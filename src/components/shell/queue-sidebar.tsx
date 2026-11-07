import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpDown,
  Clock3,
  Gauge,
  GripVertical,
  ListOrdered,
  PauseCircle,
  Play,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import StatusBadge from "@/components/status-badge.tsx";
import { useDownloads } from "@/hooks/use-downloads.ts";
import { formatBytes, formatEta, formatSpeed } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import type { DownloadJob, DownloadPriority, DownloadStatus } from "@/services/types.ts";

type SortMode = "manual" | "priority" | "speed";

const PRIORITY_ORDER: Record<DownloadPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

function inferPriority(job: DownloadJob): DownloadPriority {
  if (job.priority) return job.priority;
  if (job.status === "downloading" || job.status === "processing") return "high";
  if (job.status === "paused") return "low";
  return "normal";
}

function QueueItem({
  job,
  selected,
  sortMode,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onSelect,
  onDrop,
  onDragStart,
  onDragEnd,
  draggedId,
}: {
  job: DownloadJob & { priority: DownloadPriority };
  selected: boolean;
  sortMode: SortMode;
  onPause: (jobId: string) => void;
  onResume: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onRetry: (jobId: string) => void;
  onSelect: (jobId: string) => void;
  onDrop: (sourceId: string, targetId: string) => void;
  onDragStart: (jobId: string) => void;
  onDragEnd: () => void;
  draggedId: string | null;
}) {
  const isPaused = job.status === "paused";
  const isActive = ["queued", "analyzing", "downloading", "processing"].includes(job.status);
  const canRetry = ["failed", "cancelled"].includes(job.status);
  const canQueueAction = job.status !== "completed" && job.status !== "cancelled";

  return (
    <div
      draggable={sortMode === "manual"}
      onDragStart={() => {
        if (sortMode === "manual") {
          onSelect(job.id);
          onDragStart(job.id);
        }
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (sortMode === "manual") event.preventDefault();
      }}
      onDrop={(event) => {
        if (sortMode === "manual" && draggedId && draggedId !== job.id) {
          event.preventDefault();
          onDrop(draggedId, job.id);
          onDragEnd();
        }
      }}
      className={cn(
        "cursor-pointer rounded-xl border p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] transition-all duration-200",
        selected
          ? "border-primary/50 bg-primary/8 ring-1 ring-primary/30"
          : "border-border/80 bg-card/60 hover:border-border hover:bg-card/80",
      )}
      onClick={() => onSelect(job.id)}
    >
      <div className="flex items-start gap-2.5">
        <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          <img src={job.request.thumbnailUrl} alt={job.request.title} className="h-full w-full object-cover" />
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent px-1.5 py-0.5 text-[8px] text-white">
            <span>{job.qualityLabel}</span>
            <span>{job.extension.toUpperCase()}</span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold leading-tight">{job.request.title}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{job.request.creator}</div>
            </div>
            <div className="flex items-center gap-1.5">
              {sortMode === "manual" && <GripVertical className="size-3 text-muted-foreground/70" />}
              <StatusBadge status={job.status as DownloadStatus} className="h-5 px-1.5 text-[9px]" />
            </div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${Math.max(6, job.progress * 100)}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>{Math.round(job.progress * 100)}%</span>
            <span>{job.speedBps ? formatSpeed(job.speedBps) : "Waiting"}</span>
            <span>{job.etaSec ? formatEta(job.etaSec) : "—"}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
            {job.priority.toUpperCase()}
          </span>
          <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
            {job.qualityLabel}
          </span>
        </div>
        <div className="flex gap-1">
          {isPaused ? (
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => onResume(job.id)} aria-label="Resume download">
              <Play className="size-3" />
            </Button>
          ) : isActive ? (
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => onPause(job.id)} aria-label="Pause download">
              <PauseCircle className="size-3" />
            </Button>
          ) : canRetry ? (
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => onRetry(job.id)} aria-label="Retry download">
              <RotateCcw className="size-3" />
            </Button>
          ) : null}
          {canQueueAction && (
            <Button type="button" variant="ghost" size="icon-xs" onClick={() => onCancel(job.id)} aria-label="Cancel download">
              <XCircle className="size-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QueueSidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { jobs, activeCount, pause, resume, cancel, retry } = useDownloads();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [priorityOverrides, setPriorityOverrides] = useState<Record<string, DownloadPriority>>({});

  const activeJobs = useMemo(
    () =>
      jobs
        .filter((job) => ["queued", "analyzing", "downloading", "processing", "paused"].includes(job.status))
        .map((job) => ({
          ...job,
          priority: priorityOverrides[job.id] ?? inferPriority(job),
        })),
    [jobs, priorityOverrides],
  );

  useEffect(() => {
    setManualOrder((current) => {
      const next = current.filter((id) => activeJobs.some((job) => job.id === id));
      for (const job of activeJobs) {
        if (!next.includes(job.id)) next.push(job.id);
      }
      return next;
    });
  }, [activeJobs]);

  useEffect(() => {
    if (!activeJobs.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !activeJobs.some((job) => job.id === selectedId)) {
      setSelectedId(activeJobs[0].id);
    }
  }, [activeJobs, selectedId]);

  const orderedJobs = useMemo(() => {
    const sorted = [...activeJobs];
    if (sortMode === "manual") {
      const order = new Map(manualOrder.map((id, index) => [id, index]));
      return sorted.sort((a, b) => {
        const aIndex = order.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const bIndex = order.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return aIndex - bIndex;
      });
    }
    if (sortMode === "priority") {
      return sorted.sort((a, b) => {
        const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        const statusPriority = ["downloading", "processing", "analyzing", "queued", "paused"];
        const statusDiff = statusPriority.indexOf(a.status) - statusPriority.indexOf(b.status);
        if (statusDiff !== 0) return statusDiff;
        return b.progress - a.progress;
      });
    }
    return sorted.sort((a, b) => (b.speedBps ?? 0) - (a.speedBps ?? 0) || b.progress - a.progress);
  }, [activeJobs, manualOrder, sortMode]);

  const selectedJob = orderedJobs.find((job) => job.id === selectedId) ?? orderedJobs[0] ?? null;
  const downloading = jobs.filter((job) => job.status === "downloading").length;
  const queued = jobs.filter((job) => job.status === "queued").length;
  const paused = jobs.filter((job) => job.status === "paused").length;
  const failed = jobs.filter((job) => job.status === "failed").length;

  const moveJob = (sourceId: string, targetId: string) => {
    if (!sourceId || sourceId === targetId) return;
    setManualOrder((current) => {
      const next = [...current];
      const sourceIndex = next.indexOf(sourceId);
      const targetIndex = next.indexOf(targetId);
      if (sourceIndex === -1 || targetIndex === -1) return next;
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceId);
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 border-l border-sidebar-border bg-sidebar/90 backdrop-blur-xl transition-all duration-300 xl:flex",
        open ? "w-[350px]" : "w-0 overflow-hidden border-l-0",
      )}
    >
      <div className={cn("flex h-full w-[350px] min-w-[350px] flex-col", !open && "hidden")}>
        <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="size-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">Download queue</div>
              <div className="text-[11px] text-sidebar-foreground/60">{activeCount} active</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="grid size-7 place-items-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Collapse queue sidebar"
          >
            <ArrowRight className="size-3.5 rotate-180" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 p-3">
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/55">Downloading</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{downloading}</div>
          </div>
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/55">Queued</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{queued}</div>
          </div>
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/55">Paused</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{paused}</div>
          </div>
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/55">Failed</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{failed}</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-sidebar-border px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/55">Queue mode</div>
          <div className="inline-flex rounded-full border border-border bg-sidebar-accent/30 p-0.5">
            {(["priority", "speed", "manual"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setSortMode(mode)}
                className={cn(
                  "rounded-full px-2 py-1 text-[10px] font-medium capitalize transition-colors",
                  sortMode === mode ? "bg-primary text-primary-foreground" : "text-sidebar-foreground/65 hover:text-sidebar-foreground",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-3 pb-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/55">Live jobs</div>
          <Button type="button" variant="ghost" size="xs" nativeButton={false} render={<Link to="/queue" />} className="gap-1">
            Full queue
          </Button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
          {orderedJobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-sidebar-border bg-sidebar-accent/25 p-4 text-center text-sm text-sidebar-foreground/60">
              Queue is clear.
            </div>
          ) : (
            orderedJobs.map((job) => (
              <QueueItem
                key={job.id}
                job={job}
                selected={selectedJob?.id === job.id}
                sortMode={sortMode}
                onPause={pause}
                onResume={resume}
                onCancel={cancel}
                onRetry={retry}
                onSelect={setSelectedId}
                onDrop={moveJob}
                onDragStart={setDraggedId}
                onDragEnd={() => setDraggedId(null)}
                draggedId={draggedId}
              />
            ))
          )}
        </div>

        {selectedJob && (
          <div className="border-t border-sidebar-border bg-sidebar-accent/30 p-3">
            <div className="flex items-start gap-3">
              <img src={selectedJob.request.thumbnailUrl} alt={selectedJob.request.title} className="h-14 w-20 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-sm font-semibold">{selectedJob.request.title}</div>
                  <StatusBadge status={selectedJob.status as DownloadStatus} className="h-5 px-1.5 text-[9px]" />
                </div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-sidebar-foreground/65">
                  <span>{selectedJob.request.creator}</span>
                  <span>•</span>
                  <span>{formatBytes(selectedJob.totalBytes ?? selectedJob.downloadedBytes)}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-sidebar-border bg-background/25 p-2">
                <div className="flex items-center justify-center text-[10px] text-sidebar-foreground/55"><Gauge className="mr-1 size-3" /> Speed</div>
                <div className="mt-1 text-sm font-semibold tabular-nums">{selectedJob.speedBps ? formatSpeed(selectedJob.speedBps) : "Idle"}</div>
              </div>
              <div className="rounded-lg border border-sidebar-border bg-background/25 p-2">
                <div className="flex items-center justify-center text-[10px] text-sidebar-foreground/55"><Clock3 className="mr-1 size-3" /> ETA</div>
                <div className="mt-1 text-sm font-semibold tabular-nums">{selectedJob.etaSec ? formatEta(selectedJob.etaSec) : "—"}</div>
              </div>
              <div className="rounded-lg border border-sidebar-border bg-background/25 p-2">
                <div className="flex items-center justify-center text-[10px] text-sidebar-foreground/55"><Sparkles className="mr-1 size-3" /> Priority</div>
                <div className="mt-1 text-sm font-semibold capitalize">{selectedJob.priority}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              {(["high", "normal", "low"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPriorityOverrides((current) => ({ ...current, [selectedJob.id]: level }))}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1.5 text-[10px] font-medium capitalize transition-colors",
                    selectedJob.priority === level
                      ? "border-primary/50 bg-primary/12 text-primary"
                      : "border-sidebar-border bg-background/20 text-sidebar-foreground/70 hover:text-sidebar-foreground",
                  )}
                >
                  {level}
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              {selectedJob.status === "paused" ? (
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => resume(selectedJob.id)}>
                  <Play className="mr-1 size-3.5" /> Resume
                </Button>
              ) : ["queued", "analyzing", "downloading", "processing"].includes(selectedJob.status) ? (
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => pause(selectedJob.id)}>
                  <PauseCircle className="mr-1 size-3.5" /> Pause
                </Button>
              ) : ["failed", "cancelled"].includes(selectedJob.status) ? (
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={() => retry(selectedJob.id)}>
                  <RotateCcw className="mr-1 size-3.5" /> Retry
                </Button>
              ) : null}
              {selectedJob.status !== "completed" && selectedJob.status !== "cancelled" && (
                <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => cancel(selectedJob.id)}>
                  <XCircle className="mr-1 size-3.5" /> Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
