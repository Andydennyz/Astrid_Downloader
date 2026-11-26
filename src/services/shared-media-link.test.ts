import { describe, expect, it } from "vitest";
import { extractSharedMediaUrl } from "./shared-media-link.ts";

describe("extractSharedMediaUrl", () => {
  const isValidUrl = (url: string) =>
    url.startsWith("https://www.instagram.com/");

  it("extracts a valid media URL from shared text", () => {
    expect(
      extractSharedMediaUrl(
        "Check out this reel: https://www.instagram.com/reel/abc123/",
        isValidUrl,
      ),
    ).toBe("https://www.instagram.com/reel/abc123/");
  });

  it("removes trailing punctuation and skips unrelated links", () => {
    expect(
      extractSharedMediaUrl(
        "More info: https://example.com. Video: https://www.instagram.com/reel/abc123/)",
        isValidUrl,
      ),
    ).toBe("https://www.instagram.com/reel/abc123/");
  });

  it("returns null when the shared text contains no supported URL", () => {
    expect(extractSharedMediaUrl("Just some text", isValidUrl)).toBeNull();
  });
});
