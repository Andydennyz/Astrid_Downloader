import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ACTIVE_STATUSES,
  DownloadsContext,
  type AppNotification,
  type DownloadsContextValue,
} from "@/hooks/use-downloads.ts";
import { errorMessage } from "@/services/errors.ts";
import { getServices, type DownloadJob } from "@/services/index.ts";

const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n_seed_1",
    kind: "completed",
    title: "Download complete",
    body: "Patagonia from Above — 4K Drone Film is ready.",
    createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    read: false,
  },
  {
    id: "n_seed_2",
    kind: "failed",
    title: "Download failed",
    body: "Members-only Livestream Replay requires a channel membership.",
    createdAt: new Date(Date.now() - 7 * 3_600_000).toISOString(),
    read: true,
  },
];

/**
 * Holds the live download queue. It listens to the download service's event
 * stream, which a real backend would feed over WebSocket or SSE.
 */
export default function DownloadsProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>(SEED_NOTIFICATIONS);
  const lastStatus = useRef(new Map<string, DownloadJob["status"]>());

  const notify = useCallback((n: Omit<AppNotification, "id" | "createdAt" | "read">) => {
    setNotifications((prev) => [
      { ...n, id: `n_${Date.now()}_${prev.length}`, createdAt: new Date().toISOString(), read: false },
      ...prev,
    ].slice(0, 30));
  }, []);

  useEffect(() => {
    const { downloads } = getServices();
    let alive = true;

    void downloads.list().then((initial) => {
      if (!alive) return;
      for (const job of initial) lastStatus.current.set(job.id, job.status);
      setJobs(initial);
      setLoading(false);
    });

    const unsubscribe = downloads.subscribe((event) => {
      if (event.type === "job.removed") {
        lastStatus.current.delete(event.jobId);
        setJobs((prev) => prev.filter((j) => j.id !== event.jobId));
        return;
      }
      const { job } = event;
      const previous = lastStatus.current.get(job.id);
      lastStatus.current.set(job.id, job.status);
      if (previous !== job.status) {
        if (job.status === "completed") {
          notify({ kind: "completed", title: "Download complete", body: `${job.request.title} is ready.` });
          toast.success("Download complete", { description: job.request.title });
        } else if (job.status === "failed") {
          notify({ kind: "failed", title: "Download failed", body: `${job.request.title}: ${job.error ?? "Unknown error"}` });
          toast.error("Download failed", { description: job.request.title });
        }
      }
      setJobs((prev) => {
        const index = prev.findIndex((j) => j.id === job.id);
        if (index === -1) return [job, ...prev];
        const next = prev.slice();
        next[index] = job;
        return next;
      });
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [notify]);

  const run = useCallback(async (action: () => Promise<unknown>, fallback: string) => {
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error, fallback));
    }
  }, []);

  const value = useMemo<DownloadsContextValue>(() => {
    const { downloads } = getServices();
    const active = jobs.filter((j) => ACTIVE_STATUSES.has(j.status));
    const sized = active.filter((j) => j.totalBytes);
    const total = sized.reduce((s, j) => s + (j.totalBytes ?? 0), 0);
    const done = sized.reduce((s, j) => s + j.downloadedBytes, 0);
    return {
      jobs,
      loading,
      activeCount: active.length,
      aggregateProgress: total ? done / total : 0,
      aggregateSpeedBps: active.reduce((s, j) => s + (j.speedBps ?? 0), 0),
      start: async (request) => {
        try {
          const job = await downloads.start(request);
          notify({ kind: "info", title: "Added to queue", body: request.title });
          return job;
        } catch (error) {
          toast.error(errorMessage(error, "Could not start the download."));
          return null;
        }
      },
      pause: (id) => run(() => downloads.pause(id), "Could not pause the download."),
      resume: (id) => run(() => downloads.resume(id), "Could not resume the download."),
      cancel: (id) => run(() => downloads.cancel(id), "Could not cancel the download."),
      retry: (id) => run(() => downloads.retry(id), "Could not retry the download."),
      remove: (id) => run(() => downloads.remove(id), "Could not remove the download."),
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
      markAllRead: () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))),
      dismissNotification: (id) => setNotifications((prev) => prev.filter((n) => n.id !== id)),
      clearNotifications: () => setNotifications([]),
    };
  }, [jobs, loading, notifications, notify, run]);

  return <DownloadsContext value={value}>{children}</DownloadsContext>;
}
