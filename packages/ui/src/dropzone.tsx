"use client";

import { useCallback, useState } from "react";

export type DropzoneVariant = "hero" | "compact";

type DropzoneProps = {
  variant: DropzoneVariant;
  onFiles: (files: FileList) => void;
  /** File picker MIME/extension accept string. Default: PDF. */
  accept?: string;
  multiple?: boolean;
  /** Small caps label above the headline ("100 % en tu dispositivo", "Añadir archivos"). */
  eyebrow: React.ReactNode;
  /** Main headline displayed inside the dropzone. */
  title: React.ReactNode;
  /** Mono caption below the headline (limits, privacy reassurance, etc.). */
  hint: React.ReactNode;
};

/**
 * Generic, controlled drag-drop area. Caller wires `onFiles` to its own store action.
 * `hero` variant fills the viewport; `compact` is a smaller secondary affordance.
 */
export function Dropzone({
  variant,
  onFiles,
  accept = "application/pdf,.pdf",
  multiple = true,
  eyebrow,
  title,
  hint,
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const emit = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      onFiles(fileList);
    },
    [onFiles],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    emit(e.dataTransfer.files);
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
          accept={accept}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => emit(e.target.files)}
        />
        <span className="text-label-md font-mono text-tertiary">{eyebrow}</span>
        <span className="text-display-lg mt-4 max-w-xl text-balance text-foreground">
          {title}
        </span>
        <span className="mt-4 max-w-md font-mono text-xs leading-relaxed text-muted-foreground">
          {hint}
        </span>
      </label>
    </div>
  );
}
