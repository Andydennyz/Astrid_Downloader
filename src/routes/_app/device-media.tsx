import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { AudioLines, Clapperboard, HardDrive, Play, RefreshCw, Search } from "lucide-react";
import { PageContainer, Panel } from "@/components/layout.tsx";
import MediaPlayerDialog from "@/components/media-player-dialog.tsx";
import MediaThumb from "@/components/media-thumb.tsx";
import DataLoadError from "@/components/data-load-error.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatBytes, formatDuration } from "@/lib/format.ts";
import {
  listDeviceMedia,
  requestDeviceMediaAccess,
  type DeviceMediaAccess,
  type DeviceMediaItem,
  type DeviceMediaKind,
} from "@/services/device-media.ts";
import type { MediaPlaybackSource } from "@/services/types.ts";

export const Route = createFileRoute("/_app/device-media")({
  head: () => ({ meta: [{ title: "Device Media · MediaDock" }] }),
  component: DeviceMediaPage,
});

const PAGE_SIZE = 30;

function subscribeToPlatform() {
  return () => {};
}

function isAndroidPlatform() {
  return Capacitor.getPlatform() === "android";
}

function DeviceMediaPage() {
  const isAndroid = useSyncExternalStore(
    subscribeToPlatform,
    isAndroidPlatform,
    () => false,
  );
  const [kind, setKind] = useState<DeviceMediaKind>("all");
  const [access, setAccess] = useState<DeviceMediaAccess | null>(null);
  const [items, setItems] = useState<DeviceMediaItem[]>([]);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [playbackSource, setPlaybackSource] = useState<MediaPlaybackSource | null>(null);

  const loadPage = useCallback(
    async (nextKind: DeviceMediaKind, nextOffset: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const page = await listDeviceMedia({
          kind: nextKind,
          offset: nextOffset,
          limit: PAGE_SIZE,
        });
        setItems((current) => append ? [...current, ...page.items] : page.items);
        setOffset(page.nextOffset);
        setHasMore(page.hasMore);
      } catch (caughtError) {
        setError(caughtError);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const requestAccessAndLoad = useCallback(
    async (nextKind: DeviceMediaKind) => {
      setLoading(true);
      setError(null);
      try {
        const permission = await requestDeviceMediaAccess();
        setAccess(permission);
        if (permission.granted) {
          await loadPage(nextKind, 0, false);
        } else {
          setItems([]);
        }
      } catch (caughtError) {
        setError(caughtError);
      } finally {
        setLoading(false);
      }
    },
    [loadPage],
  );

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase();
    return items.filter((item) =>
      `${item.title} ${item.creator} ${item.filename}`
        .toLowerCase()
        .includes(search),
    );
  }, [items, query]);

  const changeKind = (nextKind: DeviceMediaKind) => {
    setKind(nextKind);
    setItems([]);
    setOffset(0);
    setHasMore(false);
    if (access) void loadPage(nextKind, 0, false);
  };

  if (!isAndroid) {
    return (
      <PageContainer>
        <Panel className="px-5 py-10 text-center">
          <HardDrive className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 font-display text-xl font-semibold">Device media</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browsing the phone’s local audio and video library is available in the Android app.
          </p>
        </Panel>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Audio and video on this phone</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Device media</h2>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "video", "audio"] as const).map((filter) => (
            <Button
              key={filter}
              type="button"
              size="sm"
              variant={kind === filter ? "secondary" : "outline"}
              disabled={
                loading ||
                !access?.granted ||
                (filter === "video" && !access.videoGranted) ||
                (filter === "audio" && !access.audioGranted)
              }
              onClick={() => changeKind(filter)}
            >
              {filter === "all" ? "All" : filter === "video" ? "Videos" : "Audio"}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Refresh device media"
            disabled={loading}
            onClick={() => {
              if (access) void loadPage(kind, 0, false);
              else void requestAccessAndLoad(kind);
            }}
          >
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      <Panel>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search device media"
              placeholder="Search by title, artist or file name"
              className="h-10 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-sm placeholder:text-muted-foreground/65 focus:border-primary"
            />
          </div>
          {items.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {items.length} {kind === "audio" ? "tracks" : kind === "video" ? "videos" : "items"}
            </span>
          )}
        </div>

        {error ? (
          <div className="px-5 pb-5">
            <DataLoadError
              error={error}
              onRetry={() => void requestAccessAndLoad(kind)}
            />
          </div>
        ) : !access?.granted ? (
          <div className="px-5 pb-6 text-center">
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8">
              <HardDrive className="mx-auto size-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">Allow access to device media</h3>
              <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
                MediaDock only reads audio and video items to show them here. You can change this permission any time in Android settings.
              </p>
              <Button
                type="button"
                className="mt-4"
                disabled={loading}
                onClick={() => void requestAccessAndLoad(kind)}
              >
                {loading ? "Requesting access…" : "Allow access"}
              </Button>
            </div>
          </div>
        ) : loading && items.length === 0 ? (
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-5 pb-6">
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              {items.length === 0
                ? "No local media found for this selection."
                : "No device media matches your search."}
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card/60"
                >
                  <MediaThumb
                    src={item.thumbnailUrl}
                    alt={item.title}
                    kind={item.kind}
                    badge={formatDuration(item.durationSec)}
                    className="w-full"
                  />
                  <div className="space-y-3 p-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{item.title}</h3>
                      <p className="truncate text-sm text-muted-foreground">{item.creator}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{item.filename}</span>
                      <span className="shrink-0">{formatBytes(item.sizeBytes)}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() =>
                        setPlaybackSource({
                          url: item.uri,
                          title: item.title,
                          element: item.kind,
                          isHls: false,
                        })
                      }
                    >
                      {item.kind === "video" ? <Clapperboard /> : <AudioLines />}
                      {item.kind === "video" ? "Watch" : "Listen"}
                      <Play className="ml-auto" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
            {hasMore && (
              <div className="px-5 pb-5 text-center">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() => void loadPage(kind, offset, true)}
                >
                  {loading ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>
      {access?.videoSelectedOnly && (
        <p className="text-xs text-muted-foreground">
          Android granted access to selected videos only; only those items appear in this library.
        </p>
      )}
      {playbackSource && (
        <MediaPlayerDialog
          source={playbackSource}
          onClose={() => setPlaybackSource(null)}
        />
      )}
    </PageContainer>
  );
}
