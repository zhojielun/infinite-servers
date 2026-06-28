import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { GlobalConfig, ServersFile, ServerConfig } from "./types.js";

const DEFAULT_CONFIG: GlobalConfig = {
  sse: false,
  interval: 5,
  "history-interval": 0.5,
  "history-days": 30,
  "cors-origins": "*.pages.dev,*.workers.dev",
};

// Encryption helpers for token storage
const KEY_FILE = ".encryption_key";

function getOrCreateKey(dataDir: string): Buffer {
  const keyPath = path.join(dataDir, KEY_FILE);
  try {
    const key = fs.readFileSync(keyPath);
    if (key.length === 32) return key;
  } catch {}

  // Generate new key
  const newKey = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, newKey, { mode: 0o600 });
  return newKey;
}

function encrypt(data: string, key: Buffer): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

function decrypt(encryptedData: string, key: Buffer): string | null {
  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], "hex");
    const tag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return null;
  }
}

export function getConfig(dataDir: string): GlobalConfig {
  const configPath = path.join(dataDir, "config.json");
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const file = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...file };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function getServers(dataDir: string): Record<string, ServerConfig> {
  const serversPath = path.join(dataDir, "servers.json");
  const settingsPath = path.join(dataDir, "server_settings.json");

  let servers: Record<string, ServerConfig> = {};
  try {
    const raw = fs.readFileSync(serversPath, "utf-8");
    const file: ServersFile = JSON.parse(raw);
    servers = file.servers || {};
  } catch {
    return {};
  }

  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    const settings: Record<string, any> = JSON.parse(raw);
    for (const [name, overrides] of Object.entries(settings)) {
      if (!servers[name]) continue;
      for (const [key, val] of Object.entries(overrides)) {
        if (val !== undefined && val !== null && val !== "") {
          (servers[name] as any)[key] = val;
        }
      }
    }
  } catch {}

  return servers;
}

export function getPassword(dataDir: string): string | undefined {
  const config = getConfig(dataDir);
  return config.password || undefined;
}

export function getSettings(dataDir: string): Record<string, any> {
  const settingsPath = path.join(dataDir, "server_settings.json");
  try {
    const raw = fs.readFileSync(settingsPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveSettings(dataDir: string, settings: Record<string, any>): void {
  const settingsPath = path.join(dataDir, "server_settings.json");
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

export function getTokens(dataDir: string): Record<string, number> {
  const tokensPath = path.join(dataDir, "auth_tokens.json");
  const key = getOrCreateKey(dataDir);

  try {
    const raw = fs.readFileSync(tokensPath, "utf-8");

    // Try to decrypt (new format)
    const decrypted = decrypt(raw, key);
    if (decrypted) {
      return JSON.parse(decrypted);
    }

    // Fallback: try as plaintext (migration from old format)
    const tokens = JSON.parse(raw);
    // Re-save in encrypted format
    saveTokens(dataDir, tokens);
    return tokens;
  } catch {
    return {};
  }
}

export function saveTokens(dataDir: string, tokens: Record<string, number>): void {
  const tokensPath = path.join(dataDir, "auth_tokens.json");
  const key = getOrCreateKey(dataDir);
  const json = JSON.stringify(tokens);
  const encrypted = encrypt(json, key);
  fs.writeFileSync(tokensPath, encrypted, { mode: 0o600 });
}

export function updateServerGeo(dataDir: string, name: string, region?: string, location?: string): void {
  if (!region && !location) return;

  const serversPath = path.join(dataDir, "servers.json");
  let file: ServersFile;
  try {
    const raw = fs.readFileSync(serversPath, "utf-8");
    file = JSON.parse(raw);
  } catch {
    file = { servers: {} };
  }

  if (!file.servers[name]) return;

  let updated = false;
  if (region && file.servers[name].region !== region) {
    file.servers[name].region = region;
    updated = true;
  }
  if (location && file.servers[name].location !== location) {
    file.servers[name].location = location;
    updated = true;
  }

  if (updated) {
    fs.writeFileSync(serversPath, JSON.stringify(file, null, 2));
  }
}
