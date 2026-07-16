"use client";

import { useCallback, useState } from "react";

import { Dropzone } from "@ceropdf/ui";
import { MAX_FILE_BYTES } from "@ceropdf/pdf-core/constants";

import { LandingFooterCopy } from "./landing-footer-copy";
import { LandingHeader } from "./landing-header";
import { ServerConsentBanner } from "./server-consent-banner";

const ACCEPT =
  ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,.csv," +
  "application/msword," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.ms-excel," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet," +
  "application/vnd.ms-powerpoint," +
  "application/vnd.openxmlformats-officedocument.presentationml.presentation," +
  "application/vnd.oasis.opendocument.text," +
  "application/vnd.oasis.opendocument.spreadsheet," +
  "application/vnd.oasis.opendocument.presentation";

const VALID_EXTS = new Set([
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "rtf",
  "txt",
  "csv",
]);

type Status =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "processing" }
  | { kind: "success"; outName: string };

function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : "";
}

export function OfficeWorkspace() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const onFiles = useCallback(async (files: FileList) => {
    const file = files.item(0);
    if (!file) return;

    const ext = extensionOf(file.name);
    if (!VALID_EXTS.has(ext)) {
      setError("Formato no soportado. Usa Word, Excel, PowerPoint u OpenDocument.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(
        `Archivo muy pesado. Límite ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB.`,
      );
      return;
    }

    setError(null);
    setStatus({ kind: "uploading" });

    try {
      const bytes = await file.arrayBuffer();
      setStatus({ kind: "processing" });
      const resp = await fetch(
        `/api/heavy/office-to-pdf?ext=${encodeURIComponent(ext)}`,
        {
          method: "POST",
          body: bytes,
          headers: { "Content-Type": "application/octet-stream" },
        },
      );

      if (!resp.ok) {
        const payload = await resp.json().catch(() => ({}));
        throw new Error(
          payload?.error === "office_disabled"
            ? "El servidor de conversión no está disponible en esta instalación."
            : payload?.error === "payload_too_large"
              ? "Archivo demasiado grande para el servidor."
              : "No se pudo convertir el documento.",
        );
      }

      const blob = await resp.blob();
      const base = file.name.replace(/\.[^./\\]+$/, "");
      const outName = `${base}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({ kind: "success", outName });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error al convertir.");
      setStatus({ kind: "idle" });
    }
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-ambient-glow"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <LandingHeader />

        <ServerConsentBanner toolKey="officeToPdf" toolLabel="Convertir Office a PDF">
          <main className="flex min-h-0 flex-1 flex-col">
            <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
              <h1 className="text-display-lg text-balance text-foreground">
                Convertir Office a PDF
              </h1>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                Convierte documentos de Word, Excel, PowerPoint y OpenDocument
                (.docx, .xlsx, .pptx, .odt y más) a PDF con LibreOffice. El
                archivo se sube a un contenedor interno, se convierte y se borra
                de inmediato.
              </p>
            </section>

            {error ? (
              <div className="mx-auto mt-6 w-full max-w-3xl px-4 sm:px-6">
                <ErrorBannerInline
                  message={error}
                  onDismiss={() => setError(null)}
                />
              </div>
            ) : null}

            <section className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
              <Dropzone
                variant="compact"
                onFiles={onFiles}
                accept={ACCEPT}
                multiple={false}
                eyebrow={status.kind === "idle" ? "Sube un documento" : "Procesando…"}
                title={
                  status.kind === "idle"
                    ? "Suelta el documento o haz clic"
                    : status.kind === "uploading"
                      ? "Subiendo al servidor temporal…"
                      : status.kind === "processing"
                        ? "Convirtiendo con LibreOffice…"
                        : "¡Listo! Tu PDF se descargó"
                }
                hint={
                  status.kind === "success"
                    ? `Generado: ${status.outName}`
                    : "Word, Excel, PowerPoint, OpenDocument. El archivo se procesa y se borra; no queda traza en logs."
                }
              />
            </section>
          </main>
        </ServerConsentBanner>

        <LandingFooterCopy />
      </div>
    </div>
  );
}

function ErrorBannerInline({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      className="rounded-md border border-destructive/30 bg-destructive-muted px-4 py-3"
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-destructive">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-sm border border-destructive/35 px-2 py-1 font-mono text-xs text-destructive transition hover:bg-destructive/15"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
