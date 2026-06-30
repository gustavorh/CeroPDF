# Crop PDF Tool — Implementation Plan (Plan C2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Crop PDF tool — draw a crop rectangle on a page, apply it uniformly to all pages or override individual pages, and export the cropped PDF.

**Architecture:** Crop is its own canvas workspace (not the thumbnail grid). The page renders UNrotated so the only coordinate transform is a Y-flip (pure, tested helpers). Crop state lives in `PageEntry.crop`; `setCropAll`/`setPageCrop` engine actions write it; export flows through the existing `buildExportRefs` + `exportMergedPdf` (Plan A) with a MediaBox-origin fix.

**Tech Stack:** TypeScript strict · React 19 · Zustand 5 · Next 15 · pdfjs (render) / pdf-lib (export) · Vitest 2.1 (node).

## Global Constraints

- **100% client-side.** No new runtime deps, API routes, env vars.
- Render the crop page with `getViewport({ rotation: 0 })` (unrotated) → coordinate transform is Y-flip only.
- `CropRect` (from `@ceropdf/pdf-core`) is normalized 0–1, **bottom-left** origin. The canvas works in **top-left** display coords; convert at the boundary.
- Crop tool: single-doc, `exportPhase: "processing"`, `exportUsesSelection: false`, suffix `recortado`.
- `crop-workspace` derives the loaded doc from the TOOL store's `pageEntries` (NOT `document-store.documents[0]`) and clears selection on mount — the C1 isolation fix; do not regress it.
- MVP crop interaction = **draw-to-set** (drag a rectangle; redraw to change). Move/resize handles are a documented follow-up.
- Comments/code English; UI copy Spanish. Vitest `^2.1.9`, node env. Conventional commits.

## Alcance
**Dentro:** pdf-core MediaBox-origin fix; `crop-coords.ts` (pure); engine `setCropAll`/`setPageCrop`/`canCrop`; `crop-canvas.tsx`, `crop-workspace.tsx`, `crop-store.ts`, route `/crop`; registration; CLAUDE.md.
**Fuera (C3 / follow-up):** Resize; move/resize handles on the crop rect; natural-orientation rendering + rotation-inverted mapping for inherently-`/Rotate`'d pages; thumbnail strip nav.

---

### Task 1: pdf-core MediaBox-origin crop fix

**Files:**
- Modify: `packages/pdf-core/src/merge.ts` (the `if (ref.crop)` branch)
- Test (modify): `packages/pdf-core/src/__tests__/export-page-ops.test.ts`

**Interfaces:**
- Produces: `exportMergedPdf` applies `crop` relative to the page's MediaBox origin (handles non-(0,0) origin). No signature change.

- [ ] **Step 1: Write the failing test**

In `packages/pdf-core/src/__tests__/export-page-ops.test.ts`, add inside the `describe("exportMergedPdf — crop", ...)` block:

```ts
  it("applies the crop relative to a non-zero MediaBox origin", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([300, 400]);
    page.setMediaBox(100, 50, 300, 400); // origin (100, 50)
    const raw = await pdf.save();
    const doc = new ArrayBuffer(raw.byteLength);
    new Uint8Array(doc).set(raw);

    const pages: ExportPageRef[] = [
      { documentId: "a", sourcePageIndex: 0, rotation: 0, crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } },
    ];
    const merged = await exportMergedPdf(pages, () => doc, { optimizeSize: false });
    const parsed = await PDFDocument.load(merged);
    const box = parsed.getPage(0).getCropBox();
    // origin + normalized*size: x = 100 + 0.25*300 = 175 ; y = 50 + 0.25*400 = 150
    expect(Math.round(box.x)).toBe(175);
    expect(Math.round(box.y)).toBe(150);
    expect(Math.round(box.width)).toBe(150);
    expect(Math.round(box.height)).toBe(200);
  });
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -w @ceropdf/pdf-core`
Expected: FAIL — current code uses `getSize()` (no origin offset) so `box.x` is `75`, not `175`.

