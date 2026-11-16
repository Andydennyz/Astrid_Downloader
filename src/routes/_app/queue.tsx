import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Clock3, Download, Eye, FolderOpen, LoaderCircle, PauseCircle, Play, RotateCcw, Trash2, XCircle } from "lucide-react";
import { PageContainer, Panel } from "@/components/layout.tsx";
import DataLoadError from "@/components/data-load-error.tsx";
import StatusBadge from "@/components/status-badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useDownloads } from "@/hooks/use-downloads.ts";
import { formatBytes, formatEta, formatSpeed } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import type { DownloadJob } from "@/services/index.ts";

export const Route = createFileRoute("/_app/queue")({
  head: () => ({ meta: [{ title: "Download Queue · MediaDock" }] }),
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

function getActivityMessage(job: DownloadJob) {
  switch (job.status) {
    case "queued":
      return "Waiting for a download slot";
    case "analyzing":
      return "Checking the link and available formats";
    case "downloading":
      if (job.speedBps) return `Downloading at ${formatSpeed(job.speedBps)}`;
      if (job.downloadedBytes > 0) return `${formatBytes(job.downloadedBytes)} downloaded`;
      return "Connecting to source…";
    case "processing":
      return "Finishing and saving your file";
    case "paused":
      return "Download paused";
    case "completed":
      return "Download complete";
    case "failed":
      return job.error || "Download failed";
    case "cancelled":
      return "Download cancelled";
  }
}

function QueueCard({ job, onPause, onResume, onCancel, onRetry, onRemove }: {
  job: DownloadJob;
  onPause: (jobId: string) => void;
  onResume: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  onRemove: (jobId: string) => void;
}) {
  const progress = job.status === "completed" ? 100 : Math.min(100, Math.max(0, (job.progress ?? 0) * 100));
  const isActive = ["queued", "analyzing", "downloading", "processing"].includes(job.status);
  const isIndeterminate =
    job.status === "queued" ||
    job.status === "analyzing" ||
    (job.status === "downloading" && (!job.totalBytes || !job.downloadedBytes));
  const activityMessage = getActivityMessage(job);
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
          <img src={job.request.thumbnailUrl} alt={job.request.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
            <span className="inline-flex items-center gap-1.5"><Download className="size-3.5" />{Math.round(progress)}%</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{job.speedBps ? formatSpeed(job.speedBps) : job.status === "queued" ? "Queued" : "—"}</span>
            <span className="inline-flex items-center gap-1.5"><Eye className="size-3.5" />{job.etaSec ? formatEta(job.etaSec) : "—"}</span>
          </div>

          <div className="mt-3 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            {isActive ? (
              <LoaderCircle className="size-3.5 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
            ) : (
              <Activity className="size-3.5 shrink-0" />
            )}
            <span className={cn("truncate", job.status === "failed" && "text-destructive")}>{activityMessage}</span>
            {job.status === "downloading" && job.downloadedBytes > 0 && (
              <span className="ml-auto shrink-0 tabular-nums">{formatBytes(job.downloadedBytes)} received</span>
            )}
          </div>

          <div
            className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={`Download progress for ${job.request.title}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-valuetext={`${Math.round(progress)}% · ${activityMessage}`}
          >
            {isIndeterminate ? (
              <span className="download-progress-indicator absolute inset-y-0 left-0 w-1/4 rounded-full bg-gradient-to-r from-primary/50 via-primary to-accent" />
            ) : (
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-1000 ease-out",
                  job.status === "failed" && "bg-gradient-to-r from-destructive to-orange-400",
                  job.status === "cancelled" && "bg-muted",
                )}
                style={{ width: `${progress}%` }}
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <Button
            type="button"
            nativeButton={false}
            render={<Link to={job.kind === "video" ? "/video" : "/audio"} />}
            variant="ghost"
            size="sm"
            className="gap-1.5"
          >
            <FolderOpen className="size-3.5" />
            {job.kind === "video" ? "Video library" : "Audio library"}
          </Button>
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
  const { jobs, loading, error, refresh, pause, resume, cancel, retry, remove, activeCount } = useDownloads();

  return (
    <PageContainer className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Live renderer</p>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Download queue</h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-sm text-muted-foreground shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/80" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
          <span className="tabular-nums">{activeCount}</span>
          <span>active jobs</span>
        </div>
      </div>

      {error && <DataLoadError error={error} onRetry={() => void refresh()} />}

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold">Queue overview</h3>
            <p className="text-sm text-muted-foreground">Real-time status updates from the database-backed backend.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
              <span className="inline-flex size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
            <span className="rounded-full border border-border px-2.5 py-1">{jobs.filter((job) => job.status === "downloading").length} downloading</span>
            <span className="rounded-full border border-border px-2.5 py-1">{jobs.filter((job) => job.status === "queued").length} queued</span>
            <span className="rounded-full border border-border px-2.5 py-1">{jobs.filter((job) => job.status === "paused").length} paused</span>
          </div>
        </div>

        <div className="space-y-3 px-5 pb-5">
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))
          ) : jobs.length === 0 ? (
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
