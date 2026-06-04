"use client";

import { useEffect, useMemo, useState } from "react";

import { useDocumentStore } from "@/stores/document-store";
import { useMergeStore } from "@/stores/merge-store";

function ConfettiLayer({ active }: { active: boolean }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        leftPct: (i * 17 + (i % 5) * 3) % 100,
        delayMs: (i % 12) * 40,
        durationMs: 2200 + (i % 5) * 180,
        hue: (i * 41) % 360,
        size: 6 + (i % 4),
      })),
    [],
  );

  if (!active) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {bits.map((b) => (
        <span
          key={b.id}
          className="absolute top-0 rounded-sm opacity-90"
          style={{
            left: `${b.leftPct}%`,
            width: b.size,
            height: b.size * 1.4,
            backgroundColor: `hsl(${b.hue} 70% 58%)`,
            animation: `ceropdf-confetti ${b.durationMs}ms ease-out ${b.delayMs}ms forwards`,
          }}
        />
      ))}
    </div>
  );
}

/** Estado 3: overlay durante exportación y pantalla de éxito con opción de reiniciar. */
export function ExportFlowModal() {
  const uiPhase = useDocumentStore((s) => s.uiPhase);
  const resetWorkspace = useMergeStore((s) => s.resetWorkspace);

  const open = uiPhase === "merging" || uiPhase === "export_success";
  const success = uiPhase === "export_success";

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (uiPhase !== "merging") {
      setProgress(0);
      return;
    }
    setProgress(8);
    const t = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        const next = p + Math.random() * 12 + 4;
        return Math.min(92, next);
      });
    }, 320);
    return () => window.clearInterval(t);
  }, [uiPhase]);

  useEffect(() => {
    if (uiPhase === "export_success") setProgress(100);
  }, [uiPhase]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/55 p-4 backdrop-blur-[6px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-flow-title"
      aria-describedby="export-flow-desc"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-outline-variant/35 bg-card/95 p-6 shadow-[0_40px_80px_-24px_var(--shadow-ambient)]">
        <ConfettiLayer active={success} />

        <div className="relative z-10">
          {!success ? (
            <>
              <p
                id="export-flow-title"
                className="text-headline-md text-balance text-foreground"
              >
                Ensamblando documento en tu equipo…
              </p>
              <p
                id="export-flow-desc"
                className="mt-2 text-sm leading-relaxed text-muted-foreground"
              >
                Estamos uniendo los PDF en memoria. No sale nada de tu
                navegador hasta que termine.
              </p>
              <div
                className="mt-6 h-2.5 w-full overflow-hidden rounded-full bg-surface-container-highest"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-primary-hover transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 font-mono text-xs text-tertiary">
                {Math.round(progress)}% · solo en tu dispositivo
              </p>
            </>
          ) : (
            <>
              <p
                id="export-flow-title"
                className="text-headline-md text-balance text-foreground"
              >
                Listo. Descarga iniciada
              </p>
              <p
                id="export-flow-desc"
                className="mt-2 text-sm leading-relaxed text-muted-foreground"
              >
                Si el navegador no guardó el archivo, revisa la carpeta de
                descargas o vuelve a exportar desde el lienzo.
              </p>
              <button
                type="button"
                className="mt-8 flex w-full min-h-14 items-center justify-center rounded-lg bg-gradient-to-b from-primary to-[#c97d62] px-6 text-base font-semibold text-primary-foreground shadow-[0_24px_48px_-16px_rgb(17_19_22/0.5)] transition hover:from-primary-hover hover:to-[#dba48e] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => resetWorkspace()}
              >
                Volver a empezar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
