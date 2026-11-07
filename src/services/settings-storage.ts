import type { AppSettings } from "./types.ts";

/** Frontend-side persistence for settings (localStorage). */

export const SETTINGS_STORAGE_KEY = "astrid.settings.v1";

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    downloadLocation: "~/Downloads/Astrid",
    defaultVideoQuality: "1080p",
    defaultAudioFormat: "mp3",
    defaultContainer: "mp4",
    organizeByType: true,
    organizeByCreator: false,
    launchAtStartup: false,
    startMinimized: false,
  },
  downloads: {
    maxSimultaneous: 3,
    defaultMode: "video+audio",
    autoStart: true,
    clearCompletedFromQueue: false,
    autoRetry: true,
    retryAttempts: 3,
  },
  appearance: {
    accent: "violet",
    density: "comfortable",
  },
  advanced: {
    preferredFormatId: "",
    filenameTemplate: "{title} [{quality}]",
    writeMetadata: true,
    downloadSubtitles: false,
    subtitleLanguage: "en",
    embedThumbnail: true,
    embedAudioMetadata: true,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Merge stored values over defaults so new settings keys get sane values. */
function mergeSection<T extends Record<string, unknown>>(base: T, stored: unknown): T {
  if (!isRecord(stored)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    const value = stored[key];
    if (value !== undefined && typeof value === typeof base[key]) out[key] = value;
  }
  // Every key was type-checked against the defaults above.
  return out as T;
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return DEFAULT_SETTINGS;
    return {
      general: mergeSection(DEFAULT_SETTINGS.general, parsed.general),
      downloads: mergeSection(DEFAULT_SETTINGS.downloads, parsed.downloads),
      appearance: mergeSection(DEFAULT_SETTINGS.appearance, parsed.appearance),
      advanced: mergeSection(DEFAULT_SETTINGS.advanced, parsed.advanced),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
