import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowRight, Copy, FolderOpen, MoreHorizontal, Play, RotateCcw, Trash2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelHeader } from "@/components/layout.tsx";
import MediaThumb from "@/components/media-thumb.tsx";
import StatusBadge from "@/components/status-badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { useDownloads } from "@/hooks/use-downloads.ts";
import { useFileActions } from "@/hooks/use-media-data.ts";
import { formatBytes, formatDuration } from "@/lib/format.ts";
import { getServices, type HistoryEntry } from "@/services/index.ts";

function QuickActions({ entry }: { entry: HistoryEntry }) {
  const files = useFileActions();
  const { start } = useDownloads();
  const { settings } = getServices();

  const redownload = async () => {
    const prefs = await settings.get();
    const job = await start({
      sourceUrl: entry.sourceUrl,
      title: entry.title,
      creator: entry.creator,
      thumbnailUrl: entry.thumbnailUrl,
      durationSec: entry.durationSec,
      selection: {
        mode: entry.kind === "audio" ? "audio" : "video+audio",
        videoQuality: prefs.general.defaultVideoQuality,
        audioFormat: prefs.general.defaultAudioFormat,
        container: prefs.general.defaultContainer,
      },
      destination: prefs.general.downloadLocation,
    });
    if (job) toast.success("Added to queue", { description: entry.title });
  };

  const path = entry.filePath;
  return (
    <div className="flex items-center justify-end gap-0.5">
      {path ? (
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Open file" onClick={() => void files.open(path)} />}>
            <Play />
          </TooltipTrigger>
          <TooltipContent>Open file</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Retry download" onClick={() => void redownload()} />}>
            <RotateCcw />
          </TooltipTrigger>
          <TooltipContent>Retry download</TooltipContent>
        </Tooltip>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {path && (
            <>
              <DropdownMenuItem onClick={() => void files.reveal(path)}>
                <FolderOpen />
                Reveal in folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void files.copyPath(path)}>
                <Copy />
                Copy file path
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => void redownload()}>
            <RotateCcw />
            Download again
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              void navigator.clipboard?.writeText(entry.sourceUrl);
              toast.success("Original link copied");
            }}
          >
            <Copy />
            Copy original link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              void getServices().history.remove(entry.id).then(() => toast.success("Removed from recent downloads"));
            }}
          >
            <Trash2 />
            Remove from history
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const HEAD = ["Media", "Format", "Quality", "Size", "Date", "Status", ""];

export default function RecentDownloads({ entries }: { entries: HistoryEntry[] | undefined }) {
  return (
    <Panel className="min-w-0">
      <PanelHeader
        title="Recent downloads"
        description="Your latest finished, failed and cancelled downloads"
        action={
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link to="/history" />}>
            View history
            <ArrowRight />
          </Button>
        }
      />
      {!entries ? (
        <div className="flex flex-col gap-2 px-5 pb-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Empty className="pb-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>No downloads yet</EmptyTitle>
            <EmptyDescription>Paste a link to start your first download.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" nativeButton={false} render={<Link to="/new" />}>
              New download
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-x-auto pb-2">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-y bg-muted/30 text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {HEAD.map((h, i) => (
                  <th key={i} className="px-5 py-2.5 font-semibold first:pl-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-[72px] shrink-0 place-items-center">
                        <MediaThumb
                          src={entry.thumbnailUrl}
                          alt=""
                          kind={entry.kind}
                          className={entry.kind === "audio" ? "h-10 rounded-md" : "w-[72px] rounded-md"}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="max-w-[320px] truncate font-medium">{entry.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {entry.creator} · {formatDuration(entry.durationSec)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium">{entry.extension.toUpperCase()}</span>
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">{entry.qualityLabel}</td>
                  <td className="px-5 py-2.5 text-muted-foreground tabular-nums">{formatBytes(entry.sizeBytes)}</td>
                  <td className="px-5 py-2.5 whitespace-nowrap text-muted-foreground">{format(new Date(entry.timestamp), "MMM d, HH:mm")}</td>
                  <td className="px-5 py-2.5">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-5 py-2.5">
                    <QuickActions entry={entry} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
