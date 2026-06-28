import type { GlobalConfig, ServersFile } from "./types.js";

const VALID_CONFIG_KEYS = [
  "password", "sse", "interval", "history-interval", "history-days",
  "cors-origins", "telegram",
];

const VALID_SERVER_FIELDS = [
  "token", "region", "location", "tags", "ip_mask", "ip6_mask",
  "expiry", "purchase_date", "expiry_notified",
];

const VALID_TELEGRAM_FIELDS = ["enabled", "bot_token", "chat_id", "cron", "offline_check", "offline_threshold", "notify_offline", "language"];

export function validateConfig(data: unknown): { valid: boolean; error?: string } {
  if (typeof data !== "object" || data === null) {
    return { valid: false, error: "Config must be an object" };
  }

  const obj = data as Record<string, unknown>;

  // Check for unknown keys
  for (const key of Object.keys(obj)) {
    if (!VALID_CONFIG_KEYS.includes(key)) {
      return { valid: false, error: `Unknown config key: ${key}` };
    }
  }

  // Validate specific fields
  if (obj.password !== undefined && typeof obj.password !== "string") {
    return { valid: false, error: "password must be a string" };
  }
  if (obj.sse !== undefined && typeof obj.sse !== "boolean") {
    return { valid: false, error: "sse must be a boolean" };
  }
  if (obj.interval !== undefined) {
    const v = Number(obj.interval);
    if (isNaN(v) || v < 1 || v > 3600) {
      return { valid: false, error: "interval must be between 1 and 3600" };
    }
  }
  if (obj["history-interval"] !== undefined) {
    const v = Number(obj["history-interval"]);
    if (isNaN(v) || v < 0.5 || v > 1440) {
      return { valid: false, error: "history-interval must be between 0.5 and 1440" };
    }
  }
  if (obj["history-days"] !== undefined) {
    const v = Number(obj["history-days"]);
    if (isNaN(v) || v < 1 || v > 365) {
      return { valid: false, error: "history-days must be between 1 and 365" };
    }
  }
  if (obj["cors-origins"] !== undefined && typeof obj["cors-origins"] !== "string") {
    return { valid: false, error: "cors-origins must be a string" };
  }
  if (obj.telegram !== undefined) {
    if (typeof obj.telegram !== "object" || obj.telegram === null) {
      return { valid: false, error: "telegram must be an object" };
    }
    const tg = obj.telegram as Record<string, unknown>;
    for (const key of Object.keys(tg)) {
      if (!VALID_TELEGRAM_FIELDS.includes(key)) {
        return { valid: false, error: `Unknown telegram key: ${key}` };
      }
    }
  }

  return { valid: true };
}

export function validateServers(data: unknown): { valid: boolean; error?: string } {
  if (typeof data !== "object" || data === null) {
    return { valid: false, error: "Servers config must be an object" };
  }

  const obj = data as Record<string, unknown>;

  if (obj.servers !== undefined) {
    if (typeof obj.servers !== "object" || obj.servers === null) {
      return { valid: false, error: "servers must be an object" };
    }

    const servers = obj.servers as Record<string, unknown>;
    for (const [name, serverData] of Object.entries(servers)) {
      if (typeof serverData !== "object" || serverData === null) {
        return { valid: false, error: `Server "${name}" must be an object` };
      }

      const server = serverData as Record<string, unknown>;

      // Validate server name (alphanumeric, hyphens, underscores, spaces)
      if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
        return { valid: false, error: `Invalid server name: "${name}"` };
      }

      // Check for unknown keys
      for (const key of Object.keys(server)) {
        if (!VALID_SERVER_FIELDS.includes(key)) {
          return { valid: false, error: `Unknown field "${key}" in server "${name}"` };
        }
      }

      // Validate token
      if (server.token !== undefined) {
        if (typeof server.token !== "string" || server.token.length < 8) {
          return { valid: false, error: `Token for "${name}" must be at least 8 characters` };
        }
      }

      // Validate expiry date format
      if (server.expiry !== undefined && server.expiry !== "") {
        if (typeof server.expiry !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(server.expiry)) {
          return { valid: false, error: `Expiry for "${name}" must be YYYY-MM-DD format` };
        }
      }

      // Validate tags array
      if (server.tags !== undefined) {
        if (!Array.isArray(server.tags)) {
          return { valid: false, error: `Tags for "${name}" must be an array` };
        }
        for (const tag of server.tags) {
          if (typeof tag !== "string") {
            return { valid: false, error: `Tags for "${name}" must be strings` };
          }
        }
      }
    }
  }

  return { valid: true };
}

// Sanitize config: remove dangerous fields
export function sanitizeConfig(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const key of VALID_CONFIG_KEYS) {
    if (key in data) {
      sanitized[key] = data[key];
    }
  }

  // Sanitize telegram
  if (sanitized.telegram && typeof sanitized.telegram === "object") {
    const tg = sanitized.telegram as Record<string, unknown>;
    const cleanTg: Record<string, unknown> = {};
    for (const key of VALID_TELEGRAM_FIELDS) {
      if (key in tg) cleanTg[key] = tg[key];
    }
    sanitized.telegram = cleanTg;
  }

  return sanitized;
}
