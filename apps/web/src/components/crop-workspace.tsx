"use client";

import { useEffect, useState } from "react";

import { MAX_FILE_BYTES } from "@ceropdf/pdf-core/constants";
import { Dropzone } from "@ceropdf/ui";

import { useDocumentStore } from "@/stores/document-store";
import { useSelectionStore } from "@/stores/selection-store";
import { cropToDisplay, displayToCrop, type DisplayRect } from "@/lib/page-grid/crop-coords";
import { useCropStore } from "@/stores/crop-store";

import { CropCanvas } from "./crop-canvas";
import { ErrorBanner } from "./error-banner";
import { LandingFooterCopy } from "./landing-footer-copy";
import { LandingHeader } from "./landing-header";

const btn =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-3 text-sm text-foreground transition hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45";

export function CropWorkspace() {
  const documents = useDocumentStore((s) => s.documents);
  const uiPhase = useDocumentStore((s) => s.uiPhase);
  const pageEntries = useCropStore((s) => s.pageEntries);
  const addDocumentsFromFiles = useCropStore((s) => s.addDocumentsFromFiles);
  const resetWorkspace = useCropStore((s) => s.resetWorkspace);
  const exportPdf = useCropStore((s) => s.exportPdf);
  const setCropAll = useCropStore((s) => s.setCropAll);
  const setPageCrop = useCropStore((s) => s.setPageCrop);

  const [pageIndex, setPageIndex] = useState(0);
  const [scope, setScope] = useState<"all" | "page">("all");

  useEffect(() => {
    useSelectionStore.getState().clear();
  }, []);

  const firstDocId = pageEntries[0]?.documentId;
  const doc = firstDocId ? documents.find((d) => d.id === firstDocId) : undefined;

  useEffect(() => {
    setPageIndex(0);
  }, [firstDocId]);

  const busy = uiPhase === "loading" || uiPhase === "parsing" || uiPhase === "processing";
  const maxMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));

  if (!doc) {
    return (
      <Frame>
        <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
          <h1 className="text-display-lg text-balance text-foreground">Recortar PDF</h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Dibuja un área de recorte y aplícala a todas las páginas o a páginas concretas. 100 % en tu navegador.
          </p>
        </section>
        <section className="mx-auto mt-6 w-full max-w-3xl flex-1 px-4 sm:px-6">
          <Dropzone
            variant="compact"
            onFiles={(files) => void addDocumentsFromFiles(files)}
            multiple={false}
            eyebrow={busy ? "Leyendo…" : "Sube un PDF"}
            title={busy ? "Procesando el PDF…" : "Suelta el PDF o haz clic"}
            hint={`Un solo PDF, hasta ${maxMb} MB. Nada sale del navegador.`}
          />
        </section>
        <LandingFooterCopy />
      </Frame>
    );
  }

  const entry = pageEntries[pageIndex];
  const cropRect = entry?.crop ? cropToDisplay(entry.crop) : null;

  const onCropChange = (r: DisplayRect) => {
    const crop = displayToCrop(r);
    if (scope === "all") setCropAll(crop);
    else if (entry) setPageCrop(entry.id, crop);
  };

  const total = pageEntries.length;

  return (
    <Frame>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-16 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-headline-md text-balance text-foreground">Recortar PDF</h1>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{doc.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className={btn} onClick={() => resetWorkspace()}>
                Cambiar PDF
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void exportPdf()}
                className="inline-flex min-h-10 min-w-[120px] items-center justify-center rounded-md bg-gradient-to-b from-primary to-primary-gradient px-5 text-sm font-semibold text-primary-foreground transition hover:from-primary-hover hover:to-primary-gradient-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? "Procesando…" : "Exportar"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-tertiary">Aplicar a:</span>
            <div className="inline-flex overflow-hidden rounded-md border border-outline-variant/45">
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`px-3 py-1.5 text-sm transition ${scope === "all" ? "bg-primary-muted text-foreground" : "bg-surface-container-low text-muted-foreground hover:text-foreground"}`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setScope("page")}
                className={`px-3 py-1.5 text-sm transition ${scope === "page" ? "bg-primary-muted text-foreground" : "bg-surface-container-low text-muted-foreground hover:text-foreground"}`}
              >
                Solo esta página
              </button>
            </div>
            <button
              type="button"
              className={btn}
              onClick={() => (scope === "all" ? setCropAll(null) : entry && setPageCrop(entry.id, null))}
            >
              {`Quitar recorte ${scope === "all" ? "(todas)" : "(esta página)"}`}
            </button>
          </div>

          <div className="mt-6">
            <CropCanvas documentId={doc.id} pageIndex={pageIndex} cropRect={cropRect} onChange={onCropChange} />
          </div>

          <div className="mt-4 flex items-center justify-center gap-4">
            <button type="button" className={btn} disabled={pageIndex === 0} onClick={() => setPageIndex((i) => Math.max(0, i - 1))}>
              ‹ Anterior
            </button>
            <span className="font-mono text-xs text-muted-foreground">
              Página {pageIndex + 1} de {total}
            </span>
            <button type="button" className={btn} disabled={pageIndex >= total - 1} onClick={() => setPageIndex((i) => Math.min(total - 1, i + 1))}>
              Siguiente ›
            </button>
          </div>

          {uiPhase === "export_success" ? (
            <p className="mt-3 text-center font-mono text-xs text-trust">Listo · descarga iniciada</p>
          ) : null}
        </div>
      </main>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-ambient-glow"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <LandingHeader />
        <ErrorBanner />
        {children}
      </div>
    </div>
  );
}
