import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const DB_PATH = path.join(DATA_DIR, "server.db");
const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");

function init() {
  console.log("Initializing infinite-servers...\n");

  // Create data directory
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log("Created data directory:", DATA_DIR);
  }

  // Initialize SQLite database
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Run migration
  const migrationFile = path.join(MIGRATIONS_DIR, "0001_init.sql");
  if (fs.existsSync(migrationFile)) {
    const sql = fs.readFileSync(migrationFile, "utf-8");
    db.exec(sql);
    console.log("Applied migration: 0001_init.sql");
  }

  // Create default config.json if not exists
  const configPath = path.join(DATA_DIR, "config.json");
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      password: "",
      sse: false,
      interval: 5,
      "history-interval": 1,
      "history-days": 30,
      "cors-origins": "*",
      telegram: {
        enabled: false,
        bot_token: "",
        chat_id: "",
        cron: "0 0 * * *",
        offline_check: "*/5 * * * *",
        offline_threshold: 900,
        notify_offline: false,
        language: "en",
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log("Created default config.json");
  }

  // Create default servers.json if not exists
  const serversPath = path.join(DATA_DIR, "servers.json");
  if (!fs.existsSync(serversPath)) {
    const defaultServers = {
      servers: {},
    };
    fs.writeFileSync(serversPath, JSON.stringify(defaultServers, null, 2));
    console.log("Created default servers.json");
  }

  // Create default server_settings.json if not exists
  const settingsPath = path.join(DATA_DIR, "server_settings.json");
  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2));
    console.log("Created default server_settings.json");
  }

  // Create auth_tokens.json if not exists
  const tokensPath = path.join(DATA_DIR, "auth_tokens.json");
  if (!fs.existsSync(tokensPath)) {
    fs.writeFileSync(tokensPath, JSON.stringify({}, null, 2));
    console.log("Created default auth_tokens.json");
  }

  db.close();

  console.log("\nInitialization complete!");
  console.log("\nNext steps:");
  console.log("  1. Edit data/config.json to set your password (optional)");
  console.log("  2. Edit data/servers.json to add your servers");
  console.log("  3. Run 'npm run dev' to start the server");
}

init();
