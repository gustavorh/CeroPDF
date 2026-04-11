"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { loadPdfJsDocument } from "@/lib/pdf/load-pdfjs-document";
import { isBenignPdfPreviewError } from "@/lib/pdf/pdf-preview-errors";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { PageEntry } from "@/types/workspace";

type PageThumbnailTileProps = {
  documentId: string;
  bytes: ArrayBuffer;
  entry: PageEntry;
  selected: boolean;
};

function PageThumbnailTile({
  documentId,
  bytes,
  entry,
  selected,
}: PageThumbnailTileProps) {
  const selectPageEntry = useWorkspaceStore((s) => s.selectPageEntry);
  const togglePageHidden = useWorkspaceStore((s) => s.togglePageHidden);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [visible, setVisible] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setVisible(true);
        }
      },
      { root: null, rootMargin: "120px", threshold: 0.01 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setRenderError(null);
      try {
        const pdf = await loadPdfJsDocument(documentId, bytes);
        if (cancelled) return;
        const pageNumber = entry.sourcePageIndex + 1;
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const targetWidth = 156;
        const scale = targetWidth / base.width;
        const viewport = page.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
        if (cancelled) return;
        setRenderError(null);
      } catch (err) {
        renderTaskRef.current = null;
        if (cancelled || isBenignPdfPreviewError(err)) return;
        setRenderError("Vista previa no disponible");
      }
    };
    void run();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [visible, documentId, bytes, entry.sourcePageIndex]);

  return (
    <div
      ref={rootRef}
      className={`flex flex-col overflow-hidden rounded-lg border bg-card/70 text-left transition ${
        entry.hidden ? "opacity-40" : ""
      } ${
        selected
          ? "border-primary ring-2 ring-primary/50"
          : "border-border hover:border-muted-foreground/40"
      }`}
    >
      <button
        type="button"
        onClick={(e) =>
          selectPageEntry(entry.id, { shiftKey: e.shiftKey })
        }
        className="group flex w-full flex-col text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="relative flex aspect-[3/4] items-center justify-center bg-background/80">
          <canvas
            ref={canvasRef}
            className={`max-h-full max-w-full object-contain ${
              renderError ? "opacity-0" : "opacity-100"
            }`}
            aria-label={`Página ${entry.sourcePageIndex + 1}`}
          />
          {renderError ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-center font-mono text-[10px] text-muted-foreground">
              {renderError}
            </span>
          ) : null}
        </div>
        <span className="border-t border-border px-2 py-1.5 font-mono text-[10px] text-muted-foreground group-hover:text-foreground">
          Página {entry.sourcePageIndex + 1}
          {entry.hidden ? " · excluida" : ""}
        </span>
      </button>
      <div className="flex gap-1 border-t border-border px-2 py-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            togglePageHidden(entry.id);
          }}
          className="flex-1 rounded border border-border px-1 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-muted-foreground/50"
        >
          {entry.hidden ? "Incluir" : "Excluir"}
        </button>
      </div>
    </div>
  );
}

type PageThumbnailsPanelProps = {
  documentId: string;
};

export function PageThumbnailsPanel({ documentId }: PageThumbnailsPanelProps) {
  const documents = useWorkspaceStore((s) => s.documents);
  const pageEntries = useWorkspaceStore((s) => s.pageEntries);
  const selectedPageIds = useWorkspaceStore((s) => s.selectedPageIds);
  const reorderPageEntriesInDocument = useWorkspaceStore(
    (s) => s.reorderPageEntriesInDocument,
  );

  const doc = documents.find((d) => d.id === documentId);
  const bytes = doc?.bytes;

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

  if (!bytes) {
    return (
      <div className="border-t border-border-subtle bg-background/50 px-4 py-4 font-mono text-xs text-muted-foreground">
        Sin datos en memoria para este documento.
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border-subtle bg-background/50 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] text-muted-foreground">
          Miniaturas · usa la barra ⋮⋮ para arrastrar y reordenar · Shift+clic
          para seleccionar
        </p>
        <p className="font-mono text-[11px] text-tertiary">
          Render perezoso (IntersectionObserver)
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {entries.map((entry, localIndex) => (
          <li
            key={entry.id}
            className="flex flex-col gap-1"
            onDragEnter={allowDrop}
            onDragOver={allowDrop}
            onDrop={(e) => onDropAtLocalIndex(e, localIndex)}
          >
            <div
              className="flex cursor-grab select-none items-center justify-center rounded-md border border-border bg-card/80 py-1 font-mono text-xs text-tertiary active:cursor-grabbing"
              draggable
              title="Arrastrar para reordenar páginas"
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(localIndex));
              }}
            >
              ⋮⋮
            </div>
            <PageThumbnailTile
              documentId={documentId}
              bytes={bytes}
              entry={entry}
              selected={selectedPageIds.includes(entry.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
