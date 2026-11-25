export type PlaylistChannel = {
  id: string;
  title: string;
  url: string;
  logoUrl: string | null;
  group: string | null;
};

export type ParsedPlaylist = {
  title: string;
  sourceUrl: string;
  thumbnailUrl: string | null;
  channels: PlaylistChannel[];
};

export type SavedPlaylist = ParsedPlaylist & {
  id: string;
  importedAt: string;
  isFavorite: boolean;
};

const MAX_PLAYLIST_CHARACTERS = 5 * 1024 * 1024;
const MAX_CHANNELS = 10_000;

function parseAttributes(value: string) {
  const attributes: Record<string, string> = {};
  const pattern = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
  for (const match of value.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] =
      match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function resolveHttpUrl(value: string | undefined, baseUrl: string) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim(), baseUrl);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function playlistFilename(sourceUrl: string) {
  const url = new URL(sourceUrl);
  const filename = url.pathname.split("/").filter(Boolean).pop();
  if (!filename) return url.hostname;
  try {
    return decodeURIComponent(filename).replace(/\.m3u$/i, "") || url.hostname;
  } catch {
    return filename.replace(/\.m3u$/i, "") || url.hostname;
  }
}

function splitExtinf(value: string) {
  let quoted = false;
  let quote = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === '"' || character === "'") && (!quoted || character === quote)) {
      quoted = !quoted;
      quote = quoted ? character : "";
    } else if (character === "," && !quoted) {
      return {
        attributesText: value.slice(0, index),
        displayTitle: value.slice(index + 1).trim(),
      };
    }
  }
  return { attributesText: value, displayTitle: "" };
}

export function normalizeM3UUrl(input: string) {
  const value = input.trim();
  if (!value) throw new Error("Enter an M3U playlist URL.");

  const explicitScheme = value.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
  if (explicitScheme && explicitScheme !== "http" && explicitScheme !== "https") {
    throw new Error("Only HTTP and HTTPS M3U playlist URLs are supported.");
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS M3U playlist URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS M3U playlist URLs are supported.");
  }
  if (/\.m3u8$/i.test(url.pathname)) {
    throw new Error(
      "M3U8 is an HLS stream format. Open it in Direct Player; this page imports channel-style M3U playlists.",
    );
  }
  return url.href;
}

export function parseM3UPlaylist(
  content: string,
  sourceUrl: string,
): ParsedPlaylist {
  if (content.length > MAX_PLAYLIST_CHARACTERS) {
    throw new Error("This playlist is too large to import (maximum 5 MB).");
  }

  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim().length > 0);
  const header = lines[headerIndex]?.trim() ?? "";
  if (!/^#EXTM3U(?:\s|$)/.test(header)) {
    throw new Error("This link did not return a valid M3U playlist.");
  }
  if (lines.some((line) => line.trim().startsWith("#EXT-X-"))) {
    throw new Error(
      "This is an HLS stream playlist, not a channel catalog. Open it in Direct Player.",
    );
  }

  const headerAttributes = parseAttributes(header.slice("#EXTM3U".length));
  let title = headerAttributes.name?.trim() || "";
  let playlistImage = resolveHttpUrl(
    headerAttributes["tvg-logo"] ?? headerAttributes.logo ?? headerAttributes.image,
    sourceUrl,
  );
  let pending:
    | {
        title: string;
        logoUrl: string | null;
        group: string | null;
      }
    | undefined;
  let currentGroup: string | null = null;
  const channels: PlaylistChannel[] = [];

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    if (line.startsWith("#PLAYLIST:")) {
      title = line.slice("#PLAYLIST:".length).trim() || title;
      continue;
    }
    if (line.startsWith("#PLAYLIST-IMAGE:") || line.startsWith("#EXTIMG:")) {
      playlistImage =
        resolveHttpUrl(line.slice(line.indexOf(":") + 1), sourceUrl) ?? playlistImage;
      continue;
    }
    if (line.startsWith("#EXTGRP:")) {
      currentGroup = line.slice("#EXTGRP:".length).trim() || null;
      continue;
    }
    if (line.startsWith("#EXTINF:")) {
      const { attributesText, displayTitle } = splitExtinf(
        line.slice("#EXTINF:".length),
      );
      const attributes = parseAttributes(attributesText);
      pending = {
        title:
          displayTitle ||
          attributes["tvg-name"] ||
          attributes["tvg-id"] ||
          "",
        logoUrl: resolveHttpUrl(attributes["tvg-logo"], sourceUrl),
        group: attributes["group-title"]?.trim() || currentGroup,
      };
      continue;
    }
    if (line.startsWith("#")) continue;

    const channelUrl = resolveHttpUrl(line, sourceUrl);
    if (channelUrl) {
      const channelTitle =
        pending?.title ||
        decodeURIComponentSafe(new URL(channelUrl).pathname.split("/").pop() ?? "") ||
        channelUrl;
      channels.push({
        id: `channel-${channels.length + 1}`,
        title: channelTitle,
        url: channelUrl,
        logoUrl: pending?.logoUrl ?? null,
        group: pending?.group ?? currentGroup,
      });
      if (channels.length > MAX_CHANNELS) {
        throw new Error("This playlist contains too many channels (maximum 10,000).");
      }
    }
    pending = undefined;
  }

  if (channels.length === 0) {
    throw new Error("This M3U playlist contains no valid channel entries.");
  }
  const fallbackLogo = channels.find((channel) => channel.logoUrl)?.logoUrl ?? null;
  return {
    title: title || playlistFilename(sourceUrl),
    sourceUrl,
    thumbnailUrl: playlistImage ?? fallbackLogo,
    channels,
  };
}

function decodeURIComponentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
