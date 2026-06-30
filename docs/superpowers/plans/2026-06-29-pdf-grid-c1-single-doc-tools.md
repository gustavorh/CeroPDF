# Single-doc Grid Shell + 4 Simple Tools — Implementation Plan (Plan C1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable single-doc grid workspace shell and the 4 simple PDF tools (Rotate, Organize, Remove pages, Extract pages) on top of the Plan B page-grid engine, with small engine additions.

**Architecture:** Each tool is a `createPageGridStore(config)` instance (single-doc) rendered through one shared `<SingleDocGridWorkspace>` shell that mounts one `<PageGrid>`. Tools differ only by config (capabilities, controls, export semantics). No new pure pdf logic — export goes through Plan A's `buildExportRefs` + `exportMergedPdf`.

**Tech Stack:** TypeScript strict · React 19 · Zustand 5 · Next 15 App Router · Vitest 2.1 (node) · pdfjs/pdf-lib via pdf-core/pdf-render.

## Global Constraints

- **100% client-side.** No new runtime deps, API routes, or env vars.
- **merge must stay behavior-identical.** `merge-store` config gains `exportUsesSelection: true` to preserve its current select-to-subset export.
- All 4 tools are **single-doc** (`multiDoc: false`), PDF input, `exportPhase: "processing"`, `features: {}` (no projectName/optimizeSize).
- **`exportUsesSelection`:** Extract = `true`; Rotate/Organize/Remove = `false`.
- Output filename = `<source-stem>.<suffix>.pdf` (suffixes: rotado / organizado / sin-paginas / extraido).
- Dedicated route + landing card per tool; reuse the `extract` i18n placeholder; **retire the `secure` landing entry**.
- Reuse Plan A helpers (`buildExportRefs`) and Plan B engine (`createPageGridStore`, `<PageGrid>`) — do not recreate.
- **Naming:** `kebab-case.tsx` components, `camelCase.ts` utils. **Code & comments in English.** UI copy in Spanish.
- Limits unchanged: `MAX_FILE_BYTES` (250 MB), `MAX_COMBINED_PAGES` (500).
- Vitest `^2.1.9`, node env. Conventional commits.

## Alcance

**Dentro:** engine additions (`use-page-grid`, `selection-store`, `document-store` UiPhase, `status-strip` label, `merge-store` config), the `<PageGrid>` drag-gating fix, the shared shell + range control, the 4 tools (store + workspace + route each), registration (i18n/sitemap/landing), `CLAUDE.md`.

**Fuera (C2/C3):** Crop (`setPageCrop`, focused-slot, MediaBox/rotation), Resize (`setResize`, control panel), landing mega-menu categorization, the `@ceropdf/pdf-core/storage` subpath perf-pass.

---

### Task 1: Engine + state additions (tested core)

**Files:**
- Modify: `apps/web/src/stores/document-store.ts` (UiPhase union)
- Modify: `apps/web/src/components/status-strip.tsx` (PHASE_LABEL)
- Modify: `apps/web/src/stores/selection-store.ts` (setSelection)
- Modify: `apps/web/src/lib/page-grid/use-page-grid.ts` (rotateAll, exportUsesSelection, single-doc replace)
- Modify: `apps/web/src/stores/merge-store.ts` (exportUsesSelection: true)
- Test (modify): `apps/web/src/lib/page-grid/use-page-grid.test.ts`
- Test (create): `apps/web/src/stores/selection-store.test.ts`

**Interfaces:**
- Produces:
  - `UiPhase` gains `"processing"`.
  - `useSelectionStore` gains `setSelection(ids: string[]): void`.
  - `PageGridConfig` gains `exportUsesSelection: boolean`.
  - `createPageGridStore` state gains `rotateAll(delta: 90 | -90): void`; `addDocumentsFromFiles` replaces when `!multiDoc`; `exportPdf` honors `exportUsesSelection`.

- [ ] **Step 1: Add `"processing"` to `UiPhase`**

In `apps/web/src/stores/document-store.ts`, replace the `UiPhase` union:

```ts
export type UiPhase =
  | "idle"
  | "loading"
  | "parsing"
  | "rendering"
  | "merging"
  | "processing"
  | "export_success"
  | "error";
```

- [ ] **Step 2: Add the `processing` label to `PHASE_LABEL`**

In `apps/web/src/components/status-strip.tsx`, inside the `PHASE_LABEL` object, add after the `merging` line:

```ts
  processing: "Procesando…",
```

- [ ] **Step 3: Write the failing `selection-store` test**

Create `apps/web/src/stores/selection-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { useSelectionStore } from "./selection-store";

beforeEach(() => useSelectionStore.setState({ selectedIds: [], anchorId: null }));

describe("selection-store setSelection", () => {
  it("replaces the selection and anchors on the last id", () => {
    useSelectionStore.getState().setSelection(["a", "b", "c"]);
    expect(useSelectionStore.getState().selectedIds).toEqual(["a", "b", "c"]);
    expect(useSelectionStore.getState().anchorId).toBe("c");
  });

  it("clears the anchor for an empty selection", () => {
    useSelectionStore.setState({ selectedIds: ["x"], anchorId: "x" });
    useSelectionStore.getState().setSelection([]);
    expect(useSelectionStore.getState().selectedIds).toEqual([]);
    expect(useSelectionStore.getState().anchorId).toBeNull();
  });
});
```

