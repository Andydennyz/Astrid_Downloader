import type { DownloadJob, HistoryEntry } from "./types.ts";

export const HISTORY_STORAGE_KEY = "mediadock.history.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.creator === "string" &&
    typeof value.thumbnailUrl === "string" &&
    typeof value.sourceUrl === "string" &&
    typeof value.platform === "string" &&
    typeof value.kind === "string" &&
    typeof value.status === "string" &&
    typeof value.durationSec === "number" &&
    typeof value.extension === "string" &&
    typeof value.qualityLabel === "string" &&
    typeof value.timestamp === "string"
  );
}

export function loadLocalHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  if (raw === null) return [];

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    throw new Error("Saved device history is unreadable.");
  }
  if (!Array.isArray(stored) || !stored.every(isHistoryEntry)) {
    throw new Error("Saved device history has an invalid format.");
  }
  return stored;
}

export function saveLocalHistory(entries: HistoryEntry[]) {
  if (typeof window === "undefined") {
    throw new Error("Download history can only be saved in a browser.");
  }
  window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
}

export function mergeHistoryEntries(
  remoteEntries: HistoryEntry[],
  localEntries: HistoryEntry[],
) {
  const byId = new Map<string, HistoryEntry>();
  for (const entry of localEntries) byId.set(entry.id, entry);
  for (const entry of remoteEntries) byId.set(entry.id, entry);
  return [...byId.values()].sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

export function rememberLocalHistory(entry: HistoryEntry) {
  const entries = loadLocalHistory();
  saveLocalHistory(mergeHistoryEntries([], [...entries, entry]));
}

export function removeLocalHistory(entryId: string) {
  saveLocalHistory(loadLocalHistory().filter((entry) => entry.id !== entryId));
}

export function clearLocalHistory() {
  saveLocalHistory([]);
}

export function historyEntryFromJob(job: DownloadJob): HistoryEntry | null {
  if (
    job.status !== "completed" &&
    job.status !== "failed" &&
    job.status !== "cancelled"
  ) {
    return null;
  }

  const filename =
    job.request.filename ??
    job.filePath?.replace(/\\/g, "/").split("/").pop();
  return {
    id: `hist_${job.id}`,
    title: job.request.title,
    creator: job.request.creator,
    thumbnailUrl: job.request.thumbnailUrl,
    sourceUrl: job.request.sourceUrl,
    platform: "other",
    kind: job.kind,
    status: job.status,
    durationSec: job.request.durationSec,
    extension: job.extension,
    qualityLabel: job.qualityLabel,
    sizeBytes: job.totalBytes ?? (job.downloadedBytes || undefined),
    filePath: job.filePath,
    libraryId: job.status === "completed" ? `lib_${job.id}` : undefined,
    filename,
    error: job.error,
    timestamp: job.completedAt ?? job.createdAt,
  };
}
