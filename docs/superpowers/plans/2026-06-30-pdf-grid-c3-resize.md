# Resize PDF Tool — Implementation Plan (Plan C3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Resize PDF tool — scale pages by percentage or fit them to a standard paper size (A4/Letter/Legal), aspect-preserving.

**Architecture:** Resize reuses the C1 `<SingleDocGridWorkspace>` shell with a control panel. The export path already applies a uniform `resize` (Plan A's `buildExportRefs` + `exportMergedPdf`); this plan wires a workspace-level `resize` into the store and changes pdf-core's `{kind:"size"}` branch from stretch to aspect-preserving fit.

**Tech Stack:** TypeScript strict · React 19 · Zustand 5 · Next 15 · pdf-lib (export) · Vitest 2.1 (node).

## Global Constraints

- **100% client-side.** No new runtime deps, API routes, env vars.
- Resize is single-doc, `exportPhase:"processing"`, `exportUsesSelection:false`, suffix `redimensionado`.
- `resize` is workspace-level (uniform across all pages), one field, `ResizeDirective | null`. Modes: scale % (`{kind:"scale"}`, uniform, unchanged) and paper-size presets (`{kind:"size"}`, aspect-preserving fit).
- Paper sizes in POINTS: A4 = 595×842, Letter = 612×792, Legal = 612×1008.
- pdf-core `{kind:"size"}` becomes aspect-preserving: `scaleContent(min-ratio)` + `translateContent(center)` + `setSize(target)`. Plan A's `"resizes to a target size"` test (asserts `getSize() == target`) MUST stay green.
- Adding `resize` state to the factory is benign for other tools (default `null` → export passes `undefined` → no resize; merge stays behavior-identical).
- Comments/code English; UI copy Spanish. Vitest `^2.1.9`, node env. Conventional commits.

## Alcance
**Dentro:** pdf-core `computeFitResize` + aspect-preserving `size` branch; engine `resize`/`setResize`/`canResize` + exportPdf wiring; `resize-store.ts`, `resize-workspace.tsx` (+ `ResizeControls`), route `/resize`; registration; CLAUDE.md.
**Fuera:** app-wide design-token pass; `/storage` subpath perf-pass; Crop move/resize handles.

---

### Task 1: pdf-core aspect-preserving `size` resize + `computeFitResize`

**Files:**
- Modify: `packages/pdf-core/src/merge.ts` (add `computeFitResize`; rewrite the `{kind:"size"}` branch)
- Modify: `packages/pdf-core/src/index.ts` (export `computeFitResize`)
- Test (modify): `packages/pdf-core/src/__tests__/export-page-ops.test.ts`

**Interfaces:**
- Produces: `computeFitResize(srcW: number, srcH: number, targetW: number, targetH: number): { scale: number; dx: number; dy: number }`. The `{kind:"size"}` resize now fits content into the target preserving aspect (page becomes exactly the target size).

- [ ] **Step 1: Write the failing test**

In `packages/pdf-core/src/__tests__/export-page-ops.test.ts`, add a new top-level describe block (import `computeFitResize` alongside the existing imports — change the top import line to `import { computeFitResize, exportMergedPdf, type ExportPageRef } from "../merge";`):

```ts
describe("computeFitResize", () => {
  it("scales by the smaller ratio and centers the overflow axis", () => {
    const r = computeFitResize(200, 400, 595, 842);
    expect(r.scale).toBeCloseTo(2.105, 2); // min(595/200=2.975, 842/400=2.105)
    expect(Math.round(r.dx)).toBe(87); // (595 - 200*2.105)/2
    expect(Math.round(r.dy)).toBe(0); // (842 - 400*2.105)/2
  });

  it("has no offset when the aspect ratios match", () => {
    const r = computeFitResize(100, 200, 300, 600);
    expect(r.scale).toBeCloseTo(3, 5);
    expect(r.dx).toBeCloseTo(0, 5);
    expect(r.dy).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`computeFitResize` not exported)

Run: `npm test -w @ceropdf/pdf-core`
Expected: FAIL.

- [ ] **Step 3: Add `computeFitResize` and rewrite the `size` branch**

In `packages/pdf-core/src/merge.ts`, add this exported function above `exportMergedPdf` (after the `stripMergedDocumentMetadata` helper):

```ts
/** Uniform scale + centering offsets to fit a src box into a target box (aspect-preserving). */
export function computeFitResize(
  srcW: number,
  srcH: number,
  targetW: number,
  targetH: number,
): { scale: number; dx: number; dy: number } {
  const scale = Math.min(targetW / srcW, targetH / srcH);
  return {
    scale,
    dx: (targetW - srcW * scale) / 2,
    dy: (targetH - srcH * scale) / 2,
  };
}
```

Then, in the resize block inside `exportMergedPdf`, replace the `else` branch (the `{kind:"size"}` case) so it reads:

```ts
      if (ref.resize) {
        if (ref.resize.kind === "scale") {
          page.scale(ref.resize.factor, ref.resize.factor);
        } else {
          const { width: w, height: h } = page.getSize();
          const { scale, dx, dy } = computeFitResize(
            w,
            h,
            ref.resize.width,
            ref.resize.height,
          );
          page.scaleContent(scale, scale);
          page.translateContent(dx, dy);
          page.setSize(ref.resize.width, ref.resize.height);
        }
      }
```

> `page.scaleContent`, `page.translateContent`, and `page.setSize` are existing pdf-lib PDFPage methods. If any behaves unexpectedly (e.g. content not centered), STOP and report — do not fudge assertions.

- [ ] **Step 4: Export from `index.ts`**

In `packages/pdf-core/src/index.ts`, change the merge export line to also export `computeFitResize`:

```ts
export { computeFitResize, exportMergedPdf } from "./merge";
```

- [ ] **Step 5: Run — expect PASS**

Run: `npm test -w @ceropdf/pdf-core`
Expected: PASS — the two `computeFitResize` tests plus the existing `"resizes to a target size"` test (still asserts `getSize() == 595×842`, which `setSize` preserves) and all other pdf-core tests.

- [ ] **Step 6: Commit**

```bash
git add packages/pdf-core/src/merge.ts packages/pdf-core/src/index.ts packages/pdf-core/src/__tests__/export-page-ops.test.ts
git commit -m "feat(pdf-core): aspect-preserving size resize (computeFitResize)"
```

---

### Task 2: Engine — `resize` state + `setResize` + `canResize`

**Files:**
- Modify: `apps/web/src/lib/page-grid/use-page-grid.ts`
- Test (modify): `apps/web/src/lib/page-grid/use-page-grid.test.ts`

**Interfaces:**
- Consumes: `ResizeDirective` (from `@ceropdf/pdf-core`); `buildExportRefs`'s existing `resize` option.
- Produces: `Capabilities.canResize?: boolean`; state `resize: ResizeDirective | null` + `setResize(directive: ResizeDirective | null): void`; `exportPdf` applies the active resize; `resetWorkspace` clears it.

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/lib/page-grid/use-page-grid.test.ts`, add inside `describe("createPageGridStore — page ops", ...)`:

```ts
  it("setResize sets and clears the resize directive", () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.getState().setResize({ kind: "scale", factor: 0.5 });
    expect(useStore.getState().resize).toEqual({ kind: "scale", factor: 0.5 });
    useStore.getState().setResize(null);
    expect(useStore.getState().resize).toBeNull();
  });
```

and inside `describe("createPageGridStore — exportPdf semantics", ...)`:

```ts
  it("exportPdf applies the active resize to every ref", async () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({
      pageEntries: [entry({ id: "p1", sourcePageIndex: 0 }), entry({ id: "p2", sourcePageIndex: 1 })],
    });
    useStore.getState().setResize({ kind: "size", width: 595, height: 842 });
    await useStore.getState().exportPdf();
    const call = exportMergedPdfMock.mock.calls[0] as unknown as [
      Array<{ resize?: { kind: string } }>,
      unknown,
      unknown,
    ];
    expect(call[0].every((r) => r.resize?.kind === "size")).toBe(true);
  });
```

- [ ] **Step 2: Run — expect FAIL** (`setResize` undefined; refs have no `resize`)

Run: `npm test -w web`
Expected: FAIL.

- [ ] **Step 3: Implement the engine additions**

In `apps/web/src/lib/page-grid/use-page-grid.ts`:

1. Extend the pdf-core type import — change:
```ts
import { readDocumentBytes, type CropRect } from "@ceropdf/pdf-core";
```
to:
```ts
import { readDocumentBytes, type CropRect, type ResizeDirective } from "@ceropdf/pdf-core";
```
2. In `Capabilities`, add after `canCrop?: boolean;`:
```ts
  canResize?: boolean;
```
3. In `PageGridState`, add after the `setPageCrop` line:
```ts
  resize: ResizeDirective | null;
  setResize: (directive: ResizeDirective | null) => void;
```
4. In the store object, add `resize: null,` to the initial state (next to `pageEntries: []`), and add the action after `setPageCrop`:
```ts
    setResize: (resize) => set({ resize }),
```
5. In `resetWorkspace`, add `resize: null` to the `set({ ... })` call.
6. In `exportPdf`, change the `buildExportRefs` call from:
```ts
      const refs = buildExportRefs(pageEntries, { selectedIds: new Set(selectedIds) });
```
to:
```ts
      const refs = buildExportRefs(pageEntries, {
        selectedIds: new Set(selectedIds),
        resize: get().resize ?? undefined,
      });
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -w web`
Expected: PASS — the two new tests + all prior web tests (merge export-semantics tests stay green: `resize` defaults `null` → `undefined` passed → no resize).

- [ ] **Step 5: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.

```bash
git add apps/web/src/lib/page-grid/use-page-grid.ts apps/web/src/lib/page-grid/use-page-grid.test.ts
git commit -m "feat(web): resize state + setResize engine action, wired into export"
```

---

### Task 3: Resize tool UI (store + workspace + controls + route)

**Files:**
- Create: `apps/web/src/stores/resize-store.ts`
- Create: `apps/web/src/components/resize-workspace.tsx`
- Create: `apps/web/src/app/[locale]/resize/page.tsx`

**Interfaces:**
- Consumes: `createPageGridStore`, `Capabilities`, `<SingleDocGridWorkspace>`, `useResizeStore.setResize`.
- Produces: `useResizeStore`, `RESIZE_CAPS`, `<ResizeWorkspace>`.

> No automated test (UI). Verify via typecheck/lint/build + manual smoke.

- [ ] **Step 1: Create the store**

Create `apps/web/src/stores/resize-store.ts`:

```ts
import { createPageGridStore, type Capabilities } from "@/lib/page-grid/use-page-grid";

export const RESIZE_CAPS: Capabilities = { canResize: true };

export const useResizeStore = createPageGridStore({
  multiDoc: false,
  capabilities: RESIZE_CAPS,
  exportPhase: "processing",
  exportUsesSelection: false,
  buildFilename: (_, docs) =>
    `${docs[0]?.name.replace(/\.pdf$/i, "") ?? "documento"}.redimensionado.pdf`,
});
```

- [ ] **Step 2: Create the workspace + controls**

Create `apps/web/src/components/resize-workspace.tsx`:

```tsx
"use client";

import { useState } from "react";

import { RESIZE_CAPS, useResizeStore } from "@/stores/resize-store";

import { SingleDocGridWorkspace } from "./page-grid/single-doc-grid-workspace";

const PRESETS = [
  { label: "A4", width: 595, height: 842 },
  { label: "Letter", width: 612, height: 792 },
  { label: "Legal", width: 612, height: 1008 },
] as const;

const chip =
  "inline-flex min-h-9 items-center justify-center rounded-md border px-3 text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
const chipOff =
  "border-outline-variant/45 bg-surface-container-low text-muted-foreground hover:text-foreground";
const chipOn = "border-primary/55 bg-primary-muted text-foreground";

function ResizeControls() {
  const resize = useResizeStore((s) => s.resize);
  const setResize = useResizeStore((s) => s.setResize);
  const [pct, setPct] = useState("100");

  const applyScale = () => {
    const n = Number.parseInt(pct, 10);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(400, Math.max(10, n));
    setResize({ kind: "scale", factor: clamped / 100 });
  };

  const target =
    resize?.kind === "size"
      ? `${PRESETS.find((p) => p.width === resize.width && p.height === resize.height)?.label ?? "Personalizado"} · ${resize.width}×${resize.height} pt`
      : resize?.kind === "scale"
        ? `Escala ${Math.round(resize.factor * 100)} %`
        : "Tamaño original (sin cambios)";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-tertiary">Tamaño de papel:</span>
        {PRESETS.map((p) => {
          const active =
            resize?.kind === "size" && resize.width === p.width && resize.height === p.height;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setResize({ kind: "size", width: p.width, height: p.height })}
              className={`${chip} ${active ? chipOn : chipOff}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-tertiary">Escala:</span>
        <input
          type="number"
          min={10}
          max={400}
          value={pct}
          onChange={(e) => setPct(e.target.value)}
          className="w-20 rounded-md border border-outline-variant/40 bg-surface-container-low/90 px-2 py-1.5 font-mono text-sm text-foreground focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
        <span className="text-sm text-muted-foreground">%</span>
        <button type="button" onClick={applyScale} className={`${chip} ${chipOff}`}>
          Aplicar escala
        </button>
        <button type="button" onClick={() => setResize(null)} className={`${chip} ${chipOff}`}>
          Tamaño original
        </button>
      </div>
      <p className="font-mono text-xs text-muted-foreground">Destino: {target}</p>
    </div>
  );
}

