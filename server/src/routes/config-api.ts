import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { isAuthenticated, getClientIP } from "../auth.js";
import { getPassword } from "../config.js";
import { validateConfig, validateServers, sanitizeConfig } from "../validation.js";
import { logAudit } from "../audit.js";
import fs from "node:fs";
import path from "node:path";

const configApi = new Hono<AppEnv>();

// GET /api/config - 获取 config.json
configApi.get("/api/config", async (c) => {
  const dataDir = c.get("dataDir");
  const password = getPassword(dataDir);
  if (password && !isAuthenticated(c.req.raw, dataDir)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const configPath = path.join(dataDir, "config.json");
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return c.json(JSON.parse(raw));
  } catch {
    // Return empty config on error, don't leak file path
    return c.json({});
  }
});

// POST /api/config - 更新 config.json
configApi.post("/api/config", async (c) => {
  const db = c.get("db");
  const dataDir = c.get("dataDir");
  const ip = getClientIP(c.req.raw);
  const password = getPassword(dataDir);
  if (password && !isAuthenticated(c.req.raw, dataDir)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // Validate
  const validation = validateConfig(body);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  // Sanitize
  const sanitized = sanitizeConfig(body as Record<string, unknown>);

  try {
    const configPath = path.join(dataDir, "config.json");
    fs.writeFileSync(configPath, JSON.stringify(sanitized, null, 2));
    logAudit(db, ip, "config.update", "config.json");
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "Failed to save config" }, 500);
  }
});

// GET /api/servers - 获取 servers.json
configApi.get("/api/servers", async (c) => {
  const dataDir = c.get("dataDir");
  const password = getPassword(dataDir);
  if (password && !isAuthenticated(c.req.raw, dataDir)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const serversPath = path.join(dataDir, "servers.json");
  try {
    const raw = fs.readFileSync(serversPath, "utf-8");
    return c.json(JSON.parse(raw));
  } catch {
    return c.json({ servers: {} });
  }
});

// POST /api/servers - 更新 servers.json
configApi.post("/api/servers", async (c) => {
  const db = c.get("db");
  const dataDir = c.get("dataDir");
  const ip = getClientIP(c.req.raw);
  const password = getPassword(dataDir);
  if (password && !isAuthenticated(c.req.raw, dataDir)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  // Validate
  const validation = validateServers(body);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  try {
    const serversPath = path.join(dataDir, "servers.json");
    fs.writeFileSync(serversPath, JSON.stringify(body, null, 2));
    logAudit(db, ip, "servers.update", "servers.json");
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "Failed to save servers config" }, 500);
  }
});

// GET /api/server-settings - 获取 server_settings.json
configApi.get("/api/server-settings", async (c) => {
  const dataDir = c.get("dataDir");
  const password = getPassword(dataDir);
  if (password && !isAuthenticated(c.req.raw, dataDir)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const settingsPath = path.join(dataDir, "server_settings.json");
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    return c.json(JSON.parse(raw));
  } catch {
    return c.json({});
  }
});

// POST /api/server-settings - 更新 server_settings.json
configApi.post("/api/server-settings", async (c) => {
  const db = c.get("db");
  const dataDir = c.get("dataDir");
  const ip = getClientIP(c.req.raw);
  const password = getPassword(dataDir);
  if (password && !isAuthenticated(c.req.raw, dataDir)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  try {
    const settingsPath = path.join(dataDir, "server_settings.json");
    fs.writeFileSync(settingsPath, JSON.stringify(body, null, 2));
    logAudit(db, ip, "server_settings.update", "server_settings.json");
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "Failed to save server settings" }, 500);
  }
});

export default configApi;
