"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";
import type { WorkspaceDocument } from "@/types/workspace";
import { formatBytes } from "@/lib/format-bytes";

import { PageThumbnailsPanel } from "./page-thumbnails-panel";

type DocumentBlockProps = {
  doc: WorkspaceDocument;
  index: number;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
};

export function DocumentBlock({
  doc,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: DocumentBlockProps) {
  const toggleExpanded = useWorkspaceStore((s) => s.toggleExpanded);
  const removeDocument = useWorkspaceStore((s) => s.removeDocument);
  const expandedDocumentIds = useWorkspaceStore((s) => s.expandedDocumentIds);

  const expanded = expandedDocumentIds.includes(doc.id);

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
        onDragStart(index);
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={() => onDrop(index)}
      className="overflow-hidden rounded-xl border border-border bg-card/50 ring-1 ring-border/40"
    >
      <div
        role="button"
        tabIndex={0}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-card"
        onClick={() => toggleExpanded(doc.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleExpanded(doc.id);
          }
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          toggleExpanded(doc.id);
        }}
      >
        <span
          className="cursor-grab font-mono text-tertiary select-none active:cursor-grabbing"
          title="Arrastra el bloque para reordenar el orden de unión"
          onClick={(e) => e.stopPropagation()}
        >
          ⋮⋮
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{doc.name}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {formatBytes(doc.sizeBytes)}
          </p>
        </div>
        <span className="hidden font-mono text-[10px] text-tertiary sm:inline">
          Orden {index + 1}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            removeDocument(doc.id);
          }}
          className="rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground transition hover:border-destructive/50 hover:text-destructive"
        >
          Quitar
        </button>
        <span className="font-mono text-muted-foreground" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </div>
      {expanded ? <PageThumbnailsPanel documentId={doc.id} /> : null}
    </article>
  );
}
