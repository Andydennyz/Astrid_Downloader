import { describe, expect, it } from "vitest";
import { prepareRemoteMediaSource } from "./media-player.ts";

describe("remote media source", () => {
  it("normalizes direct video URLs and infers HLS from the path", () => {
    expect(prepareRemoteMediaSource("cdn.example.com/movie.mp4")).toEqual({
      url: "https://cdn.example.com/movie.mp4",
      isHls: false,
      element: "video",
    });
    expect(
      prepareRemoteMediaSource("https://cdn.example.com/live.m3u8?token=abc"),
    ).toEqual({
      url: "https://cdn.example.com/live.m3u8?token=abc",
      isHls: true,
      element: "video",
    });
  });

  it("supports audio URLs and manually selected HLS URLs", () => {
    expect(
      prepareRemoteMediaSource("https://cdn.example.com/audio", "hls"),
    ).toEqual({
      url: "https://cdn.example.com/audio",
      isHls: true,
      element: "video",
    });
    expect(prepareRemoteMediaSource("https://cdn.example.com/track.mp3").element)
      .toBe("audio");
  });

  it("rejects local paths and non-web protocols", () => {
    expect(() => prepareRemoteMediaSource("file:///storage/movie.mp4")).toThrow(
      "Use the file picker for media stored on this device.",
    );
    expect(() => prepareRemoteMediaSource("rtsp://example.com/live")).toThrow(
      "Only HTTP and HTTPS links can be opened here.",
    );
  });
});
