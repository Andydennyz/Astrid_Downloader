import { useCallback, useRef, useState } from "react";
import { errorMessage, ServiceError } from "@/services/errors.ts";
import { getServices, type MediaInfo } from "@/services/index.ts";

export type AnalyzerState =
  | { status: "idle" }
  | { status: "analyzing"; url: string }
  | { status: "ready"; info: MediaInfo }
  | { status: "error"; url: string; message: string; requiresAuthentication: boolean };

/** Drives the analyze flow and ignores results from superseded requests. */
export function useAnalyzer() {
  const [state, setState] = useState<AnalyzerState>({ status: "idle" });
  const requestId = useRef(0);

  const analyze = useCallback(async (url: string) => {
    const id = ++requestId.current;
    setState({ status: "analyzing", url });
    try {
      const info = await getServices().media.analyze(url);
      if (id === requestId.current) setState({ status: "ready", info });
    } catch (error) {
      if (id === requestId.current) {
        setState({
          status: "error",
          url,
          message: errorMessage(error, "We couldn't read that link."),
          requiresAuthentication: error instanceof ServiceError && error.code === "INVALID_STATE",
        });
      }
    }
  }, []);

  const reset = useCallback(() => {
    requestId.current += 1;
    setState({ status: "idle" });
  }, []);

  return { state, analyze, reset };
}
