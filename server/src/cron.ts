import cron from "node-cron";
import type Database from "better-sqlite3";
import { getConfig, getServers, getSettings, saveSettings, updateServerGeo } from "./config.js";

const scheduledTasks: cron.ScheduledTask[] = [];

export function buildExpiryMessage(
  name: string,
  statusText: string,
  expiry: string,
  daysLeft: number,
  lang: string
): string {
  const ball = daysLeft < 0 ? "🔴" : daysLeft <= 3 ? "🟠" : "🟡";
  const isZh = lang === "zh";

  if (daysLeft < 0) {
    return isZh
      ? `${ball} 到期告警\n服务器: ${name}\n状态: ${statusText}\n到期: ${expiry}\n已过期 ${Math.abs(daysLeft)} 天`
      : `${ball} Expiry Alert\nServer: ${name}\nStatus: ${statusText}\nExpiry: ${expiry}\nExpired ${Math.abs(daysLeft)} day(s) ago`;
  } else if (daysLeft === 0) {
    return isZh
      ? `${ball} 到期告警\n服务器: ${name}\n状态: ${statusText}\n到期: ${expiry}\n今天到期！`
      : `${ball} Expiry Alert\nServer: ${name}\nStatus: ${statusText}\nExpiry: ${expiry}\nExpires today!`;
  } else {
    return isZh
      ? `${ball} 即将到期\n服务器: ${name}\n状态: ${statusText}\n到期: ${expiry}\n剩余 ${daysLeft} 天`
      : `${ball} Expiring Soon\nServer: ${name}\nStatus: ${statusText}\nExpiry: ${expiry}\n${daysLeft} day(s) left`;
  }
}

export function buildOfflineMessage(name: string, minutesAgo: number, lang: string): string {
  const isZh = lang === "zh";
  return isZh
    ? `🔴 离线告警\n服务器: ${name}\n状态: 离线\n最后在线: ${minutesAgo} 分钟前`
    : `🔴 Offline Alert\nServer: ${name}\nStatus: Offline\nLast seen: ${minutesAgo} minute(s) ago`;
}

export function startCronJobs(db: Database.Database, dataDir: string): void {
  const config = getConfig(dataDir);
  const telegram = config.telegram;

  // Expiry check cron
  const expiryCron = telegram?.cron || "0 0 * * *";
  if (cron.validate(expiryCron)) {
    scheduledTasks.push(cron.schedule(expiryCron, () => {
      runCronCheck(db, dataDir);
    }));
    console.log(`[Cron] Expiry check scheduled: ${expiryCron}`);
  } else {
    console.error(`[Cron] Invalid expiry cron: ${expiryCron}, using default 0 0 * * *`);
    scheduledTasks.push(cron.schedule("0 0 * * *", () => {
      runCronCheck(db, dataDir);
    }));
  }

  // Offline check cron
  if (telegram?.enabled && telegram?.notify_offline) {
    const offlineCron = telegram.offline_check || "*/5 * * * *";
    if (cron.validate(offlineCron)) {
      scheduledTasks.push(cron.schedule(offlineCron, () => {
        runOfflineCheck(db, dataDir);
      }));
      console.log(`[Cron] Offline check scheduled: ${offlineCron}`);
    } else {
      console.error(`[Cron] Invalid offline cron: ${offlineCron}, skipping`);
    }
  }

  // Geo recheck - daily at UTC 00:00
  scheduledTasks.push(cron.schedule("0 0 * * *", async () => {
    await recheckGeoForAllServers(db, dataDir);
  }));

  console.log("[Cron] All cron jobs started");
}

