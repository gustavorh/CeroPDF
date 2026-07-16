"use client";

import { useEffect, useRef, useState } from "react";

import { readDocumentBytes } from "@ceropdf/pdf-core/storage";
import { isBenignPdfPreviewError, loadPdfJsDocument } from "@ceropdf/pdf-render";

import { useDocumentStore } from "@/stores/document-store";
import type { DisplayRect } from "@/lib/page-grid/crop-coords";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Minimum crop size (normalized) so a resize can't collapse the rect. */
const MIN_SIZE = 0.02;
/** Hit radius (px) around a handle center for grabbing it. */
const HANDLE_HIT_PX = 14;

type Handle = "nw" | "ne" | "se" | "sw" | "n" | "e" | "s" | "w";

// Corners first so they win hit-testing over the edge handles they overlap.
const HANDLES: { id: Handle; cx: number; cy: number; cursor: string }[] = [
  { id: "nw", cx: 0, cy: 0, cursor: "nwse-resize" },
  { id: "ne", cx: 1, cy: 0, cursor: "nesw-resize" },
  { id: "se", cx: 1, cy: 1, cursor: "nwse-resize" },
  { id: "sw", cx: 0, cy: 1, cursor: "nesw-resize" },
  { id: "n", cx: 0.5, cy: 0, cursor: "ns-resize" },
  { id: "e", cx: 1, cy: 0.5, cursor: "ew-resize" },
  { id: "s", cx: 0.5, cy: 1, cursor: "ns-resize" },
  { id: "w", cx: 0, cy: 0.5, cursor: "ew-resize" },
];

const LEFT: Handle[] = ["nw", "w", "sw"];
const RIGHT: Handle[] = ["ne", "e", "se"];
const TOP: Handle[] = ["nw", "n", "ne"];
const BOTTOM: Handle[] = ["sw", "s", "se"];

type Drag =
  | { kind: "draw"; sx: number; sy: number }
  | { kind: "move"; px: number; py: number; base: DisplayRect }
  | { kind: "resize"; handle: Handle; base: DisplayRect };

type Point = { x: number; y: number };

function rectFromCorners(sx: number, sy: number, px: number, py: number): DisplayRect {
  const x = clamp01(Math.min(sx, px));
  const y = clamp01(Math.min(sy, py));
  return {
    x,
    y,
    w: Math.min(Math.abs(px - sx), 1 - x),
    h: Math.min(Math.abs(py - sy), 1 - y),
  };
}

function applyMove(base: DisplayRect, dx: number, dy: number): DisplayRect {
  return {
    x: Math.min(Math.max(base.x + dx, 0), 1 - base.w),
    y: Math.min(Math.max(base.y + dy, 0), 1 - base.h),
    w: base.w,
    h: base.h,
  };
}

function applyResize(base: DisplayRect, handle: Handle, px: number, py: number): DisplayRect {
  let l = base.x;
  let t = base.y;
  let r = base.x + base.w;
  let b = base.y + base.h;
  if (LEFT.includes(handle)) l = Math.min(clamp01(px), r - MIN_SIZE);
  if (RIGHT.includes(handle)) r = Math.max(clamp01(px), l + MIN_SIZE);
  if (TOP.includes(handle)) t = Math.min(clamp01(py), b - MIN_SIZE);
  if (BOTTOM.includes(handle)) b = Math.max(clamp01(py), t + MIN_SIZE);
  return { x: l, y: t, w: r - l, h: b - t };
}

