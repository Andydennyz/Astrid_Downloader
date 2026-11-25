import { useEffect, useRef, useState } from "react";
import type { RemoteMediaSource } from "@/lib/media-player.ts";

type MediaPlayerProps = {
  source: RemoteMediaSource & { title: string };
};

export default function MediaPlayer({ source }: MediaPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const player =
      source.element === "audio" ? audioRef.current : videoRef.current;
    if (!player) return undefined;
    let active = true;
    let hls: import("hls.js").default | undefined;
    setError(null);

    const clearPlayer = () => {
      active = false;
      hls?.destroy();
      player.pause();
      player.removeAttribute("src");
      player.load();
    };

    if (!source.isHls || source.element === "audio") {
      player.src = source.url;
      return clearPlayer;
    }

    if (player.canPlayType("application/vnd.apple.mpegurl")) {
      player.src = source.url;
      return clearPlayer;
    }

    void import("hls.js")
      .then(({ default: Hls }) => {
        if (!active) return;
        if (!Hls.isSupported()) {
          setError("This device cannot play HLS/M3U8 streams in the browser.");
          return;
        }

        hls = new Hls();
        hls.on(Hls.Events.MEDIA_ATTACHED, () => hls?.loadSource(source.url));
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!active || !data.fatal) return;
          setError(
            "The stream could not be loaded. Check the URL, internet connection, and whether the stream allows cross-origin playback.",
          );
          hls?.destroy();
        });
        hls.attachMedia(player);
      })
      .catch(() => {
        if (active) {
          setError("The HLS playback engine could not be loaded.");
        }
      });

    return clearPlayer;
  }, [source]);

  return (
    <div className="space-y-3">
      {source.element === "audio" ? (
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          aria-label={source.title}
          onError={() => setError("This audio URL could not be played. Check the URL and stream availability.")}
          className="w-full"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-black">
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            aria-label={source.title}
            onError={() => setError("This video URL could not be played. Check the URL and stream availability.")}
            className="aspect-video max-h-[70vh] w-full"
          />
        </div>
      )}
      {source.element === "audio" && (
        <p className="text-sm text-muted-foreground">
          This link appears to be audio; use the player controls to listen.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
