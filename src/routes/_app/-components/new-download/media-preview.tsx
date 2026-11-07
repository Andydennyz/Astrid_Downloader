import { motion } from "motion/react";
import { formatDistanceToNowStrict } from "date-fns";
import { CalendarDays, Clock, Eye, Layers, User } from "lucide-react";
import { Panel } from "@/components/layout.tsx";
import MediaThumb from "@/components/media-thumb.tsx";
import { formatCount, formatDuration, PLATFORM_LABEL } from "@/lib/format.ts";
import type { MediaInfo } from "@/services/index.ts";
import { hasVideo } from "../../-lib/new-download.ts";

function Meta({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

function ChipRow({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-full pb-0.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sm:w-24 sm:pb-0">{label}</span>
      {items.map((item) => (
        <span key={item} className="rounded-md border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-foreground/90">
          {item}
        </span>
      ))}
    </div>
  );
}

/** Rich preview of analyzed media plus a summary of the streams it offers. */
export default function MediaPreview({ info }: { info: MediaInfo }) {
  const video = hasVideo(info);
  const resolutions = [...new Set(info.formats.filter((f) => f.kind === "video").map((f) => f.height ?? 0))]
    .sort((a, b) => b - a)
    .map((h) => `${h}p`);
  const audio = info.formats
    .filter((f) => f.kind === "audio")
    .map((f) => `${f.container.toUpperCase()}${f.bitrateKbps ? ` ${f.bitrateKbps}k` : ""}`);
  const containers = [...new Set(info.formats.filter((f) => f.kind !== "audio").map((f) => f.container.toUpperCase()))];
  const codecs = [...new Set(info.formats.flatMap((f) => [f.videoCodec, f.audioCodec]).filter((c): c is string => Boolean(c)))];

  return (
    <Panel className="overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col gap-5 p-5 md:flex-row"
      >
        <div className="relative w-full shrink-0 md:w-[300px]">
          <MediaThumb
            src={info.thumbnailUrl}
            alt={info.title}
            kind={video ? "video" : "audio"}
            badge={formatDuration(info.durationSec)}
            className={video ? "w-full rounded-xl" : "mx-auto w-48 rounded-xl md:w-full"}
          />
          <span className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
            {PLATFORM_LABEL[info.platform]}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-lg leading-snug font-semibold tracking-tight text-balance">{info.title}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
              <Meta icon={User}>{info.creator}</Meta>
              <Meta icon={Clock}>{formatDuration(info.durationSec)}</Meta>
              {info.viewCount !== undefined && <Meta icon={Eye}>{formatCount(info.viewCount)} plays</Meta>}
              <Meta icon={CalendarDays}>{formatDistanceToNowStrict(new Date(info.uploadedAt), { addSuffix: true })}</Meta>
              <Meta icon={Layers}>{info.formats.length} streams</Meta>
            </div>
          </div>
          {info.description && <p className="line-clamp-2 text-sm text-muted-foreground">{info.description}</p>}
          <div className="mt-auto flex flex-col gap-2 border-t pt-3">
            <ChipRow label="Resolutions" items={resolutions} />
            <ChipRow label="Containers" items={containers} />
            <ChipRow label="Audio" items={audio} />
            <ChipRow label="Codecs" items={codecs} />
          </div>
        </div>
      </motion.div>
    </Panel>
  );
}
