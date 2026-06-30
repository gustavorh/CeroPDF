"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { isBenignPdfPreviewError, loadPdfJsDocument } from "@ceropdf/pdf-render";
import { useDocumentStore } from "@/stores/document-store";
import type { PageEntry } from "@/types/workspace";
import type { UsePageGridStore, Capabilities } from "@/lib/page-grid/use-page-grid";

type PageThumbnailTileProps = {
  documentId: string;
  bytes: ArrayBuffer;
  entry: PageEntry;
  selected: boolean;
  store: UsePageGridStore;
  capabilities: Capabilities;
};

function IconTrash({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconRotateCw({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v7h-7" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="m1 1 22 22" />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconRotateCcw({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v7h7" />
    </svg>
  );
}

export function PageThumbnailTile({
  documentId,
  bytes,
  entry,
  selected,
  store: useStore,
  capabilities,
}: PageThumbnailTileProps) {
  const selectPageEntry = useStore((s) => s.selectPageEntry);
  const removePageEntry = useStore((s) => s.removePageEntry);
  const togglePageHidden = useStore((s) => s.togglePageHidden);
  const rotatePageClockwise = useStore((s) => s.rotatePageClockwise);
  const rotatePageCounterClockwise = useStore((s) => s.rotatePageCounterClockwise);

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
    const { beginThumbnailRender, endThumbnailRender } =
      useDocumentStore.getState();

    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      setRenderError(null);
      beginThumbnailRender();
      try {
        const pdf = await loadPdfJsDocument(documentId, bytes);
        if (cancelled) return;
        const pageNumber = entry.sourcePageIndex + 1;
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const targetWidth = 156;
        const scale = targetWidth / base.width;
        const combined =
          (((page.rotate ?? 0) + (entry.rotation ?? 0)) % 360 + 360) % 360;
        const viewport = page.getViewport({ scale, rotation: combined });
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
      } finally {
        endThumbnailRender();
      }
    };
    void run();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [visible, documentId, bytes, entry.sourcePageIndex, entry.rotation]);

  return (
    <div
      ref={rootRef}
      className={`group/tile relative flex flex-col overflow-hidden rounded-md bg-surface-container-low text-left transition will-change-transform ${
        entry.hidden ? "opacity-40" : ""
      } ${
        selected
          ? "ring-2 ring-primary/55 ring-offset-2 ring-offset-background"
          : "ring-1 ring-outline-variant/30"
      }`}
    >
      <div className="flex w-full flex-col">
        <div className="relative flex aspect-[3/4] items-center justify-center bg-background/70">
          <canvas
            ref={canvasRef}
            className={`relative z-0 max-h-full max-w-full object-contain pointer-events-none ${
              renderError ? "opacity-0" : "opacity-100"
            }`}
            aria-hidden
          />
          {capabilities.canSelect && (
            <button
              type="button"
              draggable={false}
              aria-label={`Seleccionar página ${entry.sourcePageIndex + 1}`}
              className="absolute inset-0 z-[1] bg-transparent focus-visible:z-[4] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
              onClick={(e) => {
                selectPageEntry(entry.id, { shiftKey: e.shiftKey });
              }}
            />
          )}
          {renderError ? (
            <span className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center px-2 text-center font-mono text-[10px] text-muted-foreground">
              {renderError}
            </span>
          ) : null}

          <div
            draggable={false}
            className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center opacity-0 transition-opacity group-hover/tile:opacity-100"
            onDragStart={(e) => e.stopPropagation()}
          >
            <div
              draggable={false}
              className="pointer-events-auto flex items-center gap-1 rounded-md border border-outline-variant/40 bg-surface-container/95 p-1 shadow-lg backdrop-blur-sm"
              onDragStart={(e) => e.stopPropagation()}
            >
              {capabilities.canRotate && (
                <>
                  <button
                    type="button"
                    title="Rotar en sentido antihorario"
                    className="rounded-sm p-2 text-foreground transition hover:bg-primary-muted hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      rotatePageCounterClockwise(entry.id);
                    }}
                  >
                    <IconRotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Rotar 90°"
                    className="rounded-sm p-2 text-foreground transition hover:bg-primary-muted hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      rotatePageClockwise(entry.id);
                    }}
                  >
                    <IconRotateCw className="h-4 w-4" />
                  </button>
                </>
              )}
              {capabilities.canHide && (
                <button
                  type="button"
                  title={
                    entry.hidden
                      ? "Incluir de nuevo en el PDF final"
                      : "Excluir del PDF final (sigue en el lienzo)"
                  }
                  className="rounded-sm p-2 text-muted-foreground transition hover:bg-surface-bright hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePageHidden(entry.id);
                  }}
                >
                  {entry.hidden ? (
                    <IconEye className="h-4 w-4" />
                  ) : (
                    <IconEyeOff className="h-4 w-4" />
                  )}
                </button>
              )}
              {capabilities.canRemove && (
                <button
                  type="button"
                  title="Quitar esta página de la secuencia"
                  className="rounded-sm p-2 text-destructive transition hover:bg-destructive-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePageEntry(entry.id);
                  }}
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          draggable={false}
          className="bg-surface-container-highest/50 px-2 py-1.5 text-left font-mono text-[10px] text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={(e) => {
            if (capabilities.canSelect) selectPageEntry(entry.id, { shiftKey: e.shiftKey });
          }}
        >
          Página {entry.sourcePageIndex + 1}
          {entry.hidden ? " · excluida" : ""}
        </button>
      </div>
    </div>
  );
}
