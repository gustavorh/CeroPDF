"use client";

import { useState } from "react";

type Props = {
  pageCount: number;
  /** 1-based page numbers parsed from the range expression. */
  onApply: (pages: number[]) => void;
  applyLabel: string;
  placeholder?: string;
};

export function PageRangeControl({ pageCount, onApply, applyLabel, placeholder }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    setError(null);
    try {
      const { parseRanges } = await import("@ceropdf/pdf-core");
      const ranges = parseRanges(value, pageCount);
      const pages = ranges.flatMap((r) =>
        Array.from({ length: r.end - r.start + 1 }, (_, k) => r.start + k),
      );
      onApply(pages);
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rango no válido.");
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void apply(); }}
          placeholder={placeholder ?? "1-3, 5, 7-10"}
          className="min-w-[12rem] flex-1 rounded-md border border-outline-variant/40 bg-surface-container-low/90 px-3 py-2 font-mono text-sm text-foreground placeholder:text-tertiary focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => void apply()}
          className="inline-flex min-h-9 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-3 text-sm text-foreground transition hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {applyLabel}
        </button>
      </div>
      {error ? <p className="font-mono text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
