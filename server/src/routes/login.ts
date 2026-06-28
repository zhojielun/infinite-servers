import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import {
  getClientIP,
  isIPBanned,
  verifyPassword,
  generateToken,
  logLoginAttempt,
  setAuthCookie,
} from "../auth.js";
import { getPassword } from "../config.js";
import { rateLimit } from "../rate-limit.js";

const login = new Hono<AppEnv>();

login.post("/login", rateLimit("write"), async (c) => {
  const db = c.get("db");
  const dataDir = c.get("dataDir");
  const ip = getClientIP(c.req.raw);

  // Check IP ban
  const ban = isIPBanned(db, ip);
  if (ban.banned) {
    return c.json({ error: `IP 已被封禁，请 ${Math.ceil(ban.remaining! / 3600)} 小时后重试` }, 403);
  }

  const password = getPassword(dataDir);

  // Parse body
  const contentType = c.req.header("content-type") || "";
  let submittedPassword = "";

  if (contentType.includes("application/json")) {
    const body = await c.req.json();
    submittedPassword = body.password || "";
  } else {
    const body = await c.req.text();
    const params = new URLSearchParams(body);
    submittedPassword = params.get("password") || "";
  }

  // If no password configured, login succeeds
  if (!password) {
    const token = generateToken(dataDir);
    logLoginAttempt(db, ip, true);
    c.header("Set-Cookie", setAuthCookie(token));
    return c.json({ ok: true, token });
  }

  // Verify password
  if (verifyPassword(submittedPassword, password)) {
    const token = generateToken(dataDir);
    logLoginAttempt(db, ip, true);
    c.header("Set-Cookie", setAuthCookie(token));
    return c.json({ ok: true, token });
  }

  logLoginAttempt(db, ip, false);

  // Count remaining attempts
  const hourAgo = Math.floor(Date.now() / 1000) - 3600;
  const row = db
    .prepare(`SELECT COUNT(*) as cnt FROM login_logs WHERE ip = ? AND ts > ? AND success = 0`)
    .get(ip, hourAgo) as { cnt: number };

  const remaining = Math.max(0, 10 - row.cnt);
  return c.json({ error: `密码错误，剩余 ${remaining} 次尝试机会` }, 401);
});

export default login;
