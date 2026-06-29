# Spec — Page-grid store engine + `<PageGrid>` + merge migration (Plan B)

- **Fecha:** 2026-06-29
- **Estado:** Aprobado (diseño) — pendiente de plan de implementación
- **Cluster:** PDF tools — **Plan B de 3** (sigue a Plan A, ya en `main`)
- **Este spec cubre:** el store-factory `use-page-grid`, el componente `<PageGrid>` (grilla de un documento), y migrar `merge` a consumir ambos sin cambio observable
- **Predecesor:** `docs/superpowers/specs/2026-06-26-pdf-grid-engine-and-6-tools-design.md` (visión global) + Plan A entregado (pdf-core `crop`/`resize`, `build-export.ts`, Vitest en `apps/web`)
- **Follow-up (Plan C):** crop/resize (estado, acciones, UI, *focused slot*) + los 6 tools de grilla + registro + `CLAUDE.md`

---

## 1. Contexto

Plan A construyó la capa pura: `exportMergedPdf` con `crop`/`resize` opcionales y los helpers puros `build-export.ts` (`buildExportRefs`, `reorderInDocument`, `regroupByDocumentOrder`), más el primer runner de Vitest en `apps/web` y `PageEntry.crop`.

Plan B construye el **motor de estado y UI** sobre esa base y lo prueba con su primer y más exigente consumidor: el tool **merge**, que ya existe en producción. La arquitectura global elegida es **generalizar `merge` en un motor compartido** (máximo DRY); Plan B es donde esa generalización ocurre de verdad.

`merge` es genuinamente **multi-documento**: `CanvasDocuments` renderiza una sección por PDF (con reorder de documentos) y dentro cada uno su grilla de miniaturas. Los 6 tools de Plan C son single-doc. El motor debe servir a ambos.

### Decisiones tomadas (brainstorming Plan B)

1. **Alcance:** Plan B incluye el store-factory **+ `<PageGrid>` + migrar merge**. Crop/resize y los tools se difieren a Plan C.
2. **Estrategia de UI: unificar.** `<PageGrid>` es la grilla de **un documento** (el `PageThumbnailsPanel` de hoy, generalizado). `merge` compone **N** (uno por PDF); un tool single-doc compone **1**. Así `<PageGrid>` queda ejercitado por la propia migración de merge (sin componente huérfano).

### Hallazgos de la exploración

- Superficie de `merge-store` que la UI consume: `addDocumentsFromFiles`, `removeDocument`, `reorderDocuments`, `reorderPageEntriesInDocument`, `togglePageHidden`, `removePageEntry`, `rotatePageClockwise/CounterClockwise`, `selectPageEntry`, `setProjectName`, `setOptimizeSize`, `exportPdf`, `resetWorkspace` + estado `pageEntries`/`projectName`/`optimizeSize`.
- **Código muerto confirmado** (solo referenciado dentro de `merge-store.ts`, sin consumidor de UI): `expandedDocumentIds`, `toggleExpanded`, `clearSelection`. La migración los suelta (YAGNI).
- El download a disco está **duplicado inline** en `split-workspace.tsx`, `merge-store.ts` y `edit-store.ts`.

---

## 2. Alcance

### Dentro (Plan B)
- Store-factory `lib/page-grid/use-page-grid.ts` (`createPageGridStore(config)`), generalizando `merge-store`.
- Componente `components/page-grid/page-grid.tsx` (+ `page-thumbnail-tile.tsx`), generalizando `PageThumbnailsPanel`.
- Migrar `merge` a consumir ambos, **sin cambio observable**.
- Extraer `lib/trigger-download.ts` (DRY) y usarlo desde el factory.
- Cerrar **carry-forward #1 de Plan A**: el factory usa `build-export.regroupByDocumentOrder`/`reorderInDocument` en vez de las copias privadas de `merge-store`.
- Soltar el código muerto (`expandedDocumentIds`/`toggleExpanded`/`clearSelection`).
- Tests unitarios del factory + smoke manual de regresión de merge.

