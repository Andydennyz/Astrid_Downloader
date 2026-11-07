import { createContext, useContext } from "react";
import type { DownloadJob, DownloadRequest } from "@/services/index.ts";

export type AppNotification = {
  id: string;
  kind: "completed" | "failed" | "info";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type DownloadsContextValue = {
  jobs: DownloadJob[];
  loading: boolean;
  activeCount: number;
  /** Combined progress (0 to 1) of all active downloads. */
  aggregateProgress: number;
  aggregateSpeedBps: number;
  start: (request: DownloadRequest) => Promise<DownloadJob | null>;
  pause: (jobId: string) => Promise<void>;
  resume: (jobId: string) => Promise<void>;
  cancel: (jobId: string) => Promise<void>;
  retry: (jobId: string) => Promise<void>;
  remove: (jobId: string) => Promise<void>;
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
};

export const DownloadsContext = createContext<DownloadsContextValue | null>(null);

export function useDownloads() {
  const value = useContext(DownloadsContext);
  if (!value) throw new Error("useDownloads must be used inside DownloadsProvider");
  return value;
}

export const ACTIVE_STATUSES = new Set<DownloadJob["status"]>([
  "queued",
  "analyzing",
  "downloading",
  "processing",
]);
