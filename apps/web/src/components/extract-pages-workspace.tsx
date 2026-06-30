"use client";

import { useDocumentStore } from "@/stores/document-store";
import { useSelectionStore } from "@/stores/selection-store";
import { EXTRACT_CAPS, useExtractPagesStore } from "@/stores/extract-pages-store";

import { PageRangeControl } from "./page-grid/page-range-control";
import { SingleDocGridWorkspace } from "./page-grid/single-doc-grid-workspace";

function ExtractControls() {
  const pageEntries = useExtractPagesStore((s) => s.pageEntries);
  const setSelection = useSelectionStore((s) => s.setSelection);
  const clear = useSelectionStore((s) => s.clear);
  const selectedIds = useSelectionStore((s) => s.selectedIds);

  const selectByPositions = (pages: number[]) => {
    const ids = pages.map((p) => pageEntries[p - 1]?.id).filter(Boolean) as string[];
    setSelection(ids);
  };

  return (
    <div className="flex flex-col gap-2">
      <PageRangeControl
        pageCount={pageEntries.length}
        onApply={selectByPositions}
        applyLabel="Seleccionar rango"
      />
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-tertiary">
          {selectedIds.length} página{selectedIds.length === 1 ? "" : "s"} seleccionada
          {selectedIds.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          disabled={selectedIds.length === 0}
          onClick={() => clear()}
          className="font-mono text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline disabled:opacity-45"
        >
          limpiar
        </button>
      </div>
    </div>
  );
}

export function ExtractPagesWorkspace() {
  const hasDoc = useDocumentStore((s) => s.documents.length > 0);
  return (
    <SingleDocGridWorkspace
      store={useExtractPagesStore}
      capabilities={EXTRACT_CAPS}
      title="Extraer páginas"
      description="Selecciona páginas por rango o clic y genera un PDF nuevo solo con esas. 100 % en tu navegador."
      exportLabel="Extraer seleccionadas"
      controls={hasDoc ? <ExtractControls /> : undefined}
    />
  );
}
