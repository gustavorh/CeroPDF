# Page-grid Engine + merge Migration — Implementation Plan (Plan B of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalizar `merge-store` en un store-factory `createPageGridStore(config)` y `PageThumbnailsPanel` en un `<PageGrid>` (grilla de un documento), y migrar el tool `merge` a consumir ambos sin cambio observable.

**Architecture:** El factory expone la **misma superficie de nombres** (acciones/estado) que `merge-store` hoy, así los componentes de merge que solo leen del store no se tocan. `<PageGrid>` recibe su store por prop. `merge` compone N `<PageGrid>` (uno por PDF); los tools de Plan C compondrán 1. La capa pura (Plan A: `exportMergedPdf`, `build-export.ts`) no cambia.

**Tech Stack:** TypeScript strict · React 19 · Zustand 5 · Vitest 2.1 (node env) · pdf-lib / pdfjs (vía pdf-core/pdf-render).

## Global Constraints

- **100% client-side.** No se añaden dependencias de runtime, rutas API ni env vars.
- **Preservar la superficie de nombres de `merge-store`**: las acciones/estado que la UI consume mantienen exactamente sus nombres, para que `canvas-header`, `canvas-bottom-pill`, `export-flow-modal`, `status-strip`, `workspace-dropzone` y `merge-workspace` **no cambien**.
- **merge sin cambio observable**: mismas páginas/orden/rotación/tamaño al exportar; misma UI.
- **`exportPhase` de merge = `"merging"`** (preserva el keying de su modal/strip). Sin cambios a la unión `UiPhase`.
- **Soltar código muerto:** `expandedDocumentIds`, `toggleExpanded`, `clearSelection` (sin consumidor).
- **Usar los helpers puros de Plan A** (`buildExportRefs`, `reorderInDocument`, `regroupByDocumentOrder` en `@/lib/page-grid/build-export`) — no recrear copias.
- **Vitest `^2.1.9`**, tests en entorno node.
- **Naming:** `kebab-case.tsx` componentes, `camelCase.ts` utils. **Código y comentarios en inglés.** Copy UI en español.
- **Límites:** `MAX_FILE_BYTES` (250 MB), `MAX_COMBINED_PAGES` (500) — sin cambios.
- Commits conventional cortos.

## Alcance

**Dentro:** `lib/trigger-download.ts`, `lib/page-grid/use-page-grid.ts` (factory + tests), `components/page-grid/page-grid.tsx` + `page-thumbnail-tile.tsx`, migración de merge (`merge-store.ts`, `canvas-documents.tsx`, borrar `page-thumbnails-panel.tsx`).

**Fuera (Plan C):** crop/resize (estado `setPageCrop`/`setResize`, UI, *focused slot*, origen del MediaBox), los 6 tools, registro, `CLAUDE.md`. Migrar `split-workspace`/`edit-store` al `trigger-download` compartido es opcional (no en este plan).

---

### Task 1: Extraer `lib/trigger-download.ts` (DRY)

**Files:**
- Create: `apps/web/src/lib/trigger-download.ts`

**Interfaces:**
- Produces: `triggerDownload(blob: Blob, filename: string): void` — crea un `<a download>` temporal, hace click y revoca el object URL.

> Sin unit test: es glue de DOM irreducible (createElement/createObjectURL/click). Se verifica vía typecheck/build (Task 4) y el smoke de merge (Task 3). El factory lo mockea en sus tests.

- [ ] **Step 1: Crear el archivo**

```ts
/** Triggers a browser download for an in-memory blob via a temporary anchor. */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/trigger-download.ts
git commit -m "refactor(web): extract shared triggerDownload util"
```

---

### Task 2: Store-factory `createPageGridStore` + tests

**Files:**
- Create: `apps/web/src/lib/page-grid/use-page-grid.ts`
- Test (create): `apps/web/src/lib/page-grid/use-page-grid.test.ts`

