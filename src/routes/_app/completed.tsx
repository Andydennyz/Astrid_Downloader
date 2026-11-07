import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, FolderOpen, Grid2x2, List, Search, Trash2 } from "lucide-react";
import { PageContainer, Panel } from "@/components/layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useFileActions, useLibrary } from "@/hooks/use-media-data.ts";
import { formatBytes, formatDuration } from "@/lib/format.ts";
import { getServices, type LibraryItem } from "@/services/index.ts";

export const Route = createFileRoute("/_app/completed")({
  head: () => ({ meta: [{ title: "Completed Downloads · Astrid Downloader" }] }),
  component: Page,
});

type SortMode = "newest" | "oldest" | "size" | "title";
type ViewMode = "grid" | "list";

function LibraryCard({ item, onOpen, onReveal, onCopy, onRemove }: {
  item: LibraryItem;
  onOpen: (path: string) => void;
  onReveal: (path: string) => void;
  onCopy: (path: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card/70">
      <div className="relative h-48 overflow-hidden">
        <img src={item.thumbnailUrl} alt={item.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => onOpen(item.filePath)}>
            Open
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onReveal(item.filePath)} aria-label={`Reveal ${item.title} in folder`}>
            <FolderOpen className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onCopy(item.filePath)} aria-label={`Copy ${item.title} path`}>
            <Copy className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title}`}>
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
  const { data: items = [] } = useLibrary();
  const { open, reveal, copyPath } = useFileActions();

  const visible = useMemo(() => {
    const next = items.filter((item) => {
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
  }, [items, kind, query, sortBy]);

  return (
    <PageContainer className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">All finished downloads</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Completed downloads</h2>
        </div>
        <div className="flex gap-2 rounded-full border border-border bg-card/70 p-1">
          <Button type="button" variant={view === "grid" ? "default" : "ghost"} size="sm" onClick={() => setView("grid")}>
            <Grid2x2 className="size-3.5" />
          </Button>
          <Button type="button" variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => setView("list")}>
            <List className="size-3.5" />
          </Button>
        </div>
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

        {visible.length === 0 ? (
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
                onReveal={reveal}
                onCopy={copyPath}
                onRemove={(id) => void getServices().library.remove(id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2 px-5 pb-5">
            {visible.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
                <img src={item.thumbnailUrl} alt={item.title} className="h-16 w-16 rounded-xl object-cover" />
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
                  <Button type="button" variant="outline" size="sm" onClick={() => open(item.filePath)}>
                    Open
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => reveal(item.filePath)}>
                    Reveal
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => copyPath(item.filePath)}>
                    Copy path
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void getServices().library.remove(item.id)}>
                    Remove
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
