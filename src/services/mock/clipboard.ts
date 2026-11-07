import type { ClipboardService } from "@/services/contracts.ts";
import { ServiceError } from "@/services/errors.ts";
import { normalizeUrl, validateUrl } from "./media.ts";

export function createMockClipboardService(): ClipboardService {
  const canRead = () =>
    typeof navigator !== "undefined" && !!navigator.clipboard && typeof navigator.clipboard.readText === "function";

  return {
    async readText() {
      if (!canRead()) {
        throw new ServiceError("CLIPBOARD_UNAVAILABLE", "Clipboard access is unavailable in this browser.");
      }

      try {
        return await navigator.clipboard.readText();
      } catch {
        throw new ServiceError("CLIPBOARD_UNAVAILABLE", "Clipboard access was blocked. Paste manually instead.");
      }
    },

    async readSupportedUrl() {
      try {
        const text = (await this.readText()).trim();
        if (!text) return null;
        const validation = validateUrl(text);
        if (!validation.valid) return null;
        return normalizeUrl(text);
      } catch {
        return null;
      }
    },
  };
}
