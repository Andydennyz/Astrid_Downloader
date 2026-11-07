import type {
  FileExtension,
  HistoryEntry,
  LibraryItem,
  MediaInfo,
  Platform,
} from "@/services/types.ts";

/**
 * Demo content for the mock services. Never import this from UI components:
 * the UI reads everything through `src/services`.
 */

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&h=360&q=70`;
const square = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&h=400&q=70`;

export const THUMBS = {
  stage: img("photo-1657208431551-cbf415b8ef26"),
  mountains: img("photo-1632742707012-4c69a38f8b42"),
  snow: img("photo-1727162472767-0b7d026986b9"),
  coding: img("photo-1555209183-8facf96a4349"),
  laptop: img("photo-1562813733-b31f71025d54"),
  neon: img("photo-1628850627071-42b3fb16533d"),
  tokyo: img("photo-1542416409-400da26855b5"),
  rider: img("photo-1599060052009-24d6d0b0161c"),
  crowd: img("photo-1729553199933-c897fea4f41f"),
  hills: img("photo-1673970825861-3469f8fe01d3"),
  river: img("photo-1704021717759-15cf9ca938cf"),
  desk: img("photo-1779444480588-77001f36871b"),
} as const;

export const COVERS = {
  vinylRed: square("photo-1789655467943-d35d5cac3c5e"),
  vinylGold: square("photo-1789655467738-02f2254ac4b1"),
  vinylGreen: square("photo-1789655467900-c140da38487e"),
  geometric: square("photo-1785813124593-52caee33a8a7"),
  metal: square("photo-1565502233254-3d22afd146eb"),
  sequins: square("photo-1779144640787-976d7e6310f4"),
  lasers: square("photo-1573339887617-d674bc961c31"),
  magenta: square("photo-1789655468189-beda9a41fb97"),
  yellow: square("photo-1789655468072-6ef2dbaf40cf"),
  spot: square("photo-1681149341674-45fd772fd463"),
} as const;

export const DEFAULT_ROOT = "~/Downloads/Astrid";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Minutes/hours/days ago as ISO, anchored to load time so data feels fresh. */
function ago(ms: number) {
  return new Date(Date.now() - ms).toISOString();
}

type LibrarySeed = Omit<
  LibraryItem,
  "id" | "downloadedAt" | "filePath" | "filename"
> & { agoMs: number; filename?: string };

