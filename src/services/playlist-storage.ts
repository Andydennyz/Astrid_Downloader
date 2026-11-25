import type { SavedPlaylist } from "@/lib/m3u-playlist.ts";

export const PLAYLIST_STORAGE_KEY = "mediadock.playlists.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlaylist(value: unknown): value is SavedPlaylist {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.sourceUrl === "string" &&
    (typeof value.thumbnailUrl === "string" || value.thumbnailUrl === null) &&
    typeof value.importedAt === "string" &&
    typeof value.isFavorite === "boolean" &&
    Array.isArray(value.channels) &&
    value.channels.every(
      (channel) =>
        isRecord(channel) &&
        typeof channel.id === "string" &&
        typeof channel.title === "string" &&
        typeof channel.url === "string" &&
        (typeof channel.logoUrl === "string" || channel.logoUrl === null) &&
        (typeof channel.group === "string" || channel.group === null),
    )
  );
}

export function loadPlaylists(): SavedPlaylist[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(PLAYLIST_STORAGE_KEY);
  if (raw === null) return [];

  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    throw new Error("Saved playlists are unreadable. Remove the corrupted playlist data and import again.");
  }
  if (!Array.isArray(stored) || !stored.every(isPlaylist)) {
    throw new Error("Saved playlist data is invalid and could not be loaded.");
  }
  return stored;
}

export function savePlaylists(playlists: SavedPlaylist[]) {
  if (typeof window === "undefined") {
    throw new Error("Playlists can only be saved in a browser.");
  }
  window.localStorage.setItem(PLAYLIST_STORAGE_KEY, JSON.stringify(playlists));
}
