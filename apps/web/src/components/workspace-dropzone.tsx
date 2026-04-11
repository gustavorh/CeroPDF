"use client";

import { useCallback, useState } from "react";

import { MAX_COMBINED_PAGES, MAX_FILE_BYTES } from "@/lib/constants";
import { useWorkspaceStore } from "@/stores/workspace-store";

type WorkspaceDropzoneProps = {
  variant: "hero" | "compact";
};

/**
 * Entrada principal: hero masivo (Hook) o compacto en lienzo (añadir más).
 * Al arrastrar sobre la zona, el propio label se ilumina (y en hero, overlay fijo refuerza el “suelta aquí”).
 */
export function WorkspaceDropzone({ variant }: WorkspaceDropzoneProps) {
  const addDocumentsFromFiles = useWorkspaceStore(
    (s) => s.addDocumentsFromFiles,
  );

  const [isDragging, setIsDragging] = useState(false);

  const onFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      void addDocumentsFromFiles(fileList);
    },
    [addDocumentsFromFiles],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    onFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const isHero = variant === "hero";
  const maxMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
  const glowActive = isDragging && isHero;

  return (
    <div
      className={`relative flex min-h-0 flex-1 flex-col ${isHero ? "min-h-[min(90dvh,760px)]" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {glowActive ? (
        <div
          className="pointer-events-none fixed inset-0 z-40 bg-primary-muted/50 backdrop-brightness-110 transition-[background-color] duration-150"
          aria-hidden
        />
      ) : null}

      <label
        className={`relative z-10 flex w-full flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 text-center transition-colors ${
          isHero ? "min-h-[min(86dvh,720px)] py-6 sm:px-8" : "py-8"
        } ${
          isDragging
            ? "border-primary/85 bg-primary-muted/45 shadow-[0_0_0_1px_rgb(240_168_140/0.4)]"
            : "border-outline-variant/45 bg-surface-container/80 hover:border-primary/35 hover:bg-surface-container-low/90"
        }`}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
        />
        <span className="text-label-md font-mono text-tertiary">
          {isHero ? "100 % en tu dispositivo" : "Añadir archivos"}
        </span>
        <span className="text-display-lg mt-4 max-w-xl text-balance text-foreground">
          {isHero
            ? "Arrastra tus PDFs aquí o haz clic para elegir"
            : "Suelta más PDFs o haz clic"}
        </span>
        <span className="mt-4 max-w-md font-mono text-xs leading-relaxed text-muted-foreground">
          Hasta {maxMb} MB por archivo · hasta {MAX_COMBINED_PAGES} páginas en
          total. Todo en tu navegador; nada se sube para editarse.
        </span>
      </label>
    </div>
  );
}
