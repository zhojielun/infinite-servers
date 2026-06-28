import type Database from "better-sqlite3";
import type { GlobalConfig, HistoryRow, ServerConfig } from "./types.js";
import { getConfig, getSettings, getServers, saveSettings } from "./config.js";

function stripSecrets(data: Record<string, any>): Record<string, any> {
  const out = { ...data };
  delete out.token;
  delete out.name;
  return out;
}

export function saveServerInfo(
  db: Database.Database,
  name: string,
  info: Record<string, any>
): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO server_info (server, data, updated)
    VALUES (?, ?, ?)
  `);
  stmt.run(name, JSON.stringify(stripSecrets(info)), Math.floor(Date.now() / 1000));
}

export function saveServerStatus(
  db: Database.Database,
  dataDir: string,
  name: string,
  status: Record<string, any>
): void {
  const config = getConfig(dataDir);
  const intervalSec = Math.max(0.5, config["history-interval"] || 0.5) * 60;

  const time = status.time ? Math.floor(Number(status.time)) : Math.floor(Date.now() / 1000);
  const ts = Math.floor(time / intervalSec) * intervalSec;

  const loadRaw = Array.isArray(status.loadavg) ? status.loadavg[0] : status.loadavg;
  const load1 = loadRaw ? parseFloat(loadRaw) : null;
  const mem_pct = status.meminfo ? Number(status.meminfo.memUsedPercent) || null : null;
  const disk_pct = status.diskinfo ? Number(status.diskinfo.diskPercent) || null : null;
  const net_rx = status.netdev ? Number(status.netdev.rx) || null : null;
  const net_tx = status.netdev ? Number(status.netdev.tx) || null : null;
  const cores = status.cpuinfo?.num ? Number(status.cpuinfo.num) : 1;
  const cpu_pct = status.cpu_percent != null
    ? Number(status.cpu_percent)
    : load1 != null
      ? Math.min(100, (load1 / cores) * 100)
      : null;
  const swap_pct = status.meminfo ? Number(status.meminfo.swapPercent) || null : null;

  // Insert history (ignore duplicates)
  const insertHistory = db.prepare(`
    INSERT OR IGNORE INTO history (server, ts, load1, mem_pct, disk_pct, net_rx, net_tx, cpu_pct, swap_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertHistory.run(name, ts, load1, mem_pct, disk_pct, net_rx, net_tx, cpu_pct, swap_pct);

  // Upsert server_status
  const insertStatus = db.prepare(`
    INSERT OR REPLACE INTO server_status (server, data, updated)
    VALUES (?, ?, ?)
  `);
  insertStatus.run(name, JSON.stringify(stripSecrets(status)), time);

  // Cleanup old history (keep ~100 rows per server)
  const countStmt = db.prepare(`SELECT COUNT(*) as cnt FROM history WHERE server = ?`);
  const { cnt } = countStmt.get(name) as { cnt: number };
  if (cnt > 100) {
    const cutoff = ts - 100 * intervalSec;
    db.prepare(`DELETE FROM history WHERE server = ? AND ts < ?`).run(name, cutoff);
  }
}

export function getServerInfo(
  db: Database.Database,
  dataDir: string
): Record<string, Record<string, any>> {
  const servers = getServers(dataDir);
  const result: Record<string, Record<string, any>> = {};

  for (const [name, serverConfig] of Object.entries(servers)) {
    if (!serverConfig.token) continue;

    // Try to get from D1 cache first
    const row = db.prepare(`SELECT data FROM server_info WHERE server = ?`).get(name) as
      | { data: string }
      | undefined;

    let info: Record<string, any> = {};
    if (row) {
      try {
        info = JSON.parse(row.data);
      } catch {}
    }

    // Merge with config
    info.name = name;
    if (serverConfig.region) info.region = serverConfig.region;
    if (serverConfig.location) info.location = serverConfig.location;
    if (serverConfig.tags) info.tags = serverConfig.tags;

    // expiry / purchase_date from serverConfig (merged by getServers)
    if (serverConfig.expiry) info.expiry = serverConfig.expiry;
    if (serverConfig.purchase_date) info.purchase_date = serverConfig.purchase_date;

    result[name] = info;
  }

  return result;
}

