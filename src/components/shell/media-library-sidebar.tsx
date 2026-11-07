import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AudioLines, BookOpenText, Clapperboard, FolderOpen, Library, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useLibrary } from "@/hooks/use-media-data.ts";
import { formatBytes, formatDuration } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";

function StatCard({ label, value, kind }: { label: string; value: string; kind: "video" | "audio" | "all" }) {
  const icon =
    kind === "video" ? <Clapperboard className="size-3.5" /> : kind === "audio" ? <AudioLines className="size-3.5" /> : <Library className="size-3.5" />;

  return (
    <div className="media-library-stat rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/55">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function MediaLibrarySidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { data: items = [] } = useLibrary();
  const [filter, setFilter] = useState<"all" | "video" | "audio">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const next = filter === "all" ? items : items.filter((item) => item.kind === filter);
    return [...next].sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime());
  }, [filter, items]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0].id);
    }
  }, [filteredItems, selectedId]);

  const selected = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;
  const videoCount = items.filter((item) => item.kind === "video").length;
  const audioCount = items.filter((item) => item.kind === "audio").length;

  return (
    <aside
      className={cn(
        "media-library-rail hidden h-full shrink-0 border-l border-sidebar-border bg-sidebar/90 backdrop-blur-xl transition-all duration-300 xl:flex",
        open ? "w-[320px]" : "w-0 overflow-hidden border-l-0",
      )}
    >
      <div className={cn("flex h-full w-[320px] min-w-[320px] flex-col", !open && "hidden")}>
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpenText className="size-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">Media library</div>
              <div className="text-[11px] text-sidebar-foreground/60">{items.length} saved items</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="grid size-7 place-items-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Collapse media library sidebar"
          >
            <span className="sr-only">Collapse</span>
            <FolderOpen className="size-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 p-3">
          <StatCard label="All" value={String(items.length)} kind="all" />
          <StatCard label="Video" value={String(videoCount)} kind="video" />
          <StatCard label="Audio" value={String(audioCount)} kind="audio" />
        </div>

        <div className="flex items-center justify-between px-3 pb-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/55">Collections</div>
          <div className="flex gap-1">
            {(["all", "video", "audio"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-full border px-2 py-1 text-[10px] font-medium capitalize transition-colors",
                  filter === value
                    ? "border-primary/40 bg-primary/12 text-primary"
                    : "border-sidebar-border bg-background/20 text-sidebar-foreground/65 hover:text-sidebar-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
          {filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sidebar-border bg-sidebar-accent/25 p-4 text-center text-sm text-sidebar-foreground/60">
              No media saved yet.
            </div>
          ) : (
            filteredItems.slice(0, 6).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "media-library-item w-full rounded-xl border bg-card/60 p-2.5 text-left transition-all duration-200 hover:border-border hover:bg-card/80",
                  selected?.id === item.id && "border-primary/45 bg-primary/8 shadow-[inset_0_0_0_1px_rgba(127,86,255,0.08)]",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <img src={item.thumbnailUrl} alt={item.title} className="media-library-thumb h-12 w-16 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold leading-tight">{item.title}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{item.creator}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                  <span>{item.kind === "video" ? "Video" : "Audio"}</span>
                  <span>{formatBytes(item.sizeBytes)}</span>
                  <span>{formatDuration(item.durationSec)}</span>
                </div>
              </button>
            ))
          )}
        </div>

        {selected && (
          <div className="border-t border-sidebar-border bg-sidebar-accent/30 p-3">
            <div className="flex items-start gap-3">
              <img src={selected.thumbnailUrl} alt={selected.title} className="h-14 w-20 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{selected.title}</div>
                <div className="mt-1 text-[10px] text-sidebar-foreground/65">{selected.creator}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-sidebar-foreground/70">
              <div className="rounded-lg border border-sidebar-border bg-background/20 px-2 py-1.5">
                <div className="uppercase tracking-[0.12em] text-sidebar-foreground/55">Format</div>
                <div className="mt-1 font-medium text-sidebar-foreground">{selected.kind === "video" ? `${selected.height ?? "—"}p` : selected.qualityLabel}</div>
              </div>
              <div className="rounded-lg border border-sidebar-border bg-background/20 px-2 py-1.5">
                <div className="uppercase tracking-[0.12em] text-sidebar-foreground/55">Size</div>
                <div className="mt-1 font-medium tabular-nums text-sidebar-foreground">{formatBytes(selected.sizeBytes)}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg border border-sidebar-border bg-background/20 px-2 py-1.5 text-[10px] text-sidebar-foreground/70">
              <span>{selected.kind === "video" ? "Video" : "Audio"}</span>
              <span className="tabular-nums">{selected.extension.toUpperCase()}</span>
            </div>

            <div className="mt-3 flex gap-2">
              <Button type="button" variant="secondary" size="sm" className="flex-1" nativeButton={false} render={<Link to={selected.kind === "video" ? "/video" : "/audio"} />}>
                <Play className="mr-1 size-3.5" /> Open
              </Button>
              <Button type="button" variant="ghost" size="sm" nativeButton={false} render={<Link to="/completed" />}>
                <Sparkles className="mr-1 size-3.5" /> Browse
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
