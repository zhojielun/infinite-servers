import { Hono } from "hono";
import type { AppEnv } from "../types.js";
import { getConfig, getServers, getSettings, saveSettings } from "../config.js";
import { buildExpiryMessage } from "../cron.js";

const telegramCheck = new Hono<AppEnv>();

telegramCheck.post("/api/telegram-check", async (c) => {
  try {
    const dataDir = c.get("dataDir");
    const config = getConfig(dataDir);
    const servers = getServers(dataDir);
    const settings = getSettings(dataDir);

    const telegram = config.telegram;
    if (!telegram?.enabled || !telegram.bot_token || !telegram.chat_id) {
      return c.json({ ok: false, error: "Telegram not configured" }, 400);
    }

    const now = Math.floor(Date.now() / 1000);
    const cleared: string[] = [];

    for (const [name, serverConfig] of Object.entries(servers)) {
      if (!serverConfig.token || !serverConfig.expiry) continue;

      const expiryDate = new Date(serverConfig.expiry);
      const expiryTs = Math.floor(expiryDate.getTime() / 1000);
      const daysLeft = Math.ceil((expiryTs - now) / 86400);

      if (daysLeft < -4 || daysLeft > 7) continue;

      const serverSettings = settings[name] || {};
      if (serverSettings.expiry_notified) {
        delete serverSettings.expiry_notified;
        cleared.push(name);
      }
    }

    saveSettings(dataDir, settings);

    const url = `https://api.telegram.org/bot${telegram.bot_token}/sendMessage`;
    let sent = 0;
    let failed = 0;

    for (const [name, serverConfig] of Object.entries(servers)) {
      if (!serverConfig.token || !serverConfig.expiry) continue;

      const expiryDate = new Date(serverConfig.expiry);
      const expiryTs = Math.floor(expiryDate.getTime() / 1000);
      const daysLeft = Math.ceil((expiryTs - now) / 86400);

      if (daysLeft < -4 || daysLeft > 7) continue;

      const statusRow = c.get("db")
        .prepare(`SELECT updated FROM server_status WHERE server = ?`)
        .get(name) as { updated: number } | undefined;
      const isOnline = statusRow ? now - statusRow.updated < 900 : false;
      const statusText = isOnline ? "Online" : "Offline";
      const lang = telegram.language || "en";
      const message = buildExpiryMessage(name, statusText, serverConfig.expiry, daysLeft, lang);

      try {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: telegram.chat_id, text: message }),
          signal: AbortSignal.timeout(10000),
        });
        sent++;
      } catch (err) {
        failed++;
        console.error(`[TelegramCheck] Failed to send for ${name}:`, err);
      }
    }

    return c.json({ ok: true, cleared, sent, failed });
  } catch (err) {
    console.error("[TelegramCheck] Error:", err);
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

export default telegramCheck;
