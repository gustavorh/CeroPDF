"use client";

import { useCallback } from "react";

import { MAX_COMBINED_PAGES, MAX_FILE_BYTES } from "@ceropdf/pdf-core/constants";
import { Dropzone, type DropzoneVariant } from "@ceropdf/ui";

import { useMergeStore } from "@/stores/merge-store";

type WorkspaceDropzoneProps = {
  variant: DropzoneVariant;
};

/** Dropzone conectado a `merge-store`. Para nuevos tools, crear un wrapper análogo con su propio store. */
export function WorkspaceDropzone({ variant }: WorkspaceDropzoneProps) {
  const addDocumentsFromFiles = useMergeStore(
    (s) => s.addDocumentsFromFiles,
  );

  const onFiles = useCallback(
    (files: FileList) => {
      void addDocumentsFromFiles(files);
    },
    [addDocumentsFromFiles],
  );

  const maxMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));
  const isHero = variant === "hero";

  return (
    <Dropzone
      variant={variant}
      onFiles={onFiles}
      eyebrow={isHero ? "100 % en tu dispositivo" : "Añadir archivos"}
      title={
        isHero
          ? "Arrastra tus PDFs aquí o haz clic para elegir"
          : "Suelta más PDFs o haz clic"
      }
      hint={
        <>
          Hasta {maxMb} MB por archivo · hasta {MAX_COMBINED_PAGES} páginas en
          total. Todo en tu navegador; nada se sube para editarse.
        </>
      }
    />
  );
}