- [ ] **Step 3: Apply the fix**

In `packages/pdf-core/src/merge.ts`, replace the `if (ref.crop) { ... }` block with:

```ts
      if (ref.crop) {
        const mb = page.getMediaBox();
        page.setCropBox(
          mb.x + ref.crop.x * mb.width,
          mb.y + ref.crop.y * mb.height,
          ref.crop.width * mb.width,
          ref.crop.height * mb.height,
        );
      }
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -w @ceropdf/pdf-core`
Expected: PASS — the new test plus the existing Plan A crop tests (origin (0,0) → `mb.x = mb.y = 0`, unchanged behavior).

- [ ] **Step 5: Commit**

```bash
git add packages/pdf-core/src/merge.ts packages/pdf-core/src/__tests__/export-page-ops.test.ts
git commit -m "fix(pdf-core): apply crop relative to MediaBox origin"
```

---

### Task 2: crop-coords helpers + engine crop actions

**Files:**
- Create: `apps/web/src/lib/page-grid/crop-coords.ts`
- Test (create): `apps/web/src/lib/page-grid/crop-coords.test.ts`
- Modify: `apps/web/src/lib/page-grid/use-page-grid.ts` (`canCrop`, `setCropAll`, `setPageCrop`)
- Test (modify): `apps/web/src/lib/page-grid/use-page-grid.test.ts`

**Interfaces:**
- Produces:
  - `type DisplayRect = { x: number; y: number; w: number; h: number }` (top-left, 0–1).
  - `displayToCrop(r: DisplayRect): CropRect` (Y-flip, clamp01, min-size 0.02).
  - `cropToDisplay(c: CropRect): DisplayRect`.
  - `Capabilities` gains `canCrop?: boolean`.
  - state gains `setCropAll(rect: CropRect | null): void` and `setPageCrop(entryId: string, rect: CropRect | null): void`.

- [ ] **Step 1: Write the failing crop-coords test**

Create `apps/web/src/lib/page-grid/crop-coords.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { cropToDisplay, displayToCrop } from "./crop-coords";

describe("crop-coords", () => {
  it("displayToCrop flips Y (top-left → bottom-left)", () => {
    expect(displayToCrop({ x: 0.1, y: 0.2, w: 0.5, h: 0.3 })).toEqual({
      x: 0.1,
      y: 0.5, // 1 - 0.2 - 0.3
      width: 0.5,
      height: 0.3,
    });
  });

  it("round-trips through cropToDisplay", () => {
    const d = { x: 0.1, y: 0.2, w: 0.5, h: 0.3 };
    expect(cropToDisplay(displayToCrop(d))).toEqual(d);
  });

  it("enforces a minimum size", () => {
    const c = displayToCrop({ x: 0.5, y: 0.5, w: 0.001, h: 0.001 });
    expect(c.width).toBe(0.02);
    expect(c.height).toBe(0.02);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module './crop-coords'`)

Run: `npm test -w web`
Expected: FAIL.

- [ ] **Step 3: Implement `crop-coords.ts`**

Create `apps/web/src/lib/page-grid/crop-coords.ts`:

```ts
import type { CropRect } from "@ceropdf/pdf-core";

export type DisplayRect = { x: number; y: number; w: number; h: number };

const MIN = 0.02;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Display rect (top-left origin, 0–1) → CropRect (bottom-left origin, 0–1). */
export function displayToCrop(r: DisplayRect): CropRect {
  const width = clamp(r.w, MIN, 1);
  const height = clamp(r.h, MIN, 1);
  const x = clamp(r.x, 0, 1 - width);
  const yTop = clamp(r.y, 0, 1 - height);
  return { x, y: 1 - yTop - height, width, height };
}

/** CropRect (bottom-left) → display rect (top-left). */
export function cropToDisplay(c: CropRect): DisplayRect {
  return { x: c.x, y: 1 - c.y - c.height, w: c.width, h: c.height };
}
```