**Interfaces:**
- Consumes: `buildExportRefs`, `reorderInDocument`, `regroupByDocumentOrder` (de `@/lib/page-grid/build-export`); `triggerDownload` (de `@/lib/trigger-download`); `exportMergedPdf`, `readDocumentBytes` (de `@ceropdf/pdf-core`); `useDocumentStore`/`UiPhase`, `useSelectionStore`; `PageEntry`, `WorkspaceDocument`.
- Produces:
  - `type Capabilities = { canReorder?: boolean; canRotate?: boolean; canHide?: boolean; canRemove?: boolean; canSelect?: boolean }`.
  - `type PageGridConfig = { multiDoc: boolean; capabilities: Capabilities; features?: { projectName?: boolean; optimizeSize?: boolean }; exportPhase: UiPhase; buildFilename: (projectName: string | null, docs: WorkspaceDocument[]) => string; defaultProjectName?: (docs: WorkspaceDocument[]) => string }`.
  - `createPageGridStore(config: PageGridConfig)` → zustand hook con state `{ pageEntries, projectName, optimizeSize }` y acciones `addDocumentsFromFiles, removeDocument, reorderDocuments, reorderPageEntriesInDocument, togglePageHidden, removePageEntry, rotatePageClockwise, rotatePageCounterClockwise, selectPageEntry, setProjectName, setOptimizeSize, resetWorkspace, exportPdf`.
  - `type UsePageGridStore = ReturnType<typeof createPageGridStore>`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/web/src/lib/page-grid/use-page-grid.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ceropdf/pdf-render", () => ({
  invalidatePdfJsDocument: vi.fn(),
  clearPdfJsDocumentCache: vi.fn(),
}));

const exportMergedPdfMock = vi.fn(async () => new Uint8Array());
vi.mock("@ceropdf/pdf-core", async (orig) => ({
  ...(await orig<typeof import("@ceropdf/pdf-core")>()),
  exportMergedPdf: exportMergedPdfMock,
}));

vi.mock("@/lib/trigger-download", () => ({ triggerDownload: vi.fn() }));

import { useDocumentStore } from "@/stores/document-store";
import { useSelectionStore } from "@/stores/selection-store";
import type { PageEntry } from "@/types/workspace";

import { createPageGridStore, type PageGridConfig } from "./use-page-grid";

const CONFIG: PageGridConfig = {
  multiDoc: true,
  capabilities: { canReorder: true, canRotate: true, canHide: true, canRemove: true, canSelect: true },
  features: { projectName: true, optimizeSize: true },
  exportPhase: "merging",
  buildFilename: () => "out.pdf",
};

function entry(p: Partial<PageEntry> & { id: string }): PageEntry {
  return { documentId: "d1", sourcePageIndex: 0, hidden: false, rotation: 0, ...p };
}

beforeEach(() => {
  exportMergedPdfMock.mockClear();
  useSelectionStore.setState({ selectedIds: [], anchorId: null });
  useDocumentStore.setState({ documents: [], uiPhase: "idle", lastError: null });
});

describe("createPageGridStore — page ops", () => {
  it("rotates a page clockwise", () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({ pageEntries: [entry({ id: "p1" })] });
    useStore.getState().rotatePageClockwise("p1");
    expect(useStore.getState().pageEntries[0].rotation).toBe(90);
  });

  it("toggles a page hidden", () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({ pageEntries: [entry({ id: "p1" })] });
    useStore.getState().togglePageHidden("p1");
    expect(useStore.getState().pageEntries[0].hidden).toBe(true);
  });

  it("removes a page entry and prunes the selection", () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({ pageEntries: [entry({ id: "p1" }), entry({ id: "p2", sourcePageIndex: 1 })] });
    useSelectionStore.setState({ selectedIds: ["p1", "p2"], anchorId: "p1" });
    useStore.getState().removePageEntry("p1");
    expect(useStore.getState().pageEntries.map((e) => e.id)).toEqual(["p2"]);
    expect(useSelectionStore.getState().selectedIds).toEqual(["p2"]);
  });
});

