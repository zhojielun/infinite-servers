import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { isAuthenticated } from "../auth.js";
import { getPassword } from "../config.js";
import { saveServerExpiry } from "../db.js";
import { rateLimit } from "../rate-limit.js";

const setExpiry = new Hono<AppEnv>();

setExpiry.post("/set-expiry", rateLimit("write"), async (c) => {
  const db = c.get("db");
  const dataDir = c.get("dataDir");

  // Auth check
  const password = getPassword(dataDir);
  if (password && !isAuthenticated(c.req.raw, dataDir)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Parse body
  const contentType = c.req.header("content-type") || "";
  let name = "";
  let expiry = "";

  if (contentType.includes("application/json")) {
    const body = await c.req.json();
    name = body.name || "";
    expiry = body.expiry || "";
  } else {
    const body = await c.req.text();
    const params = new URLSearchParams(body);
    name = params.get("name") || "";
    expiry = params.get("expiry") || "";
  }

  if (!name) {
    return c.json({ error: "Missing server name" }, 400);
  }

  const result = saveServerExpiry(db, dataDir, name, expiry);
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }

  return c.json({ ok: true });
});

export default setExpiry;
