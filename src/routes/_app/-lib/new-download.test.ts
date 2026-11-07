import { describe, expect, it } from "vitest";
import { renderFilenameTemplate, sanitizeFilename } from "@/services/filename.ts";
import { resolveSelection } from "@/services/format-selection.ts";
import { DEFAULT_SETTINGS } from "@/services/settings-storage.ts";
import type { FormatOption, MediaInfo } from "@/services/index.ts";
import { clampQuality, initialSelection, isQualityAvailable, outputFolder } from "./new-download.ts";

const video = (height: number): FormatOption => ({
  formatId: `v${height}`,
  kind: "video",
  container: "mp4",
  height,
});
const audio: FormatOption = { formatId: "a140", kind: "audio", container: "m4a", bitrateKbps: 256 };

const media = (formats: FormatOption[]): MediaInfo => ({
  id: "m1",
  sourceUrl: "https://example.com/v",
  platform: "other",
  title: "Clip",
  creator: "Maker",
  durationSec: 100,
  thumbnailUrl: "",
  uploadedAt: "2026-01-01T00:00:00.000Z",
  formats,
});

describe("quality availability", () => {
  const info = media([video(1440), video(720), audio]);

  it("blocks presets above the source maximum", () => {
    expect(isQualityAvailable(info, "2160p")).toBe(false);
    expect(isQualityAvailable(info, "1440p")).toBe(true);
    expect(isQualityAvailable(info, "best")).toBe(true);
  });

  it("clamps a too-high default to the best available preset", () => {
    expect(clampQuality(info, "2160p")).toBe("1440p");
    expect(clampQuality(info, "480p")).toBe("480p");
  });

  it("treats audio-only sources as having no video presets", () => {
    expect(isQualityAvailable(media([audio]), "best")).toBe(false);
  });
});

describe("initialSelection", () => {
  it("forces audio mode for audio-only media", () => {
    expect(initialSelection(media([audio]), DEFAULT_SETTINGS).mode).toBe("audio");
  });

  it("applies the preferred format only when the source offers it", () => {
    const withPref = {
      ...DEFAULT_SETTINGS,
      advanced: { ...DEFAULT_SETTINGS.advanced, preferredFormatId: "v720" },
    };
    expect(initialSelection(media([video(720), audio]), withPref).customFormatId).toBe("v720");
    expect(initialSelection(media([video(1080), audio]), withPref).customFormatId).toBeUndefined();
  });
});

describe("resolveSelection", () => {
  it("reports a downgrade when the source is lower than requested", () => {
    const resolved = resolveSelection(
      { mode: "video+audio", videoQuality: "2160p", audioFormat: "best", container: "webm" },
      [video(1080)],
      60,
    );
    expect(resolved).toMatchObject({ kind: "video", extension: "webm", qualityLabel: "1080p", downgraded: true });
  });

  it("uses the chosen audio format as the extension", () => {
    const resolved = resolveSelection(
      { mode: "audio", videoQuality: "best", audioFormat: "flac", container: "mp4" },
      [audio],
      60,
    );
    expect(resolved).toMatchObject({ kind: "audio", extension: "flac", qualityLabel: "Lossless" });
  });
});

describe("filenames", () => {
  it("strips characters that are invalid on common file systems", () => {
    expect(sanitizeFilename('a/b:c*?"<>|d  e')).toBe("abcd e");
  });

  it("renders template tokens and keeps unknown ones visible", () => {
    const name = renderFilenameTemplate("{creator} - {title} [{quality}] {oops}", {
      title: "Neon",
      creator: "Hiep",
      quality: "Best (2160p)",
      platform: "youtube",
    });
    expect(name).toBe("Hiep - Neon [2160p] {oops}");
  });

  it("falls back to the title when the template renders empty", () => {
    expect(renderFilenameTemplate("///", { title: "Clip", creator: "", quality: "", platform: "other" })).toBe("Clip");
  });
});

describe("outputFolder", () => {
  it("appends type and creator subfolders when enabled", () => {
    expect(
      outputFolder("~/Downloads/", "audio", "Lune: Collective", { organizeByType: true, organizeByCreator: true }),
    ).toBe("~/Downloads/Audio/Lune Collective");
  });
});
