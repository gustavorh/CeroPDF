"use client";

import { useDocumentStore } from "@/stores/document-store";
import { useEditStore, type EditTool } from "@/stores/edit-store";

type ToolDef = {
  id: EditTool;
  label: string;
  shortcut: string;
};

const TOOLS: ToolDef[] = [
  { id: "select", label: "Seleccionar", shortcut: "V" },
  { id: "text", label: "Texto", shortcut: "T" },
  { id: "rect", label: "Rectángulo", shortcut: "R" },
  { id: "highlight", label: "Resaltar", shortcut: "H" },
];

export function EditToolbar() {
  const activeTool = useEditStore((s) => s.activeTool);
  const setActiveTool = useEditStore((s) => s.setActiveTool);
  // Primitive selector: avoid re-rendering the sticky toolbar on every annotation
  // mutation (incl. pointermove drags) — only the count matters here.
  const annotationCount = useEditStore((s) => s.annotations.length);
  const clearAllAnnotations = useEditStore((s) => s.clearAllAnnotations);
  const exportFlattened = useEditStore((s) => s.exportFlattened);
  const resetWorkspace = useEditStore((s) => s.resetWorkspace);
  const uiPhase = useDocumentStore((s) => s.uiPhase);

  const busy = uiPhase === "merging";

  return (
    <div className="sticky top-0 z-30 border-b border-outline-variant/30 bg-card/85 backdrop-blur-[20px]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTool(t.id)}
              className={`inline-flex min-h-9 items-center justify-center rounded-md border px-3 text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                activeTool === t.id
                  ? "border-primary/55 bg-primary-muted/40 text-foreground"
                  : "border-outline-variant/45 bg-surface-container-low text-muted-foreground hover:text-foreground"
              }`}
              title={`${t.label} (${t.shortcut})`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-tertiary">
            {annotationCount} anotacion{annotationCount === 1 ? "" : "es"}
          </span>
          <button
            type="button"
            onClick={clearAllAnnotations}
            disabled={annotationCount === 0 || busy}
            className="inline-flex min-h-9 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-3 text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={resetWorkspace}
            disabled={busy}
            className="inline-flex min-h-9 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-3 text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cambiar PDF
          </button>
          <button
            type="button"
            onClick={() => void exportFlattened()}
            disabled={busy}
            className="inline-flex min-h-9 items-center justify-center rounded-md bg-gradient-to-b from-primary to-primary-gradient px-4 text-sm font-semibold text-primary-foreground transition hover:from-primary-hover hover:to-primary-gradient-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? "Exportando…" : "Exportar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
