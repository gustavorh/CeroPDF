"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";
import type { UiPhase } from "@/stores/workspace-store";

const PHASE_LABEL: Record<UiPhase, string> = {
  idle: "Todo listo",
  loading: "Cargando…",
  parsing: "Leyendo tu PDF…",
  rendering: "Preparando vista previa…",
  merging: "Uniendo documentos…",
  error: "Revisa el mensaje de arriba",
};

export function StatusStrip() {
  const uiPhase = useWorkspaceStore((s) => s.uiPhase);

  const busy =
    uiPhase !== "idle" && uiPhase !== "error" && uiPhase !== undefined;

  return (
    <div
      className="border-b border-border/70 bg-gradient-to-b from-card/50 to-background/80 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <span
            className={`relative flex h-2 w-2 shrink-0 rounded-full ${
              uiPhase === "error"
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
          <span className="hidden text-[11px] font-semibold tracking-[0.12em] text-tertiary uppercase sm:inline">
            Actividad
          </span>
          <span className="truncate text-sm font-medium text-foreground">
            {PHASE_LABEL[uiPhase]}
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