export function runCronCheck(db: Database.Database, dataDir: string): void {
  const config = getConfig(dataDir);
  const servers = getServers(dataDir);
  const settings = getSettings(dataDir);

  const telegram = config.telegram;
  if (!telegram?.enabled || !telegram.bot_token || !telegram.chat_id) {
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const today = new Date().toISOString().split("T")[0];

  for (const [name, serverConfig] of Object.entries(servers)) {
    if (!serverConfig.token || !serverConfig.expiry) continue;

    const expiryDate = new Date(serverConfig.expiry);
    const expiryTs = Math.floor(expiryDate.getTime() / 1000);
    const daysLeft = Math.ceil((expiryTs - now) / 86400);

    const statusRow = db
      .prepare(`SELECT updated FROM server_status WHERE server = ?`)
      .get(name) as { updated: number } | undefined;

    const isOnline = statusRow ? now - statusRow.updated < 900 : false;
    const statusText = isOnline ? "Online" : "Offline";

    if (daysLeft < -4 || daysLeft > 7) continue;

    const serverSettings = settings[name] || {};
    if (serverSettings.expiry_notified === today) continue;

    const lang = telegram.language || "en";
    const message = buildExpiryMessage(name, statusText, serverConfig.expiry, daysLeft, lang);
    sendTelegramMessage(telegram.bot_token, telegram.chat_id, message).catch(() => {});

    if (!settings[name]) settings[name] = {};
    settings[name].expiry_notified = today;
  }

  saveSettings(dataDir, settings);
}

function runOfflineCheck(db: Database.Database, dataDir: string): void {
  const config = getConfig(dataDir);
  const servers = getServers(dataDir);
  const settings = getSettings(dataDir);

  const telegram = config.telegram;
  if (!telegram?.enabled || !telegram.bot_token || !telegram.chat_id) {
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const today = new Date().toISOString().split("T")[0];
  const threshold = telegram.offline_threshold || 900;

  for (const [name, serverConfig] of Object.entries(servers)) {
    if (!serverConfig.token) continue;

    const statusRow = db
      .prepare(`SELECT updated FROM server_status WHERE server = ?`)
      .get(name) as { updated: number } | undefined;

    if (!statusRow) continue;

    const lastUpdate = statusRow.updated;
    const isOffline = now - lastUpdate > threshold;

    if (!isOffline) continue;

    const serverSettings = settings[name] || {};
    const offlineNotifiedKey = `offline_notified_${Math.floor(now / 86400)}`;
    if (serverSettings[offlineNotifiedKey] === today) continue;

    const minutesAgo = Math.floor((now - lastUpdate) / 60);
    const lang = telegram.language || "en";
    const message = buildOfflineMessage(name, minutesAgo, lang);

    sendTelegramMessage(telegram.bot_token, telegram.chat_id, message).catch(() => {});

    if (!settings[name]) settings[name] = {};
    settings[name][offlineNotifiedKey] = today;
  }

  saveSettings(dataDir, settings);
}

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
  }
}

async function recheckGeoForAllServers(
  db: Database.Database,
  dataDir: string
): Promise<void> {
  const servers = getServers(dataDir);
  const serverNames = Object.keys(servers);

  console.log(`[Geo] Starting daily geo recheck for ${serverNames.length} servers...`);

  for (const name of serverNames) {
    try {
      const statusRow = db
        .prepare(`SELECT data FROM server_status WHERE server = ?`)
        .get(name) as { data: string } | undefined;

      if (!statusRow) continue;

      const statusData = JSON.parse(statusRow.data);
      const ip = statusData.ip4 || statusData.ip || null;

      if (!ip) continue;

      const response = await fetch(`https://ipinfo.io/${ip}/json`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const geoData = await response.json() as {
        country?: string;
        city?: string;
      };

      const newRegion = geoData.country || null;
      const newLocation = geoData.city || null;

      if (newRegion || newLocation) {
        updateServerGeo(dataDir, name, newRegion || undefined, newLocation || undefined);
        console.log(`[Geo] Updated ${name}: region=${newRegion}, location=${newLocation}`);
      }
    } catch (err) {
      console.error(`[Geo] Failed to recheck geo for ${name}:`, err);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.log("[Geo] Daily geo recheck completed");
}
