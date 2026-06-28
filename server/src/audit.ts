import type Database from "better-sqlite3";

export function logAudit(
  db: Database.Database,
  ip: string,
  action: string,
  target?: string
): void {
  db.prepare(
    `INSERT INTO audit_logs (ip, action, target, ts) VALUES (?, ?, ?, ?)`
  ).run(ip, action, target || null, Math.floor(Date.now() / 1000));
}

export function getAuditLogs(
  db: Database.Database,
  limit: number = 100
): { id: number; ip: string; action: string; target: string | null; ts: number }[] {
  return db
    .prepare(`SELECT * FROM audit_logs ORDER BY ts DESC LIMIT ?`)
    .all(limit) as { id: number; ip: string; action: string; target: string | null; ts: number }[];
}
