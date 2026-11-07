import type { DownloadStatus, Platform } from "@/services/types.ts";

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(bytes: number | null | undefined, digits = 1) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) {
    return "—";
  }
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : digits)} ${BYTE_UNITS[unit]}`;
}

export function formatSpeed(bps: number | null | undefined) {
  if (!bps) return "—";
  return `${formatBytes(bps)}/s`;
}

export function formatDuration(totalSec: number | null | undefined) {
  if (totalSec === null || totalSec === undefined || totalSec < 0) return "—";
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatEta(sec: number | null | undefined) {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return "—";
  if (sec < 60) return `${Math.max(1, Math.round(sec))}s left`;
  if (sec < 3600) return `${Math.round(sec / 60)}m left`;
  return `${(sec / 3600).toFixed(1)}h left`;
}

export function formatCount(n: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact" }).format(n);
}

export const STATUS_LABEL: Record<DownloadStatus, string> = {
  queued: "Queued",
  analyzing: "Analyzing",
  downloading: "Downloading",
  paused: "Paused",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  soundcloud: "SoundCloud",
  twitch: "Twitch",
  bandcamp: "Bandcamp",
  other: "Web",
};
