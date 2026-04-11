"use client";

import { useRef } from "react";

import { useWorkspaceStore } from "@/stores/workspace-store";

import { DocumentBlock } from "./document-block";

export function DocumentBlocks() {
  const documents = useWorkspaceStore((s) => s.documents);
  const reorderDocuments = useWorkspaceStore((s) => s.reorderDocuments);

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
      className="mx-auto w-full max-w-6xl space-y-3 px-4 pb-6 sm:px-6"
      aria-label="Documentos en el lienzo"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-mono text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Orden de unión
        </h2>
        <p className="font-mono text-[11px] text-tertiary">
          Arrastra bloques para reordenar (PRD §5.2)
        </p>
      </div>
      <ol className="space-y-3">
        {documents.map((doc, index) => (
          <li key={doc.id}>
            <DocumentBlock
              doc={doc}
              index={index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
