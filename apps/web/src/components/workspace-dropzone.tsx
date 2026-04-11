"use client";

import { useCallback, useState } from "react";

import { MAX_COMBINED_PAGES, MAX_FILE_BYTES } from "@/lib/constants";
import { useWorkspaceStore } from "@/stores/workspace-store";

import { DocumentBlocks } from "./document-blocks";

type WorkspaceDropzoneProps = {
  variant: "hero" | "compact";
};

export function WorkspaceDropzone({ variant }: WorkspaceDropzoneProps) {
  const addDocumentsFromFiles = useWorkspaceStore(
    (s) => s.addDocumentsFromFiles,
  );
  const documents = useWorkspaceStore((s) => s.documents);

  const [isDragging, setIsDragging] = useState(false);

  const onFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      addDocumentsFromFiles(fileList);
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

  return (
    <div
      className={`flex flex-1 flex-col ${isHero ? "min-h-[280px]" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <label
        className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition-colors ${
          isHero ? "mx-auto max-w-3xl py-14 sm:py-16" : "py-8"
        } ${
          isDragging
            ? "border-primary bg-primary-muted"
            : "border-border bg-card/40 hover:border-muted-foreground/50"
        }`}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(e) => onFiles(e.target.files)}
        />
        <span className="font-mono text-xs font-medium tracking-wide text-tertiary uppercase">
          {isHero ? "Prueba ahora" : "Añadir archivos"}
        </span>
        <span className="mt-2 text-base font-medium text-foreground">
          {isHero
            ? "Arrastra tus PDFs aquí o haz clic para elegir"
            : "Suelta más PDFs o haz clic"}
        </span>
        <span className="mt-2 max-w-md font-mono text-xs leading-relaxed text-muted-foreground">
          Hasta {maxMb} MB por archivo · hasta {MAX_COMBINED_PAGES} páginas en
          total. Procesamiento en tu navegador; nada se sube para editarse.
        </span>
      </label>

      {documents.length > 0 ? (
        <div className="mt-8 w-full">
          <DocumentBlocks />
        </div>
      ) : null}
    </div>
  );
}