- [ ] **Step 4: Run it — expect FAIL** (`setSelection` undefined)

Run: `npm test -w web`
Expected: FAIL — `selectedIds` test errors because `setSelection` is not a function.

- [ ] **Step 5: Add `setSelection` to `selection-store.ts`**

In `apps/web/src/stores/selection-store.ts`, add to the `SelectionState` type (after `clear: () => void;`):

```ts
  /** Replaces the whole selection (e.g. from a range expression). Anchors on the last id. */
  setSelection: (ids: string[]) => void;
```

and add the implementation inside the store (after the `clear:` action):

```ts
  setSelection: (ids) =>
    set({ selectedIds: [...ids], anchorId: ids[ids.length - 1] ?? null }),
```

- [ ] **Step 6: Write the failing `use-page-grid` tests (rotateAll + exportUsesSelection)**

In `apps/web/src/lib/page-grid/use-page-grid.test.ts`: first, add `exportUsesSelection: true` to the existing `CONFIG` object (so the existing selection-based export tests keep their meaning). Then add these tests inside the `describe("createPageGridStore — page ops", ...)` block:

```ts
  it("rotateAll rotates every page by the delta (mod 360)", () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({ pageEntries: [entry({ id: "p1", rotation: 270 }), entry({ id: "p2", rotation: 0 })] });
    useStore.getState().rotateAll(90);
    expect(useStore.getState().pageEntries.map((e) => e.rotation)).toEqual([0, 90]);
  });
```

and this test inside the `describe("createPageGridStore — exportPdf semantics", ...)` block:

```ts
  it("exportUsesSelection=false exports all visible entries, ignoring the selection", async () => {
    const useStore = createPageGridStore({ ...CONFIG, exportUsesSelection: false });
    useStore.setState({
      pageEntries: [entry({ id: "p1", sourcePageIndex: 0 }), entry({ id: "p2", sourcePageIndex: 1 })],
    });
    useSelectionStore.setState({ selectedIds: ["p1"], anchorId: "p1" });
    await useStore.getState().exportPdf();
    const call = exportMergedPdfMock.mock.calls[0] as unknown as [
      Array<{ sourcePageIndex: number }>,
      unknown,
      unknown,
    ];
    expect(call[0].map((r) => r.sourcePageIndex)).toEqual([0, 1]);
  });
```

- [ ] **Step 7: Run — expect FAIL** (`rotateAll` undefined; the false-selection test still filters by selection)

Run: `npm test -w web`
Expected: FAIL — `rotateAll` is not a function; the `exportUsesSelection=false` test gets `[0]` instead of `[0, 1]`.

- [ ] **Step 8: Add `exportUsesSelection` to `PageGridConfig`**

In `apps/web/src/lib/page-grid/use-page-grid.ts`, inside `PageGridConfig`, add after `exportPhase: UiPhase;`:

```ts
  /** When true, a non-empty selection narrows the export to selected pages (Extract, merge). */
  exportUsesSelection: boolean;
```

- [ ] **Step 9: Add `rotateAll` to the state type and the store**

In `PageGridState`, add after `rotatePageCounterClockwise: ...;`:

```ts
  rotateAll: (delta: 90 | -90) => void;
```

In the store object, add after the `rotatePageCounterClockwise` action:

```ts
    rotateAll: (delta) =>
      set((s) => ({
        pageEntries: s.pageEntries.map((e) => ({
          ...e,
          rotation: ((((e.rotation ?? 0) + delta) % 360) + 360) % 360,
        })),
      })),
```

- [ ] **Step 10: Single-doc replace in `addDocumentsFromFiles`**

In the `addDocumentsFromFiles` action, insert at the very top (before `const newDocs = ...`):

```ts
      if (!config.multiDoc && useDocumentStore.getState().documents.length > 0) {
        useDocumentStore.getState().clearAll();
        useSelectionStore.getState().clear();
        set({ pageEntries: [] });
      }
```

- [ ] **Step 11: Honor `exportUsesSelection` in `exportPdf`**

In `exportPdf`, replace this line:

```ts
      const { selectedIds } = useSelectionStore.getState();
```

with:

```ts
      const selectedIds = config.exportUsesSelection
        ? useSelectionStore.getState().selectedIds
        : [];
```

(The following `buildExportRefs(pageEntries, { selectedIds: new Set(selectedIds) })` stays unchanged.)

- [ ] **Step 12: Set `exportUsesSelection: true` in merge config**

In `apps/web/src/stores/merge-store.ts`, inside the `createPageGridStore({ ... })` call, add after `exportPhase: "merging",`:

```ts
  exportUsesSelection: true,
```

- [ ] **Step 13: Run — expect PASS**

Run: `npm test -w web`
Expected: PASS — selection-store (2) + use-page-grid (existing + rotateAll + exportUsesSelection=false). All merge export-semantics tests still green (CONFIG now has `exportUsesSelection: true`).

