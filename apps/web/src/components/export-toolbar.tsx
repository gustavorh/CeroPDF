"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";

export function ExportToolbar() {
  const documents = useWorkspaceStore((s) => s.documents);
  const selectedPageIds = useWorkspaceStore((s) => s.selectedPageIds);
  const optimizeSize = useWorkspaceStore((s) => s.optimizeSize);
  const setOptimizeSize = useWorkspaceStore((s) => s.setOptimizeSize);
  const exportPdf = useWorkspaceStore((s) => s.exportPdf);
  const uiPhase = useWorkspaceStore((s) => s.uiPhase);

  const hasDocs = documents.length > 0;
  const busy = uiPhase === "merging";

  const handleExport = () => void exportPdf();

  return (
    <div className="border-t border-border bg-card/95 px-4 py-4 backdrop-blur-sm sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={optimizeSize}
            disabled={!hasDocs}
            onClick={() => setOptimizeSize(!optimizeSize)}
            className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
              optimizeSize
                ? "border-primary/60 bg-primary/35"
                : "border-border bg-card"
            }`}
          >
            <span
              className={`ml-1 inline-block h-5 w-5 rounded-full bg-primary-foreground shadow transition ${
                optimizeSize ? "translate-x-5" : "translate-x-0"
              }`}
              aria-hidden
            />
          </button>
          <label className="text-sm text-muted-foreground select-none">
            <span className="font-medium text-foreground">Optimizar tamaño</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-tertiary">
              Reduce el peso del archivo al exportar, con la mejor calidad posible
              en el navegador.
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-tertiary">
            {hasDocs ? (
              <>
                {documents.length} PDF{documents.length === 1 ? "" : "s"} en el
                lienzo
                {selectedPageIds.length > 0
                  ? ` · ${selectedPageIds.length} página${selectedPageIds.length === 1 ? "" : "s"} seleccionada(s) (solo esas se exportan)`
                  : " · se exportan todas las páginas visibles"}
              </>
            ) : (
              "Añade PDFs para exportar"
            )}
          </p>
          <button
            type="button"
            disabled={!hasDocs || busy}
            onClick={handleExport}
            className="inline-flex min-h-11 min-w-[160px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Exportando…" : "Exportar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