### Fuera (Plan C u otros)
- Crop/resize: estado (`setPageCrop`/`setResize`), UI, *focused slot* de `<PageGrid>`, tests, y el manejo del origen no-(0,0) del MediaBox (**carry-forward #2 de Plan A**).
- Los 6 tools de grilla + su registro (rutas/i18n/sitemap/landing) + actualización de `CLAUDE.md`.
- Migrar `split-workspace`/`edit-store` al `trigger-download` compartido (oportunista; no requerido aquí — solo se extrae y lo usa el factory).
- Runner de tests de DOM (jsdom) para componentes.

---

## 3. Arquitectura

Tres capas sobre la fundación de Plan A:

```
<PageGrid documentId store capabilities/>     ← grilla de UN documento (generaliza PageThumbnailsPanel)
        │  merge compone N (uno por PDF) · un tool de Plan C compone 1
createPageGridStore(config) → useXStore       ← store-factory (generaliza merge-store)
        │  usa build-export (Plan A) + document-store + selection-store
exportMergedPdf + buildExportRefs (Plan A)    ← capa pura, sin cambios
```

**Principio de bajo riesgo:** el factory expone la **misma superficie de nombres** (acciones/estado) que `merge-store` hoy. Por eso los componentes que solo leen del store no se tocan. La paridad de comportamiento de merge es la garantía de regresión de este plan.

---

## 4. Store-factory — `lib/page-grid/use-page-grid.ts`

`createPageGridStore(config)` devuelve un hook zustand con la superficie generalizada de `merge-store`.

- **Estado:** `pageEntries: PageEntry[]`; `projectName: string | null` y `optimizeSize: boolean` (significativos solo cuando `config.features` los habilita).
- **Compone:** `document-store` (carga/OPFS/límites) + `selection-store`.
- **Acciones** (idénticas en nombre a las de merge):
  `addDocumentsFromFiles`, `removeDocument`, `reorderDocuments`, `reorderPageEntriesInDocument`, `togglePageHidden`, `removePageEntry`, `rotatePageClockwise`, `rotatePageCounterClockwise`, `selectPageEntry`, `setProjectName`, `setOptimizeSize`, `resetWorkspace`, `exportPdf`.
- **`exportPdf`:** `buildExportRefs(pageEntries, { selectedIds })` (Plan A) → `exportMergedPdf({ optimizeSize })` → `triggerDownload(blob, config.buildFilename(projectName, documents))`. Fija `uiPhase = config.exportPhase` al iniciar. Guard de export vacío reproducido (visibles/seleccionadas == 0 → `setError`, aborta).
- **Internamente** usa los helpers puros de Plan A (`reorderInDocument`, `regroupByDocumentOrder`) en vez de copias privadas.

```ts
type Capabilities = {
  canReorder?: boolean;
  canRotate?: boolean;
  canHide?: boolean;
  canRemove?: boolean;
  canSelect?: boolean;
  // canCrop / canResize → reservados para Plan C
};

type PageGridConfig = {
  multiDoc: boolean;
  capabilities: Capabilities;
  features?: { projectName?: boolean; optimizeSize?: boolean };
  exportPhase: UiPhase;        // merge: "merging"
  buildFilename: (projectName: string | null, docs: WorkspaceDocument[]) => string;
};

// createPageGridStore devuelve un hook zustand tipado, UsePageGridStore,
// que carga el estado + acciones de arriba. Ese es el tipo que <PageGrid>
// espera en su prop `store` (§5).

// merge-store.ts queda como:
export const MERGE_CAPS: Capabilities = {
  canReorder: true, canRotate: true, canHide: true, canRemove: true, canSelect: true,
};
export const useMergeStore = createPageGridStore({
  multiDoc: true,
  capabilities: MERGE_CAPS,
  features: { projectName: true, optimizeSize: true },
  exportPhase: "merging",
  buildFilename: buildExportDownloadFilename,
});
```

**Limpieza:** se eliminan `expandedDocumentIds`, `toggleExpanded`, `clearSelection` (sin consumidor).

---

## 5. Componente `<PageGrid>` — `components/page-grid/page-grid.tsx`

Generaliza `PageThumbnailsPanel`; el tile se separa a `components/page-grid/page-thumbnail-tile.tsx`.

- **Props:** `{ documentId: string; store: UsePageGridStore; capabilities: Capabilities }`. (El *focused slot* para crop se **difiere a Plan C**.)
- **Inyección de store:** el hook se pasa por prop y se aliasa a `useStore` localmente para satisfacer `react-hooks/rules-of-hooks`:
  ```tsx
  export function PageGrid({ documentId, store: useStore, capabilities }: PageGridProps) {
    const pageEntries = useStore((s) => s.pageEntries);
    const reorderInDoc = useStore((s) => s.reorderPageEntriesInDocument);
    // …mismo cuerpo que PageThumbnailsPanel, leyendo del store inyectado
  }
  ```
- **Gating por `capabilities`:** se renderizan los botones por página según los flags — `canRotate` (cw/ccw), `canHide` (excluir), `canRemove` (borrar); `canReorder`/`canSelect` habilitan drag y selección. merge pasa `MERGE_CAPS` (todos true) → paridad total.
- **Conserva intacto:** `IntersectionObserver` lazy, render vía `pdf-render`, contadores `beginThumbnailRender`/`endThumbnailRender`, y `readDocumentBytes(backing)` async.

---

## 6. Migración de merge

**Cambian (3 archivos):**
1. **`merge-store.ts`** → instancia del factory (`MERGE_CONFIG` + `MERGE_CAPS` + `export const useMergeStore = createPageGridStore(...)`). La lógica artesanal se levanta al factory.
2. **`canvas-documents.tsx`** → `<PageThumbnailsPanel documentId={doc.id} />` pasa a `<PageGrid documentId={doc.id} store={useMergeStore} capabilities={MERGE_CAPS} />`. Conserva la cabecera por doc y el reorder de documentos.
3. **`page-thumbnails-panel.tsx`** → **eliminado** (su grilla + tile se absorben en `components/page-grid/`).

**No cambian** (preservación de nombres de la superficie):
`canvas-header.tsx`, `canvas-bottom-pill.tsx`, `export-flow-modal.tsx`, `status-strip.tsx`, `workspace-dropzone.tsx`, `merge-workspace.tsx`. Siguen leyendo `useMergeStore((s) => s.X)`; `exportPhase: "merging"` preserva el keying sobre `uiPhase === "merging"`.

---

## 7. Errores, límites, `UiPhase`

- Sin superficie de error nueva (los guards de crop/resize son Plan C).
- Reusado tal cual: validaciones de `document-store` (no-PDF, `MAX_FILE_BYTES`, `MAX_COMBINED_PAGES`, parse fallido), `readDocumentBytes` memoria/OPFS, yield cada ~10 páginas en `exportMergedPdf`, contadores de thumbnails.
- Guard de export vacío reproducido en el `exportPdf` del factory.
- **`UiPhase` sin cambios:** el factory fija `config.exportPhase`; merge usa `"merging"` (preserva su modal/strip). El `"processing"` genérico de Plan A queda para Plan C.

---

## 8. Testing

**Tests unitarios del factory** (vitest de `apps/web`, entorno node; sobre el runner de Plan A):
- **Mock de `@ceropdf/pdf-render`** (`invalidatePdfJsDocument`, `clearPdfJsDocumentCache`) — importar el factory arrastra `document-store` → `pdf-render` → `pdfjs`, frágil en node.
- Sembrar `pageEntries` con `store.setState(...)` y assertar: `rotatePageClockwise/CounterClockwise`, `togglePageHidden`, `removePageEntry`, `reorderPageEntriesInDocument` (delegan a los helpers de Plan A); `removeDocument` poda entries + selección; `reorderDocuments` reagrupa vía `regroupByDocumentOrder`.
- **Preservación de semántica de export (regression clave):**
  `vi.mock("@ceropdf/pdf-core", async (orig) => ({ ...(await orig()), exportMergedPdf: vi.fn(async () => new Uint8Array()) }))`,
  `vi.mock("@/lib/trigger-download")` a no-op,
  y assertar que `exportPdf` llama `exportMergedPdf` con los refs esperados (hidden excluido, selección aplicada, rotación intacta) para un estado sembrado — prueba que merge exporta igual **sin** renderizar PDFs ni tocar el DOM.
- Guard de export vacío: todo hidden → `setError`, `exportMergedPdf` NO llamado.
- `addDocumentsFromFiles` (necesita `File` + parse pdf-lib) se cubre con smoke manual, no unit test.

**`<PageGrid>` / UI de merge:** sin runner de DOM (vitest es node) — se verifica con smoke manual + typecheck/build. No se añade jsdom en Plan B.

**Smoke de regresión de merge (gate, manual):**
1. Cargar 2 PDFs → secciones + thumbnails por doc.
2. Reordenar documentos (drag cabecera) → orden de páginas reagrupa.
3. Reordenar páginas dentro de un doc (drag tile).
4. Rotar página (cw/ccw) → thumbnail rota.
5. Excluir/incluir página (hide) → opacidad + excluida del export.
6. Selección por rango (shift) → solo seleccionadas se exportan.
7. Toggle optimizar tamaño; renombrar proyecto.
8. **Exportar y comparar el PDF contra el merge de `main` actual** (mismas páginas/orden/rotación/tamaño).
9. Añadir más PDFs; quitar un PDF; "Volver a empezar" (reset).

`pdf-core` sigue verde (sin cambios).

---

## 9. DRY incluido: `lib/trigger-download.ts`

Extraer el patrón de descarga (Blob → `<a download>` → `click` → `revokeObjectURL`), hoy duplicado inline en `split-workspace.tsx`, `merge-store.ts` y `edit-store.ts`, a `apps/web/src/lib/trigger-download.ts`:

```ts
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

El factory lo usa en `exportPdf`. Migrar los otros tres consumidores es opcional/oportunista (no requerido por este plan), pero el util queda disponible.

---

## 10. Riesgos y puntos delicados

- **Migración de merge (alto):** mitigado por preservar los nombres de la superficie (componentes de solo-lectura intactos), levantar la lógica casi verbatim, los tests del factory que prueban la semántica de export, y el smoke comparativo contra `main`.
- **Inyección de store por prop en `<PageGrid>` (medio):** alias local `useStore` para `rules-of-hooks`; el hook es estable (módulo). Verificar que lint pasa.
- **Fragilidad de import en node (medio):** el factory arrastra `pdf-render`/`pdfjs`; los tests lo mockean.
- **`features`/`exportPhase` config-gated (bajo):** evita acoplar el factory a conceptos de merge (projectName/optimizeSize); los tools de Plan C no los habilitan.

---

## 11. Entregables (checklist)

- [ ] `lib/trigger-download.ts` + el factory lo usa.
- [ ] `lib/page-grid/use-page-grid.ts` (`createPageGridStore`) usando los helpers puros de Plan A; sin código muerto.
- [ ] Tests unitarios del factory (acciones + preservación de semántica de export, con mocks de `pdf-render`/`pdf-core`/`trigger-download`).
- [ ] `components/page-grid/page-grid.tsx` + `page-thumbnail-tile.tsx` (gating por capabilities, store inyectado).
- [ ] `merge-store.ts` → instancia del factory (`MERGE_CONFIG`/`MERGE_CAPS`); `canvas-documents.tsx` usa `<PageGrid>`; `page-thumbnails-panel.tsx` eliminado.
- [ ] Componentes de merge restantes sin cambios; merge funciona idéntico (smoke verde).
- [ ] typecheck/test/lint/build del repo verdes.

---

## 12. Follow-up — Plan C

Crop/resize (estado `setPageCrop`/`setResize`, UI, *focused slot* de `<PageGrid>`, manejo del origen del MediaBox) + los 6 tools de grilla (Rotate, Organize, Quitar páginas, Extraer páginas, Crop, Resize) cada uno con su config sobre el factory + `<PageGrid>`, ruta, i18n es/en, sitemap, landing grid (reusa `extract`, retira `secure`), y actualización de `CLAUDE.md`.