- [ ] **Step 14: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS (the `Record<UiPhase, string>` PHASE_LABEL now covers `processing`; merge config satisfies the new required field).

```bash
git add apps/web/src/stores/document-store.ts apps/web/src/components/status-strip.tsx apps/web/src/stores/selection-store.ts apps/web/src/stores/selection-store.test.ts apps/web/src/lib/page-grid/use-page-grid.ts apps/web/src/lib/page-grid/use-page-grid.test.ts apps/web/src/stores/merge-store.ts
git commit -m "feat(web): page-grid engine additions for single-doc tools (rotateAll, exportUsesSelection, setSelection, processing phase)"
```

---

### Task 2: Shared shell + `<PageGrid>` drag-gating fix + Rotate tool

**Files:**
- Modify: `apps/web/src/components/page-grid/page-grid.tsx` (drag-gating)
- Create: `apps/web/src/components/page-grid/single-doc-grid-workspace.tsx`
- Create: `apps/web/src/stores/rotate-store.ts`
- Create: `apps/web/src/components/rotate-workspace.tsx`
- Create: `apps/web/src/app/[locale]/rotate/page.tsx`
- Modify: `apps/web/src/i18n/messages/es.json`, `apps/web/src/i18n/messages/en.json` (tools.rotate)
- Modify: `apps/web/src/app/sitemap.ts` (/rotate)
- Modify: `apps/web/src/components/landing-tools-grid.tsx` (rotate entry + retire `secure`)

**Interfaces:**
- Consumes: `createPageGridStore`, `Capabilities`, `UsePageGridStore` (Plan B); `<PageGrid>`.
- Produces:
  - `<SingleDocGridWorkspace store capabilities title description exportLabel controls? />`.
  - `useRotateStore`, `ROTATE_CAPS`.

> No automated test (UI). Verify via typecheck/lint/build + manual smoke of `/rotate`.

- [ ] **Step 1: Fix `<PageGrid>` drag-gating by `canReorder`**

In `apps/web/src/components/page-grid/page-grid.tsx`, inside `ThumbnailGridItem`, replace the `<li ...>`'s `className`, `onDragEnter`, `onDragOver`, and `onDrop` props with:

```tsx
      className={`flex flex-col ${
        capabilities.canReorder
          ? dragging
            ? "cursor-grabbing opacity-[0.85]"
            : "cursor-grab"
          : "cursor-default"
      }`}
      onDragEnter={capabilities.canReorder ? allowDrop : undefined}
      onDragOver={capabilities.canReorder ? allowDrop : undefined}
      onDrop={capabilities.canReorder ? (e) => onDropAtLocalIndex(e, localIndex) : undefined}
```

(Leave `draggable={capabilities.canReorder ?? false}` and `onDragStart`/`onDragEnd` as-is.)

- [ ] **Step 2: Create the shared shell**

Create `apps/web/src/components/page-grid/single-doc-grid-workspace.tsx`:

```tsx
"use client";

import { useCallback } from "react";

import { MAX_FILE_BYTES } from "@ceropdf/pdf-core";
import { Dropzone } from "@ceropdf/ui";

import { useDocumentStore } from "@/stores/document-store";
import type { Capabilities, UsePageGridStore } from "@/lib/page-grid/use-page-grid";

import { ErrorBanner } from "../error-banner";
import { LandingFooterCopy } from "../landing-footer-copy";
import { LandingHeader } from "../landing-header";
import { PageGrid } from "./page-grid";

type Props = {
  store: UsePageGridStore;
  capabilities: Capabilities;
  title: string;
  description: string;
  exportLabel: string;
  controls?: React.ReactNode;
};

export function SingleDocGridWorkspace({
  store: useStore,
  capabilities,
  title,
  description,
  exportLabel,
  controls,
}: Props) {
  const documents = useDocumentStore((s) => s.documents);
  const uiPhase = useDocumentStore((s) => s.uiPhase);
  const addDocumentsFromFiles = useStore((s) => s.addDocumentsFromFiles);
  const resetWorkspace = useStore((s) => s.resetWorkspace);
  const exportPdf = useStore((s) => s.exportPdf);

  const doc = documents[0];
  const busy =
    uiPhase === "loading" || uiPhase === "parsing" || uiPhase === "processing";
  const maxMb = Math.round(MAX_FILE_BYTES / (1024 * 1024));

  const onFiles = useCallback(
    (files: FileList) => {
      void addDocumentsFromFiles(files);
    },
    [addDocumentsFromFiles],
  );

  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgb(240_168_140/0.07),transparent_55%),radial-gradient(ellipse_70%_40%_at_100%_0%,rgb(52_211_153/0.05),transparent_45%)]"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-dvh flex-col">
        <LandingHeader />
        <ErrorBanner />

        {doc ? (
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-headline-md text-balance text-foreground">{title}</h1>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{doc.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => resetWorkspace()}
                    className="inline-flex min-h-10 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-4 text-sm text-muted-foreground transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    Cambiar PDF
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void exportPdf()}
                    className="inline-flex min-h-10 min-w-[120px] items-center justify-center rounded-md bg-gradient-to-b from-primary to-[#c97d62] px-5 text-sm font-semibold text-primary-foreground transition hover:from-primary-hover hover:to-[#dba48e] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busy ? "Procesando…" : exportLabel}
                  </button>
                </div>
              </div>

              {controls ? <div className="mt-4">{controls}</div> : null}

              {uiPhase === "export_success" ? (
                <p className="mt-3 font-mono text-xs text-trust">Listo · descarga iniciada</p>
              ) : null}

              <div className="mt-6 pb-16">
                <PageGrid documentId={doc.id} store={useStore} capabilities={capabilities} />
              </div>
            </div>
          </main>
        ) : (
          <main className="flex min-h-0 flex-1 flex-col">
            <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
              <h1 className="text-display-lg text-balance text-foreground">{title}</h1>
              <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                {description}
              </p>
            </section>
            <section className="mx-auto mt-6 w-full max-w-3xl flex-1 px-4 sm:px-6">
              <Dropzone
                variant="compact"
                onFiles={onFiles}
                multiple={false}
                eyebrow={busy ? "Leyendo…" : "Sube un PDF"}
                title={busy ? "Procesando el PDF…" : "Suelta el PDF o haz clic"}
                hint={`Un solo PDF, hasta ${maxMb} MB. Nada sale del navegador.`}
              />
            </section>
            <LandingFooterCopy />
          </main>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the Rotate store**

Create `apps/web/src/stores/rotate-store.ts`:

```ts
import { createPageGridStore, type Capabilities } from "@/lib/page-grid/use-page-grid";

