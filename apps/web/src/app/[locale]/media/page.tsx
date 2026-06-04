import type { Metadata } from "next";

import { MediaWorkspace } from "@/components/media-workspace";

export const metadata: Metadata = {
  title: "Convertir audio y video",
  description:
    "Convierte audio y video entre MP3, WAV, OGG, M4A, FLAC, Opus, MP4 y WebM. Gratis y 100 % en tu navegador con ffmpeg.wasm: tus archivos no se suben.",
  alternates: { canonical: "/media" },
};

export default function MediaPage() {
  return <MediaWorkspace />;
}
