"use client";

import { useCallback } from "react";

import { MAX_FILE_BYTES } from "@ceropdf/pdf-core";
import { Dropzone } from "@ceropdf/ui";

import { useDocumentStore } from "@/stores/document-store";
import { useEditStore } from "@/stores/edit-store";

import { EditCanvas } from "./edit-canvas";
import { EditPageNav } from "./edit-page-nav";
import { EditToolbar } from "./edit-toolbar";
import { ErrorBanner } from "./error-banner";
import { ExportFlowModal } from "./export-flow-modal";
import { LandingFooterCopy } from "./landing-footer-copy";
import { LandingHeader } from "./landing-header";

export function EditWorkspace() {
  const activeDocumentId = useEditStore((s) => s.activeDocumentId);
  const loadDocument = useEditStore((s) => s.loadDocument);
  const uiPhase = useDocumentStore((s) => s.uiPhase);

  const onFiles = useCallback(
    (files: FileList) => {
      void loadDocument(files);
    },
    [loadDocument],
  );

  const hasDoc = Boolean(activeDocumentId);
  const maxMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
  const busy = uiPhase === "loading" || uiPhase === "parsing";

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgb(240_168_140/0.07),transparent_55%),radial-gradient(ellipse_70%_40%_at_100%_0%,rgb(52_211_153/0.05),transparent_45%)]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col">
        {hasDoc ? (
          <>
            <EditToolbar />
            <ErrorBanner />
            <main className="min-h-0 flex-1 overflow-y-auto py-6">
              <EditPageNav />
              <EditCanvas />
              <p className="mt-6 px-4 text-center font-mono text-xs text-tertiary">
                Click en el lienzo con una herramienta activa para crear ·
                arrastra para mover · esquina inferior derecha para redimensionar ·
                Delete para borrar.
              </p>
            </main>
            <ExportFlowModal />
          </>
        ) : (
          <>
            <LandingHeader />
            <ErrorBanner />
            <main className="flex min-h-0 flex-1 flex-col">
              <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
                <h1 className="text-display-lg text-balance text-foreground">
                  Editar PDF
                </h1>
                <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Añade texto, rectángulos y resaltados encima de tu PDF. Al
                  exportar, las anotaciones quedan grabadas en el documento.
                  Todo en tu navegador.
                </p>
              </section>
              <section className="mx-auto mt-6 w-full max-w-3xl flex-1 px-4 sm:px-6">
                <Dropzone
                  variant="compact"
                  onFiles={onFiles}
                  multiple={false}
                  eyebrow={busy ? "Leyendo…" : "Sube un PDF"}
                  title={
                    busy
                      ? "Procesando el PDF…"
                      : "Suelta el PDF o haz clic"
                  }
                  hint={`Un solo PDF, hasta ${maxMb} MB. Nada sale del navegador.`}
                />
              </section>
            </main>
            <LandingFooterCopy />
          </>
        )}
      </div>
    </div>
  );
}
