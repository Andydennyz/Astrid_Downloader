import { Link } from "@tanstack/react-router";
import { ArrowRight, Pause, Play } from "lucide-react";
import { Panel, PanelHeader } from "@/components/layout.tsx";
import MediaThumb from "@/components/media-thumb.tsx";
import StatusBadge from "@/components/status-badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { ACTIVE_STATUSES, useDownloads } from "@/hooks/use-downloads.ts";
import { formatBytes, formatEta, formatSpeed } from "@/lib/format.ts";

/** Compact live view of what is downloading right now. */
export default function ActiveNow() {
  const { jobs, loading, pause, resume } = useDownloads();
  const items = jobs.filter((j) => ACTIVE_STATUSES.has(j.status) || j.status === "paused").slice(0, 4);

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title="In progress"
        description="Live from your queue"
        action={
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/queue" />}>
            Queue
            <ArrowRight />
          </Button>
        }
      />
      <div className="flex flex-1 flex-col gap-1 px-3 pb-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="mx-2 h-[62px] rounded-xl" />)
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">Nothing in progress.</p>
            <Button size="sm" variant="secondary" nativeButton={false} render={<Link to="/new" />}>
              Start a download
            </Button>
          </div>
        ) : (
          items.map((job) => (
            <div key={job.id} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted/40">
              <MediaThumb src={job.request.thumbnailUrl} alt="" kind="video" className="w-[68px] rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium">{job.request.title}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={job.status === "paused" ? "h-full rounded-full bg-amber-500 transition-all duration-500" : "h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"}
                    style={{ width: `${job.progress * 100}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
                  <span>
                    {job.status === "downloading"
                      ? `${formatSpeed(job.speedBps)} · ${formatEta(job.etaSec)}`
                      : job.totalBytes
                        ? `${formatBytes(job.downloadedBytes)} of ${formatBytes(job.totalBytes)}`
                        : "Preparing…"}
                  </span>
                  {job.status !== "downloading" && <StatusBadge status={job.status} className="h-5 px-2 text-[10px]" />}
                </div>
              </div>
              {(job.status === "downloading" || job.status === "paused") && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={job.status === "paused" ? "Resume" : "Pause"}
                  onClick={() => void (job.status === "paused" ? resume(job.id) : pause(job.id))}
                >
                  {job.status === "paused" ? <Play /> : <Pause />}
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
