export type PlaybackMode = "auto" | "direct" | "hls";
export type MediaElementType = "audio" | "video";

export type RemoteMediaSource = {
  url: string;
  isHls: boolean;
  element: MediaElementType;
};

const AUDIO_EXTENSIONS = new Set([
  "aac",
  "flac",
  "m4a",
  "mp3",
  "oga",
  "ogg",
  "opus",
  "wav",
  "weba",
  "wma",
]);

export function prepareRemoteMediaSource(
  input: string,
  mode: PlaybackMode = "auto",
): RemoteMediaSource {
  const value = input.trim();
  if (!value) {
    throw new Error("Enter a video or stream URL.");
  }

  const explicitScheme = value.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
  if (explicitScheme && explicitScheme !== "http" && explicitScheme !== "https") {
    throw new Error(
      "Only HTTP and HTTPS links can be opened here. Use the file picker for media stored on this device.",
    );
  }

  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS media URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS media URLs are supported.");
  }

  const extension = url.pathname.split(".").pop()?.toLowerCase() ?? "";
  const isHls =
    mode === "hls" || (mode === "auto" && extension === "m3u8");
  return {
    url: url.href,
    isHls,
    element: AUDIO_EXTENSIONS.has(extension) ? "audio" : "video",
  };
}