export const ROTATE_CAPS: Capabilities = { canRotate: true };

export const useRotateStore = createPageGridStore({
  multiDoc: false,
  capabilities: ROTATE_CAPS,
  exportPhase: "processing",
  exportUsesSelection: false,
  buildFilename: (_, docs) =>
    `${docs[0]?.name.replace(/\.pdf$/i, "") ?? "documento"}.rotado.pdf`,
});
```

- [ ] **Step 4: Create the Rotate workspace**

Create `apps/web/src/components/rotate-workspace.tsx`:

```tsx
"use client";

import { ROTATE_CAPS, useRotateStore } from "@/stores/rotate-store";

import { SingleDocGridWorkspace } from "./page-grid/single-doc-grid-workspace";

const btn =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-outline-variant/45 bg-surface-container-low px-3 text-sm text-foreground transition hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function RotateWorkspace() {
  const rotateAll = useRotateStore((s) => s.rotateAll);
  return (
    <SingleDocGridWorkspace
      store={useRotateStore}
      capabilities={ROTATE_CAPS}
      title="Rotar PDF"
      description="Rota páginas individuales o todo el documento de una vez. 100 % en tu navegador; nada se sube."
      exportLabel="Exportar"
      controls={
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-tertiary">Todo el documento:</span>
          <button type="button" className={btn} onClick={() => rotateAll(-90)}>
            Rotar todo ↺
          </button>
          <button type="button" className={btn} onClick={() => rotateAll(90)}>
            Rotar todo ↻
          </button>
        </div>
      }
    />
  );
}
```

- [ ] **Step 5: Create the route**

Create `apps/web/src/app/[locale]/rotate/page.tsx`:

```tsx
import type { Metadata } from "next";

import { RotateWorkspace } from "@/components/rotate-workspace";

export const metadata: Metadata = {
  title: "Rotar PDF — CeroPDF",
  description:
    "Rota páginas de un PDF, una a una o todas a la vez. Gratis y 100 % en tu navegador.",
  alternates: { canonical: "/rotate" },
};

export default function RotatePage() {
  return <RotateWorkspace />;
}
```

- [ ] **Step 6: i18n — add `tools.rotate`**

In `apps/web/src/i18n/messages/es.json`, inside `tools`, add:

```json
    "rotate": {
      "name": "Rotar PDF",
      "description": "Gira páginas individuales o todo el documento y descarga el PDF rotado."
    },
```

In `apps/web/src/i18n/messages/en.json`, inside `tools`, add:

```json
    "rotate": {
      "name": "Rotate PDF",
      "description": "Turn individual pages or the whole document and download the rotated PDF."
    },
```

- [ ] **Step 7: sitemap — add `/rotate`**

In `apps/web/src/app/sitemap.ts`, add `"/rotate",` to the `TOOL_PATHS` array (after `"/edit",`).

- [ ] **Step 8: landing — add the Rotate card + retire `secure`**

In `apps/web/src/components/landing-tools-grid.tsx`:

1. Add `"rotate"` to the `ToolKey` union.
2. Add a `GlyphRotate` component (place it near the other glyph functions):

```tsx
function GlyphRotate() {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 14a9 9 0 1 1-2.64-6.36" />
      <path d="M23 4v5h-5" />
      <rect x="9" y="9" width="10" height="10" rx="1.5" />
    </svg>
  );
}
```

3. In the `TOOLS` array, add (after the `edit` entry):

```tsx
  { key: "rotate", slug: "rotate", status: "available", glyph: <GlyphRotate /> },
```

4. Remove the `secure` entry line:

```tsx
  { key: "secure", status: "coming_soon", glyph: <GlyphLock /> },
