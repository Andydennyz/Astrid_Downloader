import { beforeEach, describe, expect, it } from "vitest";
import type { SavedPlaylist } from "@/lib/m3u-playlist.ts";
import {
  loadPlaylists,
  PLAYLIST_STORAGE_KEY,
  savePlaylists,
} from "./playlist-storage.ts";

const playlist: SavedPlaylist = {
  id: "playlist-1",
  title: "News",
  sourceUrl: "https://example.com/news.m3u",
  thumbnailUrl: null,
  importedAt: "2026-11-25T00:00:00.000Z",
  isFavorite: true,
  channels: [
    {
      id: "channel-1",
      title: "News One",
      url: "https://example.com/news.m3u8",
      logoUrl: null,
      group: null,
    },
  ],
};

describe("playlist storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves and reloads playlist metadata, artwork, channels, and favorites", () => {
    savePlaylists([playlist]);
    expect(loadPlaylists()).toEqual([playlist]);
  });

  it("reports corrupted saved data instead of silently discarding it", () => {
    window.localStorage.setItem(PLAYLIST_STORAGE_KEY, "{");
    expect(() => loadPlaylists()).toThrow("Saved playlists are unreadable");
  });
});
