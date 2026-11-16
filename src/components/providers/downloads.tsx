import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ACTIVE_STATUSES,
  DownloadsContext,
  type AppNotification,
  type DownloadsContextValue,
} from "@/hooks/use-downloads.ts";
import { errorMessage } from "@/services/errors.ts";
import { getServices, type DownloadJob } from "@/services/index.ts";

type StatusStream = {
  start: () => void;
  stop: () => void;
};

function createPollingStatusStream(
  refresh: () => Promise<void>,
  getIntervalMs: () => number,
): StatusStream {
  let timeoutId: number | undefined;
  let stopped = true;
  let inFlight = false;

  const schedule = () => {
    if (stopped || document.visibilityState !== "visible") return;
    timeoutId = window.setTimeout(() => void poll(), getIntervalMs());
  };

  const poll = async () => {
    if (stopped || inFlight || document.visibilityState !== "visible") return;
    inFlight = true;
    try {
      await refresh();
    } finally {
      inFlight = false;
      schedule();
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      void poll();
    } else if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      document.addEventListener("visibilitychange", onVisibilityChange);
      void poll();
    },
    stop() {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = undefined;
    },
  };
}

function downloadJobsAreEqual(previous: DownloadJob[], next: DownloadJob[]) {
  return (
    previous.length === next.length &&
    previous.every((job, index) => {
      const nextJob = next[index];
      return (
        job.id === nextJob.id &&
        job.kind === nextJob.kind &&
        job.extension === nextJob.extension &&
        job.qualityLabel === nextJob.qualityLabel &&
        job.priority === nextJob.priority &&
        job.status === nextJob.status &&
        job.progress === nextJob.progress &&
        job.downloadedBytes === nextJob.downloadedBytes &&
        job.totalBytes === nextJob.totalBytes &&
        job.speedBps === nextJob.speedBps &&
        job.etaSec === nextJob.etaSec &&
        job.error === nextJob.error &&
        job.createdAt === nextJob.createdAt &&
        job.completedAt === nextJob.completedAt &&
        job.filePath === nextJob.filePath &&
        JSON.stringify(job.request) === JSON.stringify(nextJob.request)
      );
    })
  );
}

/**
 * Holds the live download queue and refreshes it from the backend.
 */
export default function DownloadsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const lastStatus = useRef(new Map<string, DownloadJob["status"]>());
  const hasActiveJobs = useRef(false);

  const notify = useCallback(
    (n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
      setNotifications((prev) =>
        [
          {
            ...n,
            id: `n_${Date.now()}_${prev.length}`,
            createdAt: new Date().toISOString(),
            read: false,
          },
          ...prev,
        ].slice(0, 30),
      );
    },
    [],
  );

  const syncJobs = useCallback(async () => {
    try {
      const { downloads } = getServices();
      const nextJobs = await downloads.list();
      const nextStatus = new Map<string, DownloadJob["status"]>();

      for (const job of nextJobs) {
        const previous = lastStatus.current.get(job.id);
        nextStatus.set(job.id, job.status);

        if (previous !== job.status && previous !== undefined) {
          if (["completed", "failed", "cancelled"].includes(job.status)) {
            void queryClient.invalidateQueries({
              queryKey: ["astrid", "history"],
            });
            void queryClient.invalidateQueries({
              queryKey: ["astrid", "library"],
            });
            void queryClient.invalidateQueries({
              queryKey: ["astrid", "overview"],
            });
          }
          if (job.status === "completed") {
            notify({
              kind: "completed",
              title: "Download complete",
              body: `${job.request.title} is ready.`,
            });
            toast.success("Download complete", {
              description: job.request.title,
            });
          } else if (job.status === "failed") {
            notify({
              kind: "failed",
              title: "Download failed",
              body: `${job.request.title}: ${job.error ?? "Unknown error"}`,
            });
            toast.error("Download failed", { description: job.request.title });
          }
        }
      }

      lastStatus.current = nextStatus;
      hasActiveJobs.current = nextJobs.some((job) =>
        ACTIVE_STATUSES.has(job.status),
      );
      setJobs((current) =>
        downloadJobsAreEqual(current, nextJobs) ? current : nextJobs,
      );
      setError(null);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setError(errorMessage(error, "Could not refresh the download queue."));
    }
  }, [notify, queryClient]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const statusStream = createPollingStatusStream(syncJobs, () =>
      hasActiveJobs.current ? 2500 : 15000,
    );

    statusStream.start();
    return () => statusStream.stop();
  }, [syncJobs]);

  const run = useCallback(
    async (action: () => Promise<unknown>, fallback: string) => {
      try {
        await action();
        await syncJobs();
      } catch (error) {
        toast.error(errorMessage(error, fallback));
      }
    },
    [syncJobs],
  );

  const value = useMemo<DownloadsContextValue>(() => {
    const { downloads } = getServices();
    const active = jobs.filter((j) => ACTIVE_STATUSES.has(j.status));
    const sized = active.filter((j) => j.totalBytes);
    const total = sized.reduce((s, j) => s + (j.totalBytes ?? 0), 0);
    const done = sized.reduce((s, j) => s + j.downloadedBytes, 0);
    return {
      jobs,
      loading,
      error,
      refresh: syncJobs,
      activeCount: active.length,
      aggregateProgress: total ? done / total : 0,
      aggregateSpeedBps: active.reduce((s, j) => s + (j.speedBps ?? 0), 0),
      start: async (request) => {
        try {
          const job = await downloads.start(request);
          notify({
            kind: "info",
            title: "Added to queue",
            body: request.title,
          });
          await syncJobs();
          return job;
        } catch (error) {
          toast.error(errorMessage(error, "Could not start the download."));
          return null;
        }
      },
      pause: (id) =>
        run(() => downloads.pause(id), "Could not pause the download."),
      resume: (id) =>
        run(() => downloads.resume(id), "Could not resume the download."),
      cancel: (id) =>
        run(() => downloads.cancel(id), "Could not cancel the download."),
      retry: (id) =>
        run(() => downloads.retry(id), "Could not retry the download."),
      remove: (id) =>
        run(() => downloads.remove(id), "Could not remove the download."),
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      markAllRead: () =>
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
      dismissNotification: (id) =>
        setNotifications((prev) => prev.filter((n) => n.id !== id)),
      clearNotifications: () => setNotifications([]),
    };
  }, [error, jobs, loading, notifications, notify, run, syncJobs]);

  return <DownloadsContext value={value}>{children}</DownloadsContext>;
}
