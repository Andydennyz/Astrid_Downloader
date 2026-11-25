import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { ArrowLeft } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import MediaPlayer from "@/components/media-player.tsx";
import { Button } from "@/components/ui/button.tsx";
import type { MediaPlaybackSource } from "@/services/types.ts";

export default function MediaPlayerDialog({
  source,
  onClose,
}: {
  source: MediaPlaybackSource;
  onClose: () => void;
}) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);

    let active = true;
    let backButtonListener: { remove: () => Promise<void> } | undefined;
    if (Capacitor.getPlatform() === "android") {
      void App.addListener("backButton", () => closeRef.current())
        .then((listener) => {
          if (active) backButtonListener = listener;
          else void listener.remove();
        })
        .catch(() => {
          toast.error(
            "Android Back handling could not be initialized. Use Back to app to close the player.",
          );
        });
    }

    return () => {
      active = false;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      void backButtonListener?.remove();
    };
  }, []);

  useEffect(
    () => () => {
      if (source.isObjectUrl) URL.revokeObjectURL(source.url);
    },
    [source.isObjectUrl, source.url],
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-background p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Playing ${source.title}`}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 pb-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {source.element === "audio" ? "Now playing" : "Now watching"}
          </p>
          <h2 className="truncate font-display text-lg font-semibold">
            {source.title}
          </h2>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 gap-2"
          onClick={onClose}
        >
          <ArrowLeft />
          Back to app
        </Button>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center overflow-auto">
        <div className="w-full">
          <MediaPlayer source={source} />
        </div>
      </main>
    </div>,
    document.body,
  );
}