describe("createPageGridStore — exportPdf semantics", () => {
  it("exports visible entries in order, carrying rotation, with optimizeSize", async () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({
      pageEntries: [
        entry({ id: "p1", sourcePageIndex: 0, rotation: 90 }),
        entry({ id: "p2", sourcePageIndex: 1, hidden: true }),
        entry({ id: "p3", sourcePageIndex: 2 }),
      ],
      optimizeSize: true,
    });
    await useStore.getState().exportPdf();
    expect(exportMergedPdfMock).toHaveBeenCalledTimes(1);
    const call = exportMergedPdfMock.mock.calls[0] as unknown as [
      Array<{ sourcePageIndex: number; rotation: number }>,
      unknown,
      { optimizeSize: boolean },
    ];
    expect(call[0].map((r) => r.sourcePageIndex)).toEqual([0, 2]);
    expect(call[0][0].rotation).toBe(90);
    expect(call[2]).toEqual({ optimizeSize: true });
  });

  it("exports only selected entries when a selection exists", async () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({
      pageEntries: [
        entry({ id: "p1", sourcePageIndex: 0 }),
        entry({ id: "p2", sourcePageIndex: 1 }),
        entry({ id: "p3", sourcePageIndex: 2 }),
      ],
    });
    useSelectionStore.setState({ selectedIds: ["p1", "p3"], anchorId: "p1" });
    await useStore.getState().exportPdf();
    const call = exportMergedPdfMock.mock.calls[0] as unknown as [
      Array<{ sourcePageIndex: number }>,
      unknown,
      unknown,
    ];
    expect(call[0].map((r) => r.sourcePageIndex)).toEqual([0, 2]);
  });

  it("blocks export and sets an error when nothing is visible", async () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({ pageEntries: [entry({ id: "p1", hidden: true })] });
    await useStore.getState().exportPdf();
    expect(exportMergedPdfMock).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().lastError ?? "").toMatch(/No hay páginas/);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm test -w web`
Expected: FAIL con "Cannot find module './use-page-grid'".

- [ ] **Step 3: Implementar el factory**

Crear `apps/web/src/lib/page-grid/use-page-grid.ts`:

```ts
import { create } from "zustand";

import { exportMergedPdf, readDocumentBytes } from "@ceropdf/pdf-core";

import { triggerDownload } from "@/lib/trigger-download";
import {
  buildExportRefs,
  regroupByDocumentOrder,
  reorderInDocument,
} from "@/lib/page-grid/build-export";
import { useDocumentStore, type UiPhase } from "@/stores/document-store";
import { useSelectionStore } from "@/stores/selection-store";
import type { PageEntry, WorkspaceDocument } from "@/types/workspace";

export type Capabilities = {
  canReorder?: boolean;
  canRotate?: boolean;
  canHide?: boolean;
  canRemove?: boolean;
  canSelect?: boolean;
};

export type PageGridConfig = {
  multiDoc: boolean;
  capabilities: Capabilities;
  features?: { projectName?: boolean; optimizeSize?: boolean };
  exportPhase: UiPhase;
  buildFilename: (projectName: string | null, docs: WorkspaceDocument[]) => string;
  defaultProjectName?: (docs: WorkspaceDocument[]) => string;
};

type PageGridState = {
  pageEntries: PageEntry[];
  projectName: string | null;
  optimizeSize: boolean;

  addDocumentsFromFiles: (files: FileList | File[]) => Promise<void>;
  removeDocument: (id: string) => void;
  reorderDocuments: (fromIndex: number, toIndex: number) => void;
  reorderPageEntriesInDocument: (
    documentId: string,
    fromLocalIndex: number,
    toLocalIndex: number,
  ) => void;
  togglePageHidden: (entryId: string) => void;
  removePageEntry: (entryId: string) => void;
  rotatePageClockwise: (entryId: string) => void;
  rotatePageCounterClockwise: (entryId: string) => void;
  selectPageEntry: (entryId: string, options: { shiftKey: boolean }) => void;
  setProjectName: (name: string) => void;
  setOptimizeSize: (value: boolean) => void;
  resetWorkspace: () => void;
  exportPdf: () => Promise<void>;
};

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function buildPageEntries(documentId: string, pageCount: number): PageEntry[] {
  const out: PageEntry[] = [];
  for (let i = 0; i < pageCount; i++) {
    out.push({ id: newId(), documentId, sourcePageIndex: i, hidden: false, rotation: 0 });
  }
  return out;
}

function pruneSelection(pageEntries: PageEntry[]): void {
  useSelectionStore.getState().pruneTo(new Set(pageEntries.map((e) => e.id)));
}