function slug(title: string) {
  return title
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function toLibrary(seed: LibrarySeed, index: number): LibraryItem {
  const filename =
    seed.filename ?? `${slug(seed.title)} [${seed.qualityLabel}].${seed.extension}`;
  const folder = seed.kind === "video" ? "Video" : "Audio";
  return {
    ...seed,
    id: `lib_${index + 1}`,
    filename,
    downloadedAt: ago(seed.agoMs),
    filePath: `${DEFAULT_ROOT}/${folder}/${filename}`,
  };
}

const LIBRARY_SEEDS: LibrarySeed[] = [
  {
    kind: "video",
    title: "Patagonia from Above — 4K Drone Film",
    creator: "Aerial Atlas",
    thumbnailUrl: THUMBS.mountains,
    extension: "mp4",
    qualityLabel: "2160p",
    height: 2160,
    durationSec: 742,
    sizeBytes: 2_840_000_000,
    sourceUrl: "https://www.youtube.com/watch?v=pAt4g0n1a4k",
    platform: "youtube",
    agoMs: 2 * HOUR,
  },
  {
    kind: "audio",
    title: "Midnight Grooves",
    creator: "Lune Collective",
    thumbnailUrl: COVERS.vinylRed,
    extension: "flac",
    qualityLabel: "Lossless",
    durationSec: 284,
    sizeBytes: 38_400_000,
    sourceUrl: "https://lunecollective.bandcamp.com/track/midnight-grooves",
    platform: "bandcamp",
    agoMs: 5 * HOUR,
  },
  {
    kind: "video",
    title: "Building a Compiler in a Weekend",
    creator: "Low Level Lab",
    thumbnailUrl: THUMBS.coding,
    extension: "mp4",
    qualityLabel: "1080p",
    height: 1080,
    durationSec: 3_912,
    sizeBytes: 1_210_000_000,
    sourceUrl: "https://www.youtube.com/watch?v=c0mp1l3rWk",
    platform: "youtube",
    agoMs: 9 * HOUR,
  },
  {
    kind: "audio",
    title: "Golden Hour (Extended Mix)",
    creator: "Sora Vale",
    thumbnailUrl: COVERS.vinylGold,
    extension: "mp3",
    qualityLabel: "320 kbps",
    audioBitrateKbps: 320,
    durationSec: 412,
    sizeBytes: 16_480_000,
    sourceUrl: "https://soundcloud.com/soravale/golden-hour-extended",
    platform: "soundcloud",
    agoMs: 1 * DAY,
  },
  {
    kind: "video",
    title: "Tokyo Nights — Rain Walk in Shinjuku",
    creator: "Walk With Me",
    thumbnailUrl: THUMBS.neon,
    extension: "webm",
    qualityLabel: "1440p",
    height: 1440,
    durationSec: 2_705,
    sizeBytes: 1_960_000_000,
    sourceUrl: "https://www.youtube.com/watch?v=t0ky0N1ght5",
    platform: "youtube",
    agoMs: 1 * DAY + 4 * HOUR,
  },
  {
    kind: "audio",
    title: "Deep Work — Focus Session Vol. 3",
    creator: "Atmos Radio",
    thumbnailUrl: COVERS.vinylGreen,
    extension: "m4a",
    qualityLabel: "256 kbps",
    audioBitrateKbps: 256,
    durationSec: 3_600,
    sizeBytes: 115_200_000,
    sourceUrl: "https://www.youtube.com/watch?v=d33pW0rkV3",
    platform: "youtube",
    agoMs: 2 * DAY,
  },
  {
    kind: "video",
    title: "Live at Red Rocks — Full Set",
    creator: "Echo Parade",
    thumbnailUrl: THUMBS.stage,
    extension: "mp4",
    qualityLabel: "1080p",
    height: 1080,
    durationSec: 5_480,
    sizeBytes: 2_310_000_000,
    sourceUrl: "https://vimeo.com/812349911",
    platform: "vimeo",
    agoMs: 3 * DAY,
  },
  {
    kind: "audio",
    title: "Prism",
    creator: "Kaleid",
    thumbnailUrl: COVERS.geometric,
    extension: "wav",
    qualityLabel: "Lossless",
    durationSec: 238,
    sizeBytes: 42_000_000,
    sourceUrl: "https://kaleid.bandcamp.com/track/prism",
    platform: "bandcamp",
    agoMs: 3 * DAY + 6 * HOUR,
  },
  {
    kind: "video",
    title: "Himalaya Range — Winter Timelapse",
    creator: "Aerial Atlas",
    thumbnailUrl: THUMBS.snow,
    extension: "mp4",
    qualityLabel: "2160p",
    height: 2160,
    durationSec: 418,
    sizeBytes: 1_640_000_000,
    sourceUrl: "https://vimeo.com/790211843",
    platform: "vimeo",
    agoMs: 4 * DAY,
  },
  {
    kind: "audio",
    title: "Chrome Hearts",
    creator: "Neon Arcade",
    thumbnailUrl: COVERS.metal,
    extension: "mp3",
    qualityLabel: "320 kbps",
    audioBitrateKbps: 320,
    durationSec: 196,
    sizeBytes: 7_840_000,
    sourceUrl: "https://soundcloud.com/neonarcade/chrome-hearts",
    platform: "soundcloud",
    agoMs: 5 * DAY,
  },
  {
    kind: "video",
    title: "Night Ride — Saigon Street Cinematic",
    creator: "Hiep Films",
    thumbnailUrl: THUMBS.rider,
    extension: "mp4",
    qualityLabel: "720p",
    height: 720,
    durationSec: 186,
    sizeBytes: 98_000_000,
    sourceUrl: "https://www.youtube.com/watch?v=s4ig0nR1d3",
    platform: "youtube",
    agoMs: 6 * DAY,
  },
  {
    kind: "audio",
    title: "Shimmer",
    creator: "Lune Collective",
    thumbnailUrl: COVERS.sequins,
    extension: "flac",
    qualityLabel: "Lossless",
    durationSec: 301,
    sizeBytes: 41_200_000,
    sourceUrl: "https://lunecollective.bandcamp.com/track/shimmer",
    platform: "bandcamp",
    agoMs: 7 * DAY,
  },
  {
    kind: "video",
    title: "Clean Architecture in Practice",
    creator: "Low Level Lab",
    thumbnailUrl: THUMBS.laptop,
    extension: "webm",
    qualityLabel: "1080p",
    height: 1080,
    durationSec: 2_214,
    sizeBytes: 640_000_000,
    sourceUrl: "https://www.youtube.com/watch?v=cl34nArch",
    platform: "youtube",
    agoMs: 9 * DAY,
  },
  {
    kind: "audio",
    title: "Laser Lines (Live)",
    creator: "Echo Parade",
    thumbnailUrl: COVERS.lasers,
    extension: "m4a",
    qualityLabel: "256 kbps",
    audioBitrateKbps: 256,
    durationSec: 367,
    sizeBytes: 11_740_000,
    sourceUrl: "https://www.twitch.tv/videos/198273645",
    platform: "twitch",
    agoMs: 11 * DAY,
  },
  {
    kind: "video",
    title: "Rivers of the North — Documentary",
    creator: "Wild Frames",
    thumbnailUrl: THUMBS.river,
    extension: "mp4",
    qualityLabel: "1440p",
    height: 1440,
    durationSec: 3_120,
    sizeBytes: 2_020_000_000,
    sourceUrl: "https://vimeo.com/774510298",
    platform: "vimeo",
    agoMs: 13 * DAY,
  },
];

export function seedLibrary(): LibraryItem[] {
  return LIBRARY_SEEDS.map(toLibrary);
}

export function seedHistory(library: LibraryItem[]): HistoryEntry[] {
  const fromLibrary: HistoryEntry[] = library.map((item) => ({
    id: `hist_${item.id}`,
    title: item.title,
    creator: item.creator,
    thumbnailUrl: item.thumbnailUrl,
    sourceUrl: item.sourceUrl,
    platform: item.platform,
    kind: item.kind,
    status: "completed",
    durationSec: item.durationSec,
    extension: item.extension,
    qualityLabel: item.qualityLabel,
    sizeBytes: item.sizeBytes,
    filePath: item.filePath,
    timestamp: item.downloadedAt,
  }));
  const extra: HistoryEntry[] = [
    {
      id: "hist_f1",
      title: "Members-only Livestream Replay",
      creator: "Studio Kairo",
      thumbnailUrl: THUMBS.crowd,
      sourceUrl: "https://www.youtube.com/watch?v=m3mb3r5only",
      platform: "youtube",
      kind: "video",
      status: "failed",
      durationSec: 5400,
      extension: "mp4",
      qualityLabel: "1080p",
      error: "This video requires a channel membership.",
      timestamp: ago(7 * HOUR),
    },
    {
      id: "hist_c1",
      title: "Lofi Beats to Study To — 24/7",
      creator: "Atmos Radio",
      thumbnailUrl: COVERS.magenta,
      sourceUrl: "https://www.youtube.com/watch?v=l0f1l1v3",
      platform: "youtube",
      kind: "audio",
      status: "cancelled",
      durationSec: 10800,
      extension: "mp3",
      qualityLabel: "320 kbps",
      timestamp: ago(1 * DAY + 2 * HOUR),
    },
    {
      id: "hist_f2",
      title: "Green Valleys — Drone Reel",
      creator: "Zetong Visuals",
      thumbnailUrl: THUMBS.hills,
      sourceUrl: "https://vimeo.com/700000001",
      platform: "vimeo",
      kind: "video",
      status: "failed",
      durationSec: 312,
      extension: "webm",
      qualityLabel: "2160p",
      error: "Network connection lost after 3 retries.",
      timestamp: ago(4 * DAY + 3 * HOUR),
    },
    {
      id: "hist_c2",
      title: "Sunlit (Acoustic)",
      creator: "Sora Vale",
      thumbnailUrl: COVERS.yellow,
      sourceUrl: "https://soundcloud.com/soravale/sunlit-acoustic",
      platform: "soundcloud",
      kind: "audio",
      status: "cancelled",
      durationSec: 268,
      extension: "flac",
      qualityLabel: "Lossless",
      timestamp: ago(8 * DAY),
    },
  ];
  return [...fromLibrary, ...extra].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
}

type AnalyzerSample = Omit<MediaInfo, "id" | "sourceUrl" | "platform" | "formats"> & {
  kind: "video" | "audio";
  /** Source tops out at this height (video only). */
  maxHeight?: number;
  hasFlac?: boolean;
};

/** Samples the mock analyzer picks from deterministically per URL. */
export const ANALYZER_SAMPLES: AnalyzerSample[] = [
  {
    kind: "video",
    title: "Iceland in 8K — The Land of Fire and Ice",
    creator: "Aerial Atlas",
    durationSec: 1_026,
    thumbnailUrl: THUMBS.snow,
    uploadedAt: ago(12 * DAY),
    viewCount: 4_820_000,
    description:
      "A cinematic journey across glaciers, volcanoes and black sand beaches, filmed over 21 days.",
    maxHeight: 2160,
  },
  {
    kind: "video",
    title: "Rust for TypeScript Developers — Full Course",
    creator: "Low Level Lab",
    durationSec: 9_340,
    thumbnailUrl: THUMBS.desk,
    uploadedAt: ago(30 * DAY),
    viewCount: 812_000,
    description: "Everything you need to go from TS to Rust, with exercises.",
    maxHeight: 1440,
  },
  {
    kind: "video",
    title: "Neon Dreams — Night City Cinematic",
    creator: "Hiep Films",
    durationSec: 274,
    thumbnailUrl: THUMBS.tokyo,
    uploadedAt: ago(3 * DAY),
    viewCount: 1_240_000,
    description: "Shot on a single prime lens over three rainy nights.",
    maxHeight: 2160,
  },
  {
    kind: "audio",
    title: "Afterglow (Original Mix)",
    creator: "Lune Collective",
    durationSec: 386,
    thumbnailUrl: COVERS.spot,
    uploadedAt: ago(6 * DAY),
    viewCount: 96_400,
    description: "Lead single from the forthcoming EP 'Low Tide'.",
    hasFlac: true,
  },
];

export const VIDEO_HEIGHTS = [2160, 1440, 1080, 720, 480, 360] as const;

export const AUDIO_STREAMS: Array<{
  container: FileExtension;
  codec: string;
  kbps: number;
}> = [
  { container: "m4a", codec: "aac", kbps: 256 },
  { container: "opus", codec: "opus", kbps: 160 },
  { container: "mp3", codec: "mp3", kbps: 320 },
];

export const PLATFORM_HOSTS: Array<{ platform: Platform; hosts: string[] }> = [
  { platform: "youtube", hosts: ["youtube.com", "youtu.be", "music.youtube.com"] },
  { platform: "vimeo", hosts: ["vimeo.com"] },
  { platform: "soundcloud", hosts: ["soundcloud.com"] },
  { platform: "twitch", hosts: ["twitch.tv"] },
  { platform: "bandcamp", hosts: ["bandcamp.com"] },
];

/** Demo jobs that seed the queue so it is lively on first load. */
export const QUEUE_SEEDS = [
  {
    title: "Aurora Borealis — Real-Time 4K",
    creator: "Aerial Atlas",
    thumbnailUrl: THUMBS.hills,
    durationSec: 1_820,
    sourceUrl: "https://www.youtube.com/watch?v=4ur0r4R34l",
    mode: "video+audio" as const,
    quality: "2160p" as const,
    progress: 0.42,
  },
  {
    title: "Echoes (Live Session)",
    creator: "Kaleid",
    thumbnailUrl: COVERS.lasers,
    durationSec: 512,
    sourceUrl: "https://soundcloud.com/kaleid/echoes-live",
    mode: "audio" as const,
    quality: "best" as const,
    progress: 0.71,
  },
  {
    title: "Designing Systems at Scale — Keynote",
    creator: "DevConf",
    thumbnailUrl: THUMBS.laptop,
    durationSec: 3_480,
    sourceUrl: "https://vimeo.com/833421907",
    mode: "video+audio" as const,
    quality: "1080p" as const,
    progress: 0.18,
    paused: true,
  },
  {
    title: "Street Food of Bangkok",
    creator: "Walk With Me",
    thumbnailUrl: THUMBS.rider,
    durationSec: 1_460,
    sourceUrl: "https://www.youtube.com/watch?v=b4ngk0kF00d",
    mode: "video+audio" as const,
    quality: "1440p" as const,
    progress: 0,
  },
];
