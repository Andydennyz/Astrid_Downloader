import { Download, Play, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button.tsx";
import { useDownloads } from "@/hooks/use-downloads.ts";
import { useFileActions, useRemoveLibraryItem } from "@/hooks/use-media-data.ts";
import { errorMessage } from "@/services/errors.ts";
import { getServices, type LibraryItem } from "@/services/index.ts";
import { buildRedownloadRequest, getHttpSourceUrl } from "../-lib/new-download.ts";

export function MediaSourceLink({
  sourceUrl,
  title,
  className,
}: {
  sourceUrl: string;
  title: string;
  className?: string;
}) {
  const href = getHttpSourceUrl(sourceUrl);
  if (!href) return <span className={className}>{title}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {title}
    </a>
  );
}

export default function LibraryItemActions({
  item,
  layout,
}: {
  item: LibraryItem;
  layout: "grid" | "list";
}) {
  const { open, download } = useFileActions();
  const { start } = useDownloads();
  const removeItem = useRemoveLibraryItem();
  const sourceUrl = getHttpSourceUrl(item.sourceUrl);
  const playLabel = item.kind === "audio" ? "Play preview" : "Watch";

  const downloadAgain = async () => {
    if (!sourceUrl) {
      toast.error("The original media link is unavailable, so this item cannot be downloaded again.");
      return;
    }

    try {
      const settings = await getServices().settings.get();
      const job = await start(buildRedownloadRequest(item, settings));
      if (job) toast.success("Added to queue", { description: item.title });
    } catch (error) {
      toast.error(errorMessage(error, "Could not download this media again."));
    }
  };

  return (
    <div
      className={
        layout === "grid"
          ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2"
          : "flex flex-wrap gap-2"
      }
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={layout === "grid" ? "min-w-0" : "min-w-0 flex-1"}
        onClick={() => void open(item.id, item.filename, item.filePath)}
      >
        <Play />
        {playLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={layout === "grid" ? "min-w-0" : "min-w-0 flex-1"}
        title="Download this saved media to your device"
        onClick={() =>
          void download(item.id, item.filename, item.filePath || undefined)
        }
      >
        <Download />
        Download
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={
          layout === "grid" ? "col-span-2 min-w-0" : "min-w-0 flex-1"
        }
        disabled={!sourceUrl}
        title={sourceUrl ? "Download this media again" : "Original source link is unavailable"}
        onClick={() => void downloadAgain()}
      >
        <RotateCcw />
        Download again
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Delete ${item.title}`}
        onClick={() => void removeItem(item)}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
