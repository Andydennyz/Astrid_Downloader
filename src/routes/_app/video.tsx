import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clapperboard, Search } from "lucide-react";
import { PageContainer, Panel } from "@/components/layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useLibrary } from "@/hooks/use-media-data.ts";
import { formatBytes, formatDuration } from "@/lib/format.ts";

export const Route = createFileRoute("/_app/video")({
  head: () => ({ meta: [{ title: "Video Downloads · Astrid Downloader" }] }),
  component: Page,
});

function Page() {
  const [query, setQuery] = useState("");
  const [resolution, setResolution] = useState("all");
  const { data: items = [] } = useLibrary({ kind: "video" });

  const visible = useMemo(() => {
    return items.filter((item) => {
      const haystack = `${item.title} ${item.creator} ${item.filename}`.toLowerCase();
      const matchesText = haystack.includes(query.trim().toLowerCase());
      const matchesResolution = resolution === "all" || `${item.height ?? 0}p` === resolution;
      return matchesText && matchesResolution;
    });
  }, [items, query, resolution]);

  return (
    <PageContainer className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Everything saved locally</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Video library</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-sm text-muted-foreground">
          <Clapperboard className="size-3.5" />
          {items.length} videos
        </div>
      </div>

      <Panel>
        <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, creator or file name"
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground/65 focus:border-primary"
            />
          </div>
          <select
            value={resolution}
            onChange={(event) => setResolution(event.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="all">All resolutions</option>
            <option value="2160p">2160p</option>
            <option value="1440p">1440p</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>
        </div>

        {visible.length === 0 ? (
          <div className="px-5 pb-6">
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              No video downloads match the current filters.
            </div>
          </div>
        ) : (
          <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-2xl border border-border bg-card/60">
                <div className="relative h-52 overflow-hidden">
                  <img src={item.thumbnailUrl} alt={item.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-[10px] text-white">
                    <span>{item.qualityLabel}</span>
                    <span>{formatDuration(item.durationSec)}</span>
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.creator}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.extension.toUpperCase()}</span>
                    <span>{formatBytes(item.sizeBytes)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1">
                      Watch
                    </Button>
                    <Button type="button" variant="ghost" size="sm">
                      Open
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageContainer>
  );
}
