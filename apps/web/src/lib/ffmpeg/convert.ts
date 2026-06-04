import { fetchFile } from "@ffmpeg/util";

import { getFfmpeg } from "./load-ffmpeg";
import type { MediaFormat } from "./formats";

export type ConvertProgress = (ratio: number) => void;

function inputExtension(file: File): string {
  const match = /\.([a-z0-9]+)$/i.exec(file.name);
  if (match) return `.${match[1].toLowerCase()}`;
  // ffmpeg sniffs the input format from content, so a generic extension is fine.
  return ".bin";
}

/**
 * Transcodes a media file fully in-browser via ffmpeg.wasm. Runs in ffmpeg's own
 * worker, so it never blocks the main thread. Returns the converted file as a Blob.
 */
export async function convertMedia(
  file: File,
  format: MediaFormat,
  onProgress?: ConvertProgress,
): Promise<Blob> {
  const ffmpeg = await getFfmpeg();
  const inputName = `input${inputExtension(file)}`;
  const outputName = `output.${format.ext}`;

  const handleProgress = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(1, Math.max(0, progress)));
  };
  ffmpeg.on("progress", handleProgress);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    const code = await ffmpeg.exec(["-i", inputName, ...format.args, outputName]);
    if (code !== 0) {
      throw new Error(`ffmpeg_exit_${code}`);
    }
    const data = await ffmpeg.readFile(outputName);
    // readFile may return a Uint8Array backed by a SharedArrayBuffer (mt core),
    // which Blob rejects. Copy into a plain ArrayBuffer-backed view.
    const bytes =
      typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    return new Blob([bytes], { type: format.mime });
  } finally {
    ffmpeg.off("progress", handleProgress);
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}
