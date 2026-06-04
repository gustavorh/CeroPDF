"use client";

import { useDocumentStore } from "@/stores/document-store";
import type { UiPhase } from "@/stores/document-store";

const PHASE_LABEL: Record<UiPhase, string> = {
  idle: "Todo listo",
  loading: "Cargando…",
  parsing: "Leyendo tu PDF…",
  rendering: "Renderizando miniaturas…",
  merging: "Uniendo documentos…",
  export_success: "Exportación lista",
  error: "Revisa el mensaje de arriba",
};

function resolveDisplayPhase(
  uiPhase: UiPhase,
  thumbnailRenderCount: number,
): UiPhase {
  if (
    uiPhase === "loading" ||
    uiPhase === "parsing" ||
    uiPhase === "merging" ||
    uiPhase === "export_success" ||
    uiPhase === "error"
  ) {
    return uiPhase;
  }
  if (thumbnailRenderCount > 0) return "rendering";
  return uiPhase;
}

export function StatusStrip() {
  const uiPhase = useDocumentStore((s) => s.uiPhase);
  const thumbnailRenderCount = useDocumentStore((s) => s.thumbnailRenderCount);
  const displayPhase = resolveDisplayPhase(uiPhase, thumbnailRenderCount);

  const busy =
    displayPhase !== "idle" &&
    displayPhase !== "error" &&
    displayPhase !== undefined;

  return (
    <div
      className="border-b border-outline-variant/30 bg-gradient-to-b from-surface-container/90 to-background/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span
            className={`relative flex h-2 w-2 shrink-0 rounded-full ${
              displayPhase === "error"
                ? "bg-destructive"
                : busy
                  ? "bg-warning"
                  : "bg-trust"
            }`}
            aria-hidden
          >
            {busy ? (
              <span className="absolute inset-0 animate-ping rounded-full bg-warning/60 opacity-75" />
            ) : null}
          </span>
          <span className="text-label-md hidden text-tertiary sm:inline">
            Actividad
          </span>
          <span className="truncate text-sm font-medium text-foreground">
            {PHASE_LABEL[displayPhase]}
          </span>
        </div>
        <p className="hidden max-w-md text-right text-xs leading-snug text-muted-foreground sm:block">
          Te avisamos aquí cuando una tarea lleve unos segundos (unir, vista
          previa o exportar).
        </p>
      </div>
    </div>
  );
}
