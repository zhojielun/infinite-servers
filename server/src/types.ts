import type Database from "better-sqlite3";

// Hono context variables
export type AppEnv = {
  Variables: {
    db: Database.Database;
    dataDir: string;
  };
};

export interface LocalEnv {
  db: Database.Database;
  dataDir: string;
}

export interface ServerConfig {
  token: string;
  region?: string;
  location?: string;
  tags?: string[];
  url?: string;
  ip_mask?: string;
  ip6_mask?: string;
  expiry?: string;
  purchase_date?: string;
  expiry_notified?: string;
}

export interface ServersFile {
  servers: Record<string, ServerConfig>;
}

export interface GlobalConfig {
  password?: string;
  sse: boolean;
  interval: number;
  "history-interval": number;
  "history-days": number;
  "cors-origins": string;
  telegram?: {
    enabled: boolean;
    bot_token: string;
    chat_id: string;
    cron?: string;
    offline_check?: string;
    offline_threshold?: number;
    notify_offline?: boolean;
    language?: string;
  };
}

export interface ServerData {
  server: string;
  data: string;
  updated: number;
}

export interface HistoryRow {
  server: string;
  ts: number;
  load1: number | null;
  mem_pct: number | null;
  disk_pct: number | null;
  net_rx: number | null;
  net_tx: number | null;
  cpu_pct: number | null;
  swap_pct: number | null;
}

export interface GeoInfo {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  queriedAt: number;
}
