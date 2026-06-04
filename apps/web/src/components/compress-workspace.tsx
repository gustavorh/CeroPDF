"use client";

import { useCallback, useState } from "react";

import { Dropzone } from "@ceropdf/ui";
import { MAX_FILE_BYTES } from "@ceropdf/pdf-core";

import { formatBytes } from "@/lib/format-bytes";

import { LandingFooterCopy } from "./landing-footer-copy";
import { LandingHeader } from "./landing-header";
import { ServerConsentBanner } from "./server-consent-banner";

type Quality = "screen" | "ebook" | "printer" | "prepress";

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; total: number }
  | { kind: "processing" }
  | { kind: "success"; inBytes: number; outBytes: number };

const QUALITY_LABEL: Record<Quality, string> = {
  screen: "Máxima (peor calidad)",
  ebook: "Recomendada (medio)",
  printer: "Alta calidad",
  prepress: "Calidad pre-prensa",
};

export function CompressWorkspace() {
  const [quality, setQuality] = useState<Quality>("ebook");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const onFiles = useCallback(
    async (files: FileList) => {
      const file = files.item(0);
      if (!file) return;
      if (file.size > MAX_FILE_BYTES) {
        setError(
          `Archivo muy pesado. Límite ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB.`,
        );
        return;
      }
      setError(null);
      setStatus({ kind: "uploading", total: file.size });

      try {
        const bytes = await file.arrayBuffer();
        setStatus({ kind: "processing" });
        const resp = await fetch(
          `/api/heavy/compress?quality=${encodeURIComponent(quality)}`,
          {
            method: "POST",
            body: bytes,
            headers: { "Content-Type": "application/pdf" },
          },
        );

        if (!resp.ok) {
          const payload = await resp.json().catch(() => ({}));
          throw new Error(
            payload?.error === "compress_disabled"
              ? "El servidor de compresión no está disponible en esta instalación."
              : payload?.error === "payload_too_large"
                ? "Archivo demasiado grande para el servidor."
                : "No se pudo comprimir el PDF.",
          );
        }

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const base = file.name.replace(/\.pdf$/i, "");
        a.download = `${base}.compressed.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        setStatus({
          kind: "success",
          inBytes: file.size,
          outBytes: blob.size,
        });
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Error al comprimir.");
        setStatus({ kind: "idle" });
      }
    },
    [quality],
  );

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgb(240_168_140/0.07),transparent_55%),radial-gradient(ellipse_70%_40%_at_100%_0%,rgb(52_211_153/0.05),transparent_45%)]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <LandingHeader />

        <ServerConsentBanner toolKey="compress" toolLabel="Comprimir PDF">
          <main className="flex min-h-0 flex-1 flex-col">
            <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
              <h1 className="text-display-lg text-balance text-foreground">
                Comprimir PDF
              </h1>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                Compresión real con Ghostscript: reduce el peso aplastando
                imágenes incrustadas según el preset que elijas. Ideal para
                enviar PDFs por correo o subirlos a sistemas con límites de
                tamaño.
              </p>

              <fieldset className="mt-6 rounded-xl border border-outline-variant/30 bg-surface-container/70 p-4 sm:p-5">
                <legend className="px-2 text-label-md font-mono text-tertiary">
                  Calidad / nivel de compresión
                </legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(Object.keys(QUALITY_LABEL) as Quality[]).map((q) => (
                    <label
                      key={q}
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition ${
                        quality === q
                          ? "border-primary/55 bg-primary-muted/30 text-foreground"
                          : "border-outline-variant/35 bg-surface-container-low/80 text-muted-foreground hover:border-primary/35"
                      }`}
                    >
                      <input
                        type="radio"
                        name="quality"
                        value={q}
                        checked={quality === q}
                        onChange={() => setQuality(q)}
                        className="sr-only"
                      />
                      <span className="font-mono text-xs uppercase tracking-[0.1em]">
                        {q}
                      </span>
                      <span className="text-sm">{QUALITY_LABEL[q]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>

            {error ? (
              <div className="mx-auto mt-6 w-full max-w-3xl px-4 sm:px-6">
                <ErrorBannerInline message={error} onDismiss={() => setError(null)} />
              </div>
            ) : null}

            <section className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
              <Dropzone
                variant="compact"
                onFiles={onFiles}
                multiple={false}
                eyebrow={status.kind === "idle" ? "Sube un PDF" : "Procesando…"}
                title={
                  status.kind === "idle"
                    ? "Suelta el PDF o haz clic"
                    : status.kind === "uploading"
                      ? "Subiendo al servidor temporal…"
                      : status.kind === "processing"
                        ? "Aplastando imágenes con Ghostscript…"
                        : "¡Listo! Tu PDF se descargó"
                }
                hint={
                  status.kind === "success"
                    ? `Antes: ${formatBytes(status.inBytes)} · Ahora: ${formatBytes(status.outBytes)} (${Math.max(
                        0,
                        Math.round(
                          (1 - status.outBytes / status.inBytes) * 100,
                        ),
                      )}% menos)`
                    : "El PDF se sube cifrado, se procesa y se borra. Nunca queda en disco más de lo necesario."
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
