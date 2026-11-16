import type {
  AppServices,
  DownloadService,
  HistoryService,
  LibraryService,
  MediaService,
  SettingsService,
  StatsService,
} from "./contracts.ts";
import { getSupabaseSession } from "../lib/supabase.ts";
import { getGuestToken } from "../lib/guest.ts";
import { ServiceError } from "./errors.ts";
import { createLocalSettingsService } from "./mock/other.ts";
import type {
  DownloadEvent,
  DownloadJob,
  FormatOption,
  HistoryEntry,
  LibraryItem,
  MediaInfo,
  OverviewStats,
  Platform,
} from "./types.ts";

const DEFAULT_API_BASE = "/api/v1";
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

function detectPlatform(host: string): Platform {
  const match = PLATFORM_HOSTS.find(({ hosts }) =>
    hosts.some((domain) => host === domain || host.endsWith(`.${domain}`)),
  );
  return match?.platform ?? "other";
}

function toApiBaseUrl() {
  const value =
    import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_BACKEND_URL;
  const normalized = typeof value === "string" ? value.trim() : "";
  if (
    import.meta.env.DEV &&
    /^https?:\/\/(?:localhost|127\.0\.0\.1):8000(?:\/|$)/i.test(normalized)
  ) {
    return DEFAULT_API_BASE;
  }
  return normalized || DEFAULT_API_BASE;
}

