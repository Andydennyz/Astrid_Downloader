import type {
  AppSettings,
  DownloadEvent,
  DownloadJob,
  DownloadRequest,
  FormatOption,
  HistoryEntry,
  LibraryItem,
  LibraryQuery,
  MediaInfo,
  OverviewStats,
  UrlValidation,
} from "./types.ts";

/**
 * Service contracts. The UI only talks to these types, never to a concrete
 * implementation. To connect the real backend, write an implementation of each
 * contract (HTTP + WebSocket/SSE, or a desktop IPC bridge) and register it in
 * `src/services/index.ts`.
 */

export type Unsubscribe = () => void;

export type MediaService = {
  /** Quick client-side check before calling the analyzer. */
  validateUrl: (url: string) => UrlValidation;
  /** Suggested backend endpoint: POST /media/analyze { url } */
  analyze: (url: string) => Promise<MediaInfo>;
  /** Suggested backend endpoint: GET /media/:id/formats */
  getFormats: (mediaId: string) => Promise<FormatOption[]>;
};

export type ClipboardService = {
  /** Reads raw clipboard text when the browser allows it. */
  readText: () => Promise<string>;
  /** Returns a supported media URL if the clipboard contains one, or null. */
  readSupportedUrl: () => Promise<string | null>;
};

export type DownloadService = {
  /** Suggested backend endpoint: GET /downloads */
  list: () => Promise<DownloadJob[]>;
  /** Suggested backend endpoint: POST /downloads */
  start: (request: DownloadRequest) => Promise<DownloadJob>;
  /** Suggested backend endpoint: POST /downloads/:id/pause */
  pause: (jobId: string) => Promise<DownloadJob>;
  /** Suggested backend endpoint: POST /downloads/:id/resume */
  resume: (jobId: string) => Promise<DownloadJob>;
  /** Suggested backend endpoint: POST /downloads/:id/cancel */
  cancel: (jobId: string) => Promise<DownloadJob>;
  /** Suggested backend endpoint: POST /downloads/:id/retry */
  retry: (jobId: string) => Promise<DownloadJob>;
  /** Suggested backend endpoint: DELETE /downloads/:id */
  remove: (jobId: string) => Promise<void>;
  /** Suggested backend endpoint: GET /downloads/:id */
  getProgress: (jobId: string) => Promise<DownloadJob | null>;
  /** Real-time channel. Suggested transport: WebSocket /downloads/events */
  subscribe: (listener: (event: DownloadEvent) => void) => Unsubscribe;
  /** Applies the concurrency limit from settings. */
  setMaxConcurrent: (limit: number) => void;
};

export type LibraryService = {
  /** Suggested backend endpoint: GET /library?kind=&search= */
  list: (query?: LibraryQuery) => Promise<LibraryItem[]>;
  /** Removes the library entry only; the file stays on disk. */
  remove: (itemId: string) => Promise<void>;
  /** Fires whenever the library changes (download finished, item removed). */
  subscribe: (listener: () => void) => Unsubscribe;
};

export type HistoryService = {
  /** Suggested backend endpoint: GET /history */
  list: () => Promise<HistoryEntry[]>;
  /** Suggested backend endpoint: DELETE /history/:id */
  remove: (entryId: string) => Promise<void>;
  /** Suggested backend endpoint: DELETE /history */
  clear: () => Promise<void>;
  subscribe: (listener: () => void) => Unsubscribe;
};

export type StatsService = {
  /** Suggested backend endpoint: GET /stats/overview?days= */
  getOverview: (days: number) => Promise<OverviewStats>;
};

/** Local filesystem bridge. A desktop shell (Tauri, Electron, native) implements this. */
export type FileSystemService = {
  openFile: (path: string) => Promise<void>;
  revealInFolder: (path: string) => Promise<void>;
  copyPath: (path: string) => Promise<void>;
  /** Opens a native folder picker. Resolves null when dismissed. */
  chooseFolder: (current: string) => Promise<string | null>;
  fileExists: (path: string) => Promise<boolean>;
};

export type SettingsService = {
  get: () => Promise<AppSettings>;
  update: (next: AppSettings) => Promise<AppSettings>;
  reset: () => Promise<AppSettings>;
};

export type AppServices = {
  media: MediaService;
  clipboard: ClipboardService;
  downloads: DownloadService;
  library: LibraryService;
  history: HistoryService;
  stats: StatsService;
  fileSystem: FileSystemService;
  settings: SettingsService;
};