- [ ] **Step 4: Write the failing engine test**

In `apps/web/src/lib/page-grid/use-page-grid.test.ts`, add inside `describe("createPageGridStore — page ops", ...)`:

```ts
  it("setCropAll applies the same crop to every entry; null clears it", () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({ pageEntries: [entry({ id: "p1" }), entry({ id: "p2", sourcePageIndex: 1 })] });
    const rect = { x: 0.1, y: 0.1, width: 0.8, height: 0.8 };
    useStore.getState().setCropAll(rect);
    expect(useStore.getState().pageEntries.map((e) => e.crop)).toEqual([rect, rect]);
    useStore.getState().setCropAll(null);
    expect(useStore.getState().pageEntries.map((e) => e.crop)).toEqual([undefined, undefined]);
  });

  it("setPageCrop sets/clears only the target entry", () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({ pageEntries: [entry({ id: "p1" }), entry({ id: "p2", sourcePageIndex: 1 })] });
    const rect = { x: 0, y: 0, width: 0.5, height: 0.5 };
    useStore.getState().setPageCrop("p2", rect);
    expect(useStore.getState().pageEntries.map((e) => e.crop)).toEqual([undefined, rect]);
    useStore.getState().setPageCrop("p2", null);
    expect(useStore.getState().pageEntries.map((e) => e.crop)).toEqual([undefined, undefined]);
  });
```

- [ ] **Step 5: Run — expect FAIL** (`setCropAll` undefined)

Run: `npm test -w web`
Expected: FAIL.

- [ ] **Step 6: Add `canCrop`, `setCropAll`, `setPageCrop` to the engine**

In `apps/web/src/lib/page-grid/use-page-grid.ts`:

