/**
 * Shared data contracts for Astrid Downloader.
 *
 * These shapes are the integration boundary with the future backend. Keep them
 * transport-agnostic (plain JSON-serialisable values, ISO 8601 UTC timestamps)
 * so an HTTP or WebSocket implementation can return them unchanged.
 */

export type MediaKind = "video" | "audio";

export type Platform =
  | "youtube"
  | "vimeo"
  | "soundcloud"
  | "twitch"
  | "bandcamp"
  | "other";

/** Video quality preference. "best" lets the backend pick the top stream. */
export type VideoQuality =
  | "best"
  | "2160p"
  | "1440p"
  | "1080p"
  | "720p"
  | "480p"
  | "360p";

/** Audio output preference. "best" keeps the source codec untouched. */
export type AudioFormat = "best" | "mp3" | "m4a" | "wav" | "flac";

export type DownloadMode = "video+audio" | "video" | "audio";

export type ContainerPreference = "mp4" | "webm";

export type FileExtension =
  | "mp4"
  | "webm"
  | "mkv"
  | "m4a"
  | "mp3"
  | "opus"
  | "wav"
  | "flac";

/** One stream the source exposes, as reported by the analyzer. */
export type FormatOption = {
  /** Opaque backend identifier (for example "137" or "137+140"). */
  formatId: string;
  kind: "video" | "audio" | "muxed";
  container: FileExtension;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  bitrateKbps?: number;
  sampleRateHz?: number;
  estimatedSizeBytes?: number;
  note?: string;
};

export type MediaInfo = {
  id: string;
  sourceUrl: string;
  platform: Platform;
  title: string;
  creator: string;
  durationSec: number;
  thumbnailUrl: string;
  uploadedAt: string;
  viewCount?: number;
  description?: string;
  formats: FormatOption[];
};

/** The user's format choice, sent to the backend as preferences, not logic. */
export type FormatSelection = {
  mode: DownloadMode;
  videoQuality: VideoQuality;
  audioFormat: AudioFormat;
  container: ContainerPreference;
  /** Explicit backend format id; overrides the preferences above when set. */
  customFormatId?: string;
};

export type DownloadRequest = {
  mediaId?: string;
  sourceUrl: string;
  title: string;
  creator: string;
  thumbnailUrl: string;
  durationSec: number;
  selection: FormatSelection;
  filename?: string;
  destination: string;
};

export type DownloadStatus =
  | "queued"
  | "analyzing"
  | "downloading"
  | "paused"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type DownloadJob = {
  id: string;
  request: DownloadRequest;
  kind: MediaKind;
  extension: FileExtension;
  /** Human label such as "1080p" or "320 kbps". */
  qualityLabel: string;
  status: DownloadStatus;
  /** 0 to 1. */
  progress: number;
  downloadedBytes: number;
  totalBytes: number | null;
  speedBps: number | null;
  etaSec: number | null;
  error?: string;
  createdAt: string;
  completedAt?: string;
  filePath?: string;
};

/** Real-time events a backend pushes (WebSocket / SSE) to the client. */
export type DownloadEvent =
  | { type: "job.updated"; job: DownloadJob }
  | { type: "job.removed"; jobId: string };

export type LibraryItem = {
  id: string;
  kind: MediaKind;
  filename: string;
  title: string;
  creator: string;
  thumbnailUrl: string;
  extension: FileExtension;
  /** "2160p", "1080p" for video; "320 kbps", "Lossless" for audio. */
  qualityLabel: string;
  height?: number;
  audioBitrateKbps?: number;
  durationSec: number;
  sizeBytes: number;
  downloadedAt: string;
  filePath: string;
  sourceUrl: string;
  platform: Platform;
};

export type HistoryStatus = "completed" | "failed" | "cancelled";

export type HistoryEntry = {
  id: string;
  title: string;
  creator: string;
  thumbnailUrl: string;
  sourceUrl: string;
  platform: Platform;
  kind: MediaKind;
  status: HistoryStatus;
  durationSec: number;
  extension: FileExtension;
  qualityLabel: string;
  sizeBytes?: number;
  /** Present for completed downloads that are still in the library. */
  filePath?: string;
  error?: string;
  timestamp: string;
};

export type ActivityPoint = {
  /** Calendar day, YYYY-MM-DD. */
  date: string;
  video: number;
  audio: number;
};

export type OverviewStats = {
  totalDownloads: number;
  completed: number;
  failed: number;
  storageBytes: number;
  activity: ActivityPoint[];
};

export type AccentColor = "violet" | "indigo" | "cyan" | "emerald" | "rose";
export type InterfaceDensity = "comfortable" | "compact";

export type AppSettings = {
  general: {
    downloadLocation: string;
    defaultVideoQuality: VideoQuality;
    defaultAudioFormat: AudioFormat;
    defaultContainer: ContainerPreference;
    organizeByType: boolean;
    organizeByCreator: boolean;
    launchAtStartup: boolean;
    startMinimized: boolean;
  };
  downloads: {
    maxSimultaneous: number;
    defaultMode: DownloadMode;
    autoStart: boolean;
    clearCompletedFromQueue: boolean;
    autoRetry: boolean;
    retryAttempts: number;
  };
  appearance: {
    accent: AccentColor;
    density: InterfaceDensity;
  };
  advanced: {
    preferredFormatId: string;
    filenameTemplate: string;
    writeMetadata: boolean;
    downloadSubtitles: boolean;
    subtitleLanguage: string;
    embedThumbnail: boolean;
    embedAudioMetadata: boolean;
  };
};

export type UrlValidation =
  | { valid: true; platform: Platform }
  | { valid: false; reason: string };

export type LibraryQuery = {
  kind?: MediaKind;
  search?: string;
};
