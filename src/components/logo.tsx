import { cn } from "@/lib/utils.ts";

/** Astrid mark: a four-point star cut into a rounded tile. */
export default function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-gradient-to-br from-primary to-[oklch(0.55_0.2_265)] shadow-[0_4px_16px_-4px] shadow-primary/50 ring-1 ring-white/15">
        <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10" />
        <svg viewBox="0 0 24 24" className="relative size-4.5 text-white" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2c.5 4.7 2.3 6.5 7 7-4.7.5-6.5 2.3-7 7-.5-4.7-2.3-6.5-7-7 4.7-.5 6.5-2.3 7-7Z"
          />
          <path fill="currentColor" opacity=".65" d="M18 15c.2 1.9 1 2.7 3 3-2 .3-2.8 1.1-3 3-.2-1.9-1-2.7-3-3 2-.3 2.8-1.1 3-3Z" />
        </svg>
      </div>
      {!compact && (
        <div className="min-w-0 leading-none">
          <div className="font-display text-[15px] font-semibold tracking-tight">Astrid</div>
          <div className="pt-1 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Downloader
          </div>
        </div>
      )}
    </div>
  );
}
