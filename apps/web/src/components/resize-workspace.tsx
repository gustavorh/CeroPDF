"use client";

import { useState } from "react";

import { RESIZE_CAPS, useResizeStore } from "@/stores/resize-store";

import { SingleDocGridWorkspace } from "./page-grid/single-doc-grid-workspace";

const PRESETS = [
  { label: "A4", width: 595, height: 842 },
  { label: "Letter", width: 612, height: 792 },
  { label: "Legal", width: 612, height: 1008 },
] as const;

const chip =
  "inline-flex min-h-9 items-center justify-center rounded-md border px-3 text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const chipOff =
  "border-outline-variant/45 bg-surface-container-low text-muted-foreground hover:text-foreground";
const chipOn = "border-primary/55 bg-primary-muted text-foreground";

function ResizeControls() {
  const resize = useResizeStore((s) => s.resize);
  const setResize = useResizeStore((s) => s.setResize);
  const [pct, setPct] = useState("100");

  const applyScale = () => {
    const n = Number.parseInt(pct, 10);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(400, Math.max(10, n));
    setResize({ kind: "scale", factor: clamped / 100 });
  };

  const target =
    resize?.kind === "size"
      ? `${PRESETS.find((p) => p.width === resize.width && p.height === resize.height)?.label ?? "Personalizado"} · ${resize.width}×${resize.height} pt`
      : resize?.kind === "scale"
        ? `Escala ${Math.round(resize.factor * 100)} %`
        : "Tamaño original (sin cambios)";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-tertiary">Tamaño de papel:</span>
        {PRESETS.map((p) => {
          const active =
            resize?.kind === "size" && resize.width === p.width && resize.height === p.height;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setResize({ kind: "size", width: p.width, height: p.height })}
              className={`${chip} ${active ? chipOn : chipOff}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-tertiary">Escala:</span>
        <input
          type="number"
          min={10}
          max={400}
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          className="w-20 rounded-md border border-outline-variant/40 bg-surface-container-low/90 px-2 py-1.5 font-mono text-sm text-foreground focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <span className="text-sm text-muted-foreground">%</span>
        <button type="button" onClick={applyScale} className={`${chip} ${chipOff}`}>
          Aplicar escala
        </button>
        <button type="button" onClick={() => setResize(null)} className={`${chip} ${chipOff}`}>
          Tamaño original
        </button>
      </div>
      <p className="font-mono text-xs text-muted-foreground">Destino: {target}</p>
    </div>
  );
}

export function ResizeWorkspace() {
  return (
    <SingleDocGridWorkspace
      store={useResizeStore}
      capabilities={RESIZE_CAPS}
      title="Redimensionar PDF"
      description="Cambia el tamaño de las páginas por porcentaje o a un tamaño de papel estándar (A4, Letter, Legal). 100 % en tu navegador."
      exportLabel="Exportar"
      controls={<ResizeControls />}
    />
  );
}