export function getServerStatus(
  db: Database.Database,
  dataDir: string
): Record<string, Record<string, any>> {
  const servers = getServers(dataDir);
  const result: Record<string, Record<string, any>> = {};

  for (const [name, serverConfig] of Object.entries(servers)) {
    if (!serverConfig.token) continue;

    const row = db.prepare(`SELECT data FROM server_status WHERE server = ?`).get(name) as
      | { data: string }
      | undefined;

    if (row) {
      try {
        const status = JSON.parse(row.data);
        // Normalize old ip field
        if (status.ip && !status.ip4) {
          status.ip4 = status.ip;
        }
        result[name] = status;
      } catch {}
    }
  }

  return result;
}

export function getServerHistory(
  db: Database.Database,
  dataDir: string,
  name: string,
  hours: number
): HistoryRow[] {
  const config = getConfig(dataDir);
  const maxHours = (config["history-days"] || 30) * 24;
  const clampedHours = Math.min(hours, maxHours);
  const cutoff = Math.floor(Date.now() / 1000) - clampedHours * 3600;

  const rows = db
    .prepare(
      `SELECT server, ts, load1, mem_pct, disk_pct, net_rx, net_tx, cpu_pct, swap_pct
       FROM history
       WHERE server = ? AND ts >= ?
       ORDER BY ts ASC`
    )
    .all(name, cutoff) as HistoryRow[];

  return rows;
}

export function getServerAvailability(
  db: Database.Database,
  dataDir: string,
  name: string,
  days: number
): {
  overall: number;
  days: { date: number; pct: number | null; status: string }[];
  incidents: { kind: string; downMin: number; startTs: number; endTs: number | null }[];
} {
  const config = getConfig(dataDir);
  const intervalSec = Math.max(0.5, config["history-interval"] || 0.5) * 60;
  const now = Math.floor(Date.now() / 1000);
  const startTs = now - days * 86400;

  // Get all timestamps in range
  const rows = db
    .prepare(`SELECT ts FROM history WHERE server = ? AND ts >= ? ORDER BY ts ASC`)
    .all(name, startTs) as { ts: number }[];

  const timestamps = rows.map((r) => r.ts);

  // Bucket into days
  const dayBuckets: Record<number, number[]> = {};
  for (const ts of timestamps) {
    const dayStart = Math.floor(ts / 86400) * 86400;
    if (!dayBuckets[dayStart]) dayBuckets[dayStart] = [];
    dayBuckets[dayStart].push(ts);
  }

  const expectedPerDay = Math.floor(86400 / intervalSec);
  const resultDays: { date: number; pct: number | null; status: string }[] = [];
  let totalPct = 0;
  let daysWith = 0;

  for (let d = days - 1; d >= 0; d--) {
    const dayStart = Math.floor((now - d * 86400) / 86400) * 86400;
    const dayTs = dayBuckets[dayStart] || [];

    if (dayTs.length === 0) {
      resultDays.push({ date: dayStart, pct: null, status: "nodata" });
      continue;
    }

    // For current day, calculate based on elapsed time
    let effectiveExpected = expectedPerDay;
    if (dayStart + 86400 > now) {
      // Current day - use elapsed time
      const elapsed = now - dayStart;
      effectiveExpected = Math.floor(elapsed / intervalSec);
    }

    const pct = Math.min(100, effectiveExpected > 0 ? (dayTs.length / effectiveExpected) * 100 : 0);
    let status: string;
    if (pct >= 99) status = "up";
    else if (pct >= 90) status = "partial";
    else status = "down";

    resultDays.push({ date: dayStart, pct, status });
    totalPct += pct;
    daysWith++;
  }

  const overall = daysWith > 0 ? totalPct / daysWith : 0;

  // Detect incidents (gaps > 5x interval)
  const incidents: { kind: string; downMin: number; startTs: number; endTs: number | null }[] = [];
  const gapThreshold = intervalSec * 5;

  for (let i = 1; i < timestamps.length; i++) {
    const gap = timestamps[i] - timestamps[i - 1];
    if (gap > gapThreshold) {
      incidents.push({
        kind: "gap",
        downMin: Math.round(gap / 60),
        startTs: timestamps[i - 1],
        endTs: timestamps[i],
      });
    }
  }

  // Return last 10 incidents
  return {
    overall,
    days: resultDays,
    incidents: incidents.slice(-10),
  };
}

