import type {
  AudioFormat,
  FileExtension,
  FormatOption,
  FormatSelection,
  MediaKind,
  VideoQuality,
} from "./types.ts";

/**
 * Turns the user's format preferences into a concrete preview: file extension,
 * a human label, a size estimate, and a format identifier for the backend.
 * This is display logic only; the backend makes the final stream choice.
 */

const VIDEO_KBPS: Record<number, number> = {
  2160: 18_000,
  1440: 9_000,
  1080: 4_500,
  720: 2_500,
  480: 1_100,
  360: 600,
};

const AUDIO_KBPS: Record<AudioFormat, number> = {
  best: 256,
  mp3: 320,
  m4a: 256,
  wav: 1_411,
  flac: 900,
};

export const AUDIO_LABEL: Record<AudioFormat, string> = {
  best: "Best available",
  mp3: "320 kbps",
  m4a: "256 kbps",
  wav: "Lossless",
  flac: "Lossless",
};

export type ResolvedSelection = {
  kind: MediaKind;
  extension: FileExtension;
  qualityLabel: string;
  estimatedBytes: number | null;
  formatId: string;
  /** True when the requested quality was higher than the source offers. */
  downgraded: boolean;
};

export function qualityToHeight(quality: VideoQuality): number | null {
  return quality === "best" ? null : Number.parseInt(quality, 10);
}

export function maxVideoHeight(formats: FormatOption[]): number {
  const heights = formats
    .filter((f) => f.kind !== "audio" && f.height)
    .map((f) => f.height ?? 0);
  return heights.length ? Math.max(...heights) : 2160;
}

export function estimateBytes(kbps: number, durationSec: number) {
  return Math.round(((kbps * 1000) / 8) * durationSec);
}

function nearestKbps(height: number) {
  const known = Object.keys(VIDEO_KBPS)
    .map(Number)
    .sort((a, b) => b - a);
  const match = known.find((h) => h <= height) ?? 360;
  return VIDEO_KBPS[match] ?? 600;
}

function fromCustom(format: FormatOption, durationSec: number): ResolvedSelection {
  const kind: MediaKind = format.kind === "audio" ? "audio" : "video";
  const label =
    format.height !== undefined
      ? `${format.height}p`
      : format.bitrateKbps
        ? `${format.bitrateKbps} kbps`
        : format.container.toUpperCase();
  const kbps =
    format.bitrateKbps ?? (format.height ? nearestKbps(format.height) : 256);
  return {
    kind,
    extension: format.container,
    qualityLabel: label,
    estimatedBytes: format.estimatedSizeBytes ?? estimateBytes(kbps, durationSec),
    formatId: format.formatId,
    downgraded: false,
  };
}

export function resolveSelection(
  selection: FormatSelection,
  formats: FormatOption[],
  durationSec: number,
): ResolvedSelection {
  if (selection.customFormatId) {
    const custom = formats.find((f) => f.formatId === selection.customFormatId);
    if (custom) return fromCustom(custom, durationSec);
  }

  if (selection.mode === "audio") {
    const extension: FileExtension =
      selection.audioFormat === "best" ? "m4a" : selection.audioFormat;
    return {
      kind: "audio",
      extension,
      qualityLabel:
        selection.audioFormat === "best"
          ? "Best (256 kbps)"
          : AUDIO_LABEL[selection.audioFormat],
      estimatedBytes: estimateBytes(AUDIO_KBPS[selection.audioFormat], durationSec),
      formatId: `audio:${selection.audioFormat}`,
      downgraded: false,
    };
  }

  const available = maxVideoHeight(formats);
  const requested = qualityToHeight(selection.videoQuality);
  const height = requested === null ? available : Math.min(requested, available);
  const withAudio = selection.mode === "video+audio";
  const kbps = nearestKbps(height) + (withAudio ? 160 : 0);
  return {
    kind: "video",
    extension: selection.container,
    qualityLabel:
      selection.videoQuality === "best" ? `Best (${height}p)` : `${height}p`,
    estimatedBytes: estimateBytes(kbps, durationSec),
    formatId: `video:${height}:${selection.container}${withAudio ? "+audio:best" : ""}`,
    downgraded: requested !== null && requested > available,
  };
}
