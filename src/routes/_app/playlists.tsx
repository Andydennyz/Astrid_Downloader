import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Heart,
  ListVideo,
  Play,
  Radio,
  Trash2,
} from "lucide-react";
import { PageContainer, Panel, PanelHeader } from "@/components/layout.tsx";
import MediaPlayer from "@/components/media-player.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  normalizeM3UUrl,
  parseM3UPlaylist,
  type SavedPlaylist,
} from "@/lib/m3u-playlist.ts";
import { prepareRemoteMediaSource } from "@/lib/media-player.ts";
import { loadPlaylists, savePlaylists } from "@/services/playlist-storage.ts";

type PlaylistTab = "added" | "favorites";

export const Route = createFileRoute("/_app/playlists")({
  head: () => ({ meta: [{ title: "M3U Playlists · MediaDock" }] }),
  component: PlaylistsPage,
});

function getErrorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return "Could not read this playlist link. The server may be unavailable or may block browser access with CORS.";
  }
  return error instanceof Error ? error.message : "The playlist could not be imported.";
}

function newPlaylistId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function PlaylistArtwork({
  src,
  title,
  className = "",
}: {
  src: string | null;
  title: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        role="img"
        aria-label={`${title} artwork unavailable`}
        className={`flex items-center justify-center overflow-hidden bg-primary/10 text-primary ${className}`}
      >
        <Radio className="size-9" />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`${title} artwork`}
      className={`relative flex items-center justify-center overflow-hidden bg-primary/10 text-primary ${className}`}
    >
      <Radio className="size-9" />
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={(event) => {
          event.currentTarget.classList.add("hidden");
        }}
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  );
}

