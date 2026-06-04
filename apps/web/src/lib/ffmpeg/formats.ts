/**
 * Output presets for the media converter. `args` go between input and output in
 * the ffmpeg invocation (codec selection). All referenced encoders are compiled
 * into the bundled ffmpeg.wasm core (libmp3lame, libx264, libvpx, aac, flac, …).
 */
export type MediaCategory = "audio" | "video";

export type InputKind = "audio" | "video";

export type MediaFormat = {
  /** Stable key used in the UI radios. */
  key: string;
  /** Output extension (no dot). */
  ext: string;
  mime: string;
  label: string;
  category: MediaCategory;
  args: string[];
};

export const MEDIA_FORMATS: MediaFormat[] = [
  // Audio. `-vn` drops any video stream, so picking these on a video input
  // doubles as "extract audio".
  {
    key: "mp3",
    ext: "mp3",
    mime: "audio/mpeg",
    label: "MP3 · compatible",
    category: "audio",
    args: ["-vn", "-c:a", "libmp3lame", "-b:a", "192k"],
  },
  {
    key: "m4a",
    ext: "m4a",
    mime: "audio/mp4",
    label: "M4A · AAC",
    category: "audio",
    args: ["-vn", "-c:a", "aac", "-b:a", "192k"],
  },
  {
    key: "opus",
    ext: "opus",
    mime: "audio/ogg",
    label: "Opus · eficiente",
    category: "audio",
    args: ["-vn", "-c:a", "libopus", "-b:a", "128k"],
  },
  {
    key: "ogg",
    ext: "ogg",
    mime: "audio/ogg",
    label: "OGG · Vorbis",
    category: "audio",
    args: ["-vn", "-c:a", "libvorbis", "-q:a", "5"],
  },
  {
    key: "wav",
    ext: "wav",
    mime: "audio/wav",
    label: "WAV · sin pérdida",
    category: "audio",
    args: ["-vn", "-c:a", "pcm_s16le"],
  },
  {
    key: "flac",
    ext: "flac",
    mime: "audio/flac",
    label: "FLAC · sin pérdida",
    category: "audio",
    args: ["-vn", "-c:a", "flac"],
  },
  // Video.
  {
    key: "mp4",
    ext: "mp4",
    mime: "video/mp4",
    label: "MP4 · H.264",
    category: "video",
    args: [
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
    ],
  },
  {
    key: "webm",
    ext: "webm",
    mime: "video/webm",
    label: "WebM · VP8",
    category: "video",
    args: [
      "-c:v",
      "libvpx",
      "-b:v",
      "1M",
      "-c:a",
      "libvorbis",
      "-b:a",
      "128k",
    ],
  },
  {
    key: "gif",
    ext: "gif",
    mime: "image/gif",
    label: "GIF · animado",
    category: "video",
    args: ["-vf", "fps=12,scale=480:-1:flags=lanczos", "-an"],
  },
];

/** Detects whether a dropped file is audio or video from its MIME type. */
export function inputKindFromFile(file: File): InputKind | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

/**
 * Formats offered for a given input. Audio inputs only expose audio targets;
 * video inputs expose video targets plus audio targets (extract audio).
 */
export function formatsForKind(kind: InputKind): MediaFormat[] {
  if (kind === "audio") {
    return MEDIA_FORMATS.filter((f) => f.category === "audio");
  }
  return [
    ...MEDIA_FORMATS.filter((f) => f.category === "video"),
    ...MEDIA_FORMATS.filter((f) => f.category === "audio"),
  ];
}

export function findFormat(key: string): MediaFormat | undefined {
  return MEDIA_FORMATS.find((f) => f.key === key);
}
