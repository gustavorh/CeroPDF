"use client";

import { ROTATE_CAPS, useRotateStore } from "@/stores/rotate-store";

import { SingleDocGridWorkspace } from "./page-grid/single-doc-grid-workspace";

const btn =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-3 text-sm text-foreground transition hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function RotateWorkspace() {
  const rotateAll = useRotateStore((s) => s.rotateAll);
  return (
    <SingleDocGridWorkspace
      store={useRotateStore}
      capabilities={ROTATE_CAPS}
      title="Rotar PDF"
      description="Rota páginas individuales o todo el documento de una vez. 100 % en tu navegador; nada se sube."
      exportLabel="Exportar"
      controls={
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-tertiary">Todo el documento:</span>
          <button type="button" className={btn} onClick={() => rotateAll(-90)}>
            Rotar todo ↺
          </button>
          <button type="button" className={btn} onClick={() => rotateAll(90)}>
            Rotar todo ↻
          </button>
        </div>
      }
    />
  );
}
