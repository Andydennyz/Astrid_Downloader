import { motion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils.ts";

type Option<T extends string> = { value: T; label: React.ReactNode; ariaLabel?: string; disabled?: boolean };

/** Compact segmented control with a sliding active pill. */
export default function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "sm",
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<Option<T>>;
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div role="radiogroup" className={cn("inline-flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-3.5",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-md bg-card shadow-sm ring-1 ring-border"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