export function ResizeWorkspace() {
  return (
    <SingleDocGridWorkspace
      store={useResizeStore}
      capabilities={RESIZE_CAPS}
      title="Redimensionar PDF"
      description="Cambia el tamaño de las páginas por porcentaje o a un tamaño de papel estándar (A4, Letter, Legal). 100 % en tu navegador."
      exportLabel="Exportar"
      controls={<ResizeControls />}
    />
  );
}
```

- [ ] **Step 3: Create the route**

Create `apps/web/src/app/[locale]/resize/page.tsx`:

```tsx
import type { Metadata } from "next";

import { ResizeWorkspace } from "@/components/resize-workspace";

export const metadata: Metadata = {
  title: "Redimensionar PDF — CeroPDF",
  description:
    "Cambia el tamaño de un PDF por porcentaje o a un tamaño de papel estándar (A4, Letter, Legal). 100 % en tu navegador.",
  alternates: { canonical: "/resize" },
};

export default function ResizePage() {
  return <ResizeWorkspace />;
}
```

- [ ] **Step 4: Verify typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS (the `/resize` route builds). Watch for unused imports.

- [ ] **Step 5: Manual smoke**

Run `npm run dev`, open `/resize`: load a PDF → grid shows thumbnails; click "A4" → target shows "A4 · 595×842 pt"; Export downloads `<name>.redimensionado.pdf` with A4 pages (content centered, not distorted). Try scale 50 % → pages half size. "Tamaño original" → export unchanged. Document the result in the report.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/stores/resize-store.ts apps/web/src/components/resize-workspace.tsx "apps/web/src/app/[locale]/resize"
git commit -m "feat(web): Resize PDF tool (scale % + paper-size presets)"
```

