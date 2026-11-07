import type { DownloadService } from "@/services/contracts.ts";
import { ServiceError } from "@/services/errors.ts";
import { sanitizeFilename } from "@/services/filename.ts";
import { resolveSelection } from "@/services/format-selection.ts";
import type {
  DownloadEvent,
  DownloadJob,
  DownloadRequest,
  HistoryStatus,
} from "@/services/types.ts";
import { DEFAULT_ROOT, QUEUE_SEEDS } from "./data.ts";
import { delay, makeId, mockDb } from "./store.ts";

/**
 * Simulated download engine. A real implementation would forward these calls
 * to the backend and translate its progress stream into `DownloadEvent`s.
 */

const TICK_MS = 500;
const ANALYZE_MS = 1_400;
const PROCESS_MS = 1_800;

type Internal = {
  job: DownloadJob;
  /** Fraction at which this run will fail, or null when it succeeds. */
  failAt: number | null;
  phaseEndsAt: number;
  baseSpeed: number;
};

const FAILURE_REASONS = [
  "Connection reset by the server. Try again.",
  "The source stopped responding after several attempts.",
  "Not enough free space in the destination folder.",
];

function now() {
  return new Date().toISOString();
}

export function createMockDownloadService(): DownloadService {
  const jobs = new Map<string, Internal>();
  const listeners = new Set<(event: DownloadEvent) => void>();
  let maxConcurrent = 3;
  let timer: ReturnType<typeof setInterval> | null = null;
  let failureSeed = 0;

  const emit = (event: DownloadEvent) => {
    for (const l of listeners) l(event);
  };
  const update = (entry: Internal, patch: Partial<DownloadJob>) => {
    entry.job = { ...entry.job, ...patch };
    emit({ type: "job.updated", job: entry.job });
  };

  function pickFailure(): number | null {
    // Roughly one in seven new runs fails so the failed state is visible.
    failureSeed += 1;
    return failureSeed % 7 === 3 ? 0.35 + (failureSeed % 5) * 0.1 : null;
  }

  function createJob(request: DownloadRequest, overrides?: Partial<DownloadJob>) {
    const resolved = resolveSelection(request.selection, [], request.durationSec);
    const job: DownloadJob = {
      id: makeId("job"),
      request,
      kind: resolved.kind,
      extension: resolved.extension,
      qualityLabel: resolved.qualityLabel.replace(/^Best \((.+)\)$/, "$1"),
      status: "queued",
      progress: 0,
      downloadedBytes: 0,
      totalBytes: null,
      speedBps: null,
      etaSec: null,
      createdAt: now(),
      ...overrides,
    };
    const entry: Internal = {
      job,
      failAt: pickFailure(),
      phaseEndsAt: 0,
      baseSpeed: 4_000_000 + Math.random() * 9_000_000,
    };
    jobs.set(job.id, entry);
    // The size estimate is revealed once the simulated analysis finishes.
    return { entry, estimated: resolved.estimatedBytes ?? 50_000_000 };
  }

  const estimates = new Map<string, number>();

  function finish(entry: Internal) {
    const { job } = entry;
    const base = job.request.filename?.trim()
      ? sanitizeFilename(job.request.filename)
      : sanitizeFilename(`${job.request.title} [${job.qualityLabel}]`);
    const filename = `${base}.${job.extension}`;
    const filePath = `${job.request.destination}/${filename}`;
    update(entry, {
      status: "completed",
      progress: 1,
      downloadedBytes: job.totalBytes ?? job.downloadedBytes,
      speedBps: null,
      etaSec: null,
      completedAt: now(),
      filePath,
    });
    const size = entry.job.totalBytes ?? 0;
    mockDb.addLibraryItem({
      id: `lib_${job.id}`,
      kind: job.kind,
      filename,
      title: job.request.title,
      creator: job.request.creator,
      thumbnailUrl: job.request.thumbnailUrl,
      extension: job.extension,
      qualityLabel: job.qualityLabel,
      height: job.kind === "video" ? Number.parseInt(job.qualityLabel, 10) || undefined : undefined,
      durationSec: job.request.durationSec,
      sizeBytes: size,
      downloadedAt: now(),
      filePath,
      sourceUrl: job.request.sourceUrl,
      platform: "other",
    });
    record(entry, "completed");
  }

  function record(entry: Internal, status: HistoryStatus) {
    const { job } = entry;
    mockDb.addHistory({
      id: `hist_${job.id}_${Date.now()}`,
      title: job.request.title,
      creator: job.request.creator,
      thumbnailUrl: job.request.thumbnailUrl,
      sourceUrl: job.request.sourceUrl,
      platform: "other",
      kind: job.kind,
      status,
      durationSec: job.request.durationSec,
      extension: job.extension,
      qualityLabel: job.qualityLabel,
      sizeBytes: status === "completed" ? (job.totalBytes ?? undefined) : undefined,
      filePath: status === "completed" ? job.filePath : undefined,
      error: job.error,
      timestamp: now(),
    });
  }

  function activeCount() {
    let n = 0;
    for (const { job } of jobs.values()) {
      if (job.status === "analyzing" || job.status === "downloading") n += 1;
    }
    return n;
  }

  function tick() {
    const t = Date.now();

    for (const entry of jobs.values()) {
      const { job } = entry;
      if (job.status === "analyzing" && t >= entry.phaseEndsAt) {
        const total = estimates.get(job.id) ?? 50_000_000;
        update(entry, { status: "downloading", totalBytes: total });
      } else if (job.status === "downloading") {
        const total = job.totalBytes ?? 50_000_000;
        // Wobble the speed so the readout feels alive.
        const speed = entry.baseSpeed * (0.75 + Math.random() * 0.5);
        const downloaded = Math.min(total, job.downloadedBytes + speed * (TICK_MS / 1000));
        const progress = downloaded / total;
        if (entry.failAt !== null && progress >= entry.failAt) {
          const reason = FAILURE_REASONS[failureSeed % FAILURE_REASONS.length] ?? FAILURE_REASONS[0];
          update(entry, {
            status: "failed",
            progress,
            downloadedBytes: downloaded,
            speedBps: null,
            etaSec: null,
            error: reason,
          });
          record(entry, "failed");
          continue;
        }
        if (progress >= 1) {
          entry.phaseEndsAt = t + PROCESS_MS;
          update(entry, {
            status: "processing",
            progress: 1,
            downloadedBytes: total,
            speedBps: null,
            etaSec: null,
          });
        } else {
          update(entry, {
            progress,
            downloadedBytes: downloaded,
            speedBps: speed,
            etaSec: (total - downloaded) / speed,
          });
        }
      } else if (job.status === "processing" && t >= entry.phaseEndsAt) {
        finish(entry);
      }
    }

    // Promote queued jobs into free slots, oldest first.
    let free = maxConcurrent - activeCount();
    if (free > 0) {
      const queued = [...jobs.values()]
        .filter((e) => e.job.status === "queued")
        .sort((a, b) => a.job.createdAt.localeCompare(b.job.createdAt));
      for (const entry of queued) {
        if (free <= 0) break;
        entry.phaseEndsAt = t + ANALYZE_MS;
        update(entry, { status: "analyzing" });
        free -= 1;
      }
    }
  }

  function ensureTicker() {
    if (timer || typeof window === "undefined") return;
    timer = setInterval(tick, TICK_MS);
  }

  function seed() {
    const base = Date.now() - 60_000;
    QUEUE_SEEDS.forEach((s, i) => {
      const request: DownloadRequest = {
        sourceUrl: s.sourceUrl,
        title: s.title,
        creator: s.creator,
        thumbnailUrl: s.thumbnailUrl,
        durationSec: s.durationSec,
        selection: {
          mode: s.mode,
          videoQuality: s.quality,
          audioFormat: "best",
          container: "mp4",
        },
        destination: `${DEFAULT_ROOT}/${s.mode === "audio" ? "Audio" : "Video"}`,
      };
      const { entry, estimated } = createJob(request, {
        createdAt: new Date(base + i * 1000).toISOString(),
      });
      entry.failAt = null;
      estimates.set(entry.job.id, estimated);
      if (s.progress > 0) {
        entry.job.status = "paused" in s && s.paused ? "paused" : "downloading";
        entry.job.totalBytes = estimated;
        entry.job.downloadedBytes = estimated * s.progress;
        entry.job.progress = s.progress;
      }
    });
  }
  seed();

  function get(jobId: string) {
    const entry = jobs.get(jobId);
    if (!entry) throw new ServiceError("NOT_FOUND", "That download no longer exists.");
    return entry;
  }

  return {
    async list() {
      await delay(250);
      return [...jobs.values()].map((e) => e.job);
    },

    async start(request) {
      await delay(200);
      const { entry, estimated } = createJob(request);
      estimates.set(entry.job.id, estimated);
      emit({ type: "job.updated", job: entry.job });
      ensureTicker();
      return entry.job;
    },

    async pause(jobId) {
      const entry = get(jobId);
      if (!["queued", "analyzing", "downloading"].includes(entry.job.status)) {
        throw new ServiceError("INVALID_STATE", "Only active downloads can be paused.");
      }
      update(entry, { status: "paused", speedBps: null, etaSec: null });
      return entry.job;
    },

    async resume(jobId) {
      const entry = get(jobId);
      if (entry.job.status !== "paused") {
        throw new ServiceError("INVALID_STATE", "This download is not paused.");
      }
      // Resumed jobs wait for a free slot like any queued job.
      update(entry, {
        status: entry.job.totalBytes ? "downloading" : "queued",
      });
      return entry.job;
    },

    async cancel(jobId) {
      const entry = get(jobId);
      if (["completed", "cancelled"].includes(entry.job.status)) {
        throw new ServiceError("INVALID_STATE", "This download has already finished.");
      }
      update(entry, { status: "cancelled", speedBps: null, etaSec: null });
      record(entry, "cancelled");
      return entry.job;
    },

    async retry(jobId) {
      const entry = get(jobId);
      if (!["failed", "cancelled"].includes(entry.job.status)) {
        throw new ServiceError("INVALID_STATE", "Only failed or cancelled downloads can be retried.");
      }
      entry.failAt = null;
      update(entry, {
        status: "queued",
        progress: 0,
        downloadedBytes: 0,
        totalBytes: null,
        error: undefined,
        createdAt: now(),
      });
      return entry.job;
    },

    async remove(jobId) {
      const entry = get(jobId);
      if (["analyzing", "downloading", "processing"].includes(entry.job.status)) {
        throw new ServiceError("INVALID_STATE", "Pause or cancel this download before removing it.");
      }
      jobs.delete(jobId);
      emit({ type: "job.removed", jobId });
    },

    async getProgress(jobId) {
      return jobs.get(jobId)?.job ?? null;
    },

    subscribe(listener) {
      listeners.add(listener);
      ensureTicker();
      return () => {
        listeners.delete(listener);
      };
    },

    setMaxConcurrent(limit) {
      maxConcurrent = Math.max(1, Math.min(10, Math.round(limit)));
    },
  };
}
