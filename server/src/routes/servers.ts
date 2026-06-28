import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { isAuthenticated } from "../auth.js";
import { getPassword } from "../config.js";
import { getServerInfo } from "../db.js";
import { rateLimit } from "../rate-limit.js";

const servers = new Hono<AppEnv>();

servers.get("/servers", rateLimit("read"), async (c) => {
  const db = c.get("db");
  const dataDir = c.get("dataDir");

  // Auth check
  const password = getPassword(dataDir);
  if (password && !isAuthenticated(c.req.raw, dataDir)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const info = getServerInfo(db, dataDir);
  return c.json(info);
});

export default servers;
