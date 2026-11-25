import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/services/errors.ts";
import { getServices, type HistoryEntry, type LibraryItem, type LibraryQuery } from "@/services/index.ts";

/**
 * Read hooks over the service layer. Data loads in the browser (the mock
 * engine is client-only) and refreshes when a service reports a change.
 */

const KEYS = {
  library: (q?: LibraryQuery) => ["astrid", "library", q ?? {}] as const,
  history: ["astrid", "history"] as const,
  overview: (days: number) => ["astrid", "overview", days] as const,
};

function useInvalidateOn(subscribe: (listener: () => void) => () => void, prefix: string[]) {
  const client = useQueryClient();
  const key = prefix.join("/");
  useEffect(
    () => subscribe(() => void client.invalidateQueries({ queryKey: key.split("/") })),
    [client, key, subscribe],
  );
}

export function useLibrary(query?: LibraryQuery) {
  const { library } = getServices();
  useInvalidateOn(library.subscribe, ["astrid", "library"]);
  return useQuery({ queryKey: KEYS.library(query), queryFn: () => library.list(query) });
}

export function useHistory() {
  const { history } = getServices();
  useInvalidateOn(history.subscribe, ["astrid", "history"]);
  return useQuery({ queryKey: KEYS.history, queryFn: () => history.list() });
}

export function useOverview(days: number) {
  const { stats, history } = getServices();
  useInvalidateOn(history.subscribe, ["astrid", "overview"]);
  return useQuery({
    queryKey: KEYS.overview(days),
    queryFn: () => stats.getOverview(days),
    placeholderData: (prev) => prev,
  });
}

export const SETTINGS_QUERY_KEY = ["astrid", "settings"] as const;

/** App settings from the settings service (device storage for now). */
export function useSettings() {
  const { settings } = getServices();
  return useQuery({ queryKey: SETTINGS_QUERY_KEY, queryFn: () => settings.get(), staleTime: Infinity });
}

/** Filesystem actions with consistent feedback. */
export function useFileActions() {
  const { fileSystem } = getServices();
  const queryClient = useQueryClient();
  return {
    open: async (itemId: string, filename: string, serverPath?: string) => {
      try {
        return await fileSystem.openFile(itemId, filename, serverPath);
      } catch (error) {
        toast.error(errorMessage(error, "Could not open the media file."));
        return null;
      }
    },
    download: async (itemId: string, filename: string, serverPath?: string) => {
      try {
        await fileSystem.downloadFile(itemId, filename, serverPath);
        await queryClient.invalidateQueries({ queryKey: ["astrid", "library"] });
        await queryClient.invalidateQueries({ queryKey: ["astrid", "history"] });
        await queryClient.invalidateQueries({ queryKey: ["astrid", "overview"] });
        toast.success("Download started", { description: filename });
      } catch (error) {
        toast.error(errorMessage(error, "Could not download the media file."));
      }
    },
    removeFile: async (itemId: string, filename: string) => {
      try {
        await fileSystem.removeFile(itemId, filename);
      } catch (error) {
        toast.error(errorMessage(error, "Could not remove the media file from your device."));
        throw error;
      }
    },
    copyPath: async (filename: string) => {
      try {
        await fileSystem.copyPath(filename);
        toast.success("Filename copied", { description: filename });
      } catch (error) {
        toast.error(errorMessage(error, "Could not copy the filename."));
      }
    },
  };
}

export function useRemoveLibraryItem() {
  const queryClient = useQueryClient();
  return async (item: LibraryItem) => {
    try {
      if (!item.filePath) {
        await getServices().fileSystem.removeFile(item.id, item.filename);
      }
      await getServices().library.remove(item.id);
      await queryClient.invalidateQueries({ queryKey: ["astrid", "library"] });
      await queryClient.invalidateQueries({ queryKey: ["astrid", "history"] });
      await queryClient.invalidateQueries({ queryKey: ["astrid", "overview"] });
      toast.success("Media deleted");
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete this media item."));
    }
  };
}

export function useRemoveHistoryEntry() {
  const queryClient = useQueryClient();
  return async (entry: HistoryEntry) => {
    try {
      if (entry.libraryId && entry.filename && !entry.filePath) {
        await getServices().fileSystem.removeFile(entry.libraryId, entry.filename);
      }
      await getServices().history.remove(entry.id);
      await queryClient.invalidateQueries({ queryKey: ["astrid", "history"] });
      await queryClient.invalidateQueries({ queryKey: ["astrid", "library"] });
      await queryClient.invalidateQueries({ queryKey: ["astrid", "overview"] });
      toast.success("History entry deleted");
    } catch (error) {
      toast.error(errorMessage(error, "Could not delete this history entry."));
    }
  };
}

export function useClearHistory() {
  const queryClient = useQueryClient();
  return async () => {
    try {
      await getServices().history.clear();
      await queryClient.invalidateQueries({ queryKey: ["astrid", "history"] });
      await queryClient.invalidateQueries({ queryKey: ["astrid", "library"] });
      await queryClient.invalidateQueries({ queryKey: ["astrid", "overview"] });
      toast.success("History cleared");
    } catch (error) {
      toast.error(errorMessage(error, "Could not clear download history."));
    }
  };
}