1. Import the type — change the top pdf-core import line to:
```ts
import { readDocumentBytes, type CropRect } from "@ceropdf/pdf-core";
```
2. In `Capabilities`, add after `canSelect?: boolean;`:
```ts
  canCrop?: boolean;
```
3. In `PageGridState`, add after `rotateAll: (delta: 90 | -90) => void;`:
```ts
  setCropAll: (rect: CropRect | null) => void;
  setPageCrop: (entryId: string, rect: CropRect | null) => void;
```
4. In the store object, add after the `rotateAll` action (clearing sets `crop: undefined`, which `buildExportRefs`'s `if (e.crop)` guard skips at export):
```ts
    setCropAll: (rect) =>
      set((s) => ({
        pageEntries: s.pageEntries.map((e) => ({ ...e, crop: rect ?? undefined })),
      })),

    setPageCrop: (entryId, rect) =>
      set((s) => ({
        pageEntries: s.pageEntries.map((e) =>
          e.id === entryId ? { ...e, crop: rect ?? undefined } : e,
        ),
      })),
```

- [ ] **Step 7: Run — expect PASS**

Run: `npm test -w web`
Expected: PASS — crop-coords (3) + the two new engine tests + all prior web tests.

- [ ] **Step 8: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add apps/web/src/lib/page-grid/crop-coords.ts apps/web/src/lib/page-grid/crop-coords.test.ts apps/web/src/lib/page-grid/use-page-grid.ts apps/web/src/lib/page-grid/use-page-grid.test.ts
git commit -m "feat(web): crop-coords helpers + setCropAll/setPageCrop engine actions"
```

---

### Task 3: Crop tool UI (store + canvas + workspace + route)

**Files:**
- Create: `apps/web/src/stores/crop-store.ts`
- Create: `apps/web/src/components/crop-canvas.tsx`
- Create: `apps/web/src/components/crop-workspace.tsx`
- Create: `apps/web/src/app/[locale]/crop/page.tsx`

**Interfaces:**
- Consumes: `createPageGridStore`, `Capabilities`; `displayToCrop`/`cropToDisplay`/`DisplayRect`; `readDocumentBytes`, `loadPdfJsDocument`, `isBenignPdfPreviewError`.
- Produces: `useCropStore`, `CROP_CAPS`; `<CropCanvas documentId pageIndex cropRect onChange>`; `<CropWorkspace>`.

> No automated test (UI). Verify via typecheck/lint/build + manual smoke.

- [ ] **Step 1: Create the store**

Create `apps/web/src/stores/crop-store.ts`:

```ts
import { createPageGridStore, type Capabilities } from "@/lib/page-grid/use-page-grid";

export const CROP_CAPS: Capabilities = { canCrop: true };

export const useCropStore = createPageGridStore({
  multiDoc: false,
  capabilities: CROP_CAPS,
  exportPhase: "processing",
  exportUsesSelection: false,
  buildFilename: (_, docs) =>
    `${docs[0]?.name.replace(/\.pdf$/i, "") ?? "documento"}.recortado.pdf`,
});
```

- [ ] **Step 2: Create the crop canvas (draw-to-set)**

Create `apps/web/src/components/crop-canvas.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { readDocumentBytes } from "@ceropdf/pdf-core";
import { isBenignPdfPreviewError, loadPdfJsDocument } from "@ceropdf/pdf-render";

import { useDocumentStore } from "@/stores/document-store";
import type { DisplayRect } from "@/lib/page-grid/crop-coords";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

type Props = {
  documentId: string;
  pageIndex: number;
  /** Committed crop in display coords (top-left, 0–1), or null. */
  cropRect: DisplayRect | null;
  /** Called once on pointer-up with the drawn rect (display coords). */
  onChange: (rect: DisplayRect) => void;
};

export function CropCanvas({ documentId, pageIndex, cropRect, onChange }: Props) {
  const documents = useDocumentStore((s) => s.documents);
  const doc = documents.find((d) => d.id === documentId);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DisplayRect | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBytes(null);
    if (!doc) return;
    void readDocumentBytes(doc.backing).then((b) => {
      if (!cancelled) setBytes(b);
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    if (!bytes) return;
    let cancelled = false;
    const run = async () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      setRenderError(null);
      try {
        const pdf = await loadPdfJsDocument(documentId, bytes);
        if (cancelled) return;
        const page = await pdf.getPage(pageIndex + 1);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1, rotation: 0 });
        const scale = Math.min(2.4, Math.max(0.6, container.clientWidth / base.width));
        const viewport = page.getViewport({ scale, rotation: 0 });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        setCanvasSize({ w: canvas.width, h: canvas.height });
        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
      } catch (err) {
        renderTaskRef.current = null;
        if (cancelled || isBenignPdfPreviewError(err)) return;
        setRenderError("No se pudo renderizar la página.");
      }
    };
    void run();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [bytes, documentId, pageIndex]);

  const norm = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: clamp01((e.clientX - r.left) / r.width),
      y: clamp01((e.clientY - r.top) / r.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canvasSize) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = norm(e);
    startRef.current = p;
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = startRef.current;
    if (!start) return;
    const p = norm(e);
    setDraft({
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      w: Math.abs(p.x - start.x),
      h: Math.abs(p.y - start.y),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const start = startRef.current;
    startRef.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    const d = draft;
    setDraft(null);
    if (start && d && d.w > 0.01 && d.h > 0.01) onChange(d);
  };

  const shown = draft ?? cropRect;

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-3xl" style={{ touchAction: "none" }}>
      <div className="relative inline-block w-full">
        <canvas
          ref={canvasRef}
          className="block w-full rounded-md bg-white shadow-[0_30px_60px_-30px_var(--shadow-ambient)]"
          aria-hidden
        />
        {canvasSize ? (
          <div
            className="absolute inset-0 cursor-crosshair"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            role="application"
            aria-label="Área de recorte"
          >
            {shown ? (
              <div
                className="pointer-events-none absolute border-2 border-primary"
                style={{
                  left: `${shown.x * 100}%`,
                  top: `${shown.y * 100}%`,
                  width: `${shown.w * 100}%`,
                  height: `${shown.h * 100}%`,
                  boxShadow: "0 0 0 9999px rgba(17,19,22,0.45)",
                }}
                aria-hidden
              />
            ) : null}
          </div>
        ) : null}
        {renderError ? (
          <p className="mt-3 text-center font-mono text-xs text-destructive">{renderError}</p>
        ) : null}
        {!canvasSize ? (
          <p className="mt-3 text-center font-mono text-xs text-muted-foreground">Cargando página…</p>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the workspace**

Create `apps/web/src/components/crop-workspace.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { MAX_FILE_BYTES } from "@ceropdf/pdf-core";
import { Dropzone } from "@ceropdf/ui";

import { useDocumentStore } from "@/stores/document-store";
import { useSelectionStore } from "@/stores/selection-store";
import { cropToDisplay, displayToCrop, type DisplayRect } from "@/lib/page-grid/crop-coords";
import { useCropStore } from "@/stores/crop-store";

import { CropCanvas } from "./crop-canvas";
import { ErrorBanner } from "./error-banner";
import { LandingFooterCopy } from "./landing-footer-copy";
import { LandingHeader } from "./landing-header";

const btn =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-3 text-sm text-foreground transition hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45";

export function CropWorkspace() {
  const documents = useDocumentStore((s) => s.documents);
  const uiPhase = useDocumentStore((s) => s.uiPhase);
  const pageEntries = useCropStore((s) => s.pageEntries);
  const addDocumentsFromFiles = useCropStore((s) => s.addDocumentsFromFiles);
  const resetWorkspace = useCropStore((s) => s.resetWorkspace);
  const exportPdf = useCropStore((s) => s.exportPdf);
  const setCropAll = useCropStore((s) => s.setCropAll);
  const setPageCrop = useCropStore((s) => s.setPageCrop);

  const [pageIndex, setPageIndex] = useState(0);
  const [scope, setScope] = useState<"all" | "page">("all");

  useEffect(() => {
    useSelectionStore.getState().clear();
  }, []);

  const firstDocId = pageEntries[0]?.documentId;
  const doc = firstDocId ? documents.find((d) => d.id === firstDocId) : undefined;

  useEffect(() => {
    setPageIndex(0);
  }, [firstDocId]);

  const busy = uiPhase === "loading" || uiPhase === "parsing" || uiPhase === "processing";
  const maxMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));

  if (!doc) {
    return (
      <Frame>
        <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
          <h1 className="text-display-lg text-balance text-foreground">Recortar PDF</h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Dibuja un área de recorte y aplícala a todas las páginas o a páginas concretas. 100 % en tu navegador.
          </p>
        </section>
        <section className="mx-auto mt-6 w-full max-w-3xl flex-1 px-4 sm:px-6">
          <Dropzone
            variant="compact"
            onFiles={(files) => void addDocumentsFromFiles(files)}
            multiple={false}
            eyebrow={busy ? "Leyendo…" : "Sube un PDF"}
            title={busy ? "Procesando el PDF…" : "Suelta el PDF o haz clic"}
            hint={`Un solo PDF, hasta ${maxMb} MB. Nada sale del navegador.`}
          />
        </section>
        <LandingFooterCopy />
      </Frame>
    );
  }

  const entry = pageEntries[pageIndex];
  const cropRect = entry?.crop ? cropToDisplay(entry.crop) : null;

  const onCropChange = (r: DisplayRect) => {
    const crop = displayToCrop(r);
    if (scope === "all") setCropAll(crop);
    else if (entry) setPageCrop(entry.id, crop);
  };

  const total = pageEntries.length;

  return (
    <Frame>
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-16 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-headline-md text-balance text-foreground">Recortar PDF</h1>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{doc.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className={btn} onClick={() => resetWorkspace()}>
                Cambiar PDF
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void exportPdf()}
                className="inline-flex min-h-10 min-w-[120px] items-center justify-center rounded-md bg-gradient-to-b from-primary to-[#c97d62] px-5 text-sm font-semibold text-primary-foreground transition hover:from-primary-hover hover:to-[#dba48e] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busy ? "Procesando…" : "Exportar"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-tertiary">Aplicar a:</span>
            <div className="inline-flex overflow-hidden rounded-md border border-outline-variant/45">
              <button
                type="button"
                onClick={() => setScope("all")}
                className={`px-3 py-1.5 text-sm transition ${scope === "all" ? "bg-primary-muted text-foreground" : "bg-surface-container-low text-muted-foreground hover:text-foreground"}`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setScope("page")}
                className={`px-3 py-1.5 text-sm transition ${scope === "page" ? "bg-primary-muted text-foreground" : "bg-surface-container-low text-muted-foreground hover:text-foreground"}`}
              >
                Solo esta página
              </button>
            </div>
            <button
              type="button"
              className={btn}
              onClick={() => (scope === "all" ? setCropAll(null) : entry && setPageCrop(entry.id, null))}
            >
              Quitar recorte
            </button>
          </div>

          <div className="mt-6">
            <CropCanvas documentId={doc.id} pageIndex={pageIndex} cropRect={cropRect} onChange={onCropChange} />
          </div>

          <div className="mt-4 flex items-center justify-center gap-4">
            <button type="button" className={btn} disabled={pageIndex === 0} onClick={() => setPageIndex((i) => Math.max(0, i - 1))}>
              ‹ Anterior
            </button>
            <span className="font-mono text-xs text-muted-foreground">
              Página {pageIndex + 1} de {total}
            </span>
            <button type="button" className={btn} disabled={pageIndex >= total - 1} onClick={() => setPageIndex((i) => Math.min(total - 1, i + 1))}>
              Siguiente ›
            </button>
          </div>

          {uiPhase === "export_success" ? (
            <p className="mt-3 text-center font-mono text-xs text-trust">Listo · descarga iniciada</p>
          ) : null}
        </div>
      </main>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgb(240_168_140/0.07),transparent_55%),radial-gradient(ellipse_70%_40%_at_100%_0%,rgb(52_211_153/0.05),transparent_45%)]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <LandingHeader />
        <ErrorBanner />
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the route**

Create `apps/web/src/app/[locale]/crop/page.tsx`:

```tsx
import type { Metadata } from "next";

import { CropWorkspace } from "@/components/crop-workspace";

export const metadata: Metadata = {
  title: "Recortar PDF — CeroPDF",
  description:
    "Recorta los márgenes de un PDF: dibuja el área y aplícala a todas las páginas o a páginas concretas. 100 % en tu navegador.",
  alternates: { canonical: "/crop" },
};

export default function CropPage() {
  return <CropWorkspace />;
}
```

- [ ] **Step 5: Verify typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS (the `/crop` route builds). Watch for unused-import/var lint.

- [ ] **Step 6: Manual smoke**

Run `npm run dev`, open `/crop`: load a PDF → page renders unrotated; drag a rectangle → shaded crop appears; Export downloads `<name>.recortado.pdf` cropped on all pages (scope "Todas"). Switch to "Solo esta página", navigate to page 2, draw a different rect → only page 2 overridden. "Quitar recorte" clears. Document the result in the report.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/stores/crop-store.ts apps/web/src/components/crop-canvas.tsx apps/web/src/components/crop-workspace.tsx "apps/web/src/app/[locale]/crop"
git commit -m "feat(web): Crop PDF tool (draw-to-set canvas, uniform + per-page override)"
```

---

### Task 4: Registration + CLAUDE.md + cross-repo verify

**Files:**
- Modify: `apps/web/src/i18n/messages/es.json`, `en.json` (tools.crop)
- Modify: `apps/web/src/app/sitemap.ts` (/crop)
- Modify: `apps/web/src/components/landing-tools-grid.tsx` (crop card + GlyphCrop)
- Modify: `CLAUDE.md`

- [ ] **Step 1: i18n — `tools.crop`**

`es.json` → `tools`:

```json
    "crop": {
      "name": "Recortar PDF",
      "description": "Dibuja un área de recorte y aplícala a todas las páginas o a páginas concretas."
    },
```

`en.json` → `tools`:

```json
    "crop": {
      "name": "Crop PDF",
      "description": "Draw a crop area and apply it to every page or to specific pages."
    },
```

- [ ] **Step 2: sitemap** — add `"/crop",` to `TOOL_PATHS` in `apps/web/src/app/sitemap.ts`.

- [ ] **Step 3: landing** — in `apps/web/src/components/landing-tools-grid.tsx`: add `"crop"` to the `ToolKey` union; add `GlyphCrop`:

```tsx
function GlyphCrop() {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 2v18a1 1 0 0 0 1 1h18" />
      <path d="M2 8h18a1 1 0 0 1 1 1v18" />
    </svg>
  );
}
```

and add to `TOOLS` (after the `extract`/`removePages` entries):

```tsx
  { key: "crop", slug: "crop", status: "available", glyph: <GlyphCrop /> },
```

- [ ] **Step 4: CLAUDE.md** — in the `## Mapa del código` block under `app/[locale]/`, add after the `extract-pages` line:

```
│   │   │   ├── crop/page.tsx        # tool: recortar páginas (client-side, canvas propio)
```

- [ ] **Step 5: Cross-repo verification**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: PASS — pdf-core tests include the new MediaBox-origin crop test; web tests include crop-coords (3) + the two engine crop tests; build emits `/crop`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/i18n/messages/es.json apps/web/src/i18n/messages/en.json apps/web/src/app/sitemap.ts apps/web/src/components/landing-tools-grid.tsx CLAUDE.md
git commit -m "feat(web): register Crop PDF tool (i18n, sitemap, landing) + CLAUDE.md"
```

---

## Self-Review (autor del plan)

**Cobertura del spec:**
- §3 MediaBox-origin fix → Task 1. ✓
- §3 crop-coords (Y-flip, min-size) → Task 2. ✓
- §4 setCropAll/setPageCrop/canCrop → Task 2. ✓
- §5 crop-canvas (unrotated render, draw-to-set, shading) → Task 3 Step 2. ✓
- §5 crop-workspace (own workspace, scope toggle, nav, isolation from C1) → Task 3 Step 3. ✓
- §5 crop-store → Task 3 Step 1. ✓
- §6 registration + CLAUDE.md → Task 4. ✓
- §8 tests (crop-coords, MediaBox-origin, setCropAll/setPageCrop; Plan A crop tests stay green) → Tasks 1-2. ✓
- §8 smoke → Task 3 Step 6. ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code; UI smoke is an explicit checklist. The `_drop` unused-var note in Task 2 Step 6 gives a concrete fallback. ✓

**Type consistency:** `CropRect` (pdf-core), `DisplayRect`, `displayToCrop`/`cropToDisplay`, `setCropAll`/`setPageCrop`/`canCrop`, `CROP_CAPS`, `<CropCanvas>` props all defined where introduced and consumed by exact name downstream. `exportPhase: "processing"` exists (added in C1). ✓

**Scope note:** crop-canvas MVP is draw-to-set (no move/resize handles); the workspace fully supports uniform+override via the scope toggle. Move/resize + inherent-rotation natural view are documented follow-ups.

---

## Plan siguiente — C3 (Resize)

`setResize(directive|null)` workspace-level + `canResize` + a control panel (A4/Letter/Legal/scale %). Resize fits the C1 `<SingleDocGridWorkspace>` shell (it needs a control panel + the thumbnail grid, not a drawing canvas).
