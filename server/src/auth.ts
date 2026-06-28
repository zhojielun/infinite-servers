import type Database from "better-sqlite3";
import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { getTokens, saveTokens, getPassword } from "./config.js";

export function getClientIP(request: Request): string {
  // Only trust proxy headers if behind a known reverse proxy
  // Check for Cloudflare or configured proxy header
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;

  // For local deployment, use direct connection IP
  // Only trust X-Real-IP/X-Forwarded-For if TRUST_PROXY env is set
  if (process.env.TRUST_PROXY === "true") {
    const real = request.headers.get("x-real-ip");
    if (real) return real;

    const xff = request.headers.get("x-forwarded-for");
    if (xff) return xff.split(",")[0].trim();
  }

  // fallback: try to get from socket (not available in Workers API)
  return "0.0.0.0";
}

export function isIPBanned(
  db: Database.Database,
  ip: string
): { banned: boolean; remaining?: number } {
  const now = Math.floor(Date.now() / 1000);

  // Check existing ban
  const ban = db
    .prepare(`SELECT banned_until FROM ip_bans WHERE ip = ? AND banned_until > ?`)
    .get(ip, now) as { banned_until: number } | undefined;

  if (ban) {
    return { banned: true, remaining: ban.banned_until - now };
  }

  // Count recent failures
  const hourAgo = now - 3600;
  const row = db
    .prepare(`SELECT COUNT(*) as cnt FROM login_logs WHERE ip = ? AND ts > ? AND success = 0`)
    .get(ip, hourAgo) as { cnt: number };

  if (row.cnt >= 10) {
    // Ban for 30 days
    const bannedUntil = now + 30 * 86400;
    db.prepare(`INSERT OR REPLACE INTO ip_bans (ip, banned_until) VALUES (?, ?)`).run(
      ip,
      bannedUntil
    );
    return { banned: true, remaining: 30 * 86400 };
  }

  return { banned: false, remaining: 10 - row.cnt };
}

export function verifyPassword(input: string, stored: string): boolean {
  if (!stored) return true; // No password configured

  // Check if stored is salted hash (format: salt:sha256hex)
  if (stored.includes(":")) {
    const [salt, hash] = stored.split(":");
    const computed = crypto.createHash("sha256").update(salt + input).digest("hex");
    // Timing-safe comparison
    if (computed.length !== hash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  }

  // Plaintext comparison (timing-safe)
  if (input.length !== stored.length) return false;
  return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(stored));
}

export function generateToken(dataDir: string): string {
  const token = uuidv4();
  const tokens = getTokens(dataDir);
  const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  tokens[token] = expiry;
  saveTokens(dataDir, tokens);
  return token;
}

export function validateToken(
  dataDir: string,
  token: string
): { valid: boolean; refreshed?: boolean } {
  if (!token || token === "1") return { valid: false };

  const tokens = getTokens(dataDir);
  const expiry = tokens[token];

  if (!expiry) return { valid: false };

  if (Date.now() > expiry) {
    // Token expired, remove it
    delete tokens[token];
    saveTokens(dataDir, tokens);
    return { valid: false };
  }

  // Auto-refresh if token expires within 1 day
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (expiry - Date.now() < ONE_DAY) {
    tokens[token] = Date.now() + 7 * 24 * 60 * 60 * 1000;
    saveTokens(dataDir, tokens);
    return { valid: true, refreshed: true };
  }

  return { valid: true };
}

export function invalidateToken(dataDir: string, token: string): void {
  const tokens = getTokens(dataDir);
  delete tokens[token];
  saveTokens(dataDir, tokens);
}

export function setAuthCookie(token: string): string {
  return `is_auth=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`;
}

export function clearAuthCookie(): string {
  return "is_auth=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

export function isAuthenticated(
  request: Request,
  dataDir: string
): boolean {
  // Check Authorization header
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const result = validateToken(dataDir, token);
    if (result.valid) return true;
  }

  // Check cookie
  const cookie = request.headers.get("cookie");
  if (cookie) {
    const match = cookie.match(/is_auth=([^;]+)/);
    if (match) {
      const token = match[1];
      if (token !== "1") {
        const result = validateToken(dataDir, token);
        if (result.valid) return true;
      }
    }
  }

  return false;
}

export function logLoginAttempt(
  db: Database.Database,
  ip: string,
  success: boolean
): void {
  db.prepare(
    `INSERT INTO login_logs (ip, ts, success) VALUES (?, ?, ?)`
  ).run(ip, Math.floor(Date.now() / 1000), success ? 1 : 0);
}
