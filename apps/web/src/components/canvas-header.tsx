"use client";

import { useCallback, useId, useRef } from "react";

import { defaultProjectDisplayName } from "@/lib/project-display-name";
import { BrandMark } from "@ceropdf/ui";

import { useDocumentStore } from "@/stores/document-store";
import { useMergeStore } from "@/stores/merge-store";

function IconPencil({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export function CanvasHeader() {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectName = useMergeStore((s) => s.projectName);
  const documents = useDocumentStore((s) => s.documents);
  const setProjectName = useMergeStore((s) => s.setProjectName);
  const addDocumentsFromFiles = useMergeStore((s) => s.addDocumentsFromFiles);
  const exportPdf = useMergeStore((s) => s.exportPdf);
  const uiPhase = useDocumentStore((s) => s.uiPhase);

  const derivedTitle = defaultProjectDisplayName(documents);
  const titleValue = projectName ?? derivedTitle;

  const busy = uiPhase === "merging";

  const onFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      void addDocumentsFromFiles(list);
    },
    [addDocumentsFromFiles],
  );

  return (
    <header className="sticky top-0 z-30 border-b border-outline-variant/30 bg-card/85 backdrop-blur-[20px]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap sm:gap-4 sm:px-6 sm:py-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <BrandMark aria-hidden className="h-9 w-9 shrink-0" />
          <div className="relative flex min-w-0 max-w-[min(100%,22rem)] flex-1 items-center gap-2">
            <label htmlFor={inputId} className="sr-only">
              Nombre del proyecto
            </label>
            <input
              id={inputId}
              type="text"
              value={titleValue}
              onChange={(e) => setProjectName(e.target.value)}
              className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-surface-container-low/90 py-1.5 pr-1 pl-2.5 text-base font-semibold text-foreground transition placeholder:text-tertiary hover:border-outline-variant/40 focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Nombre del proyecto"
              autoComplete="off"
              spellCheck={false}
            />
            <span
              className="pointer-events-none shrink-0 text-tertiary"
              title="Editable"
              aria-hidden
            >
              <IconPencil className="h-4 w-4 opacity-60" />
            </span>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="inline-flex min-h-10 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-4 text-sm font-medium text-foreground transition hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
          >
            Añadir más PDFs
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void exportPdf()}
            className="inline-flex min-h-10 min-w-[140px] items-center justify-center rounded-md bg-gradient-to-b from-primary to-[#c97d62] px-5 text-sm font-semibold text-primary-foreground shadow-[0_18px_40px_-14px_rgb(17_19_22/0.45)] transition hover:from-primary-hover hover:to-[#dba48e] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
          >
            Exportar PDF
          </button>
        </div>
      </div>
    </header>
  );
}
