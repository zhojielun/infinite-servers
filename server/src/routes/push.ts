import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getServers, updateServerGeo } from "../config.js";
import { saveServerInfo, saveServerStatus } from "../db.js";
import { rateLimit } from "../rate-limit.js";

const push = new Hono<AppEnv>();

function unflattenFields(body: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === "name" || k === "token") continue;
    const m = k.match(/^(\w+)\[(\w+)\]$/);
    if (m) {
      const [, parent, child] = m;
      if (!result[parent]) result[parent] = {};
      (result[parent] as Record<string, unknown>)[child] = v;
    } else {
      result[k] = v;
    }
  }
  return result;
}

push.post("/push", rateLimit("write"), async (c) => {
  const db = c.get("db");
  const dataDir = c.get("dataDir");

  const body = await c.req.parseBody();
  const name = body.name as string;
  const token = body.token as string;

  if (!name || !token) {
    return c.json({ error: "Missing server name or token" }, 400);
  }

  const servers = getServers(dataDir);
  if (!servers[name] || servers[name].token !== token) {
    return c.json({ error: "Invalid token" }, 403);
  }

  const data = unflattenFields(body as Record<string, string>);

  // Auto-update region/location from agent
  const region = body.region as string | undefined;
  const location = body.location as string | undefined;
  if (region || location) {
    updateServerGeo(dataDir, name, region, location);
  }

  if (body.time) {
    data.time = Number(body.time);
    saveServerStatus(db, dataDir, name, data);
  } else {
    saveServerInfo(db, name, data);
  }

  return c.json({ ok: true });
});

export default push;
