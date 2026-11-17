import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { PageContainer, Panel } from "@/components/layout.tsx";
import DataLoadError from "@/components/data-load-error.tsx";
import ViewModeToggle, { type ViewMode } from "@/components/view-mode-toggle.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import StatusBadge from "@/components/status-badge.tsx";
import { useHistory } from "@/hooks/use-media-data.ts";
import { formatBytes, formatDuration } from "@/lib/format.ts";
import type { HistoryEntry } from "@/services/types.ts";

export const Route = createFileRoute("/_app/history")({
  head: () => ({ meta: [{ title: "Download History · MediaDock" }] }),
  component: Page,
});

function HistoryCard({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/70">
      <div className="relative h-48 overflow-hidden">
        <img src={entry.thumbnailUrl} alt={entry.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-3 py-2">
          <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] text-white">{entry.kind === "video" ? "Video" : "Audio"}</span>
          <StatusBadge status={entry.status} className="h-5 px-2 text-[10px]" />
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">{entry.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{entry.creator}</p>
        </div>
        <p className="line-clamp-2 break-all text-xs text-muted-foreground/70">{entry.sourceUrl}</p>
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span>{entry.extension.toUpperCase()}</span>
          <span>{entry.qualityLabel}</span>
          <span>{entry.sizeBytes ? formatBytes(entry.sizeBytes) : "—"}</span>
          <span>{formatDuration(entry.durationSec)}</span>
          <span className="col-span-2">{new Date(entry.timestamp).toLocaleString()}</span>
        </div>
        {entry.error && <p className="line-clamp-2 text-xs text-destructive">{entry.error}</p>}
      </div>
    </div>
  );
}

function Page() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "completed" | "failed" | "cancelled">("all");
  const [dateRange, setDateRange] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [now, setNow] = useState(() => Date.now());
  const historyQuery = useHistory();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visible = useMemo(() => {
    return (historyQuery.data ?? []).filter((entry) => {
      const matchesStatus = status === "all" || entry.status === status;
      const matchesQuery = `${entry.title} ${entry.creator} ${entry.sourceUrl}`.toLowerCase().includes(query.trim().toLowerCase());
      const ageMs = now - new Date(entry.timestamp).getTime();
      const matchesDate =
        dateRange === "all" ||
        (dateRange === "7d" && ageMs <= 7 * 24 * 60 * 60 * 1000) ||
        (dateRange === "30d" && ageMs <= 30 * 24 * 60 * 60 * 1000) ||
        (dateRange === "90d" && ageMs <= 90 * 24 * 60 * 60 * 1000);
      return matchesStatus && matchesQuery && matchesDate;
    });
  }, [dateRange, historyQuery.data, now, query, status]);

  return (
    <PageContainer className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Every link ever processed</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Download history</h2>
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle value={view} onChange={setView} />
          <div className="rounded-full border border-border bg-card/70 px-3 py-1.5 text-sm text-muted-foreground">
            {historyQuery.data?.length ?? 0} entries
          </div>
        </div>
      </div>
      {historyQuery.isError && (
        <DataLoadError error={historyQuery.error} onRetry={() => void historyQuery.refetch()} />
      )}

      <Panel>
        <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search titles, creators or URLs"
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground/65 focus:border-primary"
            />
          </div>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | "completed" | "failed" | "cancelled")}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value as "all" | "7d" | "30d" | "90d")}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>

        {view === "grid" ? (
          historyQuery.isLoading ? (
            <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-80 rounded-2xl" />
              ))}
            </div>
          ) : historyQuery.isError ? (
            <div className="px-5 pb-5 text-sm text-muted-foreground">History is unavailable.</div>
          ) : visible.length === 0 ? (
            <div className="px-5 pb-6">
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                No history items match the current filters.
              </div>
            </div>
          ) : (
            <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 2xl:grid-cols-3">
              {visible.map((entry) => <HistoryCard key={entry.id} entry={entry} />)}
            </div>
          )
        ) : (
          <div className="overflow-x-auto px-5 pb-5">
            <table className="min-w-full border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="pb-2 font-medium">Title</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Format</th>
                  <th className="pb-2 font-medium">Size</th>
                  <th className="pb-2 font-medium">Duration</th>
                  <th className="pb-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {historyQuery.isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">Loading history…</td>
                  </tr>
                ) : historyQuery.isError ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">History is unavailable.</td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center text-muted-foreground">
                      No history items match the current filters.
                    </td>
                  </tr>
                ) : (
                  visible.map((entry) => (
                    <tr key={entry.id} className="rounded-2xl bg-card/50 ring-1 ring-border">
                      <td className="rounded-l-2xl p-3">
                        <div className="flex items-center gap-3">
                          <img src={entry.thumbnailUrl} alt={entry.title} loading="lazy" decoding="async" className="h-12 w-12 rounded-lg object-cover" />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{entry.title}</div>
                            <div className="truncate text-xs text-muted-foreground">{entry.creator}</div>
                            <div className="truncate text-[11px] text-muted-foreground/70">{entry.sourceUrl}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3"><StatusBadge status={entry.status} /></td>
                      <td className="p-3 text-muted-foreground">{entry.extension.toUpperCase()} · {entry.qualityLabel}</td>
                      <td className="p-3 text-muted-foreground">{entry.sizeBytes ? formatBytes(entry.sizeBytes) : "—"}</td>
                      <td className="p-3 text-muted-foreground">{formatDuration(entry.durationSec)}</td>
                      <td className="rounded-r-2xl p-3 text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </PageContainer>
  );
}
