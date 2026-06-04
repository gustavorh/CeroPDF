"use client";

import { useEditStore } from "@/stores/edit-store";

export function EditPageNav() {
  const activePageIndex = useEditStore((s) => s.activePageIndex);
  const pageCount = useEditStore((s) => s.pageCount);
  const setActivePage = useEditStore((s) => s.setActivePage);

  if (pageCount === 0) return null;

  return (
    <div className="mx-auto mb-4 flex max-w-3xl items-center justify-center gap-3 font-mono text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => setActivePage(activePageIndex - 1)}
        disabled={activePageIndex === 0}
        className="inline-flex min-h-9 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-3 text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Anterior
      </button>
      <span className="select-none">
        Página{" "}
        <span className="text-foreground">{activePageIndex + 1}</span> de{" "}
        <span className="text-foreground">{pageCount}</span>
      </span>
      <button
        type="button"
        onClick={() => setActivePage(activePageIndex + 1)}
        disabled={activePageIndex >= pageCount - 1}
        className="inline-flex min-h-9 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-3 text-sm text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
      >
        Siguiente →
      </button>
    </div>
  );
}
