"use client";

import { useCallback, useEffect } from "react";

import { MAX_FILE_BYTES } from "@ceropdf/pdf-core/constants";
import { Dropzone } from "@ceropdf/ui";

import { useDocumentStore } from "@/stores/document-store";
import { useSelectionStore } from "@/stores/selection-store";
import type { Capabilities, UsePageGridStore } from "@/lib/page-grid/use-page-grid";

import { ErrorBanner } from "../error-banner";
import { LandingFooterCopy } from "../landing-footer-copy";
import { LandingHeader } from "../landing-header";
import { PageGrid } from "./page-grid";

type Props = {
  store: UsePageGridStore;
  capabilities: Capabilities;
  title: string;
  description: string;
  exportLabel: string;
  controls?: React.ReactNode;
};

export function SingleDocGridWorkspace({
  store: useStore,
  capabilities,
  title,
  description,
  exportLabel,
  controls,
}: Props) {
  const documents = useDocumentStore((s) => s.documents);
  const uiPhase = useDocumentStore((s) => s.uiPhase);
  const addDocumentsFromFiles = useStore((s) => s.addDocumentsFromFiles);
  const resetWorkspace = useStore((s) => s.resetWorkspace);
  const exportPdf = useStore((s) => s.exportPdf);

  const firstDocId = useStore((s) => s.pageEntries[0]?.documentId);
  const doc = firstDocId ? documents.find((d) => d.id === firstDocId) : undefined;

  useEffect(() => {
    useSelectionStore.getState().clear();
  }, []);
  const busy =
    uiPhase === "loading" || uiPhase === "parsing" || uiPhase === "processing";
  const maxMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));

  const onFiles = useCallback(
    (files: FileList) => {
      void addDocumentsFromFiles(files);
    },
    [addDocumentsFromFiles],
  );

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-ambient-glow"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <LandingHeader />
        <ErrorBanner />

        {doc ? (
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-headline-md text-balance text-foreground">{title}</h1>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{doc.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => resetWorkspace()}
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-4 text-sm text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    Cambiar PDF
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void exportPdf()}
                    className="inline-flex min-h-10 min-w-[120px] items-center justify-center rounded-md bg-gradient-to-b from-primary to-primary-gradient px-5 text-sm font-semibold text-primary-foreground transition hover:from-primary-hover hover:to-primary-gradient-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busy ? "Procesando…" : exportLabel}
                  </button>
                </div>
              </div>

              {controls ? <div className="mt-4">{controls}</div> : null}

              {uiPhase === "export_success" ? (
                <p className="mt-3 font-mono text-xs text-trust">Listo · descarga iniciada</p>
              ) : null}

              <div className="mt-6 pb-16">
                <PageGrid documentId={doc.id} store={useStore} capabilities={capabilities} />
              </div>
            </div>
          </main>
        ) : (
          <main className="flex min-h-0 flex-1 flex-col">
            <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
              <h1 className="text-display-lg text-balance text-foreground">{title}</h1>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                {description}
              </p>
            </section>
            <section className="mx-auto mt-6 w-full max-w-3xl flex-1 px-4 sm:px-6">
              <Dropzone
                variant="compact"
                onFiles={onFiles}
                multiple={false}
                eyebrow={busy ? "Leyendo…" : "Sube un PDF"}
                title={busy ? "Procesando el PDF…" : "Suelta el PDF o haz clic"}
                hint={`Un solo PDF, hasta ${maxMb} MB. Nada sale del navegador.`}
              />
            </section>
            <LandingFooterCopy />
          </main>
        )}
      </div>
    </div>
  );
}
