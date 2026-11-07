import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { ArrowRight, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/layout.tsx";
import MediaThumb from "@/components/media-thumb.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useDownloads } from "@/hooks/use-downloads.ts";
import { renderFilenameTemplate } from "@/services/filename.ts";
import { resolveSelection } from "@/services/format-selection.ts";
import type { AppSettings, DownloadJob, FormatSelection, MediaInfo } from "@/services/index.ts";
import { initialSelection, outputFolder } from "../../-lib/new-download.ts";
import FormatOptions from "./format-options.tsx";
import MediaPreview from "./media-preview.tsx";
import SaveOptions from "./save-options.tsx";

/** Everything after a successful analysis: preview, options, start. */
export default function DownloadComposer({
  info,
  settings,
  onDone,
}: {
  info: MediaInfo;
  settings: AppSettings;
  onDone: () => void;
}) {
  const { start } = useDownloads();
  const [selection, setSelection] = useState<FormatSelection>(() => initialSelection(info, settings));
  const [filename, setFilename] = useState("");
  const [folder, setFolder] = useState(settings.general.downloadLocation);
  const [starting, setStarting] = useState(false);
  const [started, setStarted] = useState<DownloadJob | null>(null);

  const resolved = resolveSelection(selection, info.formats, info.durationSec);
  const defaultFilename = renderFilenameTemplate(settings.advanced.filenameTemplate, {
    title: info.title,
    creator: info.creator,
    quality: resolved.qualityLabel,
    platform: info.platform,
  });
  const finalFolder = outputFolder(folder, resolved.kind, info.creator, settings.general);

  const handleStart = async () => {
    setStarting(true);
    const job = await start({
      mediaId: info.id,
      sourceUrl: info.sourceUrl,
      title: info.title,
      creator: info.creator,
      thumbnailUrl: info.thumbnailUrl,
      durationSec: info.durationSec,
      selection,
      filename: filename.trim() || defaultFilename,
      destination: finalFolder,
    });
    setStarting(false);
    if (job) {
      setStarted(job);
      toast.success("Added to queue", { description: info.title });
    }
  };

  if (started) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: "easeOut" }}>
        <Panel className="flex flex-col items-center gap-5 px-6 py-10 text-center">
          <div className="relative">
            <MediaThumb src={info.thumbnailUrl} alt="" kind={started.kind} className="w-56 rounded-xl" />
            <span className="absolute -right-3 -bottom-3 grid size-10 place-items-center rounded-full bg-emerald-500 text-white ring-4 ring-background">
              <CheckCircle2 className="size-5" />
            </span>
          </div>
          <div className="max-w-md">
            <h2 className="font-display text-xl font-semibold tracking-tight">Added to your queue</h2>
            <p className="pt-1 text-sm text-muted-foreground text-balance">
              <span className="text-foreground">{info.title}</span> will be saved as {started.qualityLabel} {started.extension.toUpperCase()}.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button nativeButton={false} render={<Link to="/queue" />} className="gap-2">
              View queue
              <ArrowRight />
            </Button>
            <Button variant="secondary" className="gap-2" onClick={() => setStarted(null)}>
              Different format
            </Button>
            <Button variant="ghost" className="gap-2" onClick={onDone}>
              <Plus />
              New link
            </Button>
          </div>
        </Panel>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <MediaPreview info={info} />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">
          <FormatOptions info={info} selection={selection} onChange={setSelection} />
        </div>
        <div className="xl:sticky xl:top-4">
          <SaveOptions
            resolved={resolved}
            filename={filename}
            defaultFilename={defaultFilename}
            onFilenameChange={setFilename}
            folder={folder}
            finalFolder={finalFolder}
            onFolderChange={setFolder}
            general={settings.general}
            starting={starting}
            onStart={() => void handleStart()}
          />
        </div>
      </div>
    </div>
  );
}