---

### Task 4: Registration + CLAUDE.md + cross-repo verify

**Files:**
- Modify: `apps/web/src/i18n/messages/es.json`, `en.json` (tools.resize)
- Modify: `apps/web/src/app/sitemap.ts` (/resize)
- Modify: `apps/web/src/components/landing-tools-grid.tsx` (resize card + GlyphResize)
- Modify: `CLAUDE.md`

- [ ] **Step 1: i18n — `tools.resize`**

`es.json` → `tools`:

```json
    "resize": {
      "name": "Redimensionar PDF",
      "description": "Cambia el tamaño de las páginas por porcentaje o a un tamaño de papel estándar."
    },
```

`en.json` → `tools`:

```json
    "resize": {
      "name": "Resize PDF",
      "description": "Change page size by percentage or to a standard paper size."
    },
```

- [ ] **Step 2: sitemap** — add `"/resize",` to `TOOL_PATHS` in `apps/web/src/app/sitemap.ts`.

- [ ] **Step 3: landing** — in `apps/web/src/components/landing-tools-grid.tsx`: add `"resize"` to the `ToolKey` union; add `GlyphResize`:

```tsx
function GlyphResize() {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="20" height="20" rx="2" />
      <path d="M9 9h6v6" />
      <path d="M15 9l-6 6" />
    </svg>
  );
}
```

