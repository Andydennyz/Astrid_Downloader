import { createFileRoute } from "@tanstack/react-router";
import { Clock3, Download, Eye, PauseCircle, Play, RotateCcw, Trash2, XCircle } from "lucide-react";
import { PageContainer, Panel } from "@/components/layout.tsx";
import StatusBadge from "@/components/status-badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useDownloads } from "@/hooks/use-downloads.ts";
import { formatBytes, formatEta, formatSpeed } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import type { DownloadJob } from "@/services/index.ts";

export const Route = createFileRoute("/_app/queue")({
  head: () => ({ meta: [{ title: "Download Queue · Astrid Downloader" }] }),
  component: Page,
});

function ActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: typeof PauseCircle;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={onClick} disabled={disabled}>
      <Icon className="size-3.5" />
      {label}
    </Button>
  );
}

function QueueCard({ job, onPause, onResume, onCancel, onRetry, onRemove }: {
  job: DownloadJob;
  onPause: (jobId: string) => void;
  onResume: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  onRemove: (jobId: string) => void;
}) {
  const primaryAction =
    job.status === "paused"
      ? { label: "Resume", icon: Play, onClick: () => onResume(job.id) }
      : ["queued", "analyzing", "downloading", "processing"].includes(job.status)
        ? { label: "Pause", icon: PauseCircle, onClick: () => onPause(job.id) }
        : ["failed", "cancelled"].includes(job.status)
          ? { label: "Retry", icon: RotateCcw, onClick: () => onRetry(job.id) }
          : null;

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative h-20 w-full overflow-hidden rounded-xl bg-muted md:w-28">
          <img src={job.request.thumbnailUrl} alt={job.request.title} className="h-full w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] text-white">
            <span>{job.qualityLabel}</span>
            <span>{job.extension.toUpperCase()}</span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-foreground">{job.request.title}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{job.request.creator}</span>
                <span>•</span>
                <span>{job.kind === "video" ? "Video" : "Audio"}</span>
                <span>•</span>
                <span>{formatBytes(job.totalBytes ?? job.downloadedBytes)}</span>
              </div>
            </div>
            <StatusBadge status={job.status} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Download className="size-3.5" />{job.status === "completed" ? "Complete" : `${Math.round((job.progress ?? 0) * 100)}%`}</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{job.speedBps ? formatSpeed(job.speedBps) : "Waiting"}</span>
            <span className="inline-flex items-center gap-1.5"><Eye className="size-3.5" />{job.etaSec ? formatEta(job.etaSec) : "—"}</span>
          </div>

          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-500",
                job.status === "failed" && "bg-gradient-to-r from-destructive to-orange-400",
                job.status === "cancelled" && "bg-muted",
              )}
              style={{ width: `${Math.max(6, (job.progress ?? 0) * 100)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          {primaryAction && (
            <ActionButton
              label={primaryAction.label}
              icon={primaryAction.icon}
              onClick={primaryAction.onClick}
            />
          )}
          {job.status !== "completed" && job.status !== "cancelled" && (
            <ActionButton label="Cancel" icon={XCircle} onClick={() => onCancel(job.id)} />
          )}
          {job.status === "failed" || job.status === "cancelled" ? (
            <ActionButton label="Remove" icon={Trash2} onClick={() => onRemove(job.id)} />
          ) : null}
          {job.status !== "failed" && job.status !== "cancelled" && job.status !== "completed" && (
            <ActionButton label="Remove" icon={Trash2} onClick={() => onRemove(job.id)} />
          )}
        </div>
      </div>
    </div>
  );
}

function Page() {
  const { jobs, pause, resume, cancel, retry, remove, activeCount } = useDownloads();

  return (
    <PageContainer className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Live renderer</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Download queue</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-sm text-muted-foreground">
          <span className="inline-flex size-2 rounded-full bg-primary" />
          {activeCount} active jobs
        </div>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold">Queue overview</h3>
            <p className="text-sm text-muted-foreground">Real-time mock progress from the simulated backend.</p>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border px-2.5 py-1">{jobs.filter((job) => job.status === "downloading").length} downloading</span>
            <span className="rounded-full border border-border px-2.5 py-1">{jobs.filter((job) => job.status === "queued").length} queued</span>
            <span className="rounded-full border border-border px-2.5 py-1">{jobs.filter((job) => job.status === "paused").length} paused</span>
          </div>
        </div>

        <div className="space-y-3 px-5 pb-5">
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
              The queue is empty. Add a new link to watch it appear here.
            </div>
          ) : (
            jobs.map((job) => (
              <QueueCard
                key={job.id}
                job={job}
                onPause={pause}
                onResume={resume}
                onCancel={cancel}
                onRetry={retry}
                onRemove={remove}
              />
            ))
          )}
        </div>
      </Panel>
    </PageContainer>
  );
}
