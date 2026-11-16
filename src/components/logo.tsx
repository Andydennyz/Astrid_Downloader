import { cn } from "@/lib/utils.ts";

export default function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-gradient-to-br from-primary to-accent shadow-[0_4px_16px_-4px] shadow-primary/50 ring-1 ring-white/20">
        <svg
          viewBox="0 0 24 24"
          className="relative size-[19px] text-primary-foreground"
          aria-hidden="true"
        >
          <path
            d="M4.25 4.25h15.5v10h-15.5z"
            fill="none"
            stroke="currentColor"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
          <path
            d="m7.5 4.5-2.25 3m7.25-3-2.25 3m7.25-3-2.25 3"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.25"
          />
          <path d="m10 9 4.5 2.5-4.5 2.5z" fill="currentColor" />
          <path
            d="M12 15.75v4m-2-2 2 2 2-2m-5 4h10"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
          />
        </svg>
      </div>
      {!compact && (
        <div className="min-w-0 leading-none">
          <div className="font-display text-[15px] font-semibold tracking-tight">
            MediaDock
          </div>
          <div className="pt-1 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Video + Audio
          </div>
        </div>
      )}
    </div>
  );
}
