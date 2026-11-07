import type { ComponentType } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  Cog,
  Download,
  Pause,
  ScanSearch,
  XCircle,
  Ban,
} from "lucide-react";
import { STATUS_LABEL } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import type { DownloadStatus } from "@/services/index.ts";

const STYLES: Record<DownloadStatus, { icon: ComponentType<{ className?: string }>; className: string; spin?: boolean }> = {
  queued: { icon: Clock, className: "bg-muted text-muted-foreground ring-border" },
  analyzing: { icon: ScanSearch, className: "bg-accent/10 text-accent ring-accent/25" },
  downloading: { icon: Download, className: "bg-primary/12 text-primary ring-primary/25" },
  paused: { icon: Pause, className: "bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:text-amber-400" },
  processing: { icon: Cog, className: "bg-accent/10 text-accent ring-accent/25", spin: true },
  completed: { icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400" },
  failed: { icon: XCircle, className: "bg-destructive/10 text-destructive ring-destructive/25" },
  cancelled: { icon: Ban, className: "bg-muted text-muted-foreground ring-border" },
};

export default function StatusBadge({ status, className }: { status: DownloadStatus; className?: string }) {
  const style = STYLES[status] ?? { icon: CircleDashed, className: "" };
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold ring-1 ring-inset",
        style.className,
        className,
      )}
    >
      <Icon className={cn("size-3", style.spin && "animate-spin [animation-duration:2.5s]")} />
      {STATUS_LABEL[status]}
    </span>
  );
}
