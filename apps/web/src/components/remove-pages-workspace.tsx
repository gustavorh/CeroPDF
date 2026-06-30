"use client";

import { useDocumentStore } from "@/stores/document-store";
import { useSelectionStore } from "@/stores/selection-store";
import { REMOVE_CAPS, useRemovePagesStore } from "@/stores/remove-pages-store";

import { PageRangeControl } from "./page-grid/page-range-control";
import { SingleDocGridWorkspace } from "./page-grid/single-doc-grid-workspace";

function RemoveControls() {
  const pageEntries = useRemovePagesStore((s) => s.pageEntries);
  const removePageEntry = useRemovePagesStore((s) => s.removePageEntry);
  const selectedIds = useSelectionStore((s) => s.selectedIds);

  const removeByPositions = (pages: number[]) => {
    const ids = pages.map((p) => pageEntries[p - 1]?.id).filter(Boolean) as string[];
    ids.forEach((id) => removePageEntry(id));
  };

  return (
    <div className="flex flex-col gap-3">
      <PageRangeControl
        pageCount={pageEntries.length}
        onApply={removeByPositions}
        applyLabel="Quitar rango"
      />
      <button
        type="button"
        disabled={selectedIds.length === 0}
        onClick={() => selectedIds.forEach((id) => removePageEntry(id))}
        className="inline-flex min-h-9 w-fit items-center justify-center rounded-md border border-destructive/40 bg-destructive-muted px-3 text-sm text-destructive transition hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
      >
        Quitar seleccionadas ({selectedIds.length})
      </button>
    </div>
  );
}

export function RemovePagesWorkspace() {
  const hasDoc = useDocumentStore((s) => s.documents.length > 0);
  return (
    <SingleDocGridWorkspace
      store={useRemovePagesStore}
      capabilities={REMOVE_CAPS}
      title="Quitar páginas"
      description="Elige páginas por rango o selección y quítalas del PDF. 100 % en tu navegador."
      exportLabel="Exportar restantes"
      controls={hasDoc ? <RemoveControls /> : undefined}
    />
  );
}
