import { useState } from "react";
import { AudioLines, Clapperboard, Film, SlidersHorizontal, X } from "lucide-react";
import { Panel, PanelHeader } from "@/components/layout.tsx";
import Segmented from "@/components/segmented.tsx";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import type { FormatSelection, MediaInfo } from "@/services/index.ts";
import { AUDIO_FORMATS, VIDEO_QUALITIES, hasVideo, isQualityAvailable } from "../../-lib/new-download.ts";
import CustomFormatDialog from "./custom-format-dialog.tsx";

function OptionTile({
  active,
  disabled,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Not offered by this source" : undefined}
      className={cn(
        "flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-35",
        active
          ? "border-primary/60 bg-primary/10 shadow-[0_0_0_3px] shadow-primary/10"
          : "bg-muted/25 hover:border-primary/30 hover:bg-muted/50",
      )}
    >
      <span className={cn("text-[13px] font-semibold", active && "text-primary")}>{label}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </div>
  );
}

type FormatOptionsProps = {
  info: MediaInfo;
  selection: FormatSelection;
  onChange: (next: FormatSelection) => void;
};

/** Mode, quality, audio format, container and custom stream choice. */
export default function FormatOptions({ info, selection, onChange }: FormatOptionsProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const video = hasVideo(info);
  const patch = (next: Partial<FormatSelection>) => onChange({ ...selection, ...next, customFormatId: undefined });
  const custom = selection.customFormatId ? info.formats.find((f) => f.formatId === selection.customFormatId) : undefined;
  const showVideo = selection.mode !== "audio";
  const showAudio = selection.mode !== "video";

  return (
    <Panel>
      <PanelHeader
        title="Format and quality"
        description={video ? "Choose what to keep and how it's saved" : "Audio-only source"}
        action={
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setCustomOpen(true)}>
            <SlidersHorizontal />
            Custom format
          </Button>
        }
      />
      <div className="flex flex-col gap-5 px-5 pb-5">
        {custom && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/8 px-3.5 py-2.5">
            <SlidersHorizontal className="size-4 shrink-0 text-primary" />
            <p className="min-w-0 flex-1 text-[13px]">
              Using stream <span className="font-mono font-semibold">{custom.formatId}</span>
              <span className="text-muted-foreground">
                {" "}
                · {custom.container.toUpperCase()} {custom.height ? `${custom.height}p` : custom.bitrateKbps ? `${custom.bitrateKbps} kbps` : ""}
              </span>
              <span className="block text-xs text-muted-foreground">Presets below are ignored while a custom stream is selected.</span>
            </p>
            <Button variant="ghost" size="icon-sm" aria-label="Remove custom format" onClick={() => onChange({ ...selection, customFormatId: undefined })}>
              <X />
            </Button>
          </div>
        )}

        <div className={cn("flex flex-col gap-5 transition-opacity", custom && "pointer-events-none opacity-40")}>
          <Section title="Download mode">
            <Segmented
              size="md"
              value={selection.mode}
              onChange={(mode) => patch({ mode })}
              className="w-full [&>button]:flex-1"
              options={[
                { value: "video+audio", label: <><Clapperboard />Video + audio</>, disabled: !video },
                { value: "video", label: <><Film />Video only</>, disabled: !video },
                { value: "audio", label: <><AudioLines />Audio only</> },
              ]}
            />
          </Section>

          {showVideo && (
            <Section
              title="Video quality"
              aside={
                <Segmented
                  value={selection.container}
                  onChange={(container) => patch({ container })}
                  options={[
                    { value: "mp4", label: "MP4" },
                    { value: "webm", label: "WebM" },
                  ]}
                />
              }
            >
              <div role="radiogroup" aria-label="Video quality" className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                {VIDEO_QUALITIES.map((q) => (
                  <OptionTile
                    key={q.value}
                    active={selection.videoQuality === q.value}
                    disabled={!isQualityAvailable(info, q.value)}
                    label={q.label}
                    hint={q.hint}
                    onClick={() => patch({ videoQuality: q.value })}
                  />
                ))}
              </div>
            </Section>
          )}

          {showAudio && (
            <Section title={selection.mode === "audio" ? "Audio format" : "Audio track"}>
              {selection.mode === "audio" ? (
                <div role="radiogroup" aria-label="Audio format" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {AUDIO_FORMATS.map((a) => (
                    <OptionTile
                      key={a.value}
                      active={selection.audioFormat === a.value}
                      label={a.label}
                      hint={a.hint}
                      onClick={() => patch({ audioFormat: a.value })}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed bg-muted/20 px-3.5 py-2.5 text-[13px] text-muted-foreground">
                  The best audio track is merged into the {selection.container.toUpperCase()} file automatically.
                </p>
              )}
            </Section>
          )}
        </div>
      </div>
      <CustomFormatDialog
        info={info}
        open={customOpen}
        onOpenChange={setCustomOpen}
        selectedId={selection.customFormatId}
        onSelect={(customFormatId) => onChange({ ...selection, customFormatId })}
      />
    </Panel>
  );
}
