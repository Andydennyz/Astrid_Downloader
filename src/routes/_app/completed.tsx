import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, FolderOpen, Search, Trash2 } from "lucide-react";
import { PageContainer, Panel } from "@/components/layout.tsx";
import ViewModeToggle, { type ViewMode } from "@/components/view-mode-toggle.tsx";
import DataLoadError from "@/components/data-load-error.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useFileActions, useLibrary, useRemoveLibraryItem } from "@/hooks/use-media-data.ts";
import { formatBytes, formatDuration } from "@/lib/format.ts";
import type { LibraryItem } from "@/services/index.ts";

export const Route = createFileRoute("/_app/completed")({
  head: () => ({ meta: [{ title: "Completed Downloads · MediaDock" }] }),
  component: Page,
});

type SortMode = "newest" | "oldest" | "size" | "title";

function LibraryCard({ item, onOpen, onCopy, onRemove }: {
  item: LibraryItem;
  onOpen: (id: string, filename: string, path?: string) => void;
  onCopy: (filename: string) => void;
  onRemove: (item: LibraryItem) => void;
}) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card/70">
      <div className="relative h-48 overflow-hidden">
        <img src={item.thumbnailUrl} alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent px-3 py-2 text-[10px] text-white">
          <span className="rounded-full bg-black/25 px-2 py-0.5 backdrop-blur-sm">{item.kind === "video" ? "Video" : "Audio"}</span>
          <span>{item.qualityLabel}</span>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">{item.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{item.creator}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span>{item.extension.toUpperCase()}</span>
          <span>{formatDuration(item.durationSec)}</span>
          <span>{item.kind === "video" ? `${item.height ?? "—"}p` : item.qualityLabel}</span>
          <span>{formatBytes(item.sizeBytes)}</span>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onOpen(item.id, item.filename, item.filePath)}>
            Open
          </Button>
          <Button
            type="button"
            nativeButton={false}
            render={<Link to={item.kind === "video" ? "/video" : "/audio"} />}
            variant="ghost"
            size="sm"
            className="gap-1.5"
          >
            <FolderOpen className="size-3.5" />
            {item.kind === "video" ? "Video library" : "Audio library"}
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onCopy(item.filename)} aria-label={`Copy ${item.title} filename`}>
            <Copy className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(item)} aria-label={`Delete ${item.title}`}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function Page() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "video" | "audio">("all");
  const [sortBy, setSortBy] = useState<SortMode>("newest");
  const [view, setView] = useState<ViewMode>("grid");
  const libraryQuery = useLibrary();
  const { open, copyPath } = useFileActions();
  const removeItem = useRemoveLibraryItem();

  const visible = useMemo(() => {
    const next = (libraryQuery.data ?? []).filter((item) => {
      const matchesKind = kind === "all" || item.kind === kind;
      const haystack = `${item.title} ${item.creator} ${item.filename}`.toLowerCase();
      const matchesQuery = haystack.includes(query.trim().toLowerCase());
      return matchesKind && matchesQuery;
    });

    next.sort((a, b) => {
      switch (sortBy) {
        case "oldest": return new Date(a.downloadedAt).getTime() - new Date(b.downloadedAt).getTime();
        case "size": return b.sizeBytes - a.sizeBytes;
        case "title": return a.title.localeCompare(b.title);
        case "newest":
        default: return new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime();
      }
    });
    return next;
  }, [kind, libraryQuery.data, query, sortBy]);

  return (
    <PageContainer className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">All finished downloads</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Completed downloads</h2>
        </div>
        <ViewModeToggle value={view} onChange={setView} />
      </div>

      <Panel>
        <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search completed downloads"
              placeholder="Search by title, creator or filename"
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none ring-0 placeholder:text-muted-foreground/65 focus:border-primary"
            />
          </div>

          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as "all" | "video" | "audio")}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="all">All media</option>
            <option value="video">Video</option>
            <option value="audio">Audio</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortMode)}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="size">Largest first</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>

        {libraryQuery.isError ? (
          <div className="px-5 pb-5">
            <DataLoadError error={libraryQuery.error} onRetry={() => void libraryQuery.refetch()} />
          </div>
        ) : libraryQuery.isLoading ? (
          <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-5 pb-6">
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              No completed downloads match your current filters.
            </div>
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((item) => (
              <LibraryCard
                key={item.id}
                item={item}
                onOpen={open}
                onCopy={copyPath}
                onRemove={(item) => void removeItem(item)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2 px-5 pb-5">
            {visible.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
                <img src={item.thumbnailUrl} alt={item.title} loading="lazy" decoding="async" className="h-16 w-16 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.creator}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{item.kind === "video" ? `${item.height ?? "—"}p` : item.qualityLabel}</div>
                      <div>{formatBytes(item.sizeBytes)}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    nativeButton={false}
                    render={<Link to={item.kind === "video" ? "/video" : "/audio"} />}
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Open ${item.kind} library`}
                    title={`Open ${item.kind} library`}
                  >
                    <FolderOpen className="size-3.5" />
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => open(item.id, item.filename, item.filePath)}>
                    Open
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => copyPath(item.filename)}>
                    Copy filename
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void removeItem(item)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageContainer>
  );
}
