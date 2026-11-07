import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, Clock3, History, Settings2, SlidersHorizontal, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useHistory, useSettings } from "@/hooks/use-media-data.ts";
import { formatBytes } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";

export default function HistorySettingsSidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { data: entries = [] } = useHistory();
  const { data: settings } = useSettings();
  const [tab, setTab] = useState<"history" | "settings">("history");

  const stats = useMemo(() => {
    const completed = entries.filter((entry) => entry.status === "completed").length;
    const failed = entries.filter((entry) => entry.status === "failed").length;
    const cancelled = entries.filter((entry) => entry.status === "cancelled").length;
    const successRate = entries.length ? Math.round((completed / entries.length) * 100) : 0;
    return { completed, failed, cancelled, successRate };
  }, [entries]);

  const recent = [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 4);

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 border-l border-sidebar-border bg-sidebar/90 backdrop-blur-xl transition-all duration-300 xl:flex",
        open ? "w-[320px]" : "w-0 overflow-hidden border-l-0",
      )}
    >
      <div className={cn("flex h-full w-[320px] min-w-[320px] flex-col", !open && "hidden")}>
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
          <div className="flex items-center gap-2">
            {tab === "history" ? <History className="size-4 text-primary" /> : <Settings2 className="size-4 text-primary" />}
            <div>
              <div className="text-sm font-semibold">{tab === "history" ? "History" : "Settings"}</div>
              <div className="text-[11px] text-sidebar-foreground/60">
                {tab === "history" ? `${entries.length} attempts` : settings ? "Quick preferences" : "Loading"}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="grid size-7 place-items-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Collapse history and settings sidebar"
          >
            <ArrowUpRight className="size-3.5" />
          </button>
        </div>

        <div className="border-b border-sidebar-border p-3">
          <div className="inline-flex w-full rounded-full border border-border bg-sidebar-accent/30 p-0.5">
            {(["history", "settings"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                className={cn(
                  "flex-1 rounded-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
                  tab === value ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/65 hover:text-sidebar-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {tab === "history" ? (
          <>
            <div className="grid grid-cols-2 gap-2 p-3">
              <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/55"><CheckCircle2 className="size-3.5" /> Completed</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{stats.completed}</div>
              </div>
              <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/55"><XCircle className="size-3.5" /> Failed</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{stats.failed}</div>
              </div>
              <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/55"><Clock3 className="size-3.5" /> Cancelled</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{stats.cancelled}</div>
              </div>
              <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/55"><SlidersHorizontal className="size-3.5" /> Rate</div>
                <div className="mt-1 text-lg font-semibold tabular-nums">{stats.successRate}%</div>
              </div>
            </div>

            <div className="flex items-center justify-between px-3 pb-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/55">Recent</div>
              <Button type="button" variant="ghost" size="xs" nativeButton={false} render={<Link to="/history" />}>Open</Button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
              {recent.length === 0 ? (
                <div className="rounded-xl border border-dashed border-sidebar-border bg-sidebar-accent/25 p-4 text-center text-sm text-sidebar-foreground/60">
                  No history yet.
                </div>
              ) : (
                recent.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-border/80 bg-card/60 p-2.5">
                    <div className="flex items-start gap-2.5">
                      <img src={entry.thumbnailUrl} alt={entry.title} className="h-12 w-16 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] font-semibold leading-tight">{entry.title}</div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{entry.creator}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                      <span>{entry.status}</span>
                      <span>{entry.sizeBytes ? formatBytes(entry.sizeBytes) : "—"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/55">Download location</div>
              <div className="mt-2 truncate text-sm font-medium">{settings?.general.downloadLocation ?? "~/Downloads/Astrid"}</div>
            </div>

            <div className="space-y-2 rounded-xl border border-sidebar-border bg-sidebar-accent/25 p-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/55">Quick toggles</div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>Auto start</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", settings?.downloads.autoStart ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground")}>{settings?.downloads.autoStart ? "On" : "Off"}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>Auto retry</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", settings?.downloads.autoRetry ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground")}>{settings?.downloads.autoRetry ? "On" : "Off"}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>Density</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">{settings?.appearance.density ?? "comfortable"}</span>
              </div>
            </div>

            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-sidebar-foreground/70">Max concurrency</span>
                <span className="font-semibold tabular-nums">{settings?.downloads.maxSimultaneous ?? 3}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${((settings?.downloads.maxSimultaneous ?? 3) / 10) * 100}%` }} />
              </div>
            </div>

            <div className="pt-2">
              <Button type="button" variant="secondary" className="w-full" nativeButton={false} render={<Link to="/settings" />}>
                Open settings
              </Button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
