"use client";

import { useCallback, useMemo, useState } from "react";

import { MAX_FILE_BYTES } from "@ceropdf/pdf-core";
import { Dropzone } from "@ceropdf/ui";

import { formatBytes } from "@/lib/format-bytes";

import { LandingFooterCopy } from "./landing-footer-copy";
import { LandingHeader } from "./landing-header";

type Mode = "ranges" | "perPage";

type LoadedPdf = {
  name: string;
  size: number;
  bytes: ArrayBuffer;
  pageCount: number;
};

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "splitting" }
  | { kind: "success"; outCount: number };

export function SplitWorkspace() {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [mode, setMode] = useState<Mode>("ranges");
  const [ranges, setRanges] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const placeholderRange = useMemo(() => {
    if (!pdf) return "1-3, 5, 7-10";
    if (pdf.pageCount === 1) return "1";
    if (pdf.pageCount <= 5) return `1-${pdf.pageCount}`;
    return `1-${Math.ceil(pdf.pageCount / 2)}, ${Math.ceil(pdf.pageCount / 2) + 1}-${pdf.pageCount}`;
  }, [pdf]);

  const onFiles = useCallback(async (files: FileList) => {
    const file = files.item(0);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(
        `Archivo muy pesado. Límite ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB.`,
      );
      return;
    }
    setError(null);
    setStatus({ kind: "loading" });
    try {
      const bytes = await file.arrayBuffer();
      const { PDFDocument } = await import("pdf-lib");
      const parsed = await PDFDocument.load(bytes, { updateMetadata: false });
      setPdf({
        name: file.name,
        size: file.size,
        bytes,
        pageCount: parsed.getPageCount(),
      });
      setStatus({ kind: "idle" });
      setRanges("");
    } catch {
      setError(
        "No se pudo leer el PDF. Puede estar corrupto o protegido por contraseña.",
      );
      setStatus({ kind: "idle" });
    }
  }, []);

  const runSplit = useCallback(async () => {
    if (!pdf) return;
    setError(null);
    setStatus({ kind: "splitting" });

    try {
      const {
        parseRanges,
        splitPdfByPage,
        splitPdfByRanges,
      } = await import("@ceropdf/pdf-core");

      const chunks =
        mode === "perPage"
          ? await splitPdfByPage(pdf.bytes)
          : await splitPdfByRanges(pdf.bytes, parseRanges(ranges, pdf.pageCount));

      const baseName = pdf.name.replace(/\.pdf$/i, "");

      if (chunks.length === 1) {
        const blob = new Blob([new Uint8Array(chunks[0].bytes)], {
          type: "application/pdf",
        });
        triggerDownload(blob, `${baseName}-${chunks[0].label}.pdf`);
      } else {
        const { zipSync } = await import("fflate");
        const archive: Record<string, Uint8Array> = {};
        for (const c of chunks) {
          archive[`${baseName}-${c.label}.pdf`] = c.bytes;
        }
        const zipped = zipSync(archive, { level: 6 });
        const blob = new Blob([new Uint8Array(zipped)], {
          type: "application/zip",
        });
        triggerDownload(blob, `${baseName}-split.zip`);
      }

      setStatus({ kind: "success", outCount: chunks.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo dividir el PDF.");
      setStatus({ kind: "idle" });
    }
  }, [pdf, mode, ranges]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgb(240_168_140/0.07),transparent_55%),radial-gradient(ellipse_70%_40%_at_100%_0%,rgb(52_211_153/0.05),transparent_45%)]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <LandingHeader />

        <main className="flex min-h-0 flex-1 flex-col">
          <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
            <h1 className="text-display-lg text-balance text-foreground">
              Dividir PDF
            </h1>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              Separa un PDF por rangos de páginas, o genera un archivo por
              cada página. Todo en tu navegador; nada se sube.
            </p>
          </section>

          {error ? (
            <div className="mx-auto mt-6 w-full max-w-3xl px-4 sm:px-6">
              <div
                className="rounded-md border border-destructive/30 bg-destructive-muted px-4 py-3"
                role="alert"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-destructive">{error}</p>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="shrink-0 rounded-sm border border-destructive/35 px-2 py-1 font-mono text-xs text-destructive transition hover:bg-destructive/15"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {!pdf ? (
            <section className="mx-auto mt-6 w-full max-w-3xl flex-1 px-4 sm:px-6">
              <Dropzone
                variant="compact"
                onFiles={onFiles}
                multiple={false}
                eyebrow={status.kind === "loading" ? "Leyendo…" : "Sube un PDF"}
                title={
                  status.kind === "loading"
                    ? "Procesando el PDF…"
                    : "Suelta el PDF o haz clic"
                }
                hint="Un solo PDF. Después podrás elegir rangos o una página por archivo."
              />
            </section>
          ) : (
            <section className="mx-auto mt-6 w-full max-w-3xl flex-1 px-4 sm:px-6">
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container/70 p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-label-md font-mono tracking-[0.08em] text-primary">
                      Documento cargado
                    </p>
                    <p className="mt-1 truncate text-base font-medium text-foreground">
                      {pdf.name}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {pdf.pageCount} páginas · {formatBytes(pdf.size)}
                  </p>
                </div>

                <fieldset className="mt-5">
                  <legend className="text-label-md font-mono text-tertiary">
                    Modo
                  </legend>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition ${
                        mode === "ranges"
                          ? "border-primary/55 bg-primary-muted/30 text-foreground"
                          : "border-outline-variant/35 bg-surface-container-low/80 text-muted-foreground hover:border-primary/35"
                      }`}
                    >
                      <input
                        type="radio"
                        name="mode"
                        value="ranges"
                        checked={mode === "ranges"}
                        onChange={() => setMode("ranges")}
                        className="sr-only"
                      />
                      <span className="font-mono text-xs uppercase tracking-[0.1em]">
                        Rangos
                      </span>
                      <span>Un PDF por rango</span>
                    </label>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition ${
                        mode === "perPage"
                          ? "border-primary/55 bg-primary-muted/30 text-foreground"
                          : "border-outline-variant/35 bg-surface-container-low/80 text-muted-foreground hover:border-primary/35"
                      }`}
                    >
                      <input
                        type="radio"
                        name="mode"
                        value="perPage"
                        checked={mode === "perPage"}
                        onChange={() => setMode("perPage")}
                        className="sr-only"
                      />
                      <span className="font-mono text-xs uppercase tracking-[0.1em]">
                        1 × hoja
                      </span>
                      <span>Una página por archivo</span>
                    </label>
                  </div>
                </fieldset>

                {mode === "ranges" ? (
                  <div className="mt-5">
                    <label className="text-label-md font-mono text-tertiary" htmlFor="ranges">
                      Rangos
                    </label>
                    <input
                      id="ranges"
                      type="text"
                      value={ranges}
                      onChange={(e) => setRanges(e.target.value)}
                      placeholder={placeholderRange}
                      className="mt-2 w-full rounded-md border border-outline-variant/40 bg-surface-container-low/90 px-3 py-2 font-mono text-sm text-foreground placeholder:text-tertiary focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                      Ej: <code>1-3, 5, 7-10</code>. Cada rango produce un PDF.
                    </p>
                  </div>
                ) : (
                  <p className="mt-5 text-sm text-muted-foreground">
                    Se generarán {pdf.pageCount} archivos PDF empaquetados en
                    un ZIP.
                  </p>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={runSplit}
                    disabled={status.kind === "splitting"}
                    className="inline-flex min-h-10 items-center justify-center rounded-md bg-gradient-to-b from-primary to-[#c97d62] px-5 text-sm font-semibold text-primary-foreground transition hover:from-primary-hover hover:to-[#dba48e] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {status.kind === "splitting" ? "Procesando…" : "Dividir"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPdf(null);
                      setRanges("");
                      setStatus({ kind: "idle" });
                    }}
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-4 text-sm text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    Cambiar PDF
                  </button>
                  {status.kind === "success" ? (
                    <span className="font-mono text-xs text-trust">
                      Listo · {status.outCount} archivo
                      {status.outCount === 1 ? "" : "s"} generado
                      {status.outCount === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
              </div>
            </section>
          )}
        </main>

        <LandingFooterCopy />
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
