"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  isBenignPdfPreviewError,
  loadPdfJsDocument,
} from "@ceropdf/pdf-render";
import { readDocumentBytes } from "@ceropdf/pdf-core/storage";

import { useDocumentStore } from "@/stores/document-store";
import { useEditStore, type EditTool } from "@/stores/edit-store";

const DEFAULT_TEXT_FONT_SIZE = 14;
const DEFAULT_TEXT = "Texto";
// Annotation default colors are export DATA, not design tokens: they are baked
// into the output PDF by pdf-lib (hexToColor in packages/pdf-core/src/annotate.ts),
// which cannot resolve CSS vars. Kept as literal hex on purpose — stroke/text
// mirror --primary / --background; highlight is an annotation-specific yellow.
const DEFAULT_TEXT_COLOR = "#111316";
const DEFAULT_RECT_STROKE = "#f0a88c";
const DEFAULT_HIGHLIGHT_COLOR = "#facc15";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

type Drag =
  | null
  | {
      kind: "move";
      id: string;
      startX: number;
      startY: number;
      annStartX: number;
      annStartY: number;
    }
  | {
      kind: "resize";
      id: string;
      startX: number;
      startY: number;
      annStartW: number;
      annStartH: number;
    };

export function EditCanvas() {
  const activeDocumentId = useEditStore((s) => s.activeDocumentId);
  const activePageIndex = useEditStore((s) => s.activePageIndex);
  const activeTool = useEditStore((s) => s.activeTool);
  const selectedAnnotationId = useEditStore((s) => s.selectedAnnotationId);
  const annotations = useEditStore((s) => s.annotations);
  const addAnnotation = useEditStore((s) => s.addAnnotation);
  const updateAnnotation = useEditStore((s) => s.updateAnnotation);
  const removeAnnotation = useEditStore((s) => s.removeAnnotation);
  const selectAnnotation = useEditStore((s) => s.selectAnnotation);
  const setActiveTool = useEditStore((s) => s.setActiveTool);
  const documents = useDocumentStore((s) => s.documents);

  const doc = useMemo(
    () => documents.find((d) => d.id === activeDocumentId),
    [documents, activeDocumentId],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [renderError, setRenderError] = useState<string | null>(null);
  const dragRef = useRef<Drag>(null);
  // Coalesce annotation drag writes to one store update per frame (raw pointermove
  // can fire at 120+ Hz; each write maps the whole annotations array + re-renders).
  const rafRef = useRef<number | null>(null);
  const pendingPatchRef = useRef<{
    id: string;
    patch: { x: number; y: number } | { w: number; h: number };
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBytes(null);
    if (!doc) return;
    void readDocumentBytes(doc.backing).then((b) => {
      if (!cancelled) setBytes(b);
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    if (!bytes || !activeDocumentId) return;
    let cancelled = false;
    const run = async () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      setRenderError(null);
      try {
        const pdf = await loadPdfJsDocument(activeDocumentId, bytes);
        if (cancelled) return;
        const page = await pdf.getPage(activePageIndex + 1);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const containerWidth = container.clientWidth;
        const scale = Math.min(2.4, Math.max(0.6, containerWidth / base.width));
        const viewport = page.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        setCanvasSize({ w: canvas.width, h: canvas.height });
        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
      } catch (err) {
        renderTaskRef.current = null;
        if (cancelled || isBenignPdfPreviewError(err)) return;
        setRenderError("No se pudo renderizar la página.");
      }
    };
    void run();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [bytes, activeDocumentId, activePageIndex]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedAnnotationId
      ) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        e.preventDefault();
        removeAnnotation(selectedAnnotationId);
      }
      if (e.key === "Escape" && selectedAnnotationId) {
        selectAnnotation(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedAnnotationId, removeAnnotation, selectAnnotation]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.page === activePageIndex),
    [annotations, activePageIndex],
  );

  const createAnnotationAt = useCallback(
    (nx: number, ny: number, tool: Exclude<EditTool, "select">) => {
      if (tool === "text") {
        addAnnotation({
          id: newId(),
          page: activePageIndex,
          kind: "text",
          x: clamp01(nx),
          y: clamp01(ny),
          w: 0.35,
          h: 0.04,
          text: DEFAULT_TEXT,
          fontSize: DEFAULT_TEXT_FONT_SIZE,
          color: DEFAULT_TEXT_COLOR,
        });
      } else if (tool === "rect") {
        addAnnotation({
          id: newId(),
          page: activePageIndex,
          kind: "rect",
          x: clamp01(nx),
          y: clamp01(ny),
          w: 0.2,
          h: 0.12,
          stroke: DEFAULT_RECT_STROKE,
          strokeWidth: 2,
          fill: null,
        });
      } else if (tool === "highlight") {
        addAnnotation({
          id: newId(),
          page: activePageIndex,
          kind: "highlight",
          x: clamp01(nx),
          y: clamp01(ny),
          w: 0.35,
          h: 0.025,
          color: DEFAULT_HIGHLIGHT_COLOR,
        });
      }
      setActiveTool("select");
    },
    [activePageIndex, addAnnotation, setActiveTool],
  );

  const onOverlayMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (!canvasSize) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    if (activeTool === "select") {
      selectAnnotation(null);
      return;
    }
    createAnnotationAt(nx, ny, activeTool);
  };

  const beginAnnotationDrag = (
    e: React.PointerEvent,
    id: string,
    kind: "move" | "resize",
  ) => {
    e.stopPropagation();
    const ann = annotations.find((a) => a.id === id);
    if (!ann) return;
    selectAnnotation(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (kind === "move") {
      dragRef.current = {
        kind: "move",
        id,
        startX: e.clientX,
        startY: e.clientY,
        annStartX: ann.x,
        annStartY: ann.y,
      };
    } else {
      dragRef.current = {
        kind: "resize",
        id,
        startX: e.clientX,
        startY: e.clientY,
        annStartW: ann.w,
        annStartH: ann.h,
      };
    }
  };

  const flushPendingDrag = () => {
    rafRef.current = null;
    const pending = pendingPatchRef.current;
    pendingPatchRef.current = null;
    if (pending) updateAnnotation(pending.id, pending.patch);
  };

  const onAnnotationPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !canvasSize) return;
    const dxNorm = (e.clientX - drag.startX) / canvasSize.w;
    const dyNorm = (e.clientY - drag.startY) / canvasSize.h;
    pendingPatchRef.current = {
      id: drag.id,
      patch:
        drag.kind === "move"
          ? {
              x: clamp01(drag.annStartX + dxNorm),
              y: clamp01(drag.annStartY + dyNorm),
            }
          : {
              w: clamp01(Math.max(0.02, drag.annStartW + dxNorm)),
              h: clamp01(Math.max(0.015, drag.annStartH + dyNorm)),
            },
    };
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(flushPendingDrag);
    }
  };

  const endAnnotationDrag = (e: React.PointerEvent) => {
    if (dragRef.current) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      dragRef.current = null;
    }
    // Cancel any queued frame and commit the final position synchronously.
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    flushPendingDrag();
  };

  const cursorClass =
    activeTool === "select"
      ? "cursor-default"
      : activeTool === "text"
        ? "cursor-text"
        : "cursor-crosshair";

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full max-w-3xl"
      style={{ touchAction: "none" }}
    >
      <div className="relative inline-block w-full">
        <canvas
          ref={canvasRef}
          className="block w-full rounded-md bg-white shadow-[0_30px_60px_-30px_var(--shadow-ambient)]"
          aria-hidden
        />
        {canvasSize ? (
          <div
            className={`absolute inset-0 ${cursorClass}`}
            onMouseDown={onOverlayMouseDown}
            role="application"
            aria-label="Lienzo de anotaciones"
          >
            {pageAnnotations.map((ann) => {
              const isSelected = ann.id === selectedAnnotationId;
              const styleBase: React.CSSProperties = {
                position: "absolute",
                left: `${ann.x * 100}%`,
                top: `${ann.y * 100}%`,
                width: `${ann.w * 100}%`,
                height: `${ann.h * 100}%`,
              };
              if (ann.kind === "text") {
                const fontSizePx = Math.max(
                  10,
                  (ann.fontSize / 595) * canvasSize.w,
                );
                if (isSelected) {
                  return (
                    <input
                      key={ann.id}
                      type="text"
                      value={ann.text}
                      onChange={(e) =>
                        updateAnnotation(ann.id, { text: e.target.value })
                      }
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onBlur={() => {
                        if (ann.text.trim() === "") removeAnnotation(ann.id);
                      }}
                      autoFocus
                      style={{
                        ...styleBase,
                        fontSize: `${fontSizePx}px`,
                        color: ann.color,
                        background: "var(--edit-scrim)",
                        border: "1px dashed var(--edit-outline)",
                        padding: "0 2px",
                        outline: "none",
                      }}
                    />
                  );
                }
                return (
                  <div
                    key={ann.id}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(e) => beginAnnotationDrag(e, ann.id, "move")}
                    onPointerMove={onAnnotationPointerMove}
                    onPointerUp={endAnnotationDrag}
                    onPointerCancel={endAnnotationDrag}
                    style={{
                      ...styleBase,
                      fontSize: `${fontSizePx}px`,
                      color: ann.color,
                      cursor: "move",
                      userSelect: "none",
                      whiteSpace: "pre",
                    }}
                  >
                    {ann.text || DEFAULT_TEXT}
                  </div>
                );
              }
              if (ann.kind === "rect") {
                return (
                  <div
                    key={ann.id}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(e) => beginAnnotationDrag(e, ann.id, "move")}
                    onPointerMove={onAnnotationPointerMove}
                    onPointerUp={endAnnotationDrag}
                    onPointerCancel={endAnnotationDrag}
                    style={{
                      ...styleBase,
                      border: `${ann.strokeWidth}px solid ${ann.stroke}`,
                      background: ann.fill ?? "transparent",
                      cursor: "move",
                      boxShadow: isSelected
                        ? "0 0 0 2px var(--edit-ring)"
                        : "none",
                    }}
                  >
                    {isSelected ? (
                      <ResizeHandle
                        onPointerDown={(e) =>
                          beginAnnotationDrag(e, ann.id, "resize")
                        }
                        onPointerMove={onAnnotationPointerMove}
                        onPointerUp={endAnnotationDrag}
                      />
                    ) : null}
                  </div>
                );
              }
              // highlight
              return (
                <div
                  key={ann.id}
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => beginAnnotationDrag(e, ann.id, "move")}
                  onPointerMove={onAnnotationPointerMove}
                  onPointerUp={endAnnotationDrag}
                  onPointerCancel={endAnnotationDrag}
                  style={{
                    ...styleBase,
                    background: ann.color,
                    opacity: 0.35,
                    cursor: "move",
                    boxShadow: isSelected
                      ? "0 0 0 2px var(--edit-ring-strong)"
                      : "none",
                  }}
                >
                  {isSelected ? (
                    <ResizeHandle
                      onPointerDown={(e) =>
                        beginAnnotationDrag(e, ann.id, "resize")
                      }
                      onPointerMove={onAnnotationPointerMove}
                      onPointerUp={endAnnotationDrag}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {renderError ? (
          <p className="mt-3 text-center font-mono text-xs text-destructive">
            {renderError}
          </p>
        ) : null}
        {!canvasSize ? (
          <p className="mt-3 text-center font-mono text-xs text-muted-foreground">
            Cargando página…
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ResizeHandle({
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  return (
    <span
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute -bottom-2 -right-2 inline-flex h-4 w-4 cursor-nwse-resize items-center justify-center rounded-sm border border-primary/70 bg-card shadow"
      role="presentation"
    >
      <span className="block h-1.5 w-1.5 rounded-sm bg-primary" aria-hidden />
    </span>
  );
}
