import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AudioLines, Search } from "lucide-react";
import { PageContainer, Panel } from "@/components/layout.tsx";
import ViewModeToggle from "@/components/view-mode-toggle.tsx";
import DataLoadError from "@/components/data-load-error.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useLibrary } from "@/hooks/use-media-data.ts";
import { formatBytes, formatDuration } from "@/lib/format.ts";
import LibraryItemActions, { MediaSourceLink } from "./-components/library-item-actions.tsx";

export const Route = createFileRoute("/_app/audio")({
  head: () => ({ meta: [{ title: "Audio Downloads · MediaDock" }] }),
  component: Page,
});

function Page() {
  const [query, setQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const libraryQuery = useLibrary({ kind: "audio" });

  const visible = useMemo(() => {
    const items = libraryQuery.data ?? [];
    return items.filter((item) => {
      const haystack = `${item.title} ${item.creator} ${item.filename}`.toLowerCase();
      const matchesText = haystack.includes(query.trim().toLowerCase());
      const matchesFormat = formatFilter === "all" || item.extension === formatFilter;
      return matchesText && matchesFormat;
    });
  }, [formatFilter, libraryQuery.data, query]);

  return (
    <PageContainer className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Album art and mixes</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Audio library</h2>
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle value={view} onChange={setView} />
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-sm text-muted-foreground">
            <AudioLines className="size-3.5" />
            {libraryQuery.data?.length ?? 0} tracks
          </div>
        </div>
      </div>

      <Panel>
        <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tracks, artists or titles"
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground/65 focus:border-primary"
            />
          </div>
          <select
            value={formatFilter}
            onChange={(event) => setFormatFilter(event.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="all">All formats</option>
            <option value="mp3">MP3</option>
            <option value="m4a">M4A</option>
            <option value="wav">WAV</option>
            <option value="flac">FLAC</option>
          </select>
        </div>

        {libraryQuery.isError ? (
          <div className="px-5 pb-5">
            <DataLoadError error={libraryQuery.error} onRetry={() => void libraryQuery.refetch()} />
          </div>
        ) : libraryQuery.isLoading ? (
          <div className={view === "grid" ? "grid gap-4 px-5 pb-5 md:grid-cols-2 2xl:grid-cols-3" : "space-y-2 px-5 pb-5"}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className={view === "grid" ? "h-80 rounded-2xl" : "h-24 rounded-2xl"} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-5 pb-6">
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              No audio downloads match your filters.
            </div>
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card/60">
                <div className="relative h-48 overflow-hidden">
                  <img src={item.thumbnailUrl} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 top-0 flex justify-between bg-gradient-to-b from-black/55 to-transparent px-3 py-2 text-[10px] font-medium text-white">
                    <span>{item.extension.toUpperCase()}</span>
                    <span>{item.qualityLabel}</span>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="text-base font-semibold">
                      <MediaSourceLink
                        sourceUrl={item.sourceUrl}
                        title={item.title}
                        className="underline-offset-4 hover:text-primary hover:underline"
                      />
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.creator}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDuration(item.durationSec)}</span>
                    <span>{formatBytes(item.sizeBytes)}</span>
                  </div>
                  <LibraryItemActions item={item} layout="grid" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 px-5 pb-5">
            {visible.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-3 sm:flex-row sm:items-center">
                <img src={item.thumbnailUrl} alt={item.title} loading="lazy" decoding="async" className="h-16 w-full rounded-xl object-cover sm:w-20" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    <MediaSourceLink
                      sourceUrl={item.sourceUrl}
                      title={item.title}
                      className="underline-offset-4 hover:text-primary hover:underline"
                    />
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{item.creator}</p>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground sm:flex-col sm:gap-1 sm:text-right">
                  <span>{item.extension.toUpperCase()} · {item.qualityLabel}</span>
                  <span>{formatDuration(item.durationSec)} · {formatBytes(item.sizeBytes)}</span>
                </div>
                <LibraryItemActions item={item} layout="list" />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageContainer>
  );
}