export function createPageGridStore(config: PageGridConfig) {
  return create<PageGridState>()((set, get) => ({
    pageEntries: [],
    projectName: null,
    optimizeSize: false,

    addDocumentsFromFiles: async (files) => {
      const newDocs = await useDocumentStore.getState().addDocumentsFromFiles(files);
      if (newDocs.length === 0) return;
      const newEntries = newDocs.flatMap((d) => buildPageEntries(d.id, d.pageCount));
      set((s) => {
        const allDocs = [...useDocumentStore.getState().documents];
        const projectName =
          config.features?.projectName
            ? (s.projectName ?? config.defaultProjectName?.(allDocs) ?? null)
            : s.projectName;
        return { pageEntries: [...s.pageEntries, ...newEntries], projectName };
      });
    },

    removeDocument: (id) => {
      useDocumentStore.getState().removeDocument(id);
      set((s) => ({ pageEntries: s.pageEntries.filter((e) => e.documentId !== id) }));
      pruneSelection(get().pageEntries);
    },

    reorderDocuments: (fromIndex, toIndex) => {
      const { documents } = useDocumentStore.getState();
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= documents.length ||
        toIndex >= documents.length
      ) {
        return;
      }
      const copy = [...documents];
      const [item] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, item);
      const newOrderIds = copy.map((d) => d.id);
      useDocumentStore.setState({ documents: copy });
      set((s) => ({ pageEntries: regroupByDocumentOrder(s.pageEntries, newOrderIds) }));
    },

    reorderPageEntriesInDocument: (documentId, fromLocalIndex, toLocalIndex) =>
      set((s) => ({
        pageEntries: reorderInDocument(s.pageEntries, documentId, fromLocalIndex, toLocalIndex),
      })),

    togglePageHidden: (entryId) =>
      set((s) => ({
        pageEntries: s.pageEntries.map((e) =>
          e.id === entryId ? { ...e, hidden: !e.hidden } : e,
        ),
      })),

    removePageEntry: (entryId) => {
      set((s) => ({ pageEntries: s.pageEntries.filter((e) => e.id !== entryId) }));
      pruneSelection(get().pageEntries);
    },

    rotatePageClockwise: (entryId) =>
      set((s) => ({
        pageEntries: s.pageEntries.map((e) =>
          e.id === entryId ? { ...e, rotation: ((e.rotation ?? 0) + 90) % 360 } : e,
        ),
      })),

    rotatePageCounterClockwise: (entryId) =>
      set((s) => ({
        pageEntries: s.pageEntries.map((e) =>
          e.id === entryId ? { ...e, rotation: ((e.rotation ?? 0) - 90 + 360) % 360 } : e,
        ),
      })),

    selectPageEntry: (entryId, { shiftKey }) => {
      const orderedIds = get().pageEntries.map((e) => e.id);
      useSelectionStore.getState().select(entryId, orderedIds, { shiftKey });
    },

    setProjectName: (name) => set({ projectName: name.trim() || null }),
    setOptimizeSize: (optimizeSize) => set({ optimizeSize }),

    resetWorkspace: () => {
      useDocumentStore.getState().clearAll();
      useSelectionStore.getState().clear();
      set({ pageEntries: [], projectName: null, optimizeSize: false });
    },

    exportPdf: async () => {
      const { pageEntries, optimizeSize, projectName } = get();
      const { documents, setUiPhase, setError } = useDocumentStore.getState();
      const { selectedIds } = useSelectionStore.getState();

      const refs = buildExportRefs(pageEntries, { selectedIds: new Set(selectedIds) });
      if (refs.length === 0) {
        setError(
          "No hay páginas para exportar (todas excluidas o la selección no coincide).",
        );
        return;
      }

      setUiPhase(config.exportPhase);
      useDocumentStore.getState().clearError();

      try {
        const docsById = new Map(documents.map((d) => [d.id, d]));
        const pdfBytes = await exportMergedPdf(
          refs,
          (id) => {
            const doc = docsById.get(id);
            return doc ? readDocumentBytes(doc.backing) : undefined;
          },
          { optimizeSize: config.features?.optimizeSize ? optimizeSize : false },
        );
        const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
        triggerDownload(blob, config.buildFilename(projectName, documents));
        useDocumentStore.getState().setUiPhase("export_success");
        useSelectionStore.getState().clear();
      } catch (err) {
        console.error(err);
        setUiPhase("error");
        setError(
          err instanceof Error ? err.message : "No se pudo generar el PDF de salida.",
        );
      }
    },
  }));
}

export type UsePageGridStore = ReturnType<typeof createPageGridStore>;
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npm test -w web`
Expected: PASS — los 6 nuevos de `use-page-grid.test.ts` + los 7 de `build-export.test.ts` (13 en web).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/page-grid/use-page-grid.ts apps/web/src/lib/page-grid/use-page-grid.test.ts
git commit -m "feat(web): createPageGridStore factory generalizing merge-store"
```

