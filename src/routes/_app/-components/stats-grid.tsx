import { motion } from "motion/react";
import { Activity, CheckCircle2, Download, HardDrive, XCircle, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useDownloads } from "@/hooks/use-downloads.ts";
import { formatBytes } from "@/lib/format.ts";
import { cn } from "@/lib/utils.ts";
import type { OverviewStats } from "@/services/index.ts";

type Stat = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
  live?: boolean;
};

function StatCard({ stat, index }: { stat: Stat; index: number }) {
  const Icon = stat.icon;
  return (
    <motion.div
      initial={{ y: 8 }}
      animate={{ y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-2xl border bg-card/70 p-4 shadow-[0_1px_0_0_inset] shadow-white/[0.04]"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
        <span className={cn("grid size-7 place-items-center rounded-lg ring-1 ring-inset", stat.tone)}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className="pt-3 font-display text-[26px] leading-none font-semibold tracking-tight tabular-nums">{stat.value}</div>
      <div className="flex items-center gap-1.5 pt-2 text-[11px] text-muted-foreground">
        {stat.live && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
        {stat.hint}
      </div>
    </motion.div>
  );
}

export default function StatsGrid({ stats }: { stats: OverviewStats | undefined }) {
  const { activeCount, jobs } = useDownloads();
  const queued = jobs.filter((j) => j.status === "queued").length;

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-2xl" />
        ))}
      </div>
    );
  }

  const successRate = stats.totalDownloads ? Math.round((stats.completed / stats.totalDownloads) * 100) : 0;
  const items: Stat[] = [
    { label: "Total downloads", value: stats.totalDownloads.toLocaleString(), hint: "In the selected period", icon: Download, tone: "bg-primary/10 text-primary ring-primary/20" },
    { label: "Completed", value: stats.completed.toLocaleString(), hint: `${successRate}% success rate`, icon: CheckCircle2, tone: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400" },
    { label: "Active now", value: activeCount.toString(), hint: queued ? `${queued} waiting in queue` : "Live from the queue", icon: Activity, tone: "bg-accent/10 text-accent ring-accent/20", live: activeCount > 0 },
    { label: "Failed", value: stats.failed.toString(), hint: stats.failed ? "Retry from history" : "No failures", icon: XCircle, tone: "bg-destructive/10 text-destructive ring-destructive/20" },
    { label: "Storage used", value: formatBytes(stats.storageBytes), hint: "Across your library", icon: HardDrive, tone: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {items.map((stat, i) => (
        <StatCard key={stat.label} stat={stat} index={i} />
      ))}
    </div>
  );
}