```

and delete the now-unused `GlyphLock` function. Remove `"secure"` from the `ToolKey` union.

- [ ] **Step 9: Verify typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS. (`GlyphLock` removed → no unused-var lint error; the `tools.secure` message key is now unused but harmless; leave it in the JSON.)

- [ ] **Step 10: Manual smoke of `/rotate`**

Run `npm run dev`, open `/rotate`: load a PDF → grid renders; per-page rotate buttons work; "Rotar todo ↻/↺" rotates all thumbnails; cursor is NOT grab (canReorder=false); Export downloads `<name>.rotado.pdf`; "Cambiar PDF" resets. Document the result in the task report.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/page-grid/page-grid.tsx apps/web/src/components/page-grid/single-doc-grid-workspace.tsx apps/web/src/stores/rotate-store.ts apps/web/src/components/rotate-workspace.tsx "apps/web/src/app/[locale]/rotate" apps/web/src/i18n/messages/es.json apps/web/src/i18n/messages/en.json apps/web/src/app/sitemap.ts apps/web/src/components/landing-tools-grid.tsx
git commit -m "feat(web): single-doc grid shell + Rotate PDF tool"
```

---

### Task 3: Organize tool

**Files:**
- Create: `apps/web/src/stores/organize-store.ts`
- Create: `apps/web/src/components/organize-workspace.tsx`
- Create: `apps/web/src/app/[locale]/organize/page.tsx`
- Modify: i18n es/en (tools.organize), sitemap (/organize), landing (organize card)

**Interfaces:**
- Consumes: `SingleDocGridWorkspace`, `createPageGridStore`. Produces: `useOrganizeStore`, `ORGANIZE_CAPS`.

> UI tool — verify via typecheck/lint/build + manual smoke.

- [ ] **Step 1: Store**

Create `apps/web/src/stores/organize-store.ts`:

```ts
import { createPageGridStore, type Capabilities } from "@/lib/page-grid/use-page-grid";

export const ORGANIZE_CAPS: Capabilities = {
  canReorder: true,
  canRotate: true,
  canRemove: true,
  canSelect: true,
};

export const useOrganizeStore = createPageGridStore({
  multiDoc: false,
  capabilities: ORGANIZE_CAPS,
  exportPhase: "processing",
  exportUsesSelection: false,
  buildFilename: (_, docs) =>
    `${docs[0]?.name.replace(/\.pdf$/i, "") ?? "documento"}.organizado.pdf`,
});
```

- [ ] **Step 2: Workspace**

Create `apps/web/src/components/organize-workspace.tsx`:

```tsx
"use client";

import { ORGANIZE_CAPS, useOrganizeStore } from "@/stores/organize-store";

import { SingleDocGridWorkspace } from "./page-grid/single-doc-grid-workspace";

export function OrganizeWorkspace() {
  return (
    <SingleDocGridWorkspace
      store={useOrganizeStore}
      capabilities={ORGANIZE_CAPS}
      title="Organizar PDF"
      description="Reordena con arrastrar, rota y elimina páginas, y exporta el documento reorganizado. 100 % en tu navegador."
      exportLabel="Exportar"
    />
  );
}
```

- [ ] **Step 3: Route**

Create `apps/web/src/app/[locale]/organize/page.tsx`:

```tsx
import type { Metadata } from "next";

import { OrganizeWorkspace } from "@/components/organize-workspace";

export const metadata: Metadata = {
  title: "Organizar PDF — CeroPDF",
  description:
    "Reordena, rota y elimina páginas de un PDF y descárgalo reorganizado. 100 % en tu navegador.",
  alternates: { canonical: "/organize" },
};

export default function OrganizePage() {
  return <OrganizeWorkspace />;
}
```

- [ ] **Step 4: i18n**

`es.json` → `tools`:

```json
    "organize": {
      "name": "Organizar PDF",
      "description": "Reordena, rota y elimina páginas, y exporta el PDF reorganizado."
    },
```

`en.json` → `tools`:

```json
    "organize": {
      "name": "Organize PDF",
      "description": "Reorder, rotate, and delete pages, then export the reorganized PDF."
    },
```

- [ ] **Step 5: sitemap** — add `"/organize",` to `TOOL_PATHS`.

- [ ] **Step 6: landing** — add `"organize"` to `ToolKey`, a `GlyphOrganize`:

```tsx
function GlyphOrganize() {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="5" width="8" height="18" rx="1.5" />
      <rect x="16" y="5" width="8" height="18" rx="1.5" />
      <path d="M14 11v6" />
      <path d="M11.5 13.5 14 11l2.5 2.5" />
    </svg>
  );
}
```

and in `TOOLS` (after the `rotate` entry):

```tsx
  { key: "organize", slug: "organize", status: "available", glyph: <GlyphOrganize /> },
```

- [ ] **Step 7: Verify** — `npm run typecheck && npm run lint && npm run build` → PASS.

