"use client";

import { useRef } from "react";

import { useDocumentStore } from "@/stores/document-store";
import { useMergeStore, MERGE_CAPS } from "@/stores/merge-store";
import { formatBytes } from "@/lib/format-bytes";

import { PageGrid } from "./page-grid/page-grid";

/** Lienzo (estado 2): secciones por PDF con cabecera ancha y cuadrícula de miniaturas. */
export function CanvasDocuments() {
  const documents = useDocumentStore((s) => s.documents);
  const reorderDocuments = useMergeStore((s) => s.reorderDocuments);
  const removeDocument = useMergeStore((s) => s.removeDocument);

  const dragFrom = useRef<number | null>(null);

  if (documents.length === 0) return null;

  const handleDragStart = (index: number) => {
    dragFrom.current = index;
  };

  const handleDragEnd = () => {
    dragFrom.current = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (toIndex: number) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === toIndex) return;
    reorderDocuments(from, toIndex);
  };

  return (
    <section
      className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-32 pt-6 sm:space-y-10 sm:px-6"
      aria-label="Lienzo de documentos"
    >
      {documents.map((doc, index) => (
        <div key={doc.id} className="space-y-4">
          <div
            className="-mx-4 flex flex-wrap items-stretch gap-0 border-y border-outline-variant/40 bg-surface-container/95 shadow-[inset_0_1px_0_0_rgb(244_244_245/0.06)] sm:-mx-6"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(index)}
          >
            <div
              className="flex min-w-0 flex-1 cursor-grab items-center gap-3 px-4 py-3.5 select-none active:cursor-grabbing sm:gap-4 sm:px-6"
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnd={handleDragEnd}
            >
              <span className="font-mono text-[10px] text-tertiary" aria-hidden>
                ⋮⋮
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-label-md font-mono tracking-[0.08em] text-primary">
                  Documento {index + 1}
                </h2>
                <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {doc.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatBytes(doc.sizeBytes)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center border-t border-outline-variant/25 px-4 py-2 sm:border-t-0 sm:border-l sm:border-outline-variant/25 sm:px-5">
              <button
                type="button"
                onClick={() => removeDocument(doc.id)}
                className="rounded-md border border-outline-variant/45 px-3 py-1.5 font-mono text-xs text-muted-foreground transition hover:border-destructive/45 hover:bg-destructive-muted hover:text-destructive"
              >
                Quitar PDF
              </button>
            </div>
          </div>

          <PageGrid documentId={doc.id} store={useMergeStore} capabilities={MERGE_CAPS} />
        </div>
      ))}
    </section>
  );
}
