"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { readDocumentBytes } from "@ceropdf/pdf-core/storage";
import { useDocumentStore } from "@/stores/document-store";
import { useSelectionStore } from "@/stores/selection-store";
import type { PageEntry } from "@/types/workspace";
import type { UsePageGridStore, Capabilities } from "@/lib/page-grid/use-page-grid";

import { PageThumbnailTile } from "./page-thumbnail-tile";

type PageGridProps = {
  documentId: string;
  store: UsePageGridStore;
  capabilities: Capabilities;
};

type ThumbnailGridItemProps = {
  documentId: string;
  bytes: ArrayBuffer;
  entry: PageEntry;
  selected: boolean;
  localIndex: number;
  onDropAtLocalIndex: (e: React.DragEvent, targetLocalIndex: number) => void;
  allowDrop: (e: React.DragEvent) => void;
  store: UsePageGridStore;
  capabilities: Capabilities;
};

const ThumbnailGridItem = memo(function ThumbnailGridItem({
  documentId,
  bytes,
  entry,
  selected,
  localIndex,
  onDropAtLocalIndex,
  allowDrop,
  store,
  capabilities,
}: ThumbnailGridItemProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <li
      draggable={capabilities.canReorder ?? false}
      onDragStart={(e) => {
        setDragging(true);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(localIndex));
      }}
      onDragEnd={() => setDragging(false)}
      className={`flex flex-col ${
        capabilities.canReorder
          ? dragging
            ? "cursor-grabbing opacity-[0.85]"
            : "cursor-grab"
          : "cursor-default"
      }`}
      onDragEnter={capabilities.canReorder ? allowDrop : undefined}
      onDragOver={capabilities.canReorder ? allowDrop : undefined}
      onDrop={capabilities.canReorder ? (e) => onDropAtLocalIndex(e, localIndex) : undefined}
    >
      <PageThumbnailTile
        documentId={documentId}
        bytes={bytes}
        entry={entry}
        selected={selected}
        store={store}
        capabilities={capabilities}
      />
    </li>
  );
});

export function PageGrid({ documentId, store: useStore, capabilities }: PageGridProps) {
  const documents = useDocumentStore((s) => s.documents);
  const pageEntries = useStore((s) => s.pageEntries);
  const selectedPageIds = useSelectionStore((s) => s.selectedIds);
  const reorderPageEntriesInDocument = useStore((s) => s.reorderPageEntriesInDocument);

  const doc = documents.find((d) => d.id === documentId);
  const backing = doc?.backing;
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBytes(null);
    if (!backing) return;
    void readDocumentBytes(backing).then((b) => {
      if (!cancelled) setBytes(b);
    });
    return () => {
      cancelled = true;
    };
  }, [backing]);

  const entries = useMemo(
    () => pageEntries.filter((e) => e.documentId === documentId),
    [pageEntries, documentId],
  );

  const onDropAtLocalIndex = useCallback(
    (e: React.DragEvent, targetLocalIndex: number) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData("text/plain");
      const from = Number.parseInt(raw, 10);
      if (Number.isNaN(from)) return;
      if (from === targetLocalIndex) return;
      reorderPageEntriesInDocument(documentId, from, targetLocalIndex);
    },
    [documentId, reorderPageEntriesInDocument],
  );

  const allowDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  if (!backing) {
    return (
      <div className="bg-surface-container-low/90 px-4 py-4 font-mono text-xs text-muted-foreground">
        Sin datos para este documento.
      </div>
    );
  }

  if (!bytes) {
    return (
      <div className="bg-surface-container-low/90 px-4 py-4 font-mono text-xs text-muted-foreground">
        Cargando vista previa…
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {entries.map((entry, localIndex) => (
        <ThumbnailGridItem
          key={entry.id}
          documentId={documentId}
          bytes={bytes}
          entry={entry}
          selected={selectedPageIds.includes(entry.id)}
          localIndex={localIndex}
          onDropAtLocalIndex={onDropAtLocalIndex}
          allowDrop={allowDrop}
          store={useStore}
          capabilities={capabilities}
        />
      ))}
    </ul>
  );
}
