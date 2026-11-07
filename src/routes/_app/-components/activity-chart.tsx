import { format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart.tsx";
import { Panel, PanelHeader } from "@/components/layout.tsx";
import Segmented from "@/components/segmented.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import type { ActivityPoint } from "@/services/index.ts";

const chartConfig = {
  video: { label: "Video", color: "var(--chart-1)" },
  audio: { label: "Audio", color: "var(--chart-2)" },
} satisfies ChartConfig;

export type RangeDays = "7" | "14" | "30";

export default function ActivityChart({
  data,
  range,
  onRangeChange,
}: {
  data: ActivityPoint[] | undefined;
  range: RangeDays;
  onRangeChange: (range: RangeDays) => void;
}) {
  const totals = (data ?? []).reduce(
    (acc, p) => ({ video: acc.video + p.video, audio: acc.audio + p.audio }),
    { video: 0, audio: 0 },
  );

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        title="Download activity"
        description="Completed downloads per day"
        action={
          <Segmented
            value={range}
            onChange={onRangeChange}
            options={[
              { value: "7", label: "7d" },
              { value: "14", label: "14d" },
              { value: "30", label: "30d" },
            ]}
          />
        }
      />
      <div className="flex items-center gap-5 px-5 pb-2">
        {(["video", "audio"] as const).map((key) => (
          <div key={key} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: chartConfig[key].color }} />
            <span className="text-xs text-muted-foreground">{chartConfig[key].label}</span>
            <span className="font-display text-sm font-semibold tabular-nums">{totals[key]}</span>
          </div>
        ))}
      </div>
      <div className="px-2 pb-3">
        {!data ? (
          <Skeleton className="mx-3 my-2 h-[240px]" />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[256px] w-full">
            <AreaChart data={data} margin={{ left: 0, right: 12, top: 10 }}>
              <defs>
                {(["video", "audio"] as const).map((key) => (
                  <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={`var(--color-${key})`} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={`var(--color-${key})`} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 4" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={24}
                tickFormatter={(v: string) => format(parseISO(v), "MMM d")}
              />
              <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(v) => (typeof v === "string" ? format(parseISO(v), "EEEE, MMM d") : "")}
                  />
                }
              />
              <Area dataKey="audio" type="monotone" stroke="var(--color-audio)" strokeWidth={2} fill="url(#fill-audio)" stackId="a" />
              <Area dataKey="video" type="monotone" stroke="var(--color-video)" strokeWidth={2} fill="url(#fill-video)" stackId="a" />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </Panel>
  );
}
