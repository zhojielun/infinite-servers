import { Hono } from "hono";
import { serve } from "@hono/node-server";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AppEnv } from "./types.js";
import { getConfig } from "./config.js";
import { getWorkerGeo } from "./geo.js";
import { startCronJobs } from "./cron.js";

// Routes
import loginRoute from "./routes/login.js";
import logoutRoute from "./routes/logout.js";
import serversRoute from "./routes/servers.js";
import statusRoute from "./routes/status.js";
import historyRoute from "./routes/history.js";
import availabilityRoute from "./routes/availability.js";
import pushRoute from "./routes/push.js";
import setExpiryRoute from "./routes/set-expiry.js";
import setPurchaseDateRoute from "./routes/set-purchase-date.js";
import doodleRoute from "./routes/doodle.js";
import configApi from "./routes/config-api.js";
import telegramCheckRoute from "./routes/telegram-check.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, "../data");
const DIST_DIR = path.resolve(__dirname, "../../dist");
const PORT = parseInt(process.env.PORT || "8000", 10);
const HOST = process.env.HOST || "0.0.0.0";

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize SQLite
const dbPath = path.join(DATA_DIR, "server.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables if not exist
db.exec(`
  CREATE TABLE IF NOT EXISTS server_info (
    server TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS server_status (
    server TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS history (
    server TEXT NOT NULL,
    ts INTEGER NOT NULL,
    load1 REAL,
    mem_pct REAL,
    disk_pct REAL,
    net_rx INTEGER,
    net_tx INTEGER,
    cpu_pct REAL,
    swap_pct REAL,
    PRIMARY KEY (server, ts)
  );
  CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    ts INTEGER NOT NULL,
    success INTEGER NOT NULL DEFAULT 0,
    password_hash TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_login_logs_ip_ts ON login_logs(ip, ts);
  CREATE TABLE IF NOT EXISTS ip_bans (
    ip TEXT PRIMARY KEY,
    banned_until INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    ts INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_ts ON rate_limits(ip, ts);
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT,
    ts INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_audit_logs_ts ON audit_logs(ts);
  CREATE INDEX IF NOT EXISTS idx_history_server_ts ON history(server, ts);
`);

// CORS middleware
function matchOrigin(origin: string, allowed: string[]): boolean {
  try {
    const u = new URL(origin);
    for (const pattern of allowed) {
      if (pattern.startsWith("*.")) {
        const suffix = pattern.slice(1);
        if (u.hostname.endsWith(suffix)) return true;
      } else if (u.origin === pattern) {
        return true;
      }
    }
  } catch {}
  return false;
}

// Create Hono app
const app = new Hono<AppEnv>();

// Inject env into context
app.use("*", async (c, next) => {
  c.set("db", db);
  c.set("dataDir", DATA_DIR);
  await next();
});

// Security headers middleware
app.use("*", async (c, next) => {
  await next();

  // Add security headers
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://flagcdn.com https://www.google.com data:",
    "font-src 'self'",
    "connect-src 'self'",
  ].join("; ");
  c.header("Content-Security-Policy", csp);
});

// CORS middleware
app.use("*", async (c, next) => {
  const config = getConfig(DATA_DIR);
  const origin = c.req.header("origin") || "";
  const allowedRaw = config["cors-origins"] || "*";
  const allowed = allowedRaw.split(",").map((s) => s.trim());

  const headers: Record<string, string> = {};
  if (origin && matchOrigin(origin, allowed)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  } else if (allowed.includes("*")) {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
  headers["Access-Control-Max-Age"] = "86400";

  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  await next();

  for (const [k, v] of Object.entries(headers)) {
    c.header(k, v);
  }
});

// Static file serving for assets
app.get("/assets/*", (c) => {
  const assetPath = c.req.path;
  const filePath = path.resolve(DIST_DIR, "." + assetPath);

  // Path traversal check: ensure resolved path is within DIST_DIR
  if (!filePath.startsWith(path.resolve(DIST_DIR))) {
    return c.notFound();
  }

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      ".js": "application/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    };
    return new Response(content, {
      headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream" },
    });
  }
  return c.notFound();
});

// Root route - always serve index.html (React handles auth)
app.get("/", (c) => {
  const indexPath = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, "utf-8");
    return c.html(html);
  }
  return c.json({
    name: "Infinite Servers (Local Edition)",
    version: "1.0.0",
    status: "running",
    message: "Frontend not built. Run 'npm run build:web' first.",
  });
});

// Detail page
app.get("/detail", (c) => {
  const detailPath = path.join(DIST_DIR, "detail.html");
  if (fs.existsSync(detailPath)) {
    const html = fs.readFileSync(detailPath, "utf-8");
    return c.html(html);
  }
  return c.notFound();
});

// Geo endpoint
app.get("/geo", async (c) => {
  try {
    const geo = await getWorkerGeo(DATA_DIR);
    return c.json(geo ?? { error: "geo not available" });
  } catch (e: any) {
    return c.json({ error: e?.message || "geo lookup failed" }, 500);
  }
});

// Mount routes
app.route("/", loginRoute);
app.route("/", logoutRoute);
app.route("/", serversRoute);
app.route("/", statusRoute);
app.route("/", historyRoute);
app.route("/", availabilityRoute);
app.route("/", pushRoute);
app.route("/", setExpiryRoute);
app.route("/", setPurchaseDateRoute);
app.route("/", doodleRoute);
app.route("/", configApi);
app.route("/", telegramCheckRoute);

// Start cron jobs
startCronJobs(db, DATA_DIR);

// Start server
console.log(`\nInfinite Servers (Local Edition)`);
console.log(`Server running at http://${HOST}:${PORT}`);
console.log(`Data directory: ${DATA_DIR}\n`);

serve({
  fetch: app.fetch,
  port: PORT,
  hostname: HOST,
});
