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
import { getGuestToken } from "@/lib/guest.ts";
import { BROWSER_DOWNLOADS_MODE } from "@/services/device-storage.ts";

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
  const savingJobs = useRef(new Set<string>());
  const attemptedJobs = useRef(new Set<string>());
  const savingLegacyItems = useRef(false);
  const attemptedLegacyItems = useRef(new Set<string>());

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

  const saveCompletedFile = useCallback(
    async (
      jobId: string,
      filename: string,
      filePath: string,
      destination?: string,
    ) => {
      if (savingJobs.current.has(jobId) || attemptedJobs.current.has(jobId)) return;
      savingJobs.current.add(jobId);
      attemptedJobs.current.add(jobId);
      try {
        await getServices().fileSystem.saveCompletedFile(
          jobId,
          filename,
          filePath,
          destination,
        );
        void queryClient.invalidateQueries({ queryKey: ["astrid", "history"] });
        void queryClient.invalidateQueries({ queryKey: ["astrid", "library"] });
        void queryClient.invalidateQueries({ queryKey: ["astrid", "overview"] });
        if (
          await getServices().fileSystem.getFolderName() ===
          BROWSER_DOWNLOADS_MODE
        ) {
          toast.success("Sent to browser downloads", { description: filename });
        } else {
          toast.success("Saved to your device", { description: filename });
        }
      } catch (error) {
        toast.error(errorMessage(error, "Could not save the completed media to your device."));
      } finally {
        savingJobs.current.delete(jobId);
      }
    },
    [queryClient],
  );

  const migrateLegacyLibraryItems = useCallback(async () => {
    const services = getServices();
    if (!services.fileSystem || !services.library || savingLegacyItems.current) return;

    savingLegacyItems.current = true;
    try {
      const folderName = await services.fileSystem.getFolderName();
      if (!folderName || folderName === BROWSER_DOWNLOADS_MODE) return;
      const items = await services.library.list();
      for (const item of items) {
        if (!item.filePath || !item.id.startsWith("lib_")) continue;
        if (attemptedLegacyItems.current.has(item.id)) continue;
        attemptedLegacyItems.current.add(item.id);
        try {
          await saveCompletedFile(
            item.id.slice(4),
            item.filename.replace(/\\/g, "/").split("/").pop() ?? item.filename,
            item.filePath,
          );
        } catch (error) {
          toast.error(errorMessage(error, `Could not move ${item.filename} to your device.`));
        }
      }
    } finally {
      savingLegacyItems.current = false;
    }
  }, [saveCompletedFile]);

  const syncJobs = useCallback(async () => {
    try {
      const { downloads } = getServices();
      const nextJobs = await downloads.list();
      const nextStatus = new Map<string, DownloadJob["status"]>();

      for (const job of nextJobs) {
        if (job.status === "completed" && job.filePath) {
          const filename = job.filePath.replace(/\\/g, "/").split("/").pop();
          if (filename) {
            const requestedDestination = job.request.destination;
            const deviceDestination =
              requestedDestination === "." || requestedDestination.startsWith("./")
                ? requestedDestination
                : undefined;
            void saveCompletedFile(
              job.id,
              filename,
              job.filePath,
              deviceDestination,
            );
          }
        }
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
      void migrateLegacyLibraryItems();
    } catch (error) {
      setLoading(false);
      setError(errorMessage(error, "Could not refresh the download queue."));
    }
  }, [migrateLegacyLibraryItems, notify, queryClient, saveCompletedFile]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onFolderChanged = () => {
      attemptedJobs.current.clear();
      attemptedLegacyItems.current.clear();
      void syncJobs();
    };
    const statusStream = createPollingStatusStream(syncJobs, () =>
      hasActiveJobs.current ? 2500 : 15000,
    );

    window.addEventListener("astrid:device-folder-changed", onFolderChanged);
    statusStream.start();
    return () => {
      window.removeEventListener("astrid:device-folder-changed", onFolderChanged);
      statusStream.stop();
    };
  }, [syncJobs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const guestToken = getGuestToken();
    if (!guestToken) return;
    const clearGuestSession = () => {
      void fetch("/api/v1/guest-session", {
        method: "DELETE",
        headers: { "X-Guest-Token": guestToken },
        keepalive: true,
      }).catch((error: unknown) => {
        console.error("Could not clear the temporary guest session.", error);
      });
    };
    window.addEventListener("pagehide", clearGuestSession);
    return () => window.removeEventListener("pagehide", clearGuestSession);
  }, []);

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
          let folderName = await getServices().fileSystem.getFolderName();
          if (!folderName) {
            folderName = await getServices().fileSystem.chooseFolder();
          }
          if (!folderName) return null;
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
