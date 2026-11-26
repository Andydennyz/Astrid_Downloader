import { Link } from "@tanstack/react-router";
import { AlertTriangle, Download, FileVideo, Music2 } from "lucide-react";
import { Panel, PanelHeader } from "@/components/layout.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { formatBytes } from "@/lib/format.ts";
import type { ResolvedSelection } from "@/services/format-selection.ts";
import type { AppSettings } from "@/services/index.ts";

type SaveOptionsProps = {
  resolved: ResolvedSelection;
  filename: string;
  defaultFilename: string;
  onFilenameChange: (value: string) => void;
  finalFolder: string;
  general: AppSettings["general"];
  starting: boolean;
  onStart: () => void;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}

/** Filename, destination, a summary of the output and the Start button. */
export default function SaveOptions({
  resolved,
  filename,
  defaultFilename,
  onFilenameChange,
  finalFolder,
  general,
  starting,
  onStart,
}: SaveOptionsProps) {
  const shownName = filename.trim() || defaultFilename;
  const FileIcon = resolved.kind === "audio" ? Music2 : FileVideo;

  return (
    <Panel className="flex flex-col">
      <PanelHeader title="Save as" description="How the file is named and formatted" />
      <div className="flex flex-col gap-4 px-5 pb-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filename">File name</Label>
          <div className="flex items-center rounded-lg border bg-background/40 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40 dark:bg-input/30">
            <Input
              id="filename"
              value={filename}
              maxLength={180}
              onChange={(e) => onFilenameChange(e.target.value)}
              placeholder={defaultFilename}
              className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <span className="shrink-0 pr-3 font-mono text-xs text-muted-foreground">.{resolved.extension}</span>
          </div>
          <p className="text-xs text-muted-foreground">Leave empty to use your filename template.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Destination</Label>
          <p className="rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
            Completed media is saved to a selected folder when supported. Android saves files to shared Downloads/MediaDock, organized by media type; other native platforms use app Documents, and unsupported browsers use their standard Downloads location. Choose a folder in{" "}
            <Link to="/settings" className="text-primary hover:underline">Settings</Link>.
          </p>
          {(general.organizeByType || general.organizeByCreator) && (
            <p className="text-xs text-muted-foreground">
              Sorted into subfolders by {[general.organizeByType && "type", general.organizeByCreator && "creator"].filter(Boolean).join(" and ")}.{" "}
              <Link to="/settings" className="text-primary hover:underline">
                Change
              </Link>
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-muted/20 p-3.5">
          <div className="flex items-center gap-3 border-b pb-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/25 to-accent/20 text-primary">
              <FileIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold" title={`${shownName}.${resolved.extension}`}>
                {shownName}.{resolved.extension}
              </p>
              <p className="truncate font-mono text-[11px] text-muted-foreground" title={finalFolder}>
                {finalFolder}
              </p>
            </div>
          </div>
          <div className="pt-1.5">
            <Row label="Type" value={resolved.kind === "audio" ? "Audio" : "Video"} />
            <Row label="Quality" value={resolved.qualityLabel} />
            <Row label="Format" value={resolved.extension.toUpperCase()} />
            <Row
              label="Estimated size"
              value={
                <span className="tabular-nums">
                  {resolved.estimatedBytes === null
                    ? "Unknown until download starts"
                    : `≈ ${formatBytes(resolved.estimatedBytes)}`}
                </span>
              }
            />
          </div>
          {resolved.downgraded && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-500/10 px-2.5 py-2 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              This source tops out lower than requested, so the best available quality will be used.
            </p>
          )}
        </div>

        <Button
          className="h-12 gap-2 bg-gradient-to-r from-primary to-[color-mix(in_oklch,var(--primary),var(--accent)_45%)] text-[15px] font-semibold shadow-lg shadow-primary/20 hover:opacity-95"
          onClick={onStart}
          disabled={starting}
        >
          {starting ? <Spinner /> : <Download className="size-5" />}
          {starting ? "Adding to queue…" : "Start download"}
        </Button>
      </div>
    </Panel>
  );
}
