import { describe, expect, it } from "vitest";
import { normalizeM3UUrl, parseM3UPlaylist } from "./m3u-playlist.ts";

const sourceUrl = "https://example.com/lists/live.m3u";

describe("normalizeM3UUrl", () => {
  it("normalizes bare hostnames to HTTPS", () => {
    expect(normalizeM3UUrl("example.com/live.m3u")).toBe(
      "https://example.com/live.m3u",
    );
  });

  it("rejects local paths and HLS stream URLs", () => {
    expect(() => normalizeM3UUrl("file:///playlist.m3u")).toThrow(
      "Only HTTP and HTTPS",
    );
    expect(() => normalizeM3UUrl("https://example.com/live.m3u8")).toThrow(
      "M3U8 is an HLS stream format",
    );
  });
});

describe("parseM3UPlaylist", () => {
  it("parses playlist/channel metadata and resolves relative stream URLs", () => {
    const playlist = parseM3UPlaylist(
      [
        "#EXTM3U name=\"News Pack\"",
        "#PLAYLIST-IMAGE:../images/cover.png",
        '#EXTINF:-1 tvg-name="News One" tvg-logo="../logos/news.png" group-title="News",News One HD',
        "streams/news-one.m3u8",
      ].join("\n"),
      sourceUrl,
    );

    expect(playlist.title).toBe("News Pack");
    expect(playlist.thumbnailUrl).toBe("https://example.com/images/cover.png");
    expect(playlist.channels).toEqual([
      {
        id: "channel-1",
        title: "News One HD",
        url: "https://example.com/lists/streams/news-one.m3u8",
        logoUrl: "https://example.com/logos/news.png",
        group: "News",
      },
    ]);
  });

  it("uses the first channel logo when playlist artwork is absent", () => {
    const playlist = parseM3UPlaylist(
      [
        "#EXTM3U",
        '#EXTINF:-1 tvg-logo="https://cdn.example.com/channel.png",Channel',
        "https://cdn.example.com/channel.m3u8",
      ].join("\n"),
      sourceUrl,
    );
    expect(playlist.title).toBe("live");
    expect(playlist.thumbnailUrl).toBe("https://cdn.example.com/channel.png");
  });

  it("supports simple M3U entries without EXTINF metadata", () => {
    const playlist = parseM3UPlaylist(
      "#EXTM3U\nhttps://media.example.com/channel-one.ts",
      sourceUrl,
    );
    expect(playlist.channels[0]).toMatchObject({
      title: "channel-one.ts",
      url: "https://media.example.com/channel-one.ts",
      logoUrl: null,
      group: null,
    });
  });

  it("does not import invalid, empty, or HLS playlists", () => {
    expect(() => parseM3UPlaylist("<html>not a playlist</html>", sourceUrl)).toThrow(
      "valid M3U playlist",
    );
    expect(() => parseM3UPlaylist("#EXTM3U-not-valid", sourceUrl)).toThrow(
      "valid M3U playlist",
    );
    expect(() => parseM3UPlaylist("#EXTM3U\n#EXTINF:-1,Missing URL", sourceUrl)).toThrow(
      "no valid channel entries",
    );
    expect(() =>
      parseM3UPlaylist(
        "#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nsegment.ts",
        sourceUrl,
      ),
    ).toThrow("not a channel catalog");
  });

  it("skips non-HTTP channel targets", () => {
    const playlist = parseM3UPlaylist(
      [
        "#EXTM3U",
        "#EXTINF:-1,Unsafe",
        "file:///private/video.mp4",
        "#EXTINF:-1,Valid",
        "https://media.example.com/live.m3u8",
      ].join("\n"),
      sourceUrl,
    );
    expect(playlist.channels).toHaveLength(1);
    expect(playlist.channels[0].title).toBe("Valid");
  });
});
