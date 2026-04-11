"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { formatBytes } from "@/lib/format-bytes";

/** Píldora flotante: contexto de documentos, páginas y tamaño estimado. */
export function CanvasBottomPill() {
  const documents = useWorkspaceStore((s) => s.documents);
  const pageEntries = useWorkspaceStore((s) => s.pageEntries);
  const optimizeSize = useWorkspaceStore((s) => s.optimizeSize);
  const setOptimizeSize = useWorkspaceStore((s) => s.setOptimizeSize);

  const visiblePages = pageEntries.filter((e) => !e.hidden).length;
  const totalBytes = documents.reduce((acc, d) => acc + d.sizeBytes, 0);
  const docCount = documents.length;

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-20 -translate-x-1/2 px-4 sm:bottom-6">
      <div className="pointer-events-auto flex max-w-[min(100vw-2rem,42rem)] flex-col items-stretch gap-2 rounded-full border border-outline-variant/35 bg-surface-container/95 px-4 py-2.5 shadow-[0_24px_48px_-20px_var(--shadow-ambient)] backdrop-blur-md sm:flex-row sm:items-center sm:gap-4 sm:px-5">
        <p className="text-center font-mono text-xs text-muted-foreground sm:text-left">
          <span className="text-foreground">
            {docCount} documento{docCount === 1 ? "" : "s"}
          </span>
          {" · "}
          <span className="text-foreground">{visiblePages}</span> página
          {visiblePages === 1 ? "" : "s"} en total
          {" · "}
          ~{formatBytes(totalBytes)} estimado
        </p>
        <div className="flex items-center justify-center gap-2 border-t border-outline-variant/25 pt-2 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
          <button
            type="button"
            role="switch"
            aria-checked={optimizeSize}
            onClick={() => setOptimizeSize(!optimizeSize)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
              optimizeSize
                ? "border-primary/50 bg-primary-muted"
                : "border-outline-variant/40 bg-surface-container-low"
            }`}
          >
            <span
              className={`ml-1 inline-block h-5 w-5 rounded-full bg-foreground shadow transition ${
                optimizeSize ? "translate-x-5" : "translate-x-0"
              }`}
              aria-hidden
            />
          </button>
          <span className="text-xs text-muted-foreground select-none">
            Optimizar tamaño
          </span>
        </div>
      </div>
    </div>
  );
}
