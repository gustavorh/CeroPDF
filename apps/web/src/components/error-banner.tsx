"use client";

import { useDocumentStore } from "@/stores/document-store";

export function ErrorBanner() {
  const lastError = useDocumentStore((s) => s.lastError);
  const clearError = useDocumentStore((s) => s.clearError);

  if (!lastError) return null;

  return (
    <div
      className="border-b border-destructive/25 bg-destructive-muted px-4 py-3 sm:px-6"
      role="alert"
    >
      <div className="mx-auto flex max-w-6xl items-start justify-between gap-3">
        <p className="text-sm text-destructive">{lastError}</p>
        <button
          type="button"
          onClick={clearError}
          className="shrink-0 rounded-sm border border-destructive/35 px-2 py-1 font-mono text-xs text-destructive transition hover:bg-destructive/15"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