and add to `TOOLS` (after the `crop` entry):

```tsx
  { key: "resize", slug: "resize", status: "available", glyph: <GlyphResize /> },
```

- [ ] **Step 4: CLAUDE.md** — in the `## Mapa del código` block under `app/[locale]/`, add after the `crop` line:

```
│   │   │   ├── resize/page.tsx      # tool: redimensionar páginas (client-side, page-grid)
```

- [ ] **Step 5: Cross-repo verification**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: PASS — pdf-core tests include the `computeFitResize` cases; web tests include the two new engine resize cases; build emits `/resize`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/i18n/messages/es.json apps/web/src/i18n/messages/en.json apps/web/src/app/sitemap.ts apps/web/src/components/landing-tools-grid.tsx CLAUDE.md
git commit -m "feat(web): register Resize PDF tool (i18n, sitemap, landing) + CLAUDE.md"
```

---

## Self-Review (autor del plan)

**Cobertura del spec:**
- §3 `computeFitResize` + aspect-preserving `size` branch → Task 1. ✓
- §4 engine `resize`/`setResize`/`canResize` + exportPdf wiring + resetWorkspace → Task 2. ✓
- §5 resize-store + resize-workspace + ResizeControls (presets + scale + original + indicator) → Task 3. ✓
- §6 registration + CLAUDE.md → Task 4. ✓
- §8 tests (computeFitResize; setResize; exportPdf-passes-resize; Plan A size test stays green) → Tasks 1-2. ✓
- §8 smoke → Task 3 Step 5. ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code; UI smoke is an explicit checklist. ✓

**Type consistency:** `ResizeDirective` (pdf-core), `computeFitResize` signature, `resize`/`setResize`/`canResize`, `RESIZE_CAPS`, `PRESETS` (points), `<SingleDocGridWorkspace>` props — all defined where introduced and consumed by exact name. `exportPhase:"processing"` and `exportUsesSelection` exist (C1). ✓

**Regression note:** the `resize` factory field defaults `null`, so merge/rotate/organize/remove/extract/crop pass `undefined` at export → no resize → their behavior and tests are unchanged.

---

## Cierre del cluster

Con Resize, los 6 PDF tools de Plan C quedan completos. Carry-forwards abiertos (no bloqueantes, en memoria): app-wide design-token pass; `/storage` subpath perf-pass; Crop move/resize handles + vista natural de páginas rotadas.
