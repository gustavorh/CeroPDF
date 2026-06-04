import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

/**
 * Lazy singleton loader for ffmpeg.wasm. All assets are served same-origin from
 * `public/ffmpeg/` (no CDN) to honor the local-first privacy contract.
 *
 * We ship only the single-thread core. The multi-thread core needs
 * `SharedArrayBuffer` (cross-origin isolation) and, in practice, fails to spin up
 * its pthread pool reliably across browsers — a hang is far worse than a slower
 * but dependable conversion. Single-thread is plenty fast for audio; video is
 * slower but works everywhere with no special headers.
 *
 * The class worker is loaded from a real same-origin URL (not a blob) because it
 * uses relative ESM imports its blob origin couldn't resolve. It must be an
 * ABSOLUTE origin URL: @ffmpeg/ffmpeg resolves it against `import.meta.url`,
 * which is a `file://` path in the bundled app — a relative path would yield a
 * `file://` worker URL and a SecurityError. Same pattern as the pdf.js worker.
 */
const CORE_BASE = "/ffmpeg/st";

let instance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

export async function getFfmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      classWorkerURL: `${window.location.origin}/ffmpeg/esm/worker.js`,
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${CORE_BASE}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });
    instance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await loadPromise;
  } catch (err) {
    loadPromise = null; // allow a later retry
    throw err;
  }
}
