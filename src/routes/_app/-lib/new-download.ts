import { sanitizeFilename } from "@/services/filename.ts";
import { maxVideoHeight, qualityToHeight } from "@/services/format-selection.ts";
import type {
  AppSettings,
  AudioFormat,
  DownloadMode,
  FormatSelection,
  MediaInfo,
  MediaKind,
  VideoQuality,
} from "@/services/index.ts";

export const VIDEO_QUALITIES: Array<{ value: VideoQuality; label: string; hint: string }> = [
  { value: "best", label: "Best", hint: "Top stream" },
  { value: "2160p", label: "2160p", hint: "4K" },
  { value: "1440p", label: "1440p", hint: "QHD" },
  { value: "1080p", label: "1080p", hint: "Full HD" },
  { value: "720p", label: "720p", hint: "HD" },
  { value: "480p", label: "480p", hint: "SD" },
  { value: "360p", label: "360p", hint: "Data saver" },
];

export const AUDIO_FORMATS: Array<{ value: AudioFormat; label: string; hint: string }> = [
  { value: "best", label: "Best", hint: "Original codec" },
  { value: "mp3", label: "MP3", hint: "320 kbps" },
  { value: "m4a", label: "M4A", hint: "256 kbps AAC" },
  { value: "wav", label: "WAV", hint: "Lossless PCM" },
  { value: "flac", label: "FLAC", hint: "Lossless" },
];

/** True when the source has any picture stream. */
export function hasVideo(info: MediaInfo) {
  return info.formats.some((f) => f.kind !== "audio");
}

/** Whether a preset can be met by the source (no upscaling). */
export function isQualityAvailable(info: MediaInfo, quality: VideoQuality) {
  if (!hasVideo(info)) return false;
  const height = qualityToHeight(quality);
  return height === null || height <= maxVideoHeight(info.formats);
}

/** The highest preset at or below the requested one that the source offers. */
export function clampQuality(info: MediaInfo, requested: VideoQuality): VideoQuality {
  if (isQualityAvailable(info, requested)) return requested;
  const max = maxVideoHeight(info.formats);
  const fallback = VIDEO_QUALITIES.find((q) => {
    const h = qualityToHeight(q.value);
    return h !== null && h <= max;
  });
  return fallback?.value ?? "best";
}

/** Starting format choice for freshly analyzed media, from the user's defaults. */
export function initialSelection(info: MediaInfo, settings: AppSettings): FormatSelection {
  const mode: DownloadMode = hasVideo(info) ? settings.downloads.defaultMode : "audio";
  const preferred = settings.advanced.preferredFormatId.trim();
  const customFormatId = info.formats.some((f) => f.formatId === preferred) ? preferred : undefined;
  return {
    mode,
    videoQuality: clampQuality(info, settings.general.defaultVideoQuality),
    audioFormat: settings.general.defaultAudioFormat,
    container: settings.general.defaultContainer,
    customFormatId,
  };
}

/** Final folder after applying the "organize by" preferences. */
export function outputFolder(
  base: string,
  kind: MediaKind,
  creator: string,
  general: Pick<AppSettings["general"], "organizeByType" | "organizeByCreator">,
) {
  const parts = [base.replace(/\/+$/, "") || "/"];
  if (general.organizeByType) parts.push(kind === "audio" ? "Audio" : "Video");
  if (general.organizeByCreator) parts.push(sanitizeFilename(creator) || "Unknown");
  return parts.join("/");
}

/** One-click demo links for trying the analyzer. */
export const SAMPLE_LINKS = [
  { label: "YouTube video", url: "https://www.youtube.com/watch?v=Ic3l4nd8K" },
  { label: "Vimeo film", url: "https://vimeo.com/762184530" },
  { label: "SoundCloud track", url: "https://soundcloud.com/lune-collective/afterglow" },
  { label: "Unavailable video", url: "https://www.youtube.com/watch?v=private-replay" },
];
