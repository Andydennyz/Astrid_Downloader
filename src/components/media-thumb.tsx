import { useState } from "react";
import { AudioLines, Film } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import type { MediaKind } from "@/services/index.ts";

type MediaThumbProps = {
  src: string;
  alt: string;
  kind: MediaKind;
  className?: string;
  /** Optional overlay text in the bottom-right corner, e.g. a duration. */
  badge?: string;
};

/** Thumbnail with a graceful fallback when the image cannot load. */
export default function MediaThumb({ src, alt, kind, className, badge }: MediaThumbProps) {
  const [failed, setFailed] = useState(false);
  const Icon = kind === "audio" ? AudioLines : Film;
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-gradient-to-br from-primary/25 via-muted to-accent/20",
        kind === "audio" ? "aspect-square" : "aspect-video",
        className,
      )}
    >
      {failed ? (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <Icon className="size-1/3 max-h-8 max-w-8" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
      {badge && (
        <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1 py-px font-mono text-[10px] font-medium text-white tabular-nums">
          {badge}
        </span>
      )}
    </div>
  );
}
