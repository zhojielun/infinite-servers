import type { Context, Next } from "hono";
import type { AppEnv } from "./types.js";
import { getClientIP } from "./auth.js";

const LIMITS = {
  write: { max: 30, window: 60 },
  read: { max: 120, window: 60 },
};

export function rateLimit(tier: "write" | "read") {
  return async (c: Context<AppEnv>, next: Next) => {
    try {
      const db = c.get("db");
      const ip = getClientIP(c.req.raw);
      const now = Math.floor(Date.now() / 1000);
      const { max, window } = LIMITS[tier];

      // Count requests in window
      const windowStart = now - window;
      const row = db
        .prepare(`SELECT COUNT(*) as cnt FROM rate_limits WHERE ip = ? AND ts > ?`)
        .get(ip, windowStart) as { cnt: number };

      if (row.cnt >= max) {
        return c.json({ error: "请求过于频繁，请稍后再试" }, 429);
      }

      // Record this request
      db.prepare(`INSERT INTO rate_limits (ip, ts) VALUES (?, ?)`).run(ip, now);

      // Probabilistic cleanup (1% chance)
      if (Math.random() < 0.01) {
        const cutoff = now - 3600;
        db.prepare(`DELETE FROM rate_limits WHERE ts < ?`).run(cutoff);
      }

      await next();
    } catch {
      // If rate_limits table is missing or any error, proceed without limiting
      await next();
    }
  };
}
