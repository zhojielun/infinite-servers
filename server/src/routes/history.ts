import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { isAuthenticated } from "../auth.js";
import { getPassword, getServers } from "../config.js";
import { getServerHistory } from "../db.js";
import { rateLimit } from "../rate-limit.js";

const history = new Hono<AppEnv>();

history.get("/history", rateLimit("read"), async (c) => {
  const db = c.get("db");
  const dataDir = c.get("dataDir");

  // Auth check
  const password = getPassword(dataDir);
  if (password && !isAuthenticated(c.req.raw, dataDir)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const server = c.req.query("server");
  const hours = parseInt(c.req.query("hours") || "24", 10);

  if (!server) {
    return c.json({ error: "Missing 'server' query parameter" }, 400);
  }

  // Check server exists
  const servers = getServers(dataDir);
  if (!servers[server]) {
    return c.json({ error: "Server not found" }, 404);
  }

  const rows = getServerHistory(db, dataDir, server, hours);
  return c.json(rows);
});

export default history;