export function saveServerExpiry(
  db: Database.Database,
  dataDir: string,
  name: string,
  expiry: string
): { ok: boolean; error?: string } {
  const servers = getServers(dataDir);
  if (!servers[name]) {
    return { ok: false, error: "Server not found" };
  }

  if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
    return { ok: false, error: "Invalid date format. Use YYYY-MM-DD" };
  }

  const settings = getSettings(dataDir);
  if (!settings[name]) settings[name] = {};
  settings[name].expiry = expiry || undefined;
  saveSettings(dataDir, settings);

  return { ok: true };
}

export function saveServerPurchaseDate(
  db: Database.Database,
  dataDir: string,
  name: string,
  purchaseDate: string
): { ok: boolean; error?: string } {
  const servers = getServers(dataDir);
  if (!servers[name]) {
    return { ok: false, error: "Server not found" };
  }

  if (purchaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
    return { ok: false, error: "Invalid date format. Use YYYY-MM-DD" };
  }

  const settings = getSettings(dataDir);
  if (!settings[name]) settings[name] = {};
  settings[name].purchase_date = purchaseDate || undefined;
  saveSettings(dataDir, settings);

  return { ok: true };
}

export function getServerTraffic(
  db: Database.Database,
  dataDir: string,
  name: string
): { total_rx: number; total_tx: number; start_date: string } | null {
  const servers = getServers(dataDir);
  const serverConfig = servers[name];
  if (!serverConfig) return null;

  const now = Math.floor(Date.now() / 1000);
  let startTs: number;

  // Determine start date based on expiry
  if (serverConfig.expiry) {
    const expiryDate = new Date(serverConfig.expiry);
    const expiryTs = Math.floor(expiryDate.getTime() / 1000);
    startTs = expiryTs - 30 * 86400; // expiry - 30 days

    // Check if there's data before this date
    const firstRow = db
      .prepare(`SELECT ts FROM history WHERE server = ? ORDER BY ts ASC LIMIT 1`)
      .get(name) as { ts: number } | undefined;

    if (firstRow && firstRow.ts > startTs) {
      startTs = firstRow.ts;
    }
  } else {
    // No expiry: use first data date
    const firstRow = db
      .prepare(`SELECT ts FROM history WHERE server = ? ORDER BY ts ASC LIMIT 1`)
      .get(name) as { ts: number } | undefined;

    startTs = firstRow ? firstRow.ts : now;
  }

  // Get min/max net_rx and net_tx from start date
  const row = db
    .prepare(`
      SELECT
        MIN(net_rx) as min_rx,
        MAX(net_rx) as max_rx,
        MIN(net_tx) as min_tx,
        MAX(net_tx) as max_tx
      FROM history
      WHERE server = ? AND ts >= ? AND net_rx IS NOT NULL
    `)
    .get(name, startTs) as {
      min_rx: number | null;
      max_rx: number | null;
      min_tx: number | null;
      max_tx: number | null;
    } | undefined;

  if (!row || row.max_rx === null) {
    const startDate = new Date(now * 1000).toISOString().split("T")[0];
    return { total_rx: 0, total_tx: 0, start_date: startDate };
  }

  const total_rx = Math.max(0, (row.max_rx || 0) - (row.min_rx || 0));
  const total_tx = Math.max(0, (row.max_tx || 0) - (row.min_tx || 0));
  const startDate = new Date(startTs * 1000).toISOString().split("T")[0];

  return { total_rx, total_tx, start_date: startDate };
}
