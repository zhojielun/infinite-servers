import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { isAuthenticated, validateToken } from "../auth.js";
import { getPassword, getConfig, getServers } from "../config.js";
import { getServerStatus, getServerTraffic } from "../db.js";
import { rateLimit } from "../rate-limit.js";

const status = new Hono<AppEnv>();

status.get("/status", rateLimit("read"), async (c) => {
  const db = c.get("db");
  const dataDir = c.get("dataDir");

  // Auth check
  const password = getPassword(dataDir);
  const tokenParam = c.req.query("token");

  if (password && !isAuthenticated(c.req.raw, dataDir)) {
    if (!tokenParam) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const tokenResult = validateToken(dataDir, tokenParam);
    if (!tokenResult.valid) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }

  const config = getConfig(dataDir);
  const sseMode = c.req.query("sse") === "1";

  if (sseMode && config.sse) {
    // SSE mode
    const interval = Math.max(1, config.interval || 5);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const send = () => {
          const statusData = getServerStatus(db, dataDir);
          const data = `data: ${JSON.stringify(statusData)}\n\n`;
          controller.enqueue(encoder.encode(data));
        };

        send(); // Initial send

        const timer = setInterval(send, interval * 1000);

        // Cleanup on disconnect
        c.req.raw.signal?.addEventListener("abort", () => {
          clearInterval(timer);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Regular JSON mode
  const statusData = getServerStatus(db, dataDir);
  return c.json(statusData);
});

// GET /traffic - 获取所有服务器的流量统计
status.get("/traffic", rateLimit("read"), async (c) => {
  const db = c.get("db");
  const dataDir = c.get("dataDir");

  // Auth check
  const password = getPassword(dataDir);
  if (password && !isAuthenticated(c.req.raw, dataDir)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const servers = getServers(dataDir);
  const result: Record<string, any> = {};

  for (const name of Object.keys(servers)) {
    const traffic = getServerTraffic(db, dataDir, name);
    if (traffic) {
      result[name] = traffic;
    }
  }

  return c.json(result);
});

export default status;
