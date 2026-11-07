import type { MediaService } from "@/services/contracts.ts";
import { ServiceError } from "@/services/errors.ts";
import { estimateBytes } from "@/services/format-selection.ts";
import type { FormatOption, MediaInfo, Platform, UrlValidation } from "@/services/types.ts";
import { ANALYZER_SAMPLES, AUDIO_STREAMS, PLATFORM_HOSTS, VIDEO_HEIGHTS } from "./data.ts";
import { delay } from "./store.ts";

const VIDEO_KBPS: Record<number, number> = {
  2160: 18_000,
  1440: 9_000,
  1080: 4_500,
  720: 2_500,
  480: 1_100,
  360: 600,
};

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  return /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function detectPlatform(host: string): Platform {
  const clean = host.replace(/^www\./, "");
  const match = PLATFORM_HOSTS.find(({ hosts }) =>
    hosts.some((h) => clean === h || clean.endsWith(`.${h}`)),
  );
  return match?.platform ?? "other";
}

export function validateUrl(raw: string): UrlValidation {
  if (!raw.trim()) return { valid: false, reason: "Paste a link to get started." };
  let url: URL;
  try {
    url = new URL(normalizeUrl(raw));
  } catch {
    return { valid: false, reason: "That doesn't look like a valid link." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { valid: false, reason: "Only web links (http or https) are supported." };
  }
  if (!url.hostname.includes(".")) {
    return { valid: false, reason: "That doesn't look like a valid link." };
  }
  return { valid: true, platform: detectPlatform(url.hostname) };
}

/** Stable hash so the same URL always yields the same mock media. */
function hash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function buildFormats(
  durationSec: number,
  kind: "video" | "audio",
  maxHeight: number,
  hasFlac: boolean,
): FormatOption[] {
  const audio: FormatOption[] = AUDIO_STREAMS.map((s, i) => ({
    formatId: `a${140 + i}`,
    kind: "audio",
    container: s.container,
    audioCodec: s.codec,
    bitrateKbps: s.kbps,
    sampleRateHz: 48_000,
    estimatedSizeBytes: estimateBytes(s.kbps, durationSec),
  }));
  if (hasFlac) {
    audio.push({
      formatId: "a199",
      kind: "audio",
      container: "flac",
      audioCodec: "flac",
      bitrateKbps: 900,
      sampleRateHz: 96_000,
      estimatedSizeBytes: estimateBytes(900, durationSec),
      note: "Lossless master",
    });
  }
  if (kind === "audio") return audio;

  const video: FormatOption[] = VIDEO_HEIGHTS.filter((h) => h <= maxHeight).flatMap(
    (height) => {
      const kbps = VIDEO_KBPS[height] ?? 600;
      const fps = height >= 1440 ? 60 : 30;
      return [
        {
          formatId: `v${height}m`,
          kind: "video" as const,
          container: "mp4" as const,
          height,
          fps,
          videoCodec: "avc1",
          estimatedSizeBytes: estimateBytes(kbps, durationSec),
        },
        {
          formatId: `v${height}w`,
          kind: "video" as const,
          container: "webm" as const,
          height,
          fps,
          videoCodec: "vp9",
          estimatedSizeBytes: estimateBytes(kbps * 0.8, durationSec),
        },
      ];
    },
  );
  const muxed: FormatOption = {
    formatId: "m18",
    kind: "muxed",
    container: "mp4",
    height: 360,
    fps: 30,
    videoCodec: "avc1",
    audioCodec: "aac",
    estimatedSizeBytes: estimateBytes(760, durationSec),
    note: "Single file, no merge needed",
  };
  return [...video, muxed, ...audio];
}

export function createMockMediaService(): MediaService {
  const cache = new Map<string, MediaInfo>();

  return {
    validateUrl,

    async analyze(raw) {
      const check = validateUrl(raw);
      if (!check.valid) throw new ServiceError("INVALID_URL", check.reason);
      const sourceUrl = normalizeUrl(raw);
      await delay(1300 + (hash(sourceUrl) % 700));

      // Lets testers trigger the analyzer's error state on demand.
      if (/private|unavailable|fail/i.test(sourceUrl)) {
        throw new ServiceError(
          "UNAVAILABLE",
          "This media is private or unavailable in your region.",
        );
      }

      const audioPlatform = check.platform === "soundcloud" || check.platform === "bandcamp";
      const pool = ANALYZER_SAMPLES.filter((s) =>
        audioPlatform ? s.kind === "audio" : s.kind === "video",
      );
      const sample = pool[hash(sourceUrl) % pool.length] ?? ANALYZER_SAMPLES[0];
      const id = `media_${hash(sourceUrl).toString(36)}`;
      const { kind, maxHeight, hasFlac, ...rest } = sample;
      const info: MediaInfo = {
        ...rest,
        id,
        sourceUrl,
        platform: check.platform,
        formats: buildFormats(rest.durationSec, kind, maxHeight ?? 1080, hasFlac ?? false),
      };
      cache.set(id, info);
      return info;
    },

    async getFormats(mediaId) {
      await delay(150);
      const info = cache.get(mediaId);
      if (!info) throw new ServiceError("NOT_FOUND", "Media not found. Analyze the link again.");
      return info.formats;
    },
  };
}
