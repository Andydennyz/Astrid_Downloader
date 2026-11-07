import { useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import Segmented from "@/components/segmented.tsx";
import { formatBytes } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import type { FormatOption, MediaInfo } from "@/services/index.ts";

type Filter = "all" | "video" | "audio";

function describe(f: FormatOption) {
  if (f.kind === "audio") {
    return [f.audioCodec, f.bitrateKbps && `${f.bitrateKbps} kbps`, f.sampleRateHz && `${f.sampleRateHz / 1000} kHz`];
  }
  return [f.height && `${f.height}p`, f.fps && `${f.fps} fps`, f.videoCodec, f.audioCodec && `+ ${f.audioCodec}`];
}

const KIND_STYLE: Record<FormatOption["kind"], string> = {
  video: "bg-primary/12 text-primary",
  audio: "bg-accent/12 text-accent",
  muxed: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
};

/** Lets advanced users pick an exact stream the analyzer reported. */
export default function CustomFormatDialog({
  info,
  open,
  onOpenChange,
  selectedId,
  onSelect,
}: {
  info: MediaInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: string | undefined;
  onSelect: (formatId: string | undefined) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<string | undefined>(selectedId);
  const rows = info.formats.filter((f) =>
    filter === "all" ? true : filter === "audio" ? f.kind === "audio" : f.kind !== "audio",
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setPending(selectedId);
        onOpenChange(next);
      }}
    >
      <DialogContent className="gap-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <SlidersHorizontal className="size-4 text-primary" />
            Custom format
          </DialogTitle>
          <DialogDescription>Pick one exact stream. This overrides the quality presets for this download.</DialogDescription>
        </DialogHeader>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All (${info.formats.length})` },
            { value: "video", label: "Video" },
            { value: "audio", label: "Audio" },
          ]}
        />
        <div role="listbox" aria-label="Available streams" className="-mx-2 max-h-[min(420px,55vh)] overflow-y-auto px-2">
          <div className="flex flex-col gap-1">
            {rows.map((f) => {
              const active = pending === f.formatId;
              return (
                <button
                  key={f.formatId}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => setPending(f.formatId)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    active ? "border-primary/50 bg-primary/8" : "border-transparent hover:bg-muted/50",
                  )}
                >
                  <span className={cn("w-14 shrink-0 rounded-md py-0.5 text-center text-[10px] font-semibold uppercase", KIND_STYLE[f.kind])}>
                    {f.kind === "muxed" ? "Combined" : f.kind}
                  </span>
                  <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{f.formatId}</span>
                  <span className="w-12 shrink-0 text-xs font-semibold uppercase">{f.container}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {describe(f).filter(Boolean).join(" · ")}
                    {f.note && <span className="text-muted-foreground"> — {f.note}</span>}
                  </span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:block">
                    {formatBytes(f.estimatedSizeBytes)}
                  </span>
                  <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", active ? "bg-primary text-primary-foreground" : "ring-1 ring-border")}>
                    {active && <Check className="size-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              onSelect(undefined);
              onOpenChange(false);
            }}
          >
            Use presets instead
          </Button>
          <Button
            disabled={!pending}
            onClick={() => {
              onSelect(pending);
              onOpenChange(false);
            }}
          >
            Use this stream
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
