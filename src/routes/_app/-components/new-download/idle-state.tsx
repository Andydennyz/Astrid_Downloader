import { AudioLines, Film, Gauge, Layers } from "lucide-react";

const FEATURES = [
  { icon: Film, title: "Up to 4K video", body: "Pick 2160p down to 360p in MP4 or WebM." },
  { icon: AudioLines, title: "Lossless audio", body: "Extract MP3, M4A, WAV or FLAC." },
  { icon: Layers, title: "Exact streams", body: "Choose a specific format when presets aren't enough." },
  { icon: Gauge, title: "Smart queue", body: "Downloads run in parallel and resume after pauses." },
];

/** Shown before any link is analyzed. */
export default function IdleState() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {FEATURES.map((f) => (
        <div key={f.title} className="flex gap-3 rounded-2xl border border-dashed bg-card/30 p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <f.icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">{f.title}</p>
            <p className="pt-0.5 text-xs text-muted-foreground">{f.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