- [ ] **Step 8: Manual smoke** of `/organize`: load PDF → drag-reorder pages (cursor IS grab here), rotate, delete a page, export `<name>.organizado.pdf`. Document in report.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/stores/organize-store.ts apps/web/src/components/organize-workspace.tsx "apps/web/src/app/[locale]/organize" apps/web/src/i18n/messages/es.json apps/web/src/i18n/messages/en.json apps/web/src/app/sitemap.ts apps/web/src/components/landing-tools-grid.tsx
git commit -m "feat(web): Organize PDF tool"
```

---

### Task 4: PageRangeControl + Remove pages + Extract pages

**Files:**
- Create: `apps/web/src/components/page-grid/page-range-control.tsx`
- Create: `apps/web/src/stores/remove-pages-store.ts`, `apps/web/src/components/remove-pages-workspace.tsx`, `apps/web/src/app/[locale]/remove-pages/page.tsx`
- Create: `apps/web/src/stores/extract-pages-store.ts`, `apps/web/src/components/extract-pages-workspace.tsx`, `apps/web/src/app/[locale]/extract-pages/page.tsx`
- Modify: i18n es/en (tools.removePages), sitemap (/remove-pages, /extract-pages), landing (removePages card + extract → available)

**Interfaces:**
- Consumes: `parseRanges` (`@ceropdf/pdf-core`), `useSelectionStore`, `useDocumentStore`, the tool stores.
- Produces: `<PageRangeControl pageCount onApply applyLabel placeholder />`; the two tool stores/workspaces/routes.

> UI tools — verify via typecheck/lint/build + manual smoke.

- [ ] **Step 1: Create `PageRangeControl`**

Create `apps/web/src/components/page-grid/page-range-control.tsx`:

```tsx
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
```

- [ ] **Step 2: Remove pages — store**

Create `apps/web/src/stores/remove-pages-store.ts`:

```ts
import { createPageGridStore, type Capabilities } from "@/lib/page-grid/use-page-grid";

export const REMOVE_CAPS: Capabilities = { canRemove: true, canSelect: true };

export const useRemovePagesStore = createPageGridStore({
  multiDoc: false,
  capabilities: REMOVE_CAPS,
  exportPhase: "processing",
  exportUsesSelection: false,
  buildFilename: (_, docs) =>
    `${docs[0]?.name.replace(/\.pdf$/i, "") ?? "documento"}.sin-paginas.pdf`,
});
```

- [ ] **Step 3: Remove pages — workspace**

Create `apps/web/src/components/remove-pages-workspace.tsx`:

```tsx
"use client";

import { useDocumentStore } from "@/stores/document-store";
import { useSelectionStore } from "@/stores/selection-store";
import { REMOVE_CAPS, useRemovePagesStore } from "@/stores/remove-pages-store";

import { PageRangeControl } from "./page-grid/page-range-control";
import { SingleDocGridWorkspace } from "./page-grid/single-doc-grid-workspace";

function RemoveControls() {
  const pageEntries = useRemovePagesStore((s) => s.pageEntries);
  const removePageEntry = useRemovePagesStore((s) => s.removePageEntry);
  const selectedIds = useSelectionStore((s) => s.selectedIds);

  const removeByPositions = (pages: number[]) => {
    const ids = pages.map((p) => pageEntries[p - 1]?.id).filter(Boolean) as string[];
    ids.forEach((id) => removePageEntry(id));
  };

  return (
    <div className="flex flex-col gap-3">
      <PageRangeControl
        pageCount={pageEntries.length}
        onApply={removeByPositions}
        applyLabel="Quitar rango"
      />
      <button
        type="button"
        disabled={selectedIds.length === 0}
        onClick={() => selectedIds.forEach((id) => removePageEntry(id))}
        className="inline-flex min-h-9 w-fit items-center justify-center rounded-md border border-destructive/40 bg-destructive-muted px-3 text-sm text-destructive transition hover:bg-destructive/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
      >
        Quitar seleccionadas ({selectedIds.length})
      </button>
    </div>
  );
}

export function RemovePagesWorkspace() {
  const hasDoc = useDocumentStore((s) => s.documents.length > 0);
  return (
    <SingleDocGridWorkspace
      store={useRemovePagesStore}
      capabilities={REMOVE_CAPS}
      title="Quitar páginas"
      description="Elige páginas por rango o selección y quítalas del PDF. 100 % en tu navegador."
      exportLabel="Exportar restantes"
      controls={hasDoc ? <RemoveControls /> : undefined}
    />
  );
}
```

- [ ] **Step 4: Remove pages — route**

Create `apps/web/src/app/[locale]/remove-pages/page.tsx`:

```tsx
import type { Metadata } from "next";

import { RemovePagesWorkspace } from "@/components/remove-pages-workspace";

export const metadata: Metadata = {
  title: "Quitar páginas de un PDF — CeroPDF",
  description:
    "Elimina páginas de un PDF por rango o selección visual y descarga el resto. 100 % en tu navegador.",
  alternates: { canonical: "/remove-pages" },
};

export default function RemovePagesPage() {
  return <RemovePagesWorkspace />;
}
```

- [ ] **Step 5: Extract pages — store**

Create `apps/web/src/stores/extract-pages-store.ts`:

```ts
import { createPageGridStore, type Capabilities } from "@/lib/page-grid/use-page-grid";