function insideRect(p: Point, r: DisplayRect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function hitHandle(
  p: Point,
  r: DisplayRect,
  size: { w: number; h: number },
): Handle | null {
  const tx = HANDLE_HIT_PX / size.w;
  const ty = HANDLE_HIT_PX / size.h;
  for (const h of HANDLES) {
    const hx = r.x + h.cx * r.w;
    const hy = r.y + h.cy * r.h;
    if (Math.abs(p.x - hx) <= tx && Math.abs(p.y - hy) <= ty) return h.id;
  }
  return null;
}

type Props = {
  documentId: string;
  pageIndex: number;
  /** Committed crop in display coords (top-left, 0–1), or null. */
  cropRect: DisplayRect | null;
  /** Called on pointer-up with the drawn/moved/resized rect (display coords). */
  onChange: (rect: DisplayRect) => void;
};

export function CropCanvas({ documentId, pageIndex, cropRect, onChange }: Props) {
  const documents = useDocumentStore((s) => s.documents);
  const doc = documents.find((d) => d.id === documentId);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DisplayRect | null>(null);
  const [cursor, setCursor] = useState("crosshair");

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
    if (!bytes) return;
    let cancelled = false;
    const run = async () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      setRenderError(null);
      try {
        const pdf = await loadPdfJsDocument(documentId, bytes);
        if (cancelled) return;
        const page = await pdf.getPage(pageIndex + 1);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1, rotation: 0 });
        const scale = Math.min(2.4, Math.max(0.6, container.clientWidth / base.width));
        const viewport = page.getViewport({ scale, rotation: 0 });
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
  }, [bytes, documentId, pageIndex]);

  const norm = (e: React.PointerEvent): Point => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: clamp01((e.clientX - r.left) / r.width),
      y: clamp01((e.clientY - r.top) / r.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canvasSize) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = norm(e);
    const rect = draft ?? cropRect;
    if (rect) {
      const handle = hitHandle(p, rect, canvasSize);
      if (handle) {
        dragRef.current = { kind: "resize", handle, base: rect };
        setDraft(rect);
        return;
      }
      if (insideRect(p, rect)) {
        dragRef.current = { kind: "move", px: p.x, py: p.y, base: rect };
        setDraft(rect);
        return;
      }
    }
    dragRef.current = { kind: "draw", sx: p.x, sy: p.y };
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const updateHoverCursor = (e: React.PointerEvent) => {
    if (!canvasSize) return;
    const p = norm(e);
    const rect = draft ?? cropRect;
    let next = "crosshair";
    if (rect) {
      const handle = hitHandle(p, rect, canvasSize);
      if (handle) next = HANDLES.find((h) => h.id === handle)!.cursor;
      else if (insideRect(p, rect)) next = "move";
    }
    if (next !== cursor) setCursor(next);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) {
      updateHoverCursor(e);
      return;
    }
    const p = norm(e);
    if (drag.kind === "draw") {
      setDraft(rectFromCorners(drag.sx, drag.sy, p.x, p.y));
    } else if (drag.kind === "move") {
      setDraft(applyMove(drag.base, p.x - drag.px, p.y - drag.py));
    } else {
      setDraft(applyResize(drag.base, drag.handle, p.x, p.y));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    const d = draft;
    setDraft(null);
    if (!drag || !d) return;
    // Draw needs a minimum footprint to count; move/resize always commit
    // (resize already enforces MIN_SIZE, move preserves the existing size).
    if (drag.kind === "draw") {
      if (d.w > 0.01 && d.h > 0.01) onChange(d);
    } else {
      onChange(d);
    }
  };

  const shown = draft ?? cropRect;

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-3xl" style={{ touchAction: "none" }}>
      <div className="relative inline-block w-full">
        <canvas
          ref={canvasRef}
          className="block w-full rounded-md bg-white shadow-[0_30px_60px_-30px_var(--shadow-ambient)]"
          aria-hidden
        />
        {canvasSize ? (
          <div
            className="absolute inset-0"
            style={{ cursor }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="application"
            aria-label="Área de recorte"
          >
            {shown ? (
              <div
                className="pointer-events-none absolute border-2 border-primary"
                style={{
                  left: `${shown.x * 100}%`,
                  top: `${shown.y * 100}%`,
                  width: `${shown.w * 100}%`,
                  height: `${shown.h * 100}%`,
                  boxShadow: "0 0 0 9999px var(--shadow-ambient)",
                }}
                aria-hidden
              >
                {HANDLES.map((h) => (
                  <span
                    key={h.id}
                    className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-primary bg-card"
                    style={{ left: `${h.cx * 100}%`, top: `${h.cy * 100}%` }}
                    aria-hidden
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {renderError ? (
          <p className="mt-3 text-center font-mono text-xs text-destructive">{renderError}</p>
        ) : null}
        {!canvasSize ? (
          <p className="mt-3 text-center font-mono text-xs text-muted-foreground">Cargando página…</p>
        ) : null}
      </div>
    </div>
  );
}