function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>([]);
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState<PlaylistTab>("added");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState<{
    url: string;
    title: string;
    isHls: boolean;
    element: "audio" | "video";
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [channelQuery, setChannelQuery] = useState("");
  const [channelLimit, setChannelLimit] = useState(100);
  const importController = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        setPlaylists(loadPlaylists());
      } catch (caughtError) {
        setError(getErrorMessage(caughtError));
      } finally {
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      importController.current?.abort();
    },
    [],
  );

  const visiblePlaylists =
    tab === "favorites"
      ? playlists.filter((playlist) => playlist.isFavorite)
      : playlists;
  const selectedPlaylist = playlists.find(
    (playlist) => playlist.id === selectedId,
  );
  const matchingChannels = useMemo(() => {
    if (!selectedPlaylist) return [];
    const query = channelQuery.trim().toLowerCase();
    if (!query) return selectedPlaylist.channels;
    return selectedPlaylist.channels.filter((channel) =>
      `${channel.title} ${channel.group ?? ""}`.toLowerCase().includes(query),
    );
  }, [channelQuery, selectedPlaylist]);

  const persistPlaylists = (next: SavedPlaylist[]) => {
    try {
      savePlaylists(next);
      setPlaylists(next);
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  const importPlaylist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    let playlistUrl: string;
    try {
      playlistUrl = normalizeM3UUrl(url);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      return;
    }

    importController.current?.abort();
    const controller = new AbortController();
    importController.current = controller;
    setIsImporting(true);
    try {
      const response = await fetch(playlistUrl, {
        headers: { Accept: "audio/x-mpegurl, application/x-mpegURL, text/plain, */*" },
        credentials: "omit",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`The playlist server returned HTTP ${response.status}.`);
      }
      const contentLength = Number(response.headers.get("content-length"));
      if (contentLength > 5 * 1024 * 1024) {
        throw new Error("This playlist is too large to import (maximum 5 MB).");
      }
      const content = await response.text();
      const parsed = parseM3UPlaylist(content, playlistUrl);
      const previous = playlists.find(
        (playlist) => playlist.sourceUrl === playlistUrl,
      );
      const saved: SavedPlaylist = {
        ...parsed,
        id: previous?.id ?? newPlaylistId(),
        importedAt: new Date().toISOString(),
        isFavorite: previous?.isFavorite ?? false,
      };
      const next = [
        saved,
        ...playlists.filter((playlist) => playlist.sourceUrl !== playlistUrl),
      ];
      savePlaylists(next);
      setPlaylists(next);
      setSelectedId(saved.id);
      setTab("added");
      setUrl("");
    } catch (caughtError) {
      if (!controller.signal.aborted) setError(getErrorMessage(caughtError));
    } finally {
      if (importController.current === controller) {
        importController.current = null;
        setIsImporting(false);
      }
    }
  };

  const toggleFavorite = (playlist: SavedPlaylist) => {
    persistPlaylists(
      playlists.map((item) =>
        item.id === playlist.id
          ? { ...item, isFavorite: !item.isFavorite }
          : item,
      ),
    );
  };

  const removePlaylist = (playlist: SavedPlaylist) => {
    if (!window.confirm(`Remove "${playlist.title}" from saved playlists?`)) {
      return;
    }
    persistPlaylists(playlists.filter((item) => item.id !== playlist.id));
    if (selectedId === playlist.id) {
      setSelectedId(null);
      setPlaying(null);
    }
  };

  const playChannel = (channel: SavedPlaylist["channels"][number]) => {
    try {
      const source = prepareRemoteMediaSource(channel.url);
      setPlaying({ ...source, title: channel.title });
      setError(null);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  return (
    <PageContainer className="mx-auto flex max-w-[1080px] flex-col gap-5">
      <div>
        <p className="text-sm text-muted-foreground">Your channel catalogs</p>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          M3U playlists
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Import a channel-style M3U link to save its playlist details, available
          channel metadata, and artwork on this device. HLS M3U8 streams can be
          opened from Direct Player instead.
        </p>
      </div>

      <Panel>
        <PanelHeader
          title="Add a playlist"
          description="Only playlists with a valid M3U header and at least one HTTP(S) channel are saved."
        />
        <form
          onSubmit={(event) => void importPlaylist(event)}
          className="flex flex-col gap-3 px-5 pb-5 sm:flex-row"
        >
          <input
            type="url"
            inputMode="url"
            autoComplete="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/channels.m3u"
            aria-label="M3U playlist URL"
            className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <Button type="submit" className="h-11" disabled={isImporting}>
            {isImporting ? "Checking playlist…" : "Validate and add"}
          </Button>
        </form>
        <p className="px-5 pb-5 text-xs text-muted-foreground">
          Import runs in your browser. The playlist host must allow cross-origin
          access (CORS). Links are stored locally and are not synced through
          Supabase.
        </p>
        {error && (
          <p
            role="alert"
            className="mx-5 mb-5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2" role="tablist" aria-label="Playlist views">
          <Button
            type="button"
            variant={tab === "added" ? "default" : "outline"}
            role="tab"
            aria-selected={tab === "added"}
            onClick={() => setTab("added")}
          >
            <ListVideo className="mr-1 size-4" />
            Added playlists ({playlists.length})
          </Button>
          <Button
            type="button"
            variant={tab === "favorites" ? "default" : "outline"}
            role="tab"
            aria-selected={tab === "favorites"}
            onClick={() => setTab("favorites")}
          >
            <Heart className="mr-1 size-4" />
            Favorites ({playlists.filter((item) => item.isFavorite).length})
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">
          Stored on this device/browser
        </span>
      </div>

      {isLoading ? (
        <Panel>
          <div className="p-6 text-sm text-muted-foreground">
            Loading saved playlists…
          </div>
        </Panel>
      ) : visiblePlaylists.length === 0 ? (
        <Panel>
          <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <ListVideo className="size-8 text-muted-foreground" />
            <p className="font-medium">
              {tab === "favorites"
                ? "No favorite playlists yet"
                : "No playlists added yet"}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              {tab === "favorites"
                ? "Mark a saved playlist as a favorite and it will appear here."
                : "A playlist appears here only after its M3U content has been validated."}
            </p>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visiblePlaylists.map((playlist) => (
            <Panel key={playlist.id} className="overflow-hidden">
              <div className="flex min-w-0">
                <PlaylistArtwork
                  src={playlist.thumbnailUrl}
                  title={playlist.title}
                  className="h-32 w-32 shrink-0"
                />
                <div className="min-w-0 flex-1 p-4">
                  <h3 className="truncate font-semibold">{playlist.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {playlist.channels.length} channels
                    {playlist.channels.some((channel) => channel.group)
                      ? ` · ${new Set(playlist.channels.map((channel) => channel.group).filter(Boolean)).size} groups`
                      : ""}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    Imported {new Date(playlist.importedAt).toLocaleDateString()}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedId(
                          selectedId === playlist.id ? null : playlist.id,
                        );
                        setChannelQuery("");
                        setChannelLimit(100);
                      }}
                    >
                      {selectedId === playlist.id ? "Hide channels" : "Channels"}
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={
                        playlist.isFavorite
                          ? `Remove ${playlist.title} from favorites`
                          : `Add ${playlist.title} to favorites`
                      }
                      onClick={() => toggleFavorite(playlist)}
                    >
                      <Heart
                        className={
                          playlist.isFavorite
                            ? "fill-current text-primary"
                            : undefined
                        }
                      />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove ${playlist.title}`}
                      onClick={() => removePlaylist(playlist)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {selectedPlaylist && (
        <Panel>
          <PanelHeader
            title={selectedPlaylist.title}
            description={`${selectedPlaylist.channels.length} imported channel entries`}
          />
          <div className="space-y-4 px-5 pb-5">
            <p className="break-all text-xs text-muted-foreground">
              Source: {selectedPlaylist.sourceUrl}
            </p>
            <input
              value={channelQuery}
              onChange={(event) => {
                setChannelQuery(event.target.value);
                setChannelLimit(100);
              }}
              placeholder="Search channels or groups"
              aria-label="Search playlist channels"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            {matchingChannels.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No channels match this search.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {matchingChannels.slice(0, channelLimit).map((channel) => (
                  <div
                    key={`${selectedPlaylist.id}-${channel.id}`}
                    className="flex items-center gap-3 py-3"
                  >
                    {channel.logoUrl ? (
                      <PlaylistArtwork
                        src={channel.logoUrl}
                        title={channel.title}
                        className="size-11 shrink-0 rounded-lg"
                      />
                    ) : (
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Radio className="size-5" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {channel.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {channel.group ?? channel.url}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      aria-label={`Play ${channel.title}`}
                      onClick={() => playChannel(channel)}
                    >
                      <Play />
                    </Button>
                  </div>
                ))}
                {matchingChannels.length > channelLimit && (
                  <div className="pt-4 text-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setChannelLimit((limit) => limit + 100)
                      }
                    >
                      Show more channels
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>
      )}

      {playing && (
        <Panel>
          <PanelHeader
            title={playing.title}
            description="Playlist stream"
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPlaying(null)}
              >
                Close player
              </Button>
            }
          />
          <div className="px-5 pb-5">
            <MediaPlayer source={playing} />
          </div>
        </Panel>
      )}
    </PageContainer>
  );
}
