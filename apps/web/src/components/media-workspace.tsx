"use client";

import { useCallback, useMemo, useState } from "react";

import { MAX_FILE_BYTES } from "@ceropdf/pdf-core";
import { Dropzone } from "@ceropdf/ui";

import { formatBytes } from "@/lib/format-bytes";
import { convertMedia } from "@/lib/ffmpeg/convert";
import {
  findFormat,
  formatsForKind,
  inputKindFromFile,
  type InputKind,
  type MediaFormat,
} from "@/lib/ffmpeg/formats";

import { LandingFooterCopy } from "./landing-footer-copy";
import { LandingHeader } from "./landing-header";

/** Soft threshold above which client-side video transcode may be slow or OOM. */
const VIDEO_WARN_BYTES = 150 * 1024 * 1024;

type Selected = { file: File; kind: InputKind };

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "converting"; progress: number }
  | { kind: "done"; inBytes: number; outBytes: number; outName: string };

const DEFAULT_TARGET: Record<InputKind, string> = {
  audio: "mp3",
  video: "mp4",
};

export function MediaWorkspace() {
  const [selected, setSelected] = useState<Selected | null>(null);
  const [targetKey, setTargetKey] = useState<string>("mp3");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  const onFiles = useCallback((files: FileList) => {
    const file = files.item(0);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError(
        `Archivo muy pesado. Límite ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB.`,
      );
      return;
    }
    const kind = inputKindFromFile(file);
    if (!kind) {
      setError("Formato no reconocido. Sube un archivo de audio o video.");
      return;
    }
    setError(null);
    setStatus({ kind: "idle" });
    setSelected({ file, kind });
    setTargetKey(DEFAULT_TARGET[kind]);
  }, []);

  const formats = useMemo<MediaFormat[]>(
    () => (selected ? formatsForKind(selected.kind) : []),
    [selected],
  );

  const onConvert = useCallback(async () => {
    if (!selected) return;
    const format = findFormat(targetKey);
    if (!format) return;
    setError(null);
    setStatus({ kind: "loading" });
    try {
      const blob = await convertMedia(selected.file, format, (ratio) =>
        setStatus({ kind: "converting", progress: ratio }),
      );
      const base = selected.file.name.replace(/\.[^./\\]+$/, "");
      const outName = `${base}.${format.ext}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = outName;
      a.click();
      URL.revokeObjectURL(url);
      setStatus({
        kind: "done",
        inBytes: selected.file.size,
        outBytes: blob.size,
        outName,
      });
    } catch (err) {
      console.error(err);
      setError(
        "No se pudo convertir el archivo. Puede que el formato de entrada no sea válido o el archivo sea demasiado grande para el navegador.",
      );
      setStatus({ kind: "idle" });
    }
  }, [selected, targetKey]);

  const busy = status.kind === "loading" || status.kind === "converting";
  const showVideoWarning =
    selected?.kind === "video" && selected.file.size > VIDEO_WARN_BYTES;

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
              Convertir audio y video
            </h1>
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              Convierte entre MP3, WAV, OGG, M4A, FLAC, Opus, MP4, WebM y más.
              Todo ocurre{" "}
              <strong className="text-foreground">100 % en tu navegador</strong>{" "}
              con ffmpeg.wasm: tu archivo nunca se sube a ningún servidor.
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

          {!selected ? (
            <section className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
              <Dropzone
                variant="compact"
                onFiles={onFiles}
                accept="audio/*,video/*"
                multiple={false}
                eyebrow="Sube audio o video"
                title="Suelta el archivo o haz clic"
                hint={`Hasta ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB · todo se procesa en tu equipo`}
              />
            </section>
          ) : (
            <section className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
              <div className="rounded-xl border border-outline-variant/30 bg-surface-container/70 p-4 sm:p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="truncate text-sm text-foreground">
                    {selected.file.name}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {selected.kind === "video" ? "VIDEO" : "AUDIO"} ·{" "}
                    {formatBytes(selected.file.size)}
                  </p>
                </div>
                {!busy ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      setStatus({ kind: "idle" });
                    }}
                    className="mt-2 font-mono text-xs text-primary transition hover:translate-x-0.5"
                  >
                    Elegir otro archivo
                  </button>
                ) : null}
              </div>

              <fieldset className="mt-5 rounded-xl border border-outline-variant/30 bg-surface-container/70 p-4 sm:p-5">
                <legend className="px-2 text-label-md font-mono text-tertiary">
                  Convertir a
                </legend>
                <FormatGroup
                  formats={formats}
                  kind={selected.kind}
                  value={targetKey}
                  disabled={busy}
                  onChange={setTargetKey}
                />
              </fieldset>

              {showVideoWarning ? (
                <p className="mt-3 font-mono text-xs leading-relaxed text-warning">
                  Archivo de video grande: convertir en el navegador puede ser
                  lento o agotar la memoria. Para clips largos considera una
                  herramienta de escritorio.
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onConvert}
                  disabled={busy}
                  className="inline-flex min-h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status.kind === "loading"
                    ? "Cargando motor…"
                    : status.kind === "converting"
                      ? "Convirtiendo…"
                      : "Convertir"}
                </button>

                {status.kind === "converting" ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    {Math.round(status.progress * 100)}%
                  </span>
                ) : null}
              </div>

              {status.kind === "converting" ? (
                <div
                  className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest"
                  role="progressbar"
                  aria-valuenow={Math.round(status.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{ width: `${Math.round(status.progress * 100)}%` }}
                  />
                </div>
              ) : null}

              {status.kind === "done" ? (
                <p className="mt-4 font-mono text-xs leading-relaxed text-trust">
                  ¡Listo! {status.outName} · {formatBytes(status.inBytes)} →{" "}
                  {formatBytes(status.outBytes)}. La descarga empezó
                  automáticamente.
                </p>
              ) : null}
            </section>
          )}
        </main>

        <LandingFooterCopy />
      </div>
    </div>
  );
}

function FormatGroup({
  formats,
  kind,
  value,
  disabled,
  onChange,
}: {
  formats: MediaFormat[];
  kind: InputKind;
  value: string;
  disabled: boolean;
  onChange: (key: string) => void;
}) {
  if (kind === "audio") {
    return (
      <RadioGrid
        formats={formats}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  const video = formats.filter((f) => f.category === "video");
  const audio = formats.filter((f) => f.category === "audio");
  return (
    <div className="space-y-4">
      <div>
        <p className="px-2 pb-2 font-mono text-label-sm text-muted-foreground">
          Video
        </p>
        <RadioGrid
          formats={video}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
      <div>
        <p className="px-2 pb-2 font-mono text-label-sm text-muted-foreground">
          Extraer audio
        </p>
        <RadioGrid
          formats={audio}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function RadioGrid({
  formats,
  value,
  disabled,
  onChange,
}: {
  formats: MediaFormat[];
  value: string;
  disabled: boolean;
  onChange: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {formats.map((f) => (
        <label
          key={f.key}
          className={`flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition ${
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          } ${
            value === f.key
              ? "border-primary/55 bg-primary-muted/30 text-foreground"
              : "border-outline-variant/35 bg-surface-container-low/80 text-muted-foreground hover:border-primary/35"
          }`}
        >
          <input
            type="radio"
            name="target-format"
            value={f.key}
            checked={value === f.key}
            disabled={disabled}
            onChange={() => onChange(f.key)}
            className="sr-only"
          />
          <span className="font-mono text-xs uppercase tracking-[0.1em]">
            {f.ext}
          </span>
          <span className="text-sm">{f.label}</span>
        </label>
      ))}
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
