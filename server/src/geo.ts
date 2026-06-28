import fs from "node:fs";
import path from "node:path";
import type { GeoInfo } from "./types.js";

const CACHE_FILE = "worker_geo.json";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getWorkerGeo(dataDir: string): Promise<GeoInfo | null> {
  const cachePath = path.join(dataDir, CACHE_FILE);

  // Check cache
  try {
    const raw = fs.readFileSync(cachePath, "utf-8");
    const cached: GeoInfo = JSON.parse(raw);
    if (Date.now() - cached.queriedAt < CACHE_TTL) {
      return cached;
    }
  } catch {}

  try {
    // Get public IP
    const ipRes = await fetch("https://api.ipify.org?format=json");
    const ipData = (await ipRes.json()) as { ip: string };

    // Geolocate
    const geoRes = await fetch(`https://ipinfo.io/${ipData.ip}/json`);
    const geoData = (await geoRes.json()) as Record<string, string>;

    if (!geoData.country) {
      // Fallback to cache
      try {
        return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      } catch {
        return null;
      }
    }

    const geo: GeoInfo = {
      ip: ipData.ip,
      country: geoData.country || "",
      countryCode: geoData.country || "",
      region: geoData.region || "",
      city: geoData.city || "",
      lat: parseFloat(geoData.loc?.split(",")[0] || "0"),
      lon: parseFloat(geoData.loc?.split(",")[1] || "0"),
      timezone: geoData.timezone || "",
      isp: geoData.org || "",
      queriedAt: Date.now(),
    };

    // Cache result
    try {
      fs.writeFileSync(cachePath, JSON.stringify(geo, null, 2));
    } catch {}

    return geo;
  } catch (err) {
    console.error("Geo lookup failed:", err);
    // Fallback to cache
    try {
      return JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    } catch {
      return null;
    }
  }
}