export const EXTRACT_CAPS: Capabilities = { canSelect: true };

export const useExtractPagesStore = createPageGridStore({
  multiDoc: false,
  capabilities: EXTRACT_CAPS,
  exportPhase: "processing",
  exportUsesSelection: true,
  buildFilename: (_, docs) =>
    `${docs[0]?.name.replace(/\.pdf$/i, "") ?? "documento"}.extraido.pdf`,
});
```

- [ ] **Step 6: Extract pages — workspace**

Create `apps/web/src/components/extract-pages-workspace.tsx`:

```tsx
"use client";

import { useDocumentStore } from "@/stores/document-store";
import { useSelectionStore } from "@/stores/selection-store";
import { EXTRACT_CAPS, useExtractPagesStore } from "@/stores/extract-pages-store";

import { PageRangeControl } from "./page-grid/page-range-control";
import { SingleDocGridWorkspace } from "./page-grid/single-doc-grid-workspace";

function ExtractControls() {
  const pageEntries = useExtractPagesStore((s) => s.pageEntries);
  const setSelection = useSelectionStore((s) => s.setSelection);
  const clear = useSelectionStore((s) => s.clear);
  const selectedIds = useSelectionStore((s) => s.selectedIds);

  const selectByPositions = (pages: number[]) => {
    const ids = pages.map((p) => pageEntries[p - 1]?.id).filter(Boolean) as string[];
    setSelection(ids);
  };

  return (
    <div className="flex flex-col gap-2">
      <PageRangeControl
        pageCount={pageEntries.length}
        onApply={selectByPositions}
        applyLabel="Seleccionar rango"
      />
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-tertiary">
          {selectedIds.length} página{selectedIds.length === 1 ? "" : "s"} seleccionada
          {selectedIds.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          disabled={selectedIds.length === 0}
          onClick={() => clear()}
          className="font-mono text-xs text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline disabled:opacity-45"
        >
          limpiar
        </button>
      </div>
    </div>
  );
}

export function ExtractPagesWorkspace() {
  const hasDoc = useDocumentStore((s) => s.documents.length > 0);
  return (
    <SingleDocGridWorkspace
      store={useExtractPagesStore}
      capabilities={EXTRACT_CAPS}
      title="Extraer páginas"
      description="Selecciona páginas por rango o clic y genera un PDF nuevo solo con esas. 100 % en tu navegador."
      exportLabel="Extraer seleccionadas"
      controls={hasDoc ? <ExtractControls /> : undefined}
    />
  );
}
```

- [ ] **Step 7: Extract pages — route**

Create `apps/web/src/app/[locale]/extract-pages/page.tsx`:

```tsx
import type { Metadata } from "next";

import { ExtractPagesWorkspace } from "@/components/extract-pages-workspace";

export const metadata: Metadata = {
  title: "Extraer páginas de un PDF — CeroPDF",
  description:
    "Selecciona páginas concretas y genera un PDF nuevo solo con esas. 100 % en tu navegador.",
  alternates: { canonical: "/extract-pages" },
};

export default function ExtractPagesPage() {
  return <ExtractPagesWorkspace />;
}
```

- [ ] **Step 8: i18n — `tools.removePages`** (extract already exists)

`es.json` → `tools`:

```json
    "removePages": {
      "name": "Quitar páginas",
      "description": "Elimina páginas por rango o selección y descarga el resto del PDF."
    },
```

`en.json` → `tools`:

```json
    "removePages": {
      "name": "Remove pages",
      "description": "Delete pages by range or selection and download the rest of the PDF."
    },
```

- [ ] **Step 9: sitemap** — add `"/remove-pages",` and `"/extract-pages",` to `TOOL_PATHS`.

- [ ] **Step 10: landing** — add `"removePages"` to `ToolKey`; add a `GlyphRemovePages`:

```tsx
function GlyphRemovePages() {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="4" width="14" height="18" rx="1.5" />
      <path d="M9 9h6" />
      <path d="M9 13h6" />
      <path d="M16 18h7" />
    </svg>
  );
}
```

In `TOOLS`: add the removePages card, and flip `extract` from `coming_soon` to `available` with its slug. Replace the existing `extract` line:

```tsx
  { key: "extract", status: "coming_soon", glyph: <GlyphExtract /> },
```

with:

```tsx
  { key: "extract", slug: "extract-pages", status: "available", glyph: <GlyphExtract /> },
  { key: "removePages", slug: "remove-pages", status: "available", glyph: <GlyphRemovePages /> },