---

### Task 3: `<PageGrid>` + migrar merge al factory

**Files:**
- Create: `apps/web/src/components/page-grid/page-thumbnail-tile.tsx`
- Create: `apps/web/src/components/page-grid/page-grid.tsx`
- Rewrite: `apps/web/src/stores/merge-store.ts`
- Modify: `apps/web/src/components/canvas-documents.tsx`
- Delete: `apps/web/src/components/page-thumbnails-panel.tsx`

**Interfaces:**
- Consumes: `createPageGridStore`, `Capabilities`, `UsePageGridStore` (Task 2); `useDocumentStore`, `useSelectionStore`.
- Produces:
  - `<PageThumbnailTile entry store capabilities selected documentId bytes />`.
  - `<PageGrid documentId={string} store={UsePageGridStore} capabilities={Capabilities} />`.
  - `useMergeStore` (ahora `createPageGridStore(MERGE_CONFIG)`), `MERGE_CAPS: Capabilities`.

> Sin unit test (es UI). Verificación: typecheck/lint/build + el smoke manual de regresión de merge (Step 7).

- [ ] **Step 1: Crear `page-thumbnail-tile.tsx` (generalizado desde `page-thumbnails-panel.tsx`)**

Copiar el tile y los iconos desde `apps/web/src/components/page-thumbnails-panel.tsx` (las funciones `IconTrash`, `IconRotateCw`, `IconEyeOff`, `IconEye`, `IconRotateCcw` y `PageThumbnailTile`) a un nuevo archivo `apps/web/src/components/page-grid/page-thumbnail-tile.tsx`, aplicando EXACTAMENTE estas transformaciones:

1. Cambiar el tipo de props a:
   ```tsx
   import type { UsePageGridStore, Capabilities } from "@/lib/page-grid/use-page-grid";
   type PageThumbnailTileProps = {
     documentId: string;
     bytes: ArrayBuffer;
     entry: PageEntry;
     selected: boolean;
     store: UsePageGridStore;
     capabilities: Capabilities;
   };
   ```
2. Quitar `import { useMergeStore } from "@/stores/merge-store";`. Dentro de `PageThumbnailTile`, reemplazar las 5 líneas que leen acciones de `useMergeStore((s) => s.X)` por lecturas del store inyectado, aliasado:
   ```tsx
   export function PageThumbnailTile({ documentId, bytes, entry, selected, store: useStore, capabilities }: PageThumbnailTileProps) {
     const selectPageEntry = useStore((s) => s.selectPageEntry);
     const removePageEntry = useStore((s) => s.removePageEntry);
     const togglePageHidden = useStore((s) => s.togglePageHidden);
     const rotatePageClockwise = useStore((s) => s.rotatePageClockwise);
     const rotatePageCounterClockwise = useStore((s) => s.rotatePageCounterClockwise);
     // …resto idéntico (refs, IntersectionObserver, render effect)…
   ```
3. Gating por capabilities en el JSX de los botones de acción (el bloque `pointer-events-auto … p-1`):
   - Envolver los dos botones de rotación (ccw + cw) en `{capabilities.canRotate && (<>…</>)}`.
   - Envolver el botón de excluir/incluir (eye/eyeOff) en `{capabilities.canHide && (…)}`.
   - Envolver el botón de papelera (trash) en `{capabilities.canRemove && (…)}`.
   - El overlay de selección (el `<button … onClick={(e) => selectPageEntry(...)}>` que cubre el canvas) y el botón de pie "Página N": envolver el `onClick` para que solo seleccione si `capabilities.canSelect` — concretamente cambiar ambos `onClick` a:
     ```tsx
     onClick={(e) => { if (capabilities.canSelect) selectPageEntry(entry.id, { shiftKey: e.shiftKey }); }}
     ```
4. `import { useDocumentStore } from "@/stores/document-store";` se conserva (usado por `beginThumbnailRender`/`endThumbnailRender`). Conservar `import type { PageEntry } from "@/types/workspace";` y los imports de `@ceropdf/pdf-core` (`readDocumentBytes` ya NO se usa aquí — se usaba en el panel, no en el tile; verificar y quitar si no se referencia) y `@ceropdf/pdf-render`.

