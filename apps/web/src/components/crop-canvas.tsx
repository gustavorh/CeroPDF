"use client";

import { useEffect, useRef, useState } from "react";

import { readDocumentBytes } from "@ceropdf/pdf-core";
import { isBenignPdfPreviewError, loadPdfJsDocument } from "@ceropdf/pdf-render";

import { useDocumentStore } from "@/stores/document-store";
import type { DisplayRect } from "@/lib/page-grid/crop-coords";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

type Props = {
  documentId: string;
  pageIndex: number;
  /** Committed crop in display coords (top-left, 0–1), or null. */
  cropRect: DisplayRect | null;
  /** Called once on pointer-up with the drawn rect (display coords). */
  onChange: (rect: DisplayRect) => void;
};

export function CropCanvas({ documentId, pageIndex, cropRect, onChange }: Props) {
  const documents = useDocumentStore((s) => s.documents);
  const doc = documents.find((d) => d.id === documentId);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DisplayRect | null>(null);

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

  const norm = (e: React.PointerEvent) => {
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
    startRef.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (!start) return;
    const p = norm(e);
    setDraft({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = startRef.current;
    startRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    const d = draft;
    setDraft(null);
    if (start && d && d.w > 0.01 && d.h > 0.01) onChange(d);
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
            className="absolute inset-0 cursor-crosshair"
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
                  boxShadow: "0 0 0 9999px rgba(17,19,22,0.45)",
                }}
                aria-hidden
              />
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