```

- [ ] **Step 11: Verify** — `npm run typecheck && npm run lint && npm run build` → PASS.

- [ ] **Step 12: Manual smoke** — `/remove-pages`: range "1-2" → those pages gone; select pages + "Quitar seleccionadas" → gone; export `<name>.sin-paginas.pdf` of the rest. `/extract-pages`: range "1,3" selects those; visual clicks select; "Extraer seleccionadas" exports `<name>.extraido.pdf` of only selected; empty selection → export shows the "no hay páginas" error. Document in report.

- [ ] **Step 13: Commit**

```bash
git add apps/web/src/components/page-grid/page-range-control.tsx apps/web/src/stores/remove-pages-store.ts apps/web/src/components/remove-pages-workspace.tsx "apps/web/src/app/[locale]/remove-pages" apps/web/src/stores/extract-pages-store.ts apps/web/src/components/extract-pages-workspace.tsx "apps/web/src/app/[locale]/extract-pages" apps/web/src/i18n/messages/es.json apps/web/src/i18n/messages/en.json apps/web/src/app/sitemap.ts apps/web/src/components/landing-tools-grid.tsx
git commit -m "feat(web): Remove pages + Extract pages tools with range control"
```

---

### Task 5: CLAUDE.md + cross-repo verification

**Files:**
- Modify: `CLAUDE.md` (tool map + "Patrón para añadir herramienta")

- [ ] **Step 1: Update the code map in `CLAUDE.md`**

In the `## Mapa del código` section under `apps/web/src/app/[locale]/`, add lines for the new routes alongside the existing tool routes:

```
│   │   │   ├── rotate/page.tsx       # tool: rotar páginas (client-side, page-grid)
│   │   │   ├── organize/page.tsx     # tool: reordenar/rotar/quitar (client-side, page-grid)
│   │   │   ├── remove-pages/page.tsx # tool: quitar páginas (client-side, page-grid)
│   │   │   ├── extract-pages/page.tsx# tool: extraer páginas (client-side, page-grid)
```

- [ ] **Step 2: Rewrite the "Patrón para añadir herramienta" section**

Replace the body of `## Patrón para añadir una herramienta PDF nueva` with the real page-grid pattern:

```
## Patrón para añadir una herramienta PDF nueva (single-doc, tipo grilla)

1. **Store**: `apps/web/src/stores/<tool>-store.ts` = `createPageGridStore(config)` con
   `multiDoc: false`, `capabilities` (qué controles muestra `<PageGrid>`),
   `exportUsesSelection`, `exportPhase: "processing"`, `buildFilename`. Exporta también `<TOOL>_CAPS`.
2. **Workspace**: `apps/web/src/components/<tool>-workspace.tsx` que renderiza
   `<SingleDocGridWorkspace store={useXStore} capabilities={X_CAPS} title description exportLabel controls? />`.
   Los controles propios del tool (rangos, etc.) van en `controls`.
3. **Ruta**: `apps/web/src/app/[locale]/<slug>/page.tsx` con metadata SEO.
4. **Registro**: `tools.<key>` en `messages/{es,en}.json`, slug en `app/sitemap.ts`, y entrada en `landing-tools-grid.tsx`.
5. **Lógica pura** sólo si hace falta export nuevo: en `packages/pdf-core` (no en componentes).
6. **Invocar `/check-design` y `/check-architecture`** antes de commit.
```

- [ ] **Step 3: Cross-repo verification**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: PASS — web tests now include selection-store (2) + the new use-page-grid cases; pdf-core 19. Build emits 4 new routes (`/rotate`, `/organize`, `/remove-pages`, `/extract-pages`).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document the 4 page-grid tools + update tool pattern"
```

---

## Self-Review (autor del plan)

**Cobertura del spec:**
- §4.1 exportUsesSelection → Task 1 (Steps 8, 11, 12). ✓
- §4.2 rotateAll → Task 1 (Step 9). ✓
- §4.3 single-doc replace → Task 1 (Step 10). ✓
- §4.4 setSelection → Task 1 (Steps 3-5). ✓
- §4.5 UiPhase "processing" + PHASE_LABEL → Task 1 (Steps 1-2). ✓
- §4.6 drag-gating fix → Task 2 (Step 1). ✓
- §3 shell `<SingleDocGridWorkspace>` → Task 2 (Step 2). ✓
- §5 the 4 tools (capabilities/controls/exportUsesSelection/suffix) → Tasks 2-4. ✓
- §5 PageRangeControl + per-tool onApply → Task 4. ✓
- §6 registration (routes/i18n/sitemap/landing, retire secure) → Tasks 2-4. ✓
- §6 CLAUDE.md → Task 5. ✓
- §8 tests (rotateAll, exportUsesSelection, setSelection, merge regression) → Task 1. ✓
- §8 smoke per tool → Tasks 2-4 smoke steps. ✓

**Placeholder scan:** no TBD/TODO; every code step shows complete code; UI tools have explicit smoke checklists (not "test the above"). ✓

**Type consistency:** `exportUsesSelection`, `rotateAll(delta: 90|-90)`, `setSelection(ids)`, `Capabilities`, `<SingleDocGridWorkspace>` props, the `*_CAPS` consts, and `<PageRangeControl>` props are defined where introduced and consumed by exact name downstream. `exportPhase: "processing"` matches the union added in Task 1. ✓

**Note:** UI tasks (2-4) carry manual smoke instead of automated tests — the project has no DOM test runner, consistent with merge/split/edit. The tested core (engine) is Task 1.

---

## Plan siguiente — C2 (Crop)

`setPageCrop(entryId, rect|null)` + `canCrop` + `<PageGrid>` focused-slot + crop-rectangle drawing + non-zero MediaBox-origin handling + rotation↔crop preview mapping; 1 tool + registration.