- [ ] **Step 2: Crear `page-grid.tsx` (generalizado desde `page-thumbnails-panel.tsx`)**

Crear `apps/web/src/components/page-grid/page-grid.tsx` con `ThumbnailGridItem` + el componente de panel renombrado a `PageGrid`, partiendo del original (`PageThumbnailsPanel` + `ThumbnailGridItem`) con estas transformaciones:

1. Props del componente principal:
   ```tsx
   import type { UsePageGridStore, Capabilities } from "@/lib/page-grid/use-page-grid";
   import { PageThumbnailTile } from "./page-thumbnail-tile";
   type PageGridProps = {
     documentId: string;
     store: UsePageGridStore;
     capabilities: Capabilities;
   };
   export function PageGrid({ documentId, store: useStore, capabilities }: PageGridProps) {
   ```
2. Reemplazar las lecturas de `useMergeStore` por el store inyectado:
   ```tsx
   const documents = useDocumentStore((s) => s.documents);     // se conserva (doc store compartido)
   const pageEntries = useStore((s) => s.pageEntries);
   const selectedPageIds = useSelectionStore((s) => s.selectedIds); // se conserva (selección compartida)
   const reorderPageEntriesInDocument = useStore((s) => s.reorderPageEntriesInDocument);
   ```
   Quitar `import { useMergeStore } from "@/stores/merge-store";`. Conservar `useDocumentStore`, `useSelectionStore`, `readDocumentBytes`, los helpers de `pdf-render` y el efecto que carga `bytes`.
3. `ThumbnailGridItem` gana `store` + `capabilities` en sus props y los reenvía a `PageThumbnailTile`. Además el `<li draggable>` solo debe ser draggable si `capabilities.canReorder` — cambiar `draggable` por `draggable={capabilities.canReorder ?? false}` y dejar los handlers `onDragStart/onDrop` tal cual (no se disparan si no es draggable).
4. En el `.map`, pasar `store={useStore}` y `capabilities={capabilities}` a cada `<ThumbnailGridItem>`, que a su vez los pasa a `<PageThumbnailTile>`.

- [ ] **Step 3: Reescribir `merge-store.ts` como instancia del factory**

Reemplazar TODO el contenido de `apps/web/src/stores/merge-store.ts` por:

```ts
import { buildExportDownloadFilename, defaultProjectDisplayName } from "@/lib/project-display-name";
import {
  createPageGridStore,
  type Capabilities,
} from "@/lib/page-grid/use-page-grid";

export const MERGE_CAPS: Capabilities = {
  canReorder: true,
  canRotate: true,
  canHide: true,
  canRemove: true,
  canSelect: true,
};

export const useMergeStore = createPageGridStore({
  multiDoc: true,
  capabilities: MERGE_CAPS,
  features: { projectName: true, optimizeSize: true },
  exportPhase: "merging",
  buildFilename: buildExportDownloadFilename,
  defaultProjectName: defaultProjectDisplayName,
});
```

> Firmas confirmadas en `@/lib/project-display-name`: `buildExportDownloadFilename(projectName: string | null, documents: WorkspaceDocument[]): string` y `defaultProjectDisplayName(documents: WorkspaceDocument[]): string` — cuadran exactamente con `config.buildFilename` y `config.defaultProjectName`, así que se pasan directo (sin lambda).

- [ ] **Step 4: Actualizar `canvas-documents.tsx` para usar `<PageGrid>`**

En `apps/web/src/components/canvas-documents.tsx`:
- Cambiar el import `import { PageThumbnailsPanel } from "./page-thumbnails-panel";` por:
  ```tsx
  import { PageGrid } from "./page-grid/page-grid";
  import { useMergeStore, MERGE_CAPS } from "@/stores/merge-store";
  ```
  (Ya importa `useMergeStore` para `reorderDocuments`/`removeDocument`; añadir `MERGE_CAPS` a ese import existente y borrar el de `PageThumbnailsPanel`.)
- Cambiar `<PageThumbnailsPanel documentId={doc.id} />` por:
  ```tsx
  <PageGrid documentId={doc.id} store={useMergeStore} capabilities={MERGE_CAPS} />
  ```

- [ ] **Step 5: Borrar `page-thumbnails-panel.tsx`**

```bash
git rm apps/web/src/components/page-thumbnails-panel.tsx
```

