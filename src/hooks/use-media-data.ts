import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "@/services/errors.ts";
import { getServices, type LibraryQuery } from "@/services/index.ts";

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
  const wrap = (fn: (path: string) => Promise<void>, success: string, fallback: string) => async (path: string) => {
    try {
      await fn(path);
      toast.success(success, { description: path });
    } catch (error) {
      toast.error(errorMessage(error, fallback));
    }
  };
  return {
    open: wrap(fileSystem.openFile, "Opening file", "Could not open the file."),
    reveal: wrap(fileSystem.revealInFolder, "Revealed in folder", "Could not reveal the file."),
    copyPath: wrap(fileSystem.copyPath, "File path copied", "Could not copy the path."),
  };
}
