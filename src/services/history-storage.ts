import type {
  DownloadJob,
  FileExtension,
  HistoryEntry,
  LibraryItem,
  Platform,
} from "./types.ts";

export const HISTORY_STORAGE_KEY = "mediadock.history.v1";

const PLATFORM_HOSTS: ReadonlyArray<{
  platform: Platform;
  hosts: readonly string[];
}> = [
  { platform: "youtube", hosts: ["youtube.com", "youtu.be"] },
  { platform: "vimeo", hosts: ["vimeo.com"] },
  { platform: "soundcloud", hosts: ["soundcloud.com"] },
  { platform: "twitch", hosts: ["twitch.tv"] },
  { platform: "bandcamp", hosts: ["bandcamp.com"] },
  { platform: "facebook", hosts: ["facebook.com", "fb.watch"] },
  { platform: "instagram", hosts: ["instagram.com", "instagr.am"] },
  { platform: "pinterest", hosts: ["pinterest.com", "pin.it"] },
  { platform: "tiktok", hosts: ["tiktok.com"] },
  { platform: "x", hosts: ["twitter.com", "x.com"] },
  { platform: "reddit", hosts: ["reddit.com", "redd.it"] },
  { platform: "dailymotion", hosts: ["dailymotion.com", "dai.ly"] },
];

function platformFromUrl(sourceUrl: string): Platform {
  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();
    return (
      PLATFORM_HOSTS.find(({ hosts }) =>
        hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`)),
      )?.platform ?? "other"
    );
  } catch {
    return "other";
  }
}

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
  for (const entry of remoteEntries) {
    const localEntry = byId.get(entry.id);
    byId.set(
      entry.id,
      localEntry
        ? {
            ...localEntry,
            ...entry,
            platform:
              entry.platform === "other" ? localEntry.platform : entry.platform,
            sizeBytes: entry.sizeBytes ?? localEntry.sizeBytes,
            filename: entry.filename ?? localEntry.filename,
          }
        : entry,
    );
  }
  return [...byId.values()].sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

export function mergeLibraryItems(
  remoteItems: LibraryItem[],
  localItems: LibraryItem[],
): LibraryItem[] {
  const byId = new Map<string, LibraryItem>();
  for (const item of localItems) byId.set(item.id, item);
  for (const item of remoteItems) {
    const localItem = byId.get(item.id);
    byId.set(
      item.id,
      localItem
        ? {
            ...localItem,
            ...item,
            platform: item.platform === "other" ? localItem.platform : item.platform,
            height: item.height ?? localItem.height,
            audioBitrateKbps: item.audioBitrateKbps ?? localItem.audioBitrateKbps,
          }
        : item,
    );
  }
  return [...byId.values()].sort(
    (left, right) =>
      new Date(right.downloadedAt).getTime() -
      new Date(left.downloadedAt).getTime(),
  );
}

export function libraryItemFromHistory(entry: HistoryEntry): LibraryItem | null {
  if (entry.status !== "completed") return null;

  const filename =
    entry.filename ??
    entry.filePath?.replace(/\\/g, "/").split("/").pop() ??
    `${entry.title}.${entry.extension}`;
  const extension = filename.split(".").pop()?.toLowerCase();
  const height = /^(\d{3,4})p$/i.exec(entry.qualityLabel)?.[1];
  return {
    id:
      entry.libraryId ??
      (entry.id.startsWith("hist_")
        ? `lib_${entry.id.slice("hist_".length)}`
        : `lib_${entry.id}`),
    kind: entry.kind,
    filename,
    title: entry.title,
    creator: entry.creator,
    thumbnailUrl: entry.thumbnailUrl,
    extension: (extension || entry.extension) as FileExtension,
    qualityLabel: entry.qualityLabel,
    height: height ? Number(height) : undefined,
    durationSec: entry.durationSec,
    sizeBytes: entry.sizeBytes ?? 0,
    downloadedAt: entry.timestamp,
    filePath: entry.filePath ?? "",
    sourceUrl: entry.sourceUrl,
    platform:
      entry.platform === "other"
        ? platformFromUrl(entry.sourceUrl)
        : entry.platform,
  };
}

export function localLibraryFromHistory(
  entries: HistoryEntry[] = loadLocalHistory(),
): LibraryItem[] {
  return entries
    .map(libraryItemFromHistory)
    .filter((item): item is LibraryItem => item !== null);
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
    platform: platformFromUrl(job.request.sourceUrl),
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