function urlFor(path: string) {
  const base = toApiBaseUrl().replace(/\/+$/, "");
  const clean = path.replace(/^\/+/, "");
  return `${base}/${clean}`;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  const session = await getSupabaseSession();
  if (session) return { Authorization: `Bearer ${session.access_token}` };

  const guestToken = getGuestToken();
  return guestToken ? { "X-Guest-Token": guestToken } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(urlFor(path), {
      ...init,
      headers: {
        ...(await authHeaders()),
        ...(init.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ServiceError(
        "NETWORK",
        `Cannot reach the backend at ${urlFor(path)}. Check that the backend server is running, then try again.`,
      );
    }
    throw error;
  }

  if (!response.ok) {
    let detail = "Request failed.";
    try {
      const payload = (await response.json()) as {
        detail?: string;
        message?: string;
      };
      detail = payload.detail ?? payload.message ?? detail;
    } catch {
      detail = response.statusText || detail;
    }
    if (response.status === 401) {
      detail =
        "Your session is missing or expired. Refresh the page or sign in again.";
    }
    const code =
      response.status === 404
        ? "NOT_FOUND"
        : response.status === 401 ||
            response.status === 403 ||
            response.status === 409
          ? "INVALID_STATE"
          : response.status === 422 && path === "media/analyze"
            ? "INVALID_URL"
            : response.status >= 500
              ? "UNAVAILABLE"
              : "NETWORK";
    throw new ServiceError(code, detail);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function normalizeMediaInfo(raw: Record<string, unknown>): MediaInfo {
  return {
    id: String(raw["id"] ?? ""),
    sourceUrl: String(raw["sourceUrl"] ?? ""),
    platform: String(raw["platform"] ?? "other") as MediaInfo["platform"],
    title: String(raw["title"] ?? "Untitled"),
    creator: String(raw["creator"] ?? "Unknown creator"),
    durationSec: Number(raw["durationSec"] ?? 0),
    thumbnailUrl: String(raw["thumbnailUrl"] ?? ""),
    uploadedAt: String(raw["uploadedAt"] ?? new Date().toISOString()),
    description:
      typeof raw["description"] === "string" ? raw["description"] : undefined,
    formats: Array.isArray(raw["formats"])
      ? (raw["formats"] as FormatOption[])
      : [],
  };
}

function normalizeDownloadJob(raw: Record<string, unknown>): DownloadJob {
  const request =
    typeof raw["request"] === "object" && raw["request"] !== null
      ? (raw["request"] as Record<string, unknown>)
      : {};
  return {
    id: String(raw["id"] ?? ""),
    request: {
      sourceUrl: String(request["sourceUrl"] ?? ""),
      title: String(request["title"] ?? ""),
      creator: String(request["creator"] ?? ""),
      thumbnailUrl: String(request["thumbnailUrl"] ?? ""),
      durationSec: Number(request["durationSec"] ?? 0),
      selection: (request[
        "selection"
      ] as DownloadJob["request"]["selection"]) ?? {
        mode: "video",
        videoQuality: "best",
        audioFormat: "best",
        container: "mp4",
      },
      filename:
        typeof request["filename"] === "string"
          ? request["filename"]
          : undefined,
      destination: String(request["destination"] ?? ""),
    },
    kind: String(raw["kind"] ?? "video") as DownloadJob["kind"],
    extension: String(raw["extension"] ?? "mp4") as DownloadJob["extension"],
    qualityLabel: String(raw["qualityLabel"] ?? "best"),
    priority: raw["priority"]
      ? (String(raw["priority"]) as DownloadJob["priority"])
      : undefined,
    status: String(raw["status"] ?? "queued") as DownloadJob["status"],
    progress: Number(raw["progress"] ?? 0),
    downloadedBytes: Number(raw["downloadedBytes"] ?? 0),
    totalBytes:
      raw["totalBytes"] === null || typeof raw["totalBytes"] === "undefined"
        ? null
        : Number(raw["totalBytes"]),
    speedBps:
      raw["speedBps"] === null || typeof raw["speedBps"] === "undefined"
        ? null
        : Number(raw["speedBps"]),
    etaSec:
      raw["etaSec"] === null || typeof raw["etaSec"] === "undefined"
        ? null
        : Number(raw["etaSec"]),
    error: typeof raw["error"] === "string" ? raw["error"] : undefined,
    createdAt: String(raw["createdAt"] ?? new Date().toISOString()),
    completedAt:
      typeof raw["completedAt"] === "string" ? raw["completedAt"] : undefined,
    filePath: typeof raw["filePath"] === "string" ? raw["filePath"] : undefined,
  };
}

function normalizeHistoryEntry(raw: Record<string, unknown>): HistoryEntry {
  return {
    id: String(raw["id"] ?? ""),
    title: String(raw["title"] ?? ""),
    creator: String(raw["creator"] ?? ""),
    thumbnailUrl: String(raw["thumbnailUrl"] ?? ""),
    sourceUrl: String(raw["sourceUrl"] ?? ""),
    platform: String(raw["platform"] ?? "other") as HistoryEntry["platform"],
    kind: String(raw["kind"] ?? "video") as HistoryEntry["kind"],
    status: String(raw["status"] ?? "completed") as HistoryEntry["status"],
    durationSec: Number(raw["durationSec"] ?? 0),
    extension: String(raw["extension"] ?? "mp4") as HistoryEntry["extension"],
    qualityLabel: String(raw["qualityLabel"] ?? "best"),
    sizeBytes:
      typeof raw["sizeBytes"] === "number" ? raw["sizeBytes"] : undefined,
    filePath: typeof raw["filePath"] === "string" ? raw["filePath"] : undefined,
    error: typeof raw["error"] === "string" ? raw["error"] : undefined,
    timestamp: String(raw["timestamp"] ?? new Date().toISOString()),
  };
}

function normalizeLibraryItem(raw: Record<string, unknown>): LibraryItem {
  return {
    id: String(raw["id"] ?? ""),
    kind: String(raw["kind"] ?? "video") as LibraryItem["kind"],
    filename: String(raw["filename"] ?? ""),
    title: String(raw["title"] ?? ""),
    creator: String(raw["creator"] ?? ""),
    thumbnailUrl: String(raw["thumbnailUrl"] ?? ""),
    extension: String(raw["extension"] ?? "mp4") as LibraryItem["extension"],
    qualityLabel: String(raw["qualityLabel"] ?? "best"),
    height: typeof raw["height"] === "number" ? raw["height"] : undefined,
    audioBitrateKbps:
      typeof raw["audioBitrateKbps"] === "number"
        ? raw["audioBitrateKbps"]
        : undefined,
    durationSec: Number(raw["durationSec"] ?? 0),
    sizeBytes: Number(raw["sizeBytes"] ?? 0),
    downloadedAt: String(raw["downloadedAt"] ?? new Date().toISOString()),
    filePath: String(raw["filePath"] ?? ""),
    sourceUrl: String(raw["sourceUrl"] ?? ""),
    platform: String(raw["platform"] ?? "other") as LibraryItem["platform"],
  };
}

function normalizeOverviewStats(raw: Record<string, unknown>): OverviewStats {
  const activity = Array.isArray(raw["activity"])
    ? (raw["activity"] as Array<Record<string, unknown>>)
    : [];
  return {
    totalDownloads: Number(raw["totalDownloads"] ?? 0),
    completed: Number(raw["completed"] ?? 0),
    failed: Number(raw["failed"] ?? 0),
    storageBytes: Number(raw["storageBytes"] ?? 0),
    storageQuotaBytes:
      typeof raw["storageQuotaBytes"] === "number"
        ? raw["storageQuotaBytes"]
        : null,
    storageRemainingBytes:
      typeof raw["storageRemainingBytes"] === "number"
        ? raw["storageRemainingBytes"]
        : null,
    storageDiskFreeBytes:
      typeof raw["storageDiskFreeBytes"] === "number"
        ? raw["storageDiskFreeBytes"]
        : undefined,
    activity: activity.map((point) => ({
      date: String(point["date"] ?? ""),
      video: Number(point["video"] ?? 0),
      audio: Number(point["audio"] ?? 0),
    })),
  };
}

function createHttpMediaService(): MediaService {
  return {
    validateUrl(url) {
      const value = url.trim();
      if (!value)
        return { valid: false, reason: "Paste a link to get started." };
      try {
        const parsed = new URL(
          value.startsWith("http://") || value.startsWith("https://")
            ? value
            : `https://${value}`,
        );
        if (!/https?:/.test(parsed.protocol)) {
          return {
            valid: false,
            reason: "Only web links (http or https) are supported.",
          };
        }
        const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
        const platform = detectPlatform(host);
        return { valid: true, platform } as const;
      } catch {
        return { valid: false, reason: "That doesn't look like a valid link." };
      }
    },
    async analyze(url) {
      const payload = await request<Record<string, unknown>>("media/analyze", {
        method: "POST",
        body: JSON.stringify({ url }),
        headers: { "Content-Type": "application/json" },
      });
      return normalizeMediaInfo(payload);
    },
    async getFormats(mediaId) {
      const payload = await request<Array<Record<string, unknown>>>(
        `media/${encodeURIComponent(mediaId)}/formats`,
      );
      return payload as FormatOption[];
    },
  };
}

function createHttpDownloadService(): DownloadService {
  const emit = async (listener: (event: DownloadEvent) => void) => {
    try {
      const jobs = await request<Array<Record<string, unknown>>>("downloads");
      for (const job of jobs) {
        listener({ type: "job.updated", job: normalizeDownloadJob(job) });
      }
    } catch {
      // Ignore polling failures while the backend is restarting.
    }
  };

  return {
    async list() {
      const payload =
        await request<Array<Record<string, unknown>>>("downloads");
      return payload.map((item) => normalizeDownloadJob(item));
    },
    async start(downloadRequest) {
      const payload = await request<Record<string, unknown>>("downloads", {
        method: "POST",
        body: JSON.stringify(downloadRequest),
        headers: { "Content-Type": "application/json" },
      });
      return normalizeDownloadJob(payload);
    },
    async pause(jobId) {
      const payload = await request<Record<string, unknown>>(
        `downloads/${encodeURIComponent(jobId)}/pause`,
        {
          method: "POST",
        },
      );
      return normalizeDownloadJob(payload);
    },
    async resume(jobId) {
      const payload = await request<Record<string, unknown>>(
        `downloads/${encodeURIComponent(jobId)}/resume`,
        {
          method: "POST",
        },
      );
      return normalizeDownloadJob(payload);
    },
    async cancel(jobId) {
      const payload = await request<Record<string, unknown>>(
        `downloads/${encodeURIComponent(jobId)}/cancel`,
        {
          method: "POST",
        },
      );
      return normalizeDownloadJob(payload);
    },
    async retry(jobId) {
      const payload = await request<Record<string, unknown>>(
        `downloads/${encodeURIComponent(jobId)}/retry`,
        {
          method: "POST",
        },
      );
      return normalizeDownloadJob(payload);
    },
    async remove(jobId) {
      await request(`downloads/${encodeURIComponent(jobId)}`, {
        method: "DELETE",
      });
    },
    async getProgress(jobId) {
      try {
        const payload = await request<Record<string, unknown>>(
          `downloads/${encodeURIComponent(jobId)}`,
        );
        return normalizeDownloadJob(payload);
      } catch (error) {
        if (error instanceof ServiceError && error.code === "NOT_FOUND")
          return null;
        throw error;
      }
    },
    subscribe(listener) {
      if (typeof window === "undefined") return () => undefined;
      const interval = window.setInterval(() => {
        void emit(listener);
      }, 2500);
      void emit(listener);
      return () => window.clearInterval(interval);
    },
    setMaxConcurrent() {
      return undefined;
    },
  };
}

function createHttpLibraryService(): LibraryService {
  return {
    async list(query) {
      const params = new URLSearchParams();
      if (query?.kind) params.set("kind", query.kind);
      if (query?.search) params.set("search", query.search);
      const suffix = params.size ? `?${params.toString()}` : "";
      const payload = await request<Array<Record<string, unknown>>>(
        `library${suffix}`,
      );
      return payload.map((item) => normalizeLibraryItem(item));
    },
    async remove(itemId) {
      await request(`library/${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
    },
    subscribe() {
      return () => undefined;
    },
  };
}

function createHttpHistoryService(): HistoryService {
  return {
    async list() {
      const payload = await request<Array<Record<string, unknown>>>("history");
      return payload.map((item) => normalizeHistoryEntry(item));
    },
    async remove(entryId) {
      await request(`history/${encodeURIComponent(entryId)}`, {
        method: "DELETE",
      });
    },
    async clear() {
      await request("history", { method: "DELETE" });
    },
    subscribe() {
      return () => undefined;
    },
  };
}

function createHttpStatsService(): StatsService {
  return {
    async getOverview(days) {
      const payload = await request<Record<string, unknown>>(
        `stats/overview?days=${days}`,
      );
      return normalizeOverviewStats(payload);
    },
  };
}

export function createHttpServices(): AppServices {
  return {
    media: createHttpMediaService(),
    clipboard: {
      readText: async () => {
        if (typeof navigator === "undefined" || !navigator.clipboard) {
          throw new ServiceError(
            "CLIPBOARD_UNAVAILABLE",
            "Clipboard is unavailable in this environment.",
          );
        }
        return navigator.clipboard.readText();
      },
      readSupportedUrl: async () => {
        if (typeof navigator === "undefined" || !navigator.clipboard)
          return null;
        try {
          const text = await navigator.clipboard.readText();
          return /https?:\/\//i.test(text) ? text : null;
        } catch {
          return null;
        }
      },
    },
    downloads: createHttpDownloadService(),
    library: createHttpLibraryService(),
    history: createHttpHistoryService(),
    stats: createHttpStatsService(),
    fileSystem: {
      openFile: async (path) => {
        if (typeof window === "undefined") {
          throw new ServiceError(
            "UNAVAILABLE",
            "Files can only be opened in a browser.",
          );
        }
        const preview = window.open("about:blank", "_blank");
        if (!preview) {
          throw new ServiceError(
            "UNAVAILABLE",
            "Allow pop-ups to open this media file.",
          );
        }
        preview.opener = null;
        try {
          const { ticket } = await request<{ ticket: string }>(
            "files/open-session",
            {
              method: "POST",
              body: JSON.stringify({ path }),
              headers: { "Content-Type": "application/json" },
            },
          );
          preview.location.replace(
            urlFor(`files/open/${encodeURIComponent(ticket)}`),
          );
        } catch (error) {
          preview.close();
          throw error;
        }
      },
      saveFileToDevice: async (path) => {
        if (typeof document === "undefined") {
          throw new ServiceError(
            "UNAVAILABLE",
            "Files can only be saved from a browser.",
          );
        }
        const { ticket } = await request<{ ticket: string }>(
          "files/download-session",
          {
            method: "POST",
            body: JSON.stringify({ path }),
            headers: { "Content-Type": "application/json" },
          },
        );
        const link = document.createElement("a");
        link.href = urlFor(`files/open/${encodeURIComponent(ticket)}`);
        link.download = "";
        link.rel = "noopener";
        link.hidden = true;
        document.body.append(link);
        link.click();
        link.remove();
      },
      copyPath: async (path) => {
        if (typeof navigator === "undefined" || !navigator.clipboard) {
          throw new ServiceError(
            "CLIPBOARD_UNAVAILABLE",
            "Clipboard access is not available in this browser.",
          );
        }
        try {
          await navigator.clipboard.writeText(path);
        } catch (error) {
          throw new ServiceError(
            "CLIPBOARD_UNAVAILABLE",
            error instanceof Error
              ? error.message
              : "Could not copy the file path.",
          );
        }
      },
      chooseFolder: async () => {
        throw new ServiceError(
          "UNAVAILABLE",
          "Choosing a folder is not available in the browser yet.",
        );
      },
      fileExists: async () => {
        throw new ServiceError(
          "UNAVAILABLE",
          "Checking backend-stored files is not available in the browser yet.",
        );
      },
    },
    settings: createLocalSettingsService() as SettingsService,
  };
}
