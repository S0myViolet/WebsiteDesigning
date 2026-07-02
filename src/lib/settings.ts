import { prisma } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import type { AppSettings } from "@/lib/types";

/**
 * Resolve app settings: defaults <- env vars <- DB overrides (Setting row id=1).
 * API keys can be set via env (recommended) or via the settings page (stored in
 * the local database — convenient for the MVP, but treat the DB file as secret).
 */
export async function getSettings(): Promise<AppSettings> {
  let overrides: Partial<AppSettings> = {};
  try {
    const row = await prisma.setting.findUnique({ where: { id: 1 } });
    if (row?.json) overrides = JSON.parse(row.json) as Partial<AppSettings>;
  } catch {
    // Table may not exist yet (before `prisma db push`); fall back to defaults.
  }

  const base: AppSettings = {
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    searchApiKey: process.env.SEARCH_API_KEY || "",
    searchEngineId: process.env.SEARCH_ENGINE_ID || "",
    ...DEFAULT_SETTINGS,
  };

  const merged: AppSettings = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    (merged as unknown as Record<string, unknown>)[key] = value;
  }
  return merged;
}

/** Persist settings overrides. Empty-string API keys clear the override. */
export async function saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const row = await prisma.setting.findUnique({ where: { id: 1 } });
  let current: Partial<AppSettings> = {};
  if (row?.json) {
    try {
      current = JSON.parse(row.json) as Partial<AppSettings>;
    } catch {
      current = {};
    }
  }
  const next = { ...current, ...partial };
  await prisma.setting.upsert({
    where: { id: 1 },
    create: { id: 1, json: JSON.stringify(next) },
    update: { json: JSON.stringify(next) },
  });
  return getSettings();
}

/** Fixed placeholder returned instead of stored keys — no real characters. */
export const KEY_MASK = "••••••••";

/**
 * Settings safe to send to the browser. API keys are replaced with a fixed
 * placeholder (never any real characters); the UI drives its "configured"
 * state from the has*Key booleans.
 */
export function maskSettings(settings: AppSettings): AppSettings & {
  hasGoogleKey: boolean;
  hasOpenaiKey: boolean;
  hasSearchKey: boolean;
} {
  const mask = (v: string) => (v ? KEY_MASK : "");
  return {
    ...settings,
    googleMapsApiKey: mask(settings.googleMapsApiKey),
    openaiApiKey: mask(settings.openaiApiKey),
    searchApiKey: mask(settings.searchApiKey),
    hasGoogleKey: Boolean(settings.googleMapsApiKey),
    hasOpenaiKey: Boolean(settings.openaiApiKey),
    hasSearchKey: Boolean(settings.searchApiKey),
  };
}
