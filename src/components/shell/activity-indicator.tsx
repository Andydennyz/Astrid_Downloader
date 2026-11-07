import { Link } from "@tanstack/react-router";
import { Activity, ArrowDownToLine } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Button } from "@/components/ui/button.tsx";
import MediaThumb from "@/components/media-thumb.tsx";
import StatusBadge from "@/components/status-badge.tsx";
import { ACTIVE_STATUSES, useDownloads } from "@/hooks/use-downloads.ts";
import { formatEta, formatSpeed } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";

/** Ring that fills with combined progress, with a popover of active jobs. */
export default function ActivityIndicator() {
  const { jobs, activeCount, aggregateProgress, aggregateSpeedBps } = useDownloads();
  const active = jobs.filter((j) => ACTIVE_STATUSES.has(j.status)).slice(0, 4);
  const r = 9;
  const c = 2 * Math.PI * r;
  const busy = activeCount > 0;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Download activity"
            className={cn(
              "flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition-colors hover:bg-muted",
              busy ? "border-primary/30 bg-primary/8" : "bg-card/50",
            )}
          >
            <span className="relative grid size-[22px] place-items-center">
              <svg viewBox="0 0 22 22" className="absolute inset-0 -rotate-90">
                <circle cx="11" cy="11" r={r} fill="none" strokeWidth="2.5" className="stroke-border" />
                <circle
                  cx="11"
                  cy="11"
                  r={r}
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - aggregateProgress)}
                  className="stroke-primary transition-[stroke-dashoffset] duration-500"
                />
              </svg>
              <ArrowDownToLine className={cn("size-2.5", busy ? "text-primary" : "text-muted-foreground")} />
            </span>
            <span className="hidden tabular-nums sm:inline">
              {busy ? formatSpeed(aggregateSpeedBps) : "Idle"}
            </span>
          </button>
        }
      />
      <PopoverContent align="end" className="w-80 gap-3 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="size-4 text-primary" />
            Activity
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {activeCount} active · {Math.round(aggregateProgress * 100)}%
          </span>
        </div>
        <div className="flex flex-col gap-1 px-2">
          {active.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nothing downloading right now.</p>
          ) : (
            active.map((job) => (
              <div key={job.id} className="flex items-center gap-3 rounded-lg p-2">
                <MediaThumb src={job.request.thumbnailUrl} alt="" kind="video" className="w-14 rounded-md" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{job.request.title}</div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${job.progress * 100}%` }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                    <span>{Math.round(job.progress * 100)}%</span>
                    <span>{job.status === "downloading" ? formatEta(job.etaSec) : ""}</span>
                  </div>
                </div>
                {job.status !== "downloading" && <StatusBadge status={job.status} className="h-5 px-2 text-[10px]" />}
              </div>
            ))
          )}
        </div>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full" nativeButton={false} render={<Link to="/queue" />}>
            Open download queue
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