- [ ] **Step 6: Verificar typecheck + lint + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS. Si `typecheck` marca un mismatch en la firma de `buildExportDownloadFilename`/`defaultProjectDisplayName`, ajustar la lambda en el config (Step 3) hasta que cuadre.

- [ ] **Step 7: Smoke manual de regresión de merge**

Run: `npm run dev` y abrir `/merge`. Verificar contra el comportamiento de `main`:
1. Cargar 2 PDFs → aparecen 2 secciones de documento con miniaturas.
2. Arrastrar la cabecera de un documento para reordenarlo → el orden de páginas se reagrupa.
3. Arrastrar una miniatura dentro de un doc → cambia el orden local.
4. Rotar una página (cw/ccw) → la miniatura rota.
5. Excluir/incluir una página → opacidad y exclusión del export.
6. Seleccionar páginas (shift+clic rango) → solo esas se exportan.
7. Toggle "Optimizar tamaño"; renombrar el proyecto.
8. **Exportar** → el PDF descargado tiene las mismas páginas/orden/rotación que el merge de `main`.
9. "Añadir más PDFs"; "Quitar PDF"; "Volver a empezar" (reset).

Documentar el resultado del smoke (qué se probó y el resultado) en el reporte de la tarea.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/page-grid apps/web/src/stores/merge-store.ts apps/web/src/components/canvas-documents.tsx
git rm apps/web/src/components/page-thumbnails-panel.tsx
git commit -m "feat(web): migrate merge to page-grid engine (<PageGrid> + factory)"
```

---

### Task 4: Verificación cruzada del repo

**Files:** ninguno nuevo — corre las verificaciones del repo completo.

- [ ] **Step 1: Typecheck de todos los workspaces**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 2: Tests de todos los workspaces**

Run: `npm test`
Expected: PASS — web: 13 (7 build-export + 6 use-page-grid); pdf-core: 19. Total 32.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS (sin warnings nuevos; en particular `react-hooks/rules-of-hooks` debe pasar con el alias `useStore`).

- [ ] **Step 4: Build standalone**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit (si hubo ajustes)**

Si los pasos anteriores requirieron arreglos:

```bash
git add -A
git commit -m "chore: ajustes de typecheck/lint tras la migración de merge"
```

---

## Self-Review (autor del plan)

**Cobertura del spec:**
- §9 `lib/trigger-download.ts` → Task 1. ✓
- §4 factory `createPageGridStore` (config, acciones, exportPdf, drop de código muerto, helpers de Plan A) → Task 2. ✓
- §5 `<PageGrid>` (props, inyección de store, gating por capabilities) → Task 3 Steps 1-2. ✓
- §6 migración de merge (3 archivos cambian, el resto no, `page-thumbnails-panel` borrado) → Task 3 Steps 3-5. ✓
- §8 tests del factory (mocks de pd-render/pd-core/trigger-download; semántica de export) → Task 2. ✓
- §8 smoke de merge → Task 3 Step 7. ✓
- §2 carry-forward #1 (usar `regroupByDocumentOrder`/`reorderInDocument` compartidos) → Task 2 (factory los importa). ✓
- §11 verificación repo → Task 4. ✓
- Crop/resize, focused slot, 6 tools → fuera de alcance (Plan C). ✓

**Escaneo de placeholders:** sin TBD/TODO; los pasos de código muestran código completo; las transformaciones de UI (Task 3) son precisas sobre el archivo fuente in-repo (no "similar a"). ✓

**Consistencia de tipos:** `Capabilities`/`PageGridConfig`/`UsePageGridStore`/`createPageGridStore` definidos en Task 2 y consumidos por nombre exacto en Task 3. `MERGE_CAPS`/`useMergeStore` producidos en Task 3 Step 3 y consumidos en Step 4. Firmas de acciones idénticas a las de `merge-store` original (preservación de superficie). ✓

**Firmas de filename:** confirmadas — `buildExportDownloadFilename(projectName, docs)` y `defaultProjectDisplayName(docs)` cuadran exactamente con la config; se pasan directo (sin lambda). Resuelto en el Step 3.

---

## Plan siguiente — Plan C

Crop/resize (estado `setPageCrop`/`setResize`, *focused slot* de `<PageGrid>`, capabilities `canCrop`/`canResize`, origen del MediaBox) + los 6 tools de grilla con su registro (rutas/i18n/sitemap/landing) + `CLAUDE.md`.
