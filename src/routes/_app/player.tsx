import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileVideo, Link2, Play, X } from "lucide-react";
import { PageContainer, Panel, PanelHeader } from "@/components/layout.tsx";
import MediaPlayer from "@/components/media-player.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  prepareRemoteMediaSource,
  type PlaybackMode,
  type RemoteMediaSource,
} from "@/lib/media-player.ts";

type PlayerSource = RemoteMediaSource & {
  title: string;
  isLocal: boolean;
};

export const Route = createFileRoute("/_app/player")({
  head: () => ({ meta: [{ title: "Direct Player · MediaDock" }] }),
  component: DirectPlayerPage,
});

function DirectPlayerPage() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<PlaybackMode>("auto");
  const [source, setSource] = useState<PlayerSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!source?.isLocal) return undefined;
    const localUrl = source.url;
    return () => URL.revokeObjectURL(localUrl);
  }, [source]);

  const playUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const prepared = prepareRemoteMediaSource(url, mode);
      const parsed = new URL(prepared.url);
      const title = parsed.pathname.split("/").filter(Boolean).pop() ?? parsed.hostname;
      setSource({ ...prepared, title, isLocal: false });
      setUrl(prepared.url);
      setError(null);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not open this media URL.",
      );
    }
  };

  const openLocalFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setSource({
      url: objectUrl,
      title: file.name,
      isHls: false,
      element: file.type.startsWith("audio/") ? "audio" : "video",
      isLocal: true,
    });
    setError(null);
  };

  return (
    <PageContainer className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <div>
        <p className="text-sm text-muted-foreground">Direct playback</p>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Play a video or stream
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Open a direct HTTP(S) media link, an HLS/M3U8 stream, or choose a media
          file from this device. Webpage links (such as social-site watch pages),
          DRM-protected streams, and RTSP are not direct-playable here.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title="Open media"
          description="Paste a direct media URL, or choose a local file."
        />
        <div className="space-y-4 px-5 pb-5">
          <form onSubmit={playUrl} className="space-y-3">
            <label htmlFor="media-url" className="text-sm font-medium">
              Video or stream URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="media-url"
                  type="text"
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/video.mp4 or /live.m3u8"
                  className="h-11 w-full rounded-xl border border-border bg-background pr-3 pl-10 text-sm outline-none focus:border-primary"
                />
              </div>
              <select
                aria-label="Stream format"
                value={mode}
                onChange={(event) => setMode(event.target.value as PlaybackMode)}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="auto">Auto detect</option>
                <option value="hls">HLS / M3U8</option>
                <option value="direct">Direct media</option>
              </select>
              <Button type="submit" className="h-11 gap-2">
                <Play />
                Play link
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <input
              ref={fileInput}
              type="file"
              accept="video/*,audio/*"
              className="hidden"
              onChange={openLocalFile}
            />
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => fileInput.current?.click()}
            >
              <FileVideo />
              Choose local media
            </Button>
            <p className="text-xs text-muted-foreground">
              Use the picker for files on your phone; typing a local filesystem
              path is blocked by browser security.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            HLS streams must allow cross-origin playback. M3U playlist metadata
            and saved playlists are reserved for a later milestone.
          </p>
          {error && (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </Panel>

      {source && (
        <Panel>
          <PanelHeader
            title={source.title}
            description={
              source.isLocal
                ? "Local file"
                : source.isHls
                  ? "HLS / M3U8 stream"
                  : source.element === "audio"
                    ? "Direct audio URL"
                    : "Direct video URL"
            }
            action={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close player"
                onClick={() => setSource(null)}
              >
                <X />
              </Button>
            }
          />
          <div className="px-5 pb-5">
            <MediaPlayer source={source} />
          </div>
        </Panel>
      )}
    </PageContainer>
  );
}
