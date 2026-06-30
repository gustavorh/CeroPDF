# Spec — Single-doc grid shell + 4 simple PDF tools (Plan C1)

- **Fecha:** 2026-06-29
- **Estado:** Aprobado (diseño) — pendiente de plan de implementación
- **Cluster:** PDF tools — **Plan C, sub-plan C1 de 3** (C1 = shell + 4 tools simples; C2 = Crop; C3 = Resize)
- **Predecesores:** Plan A (pdf-core `crop`/`resize`, `build-export.ts`) + Plan B (`createPageGridStore`, `<PageGrid>`, merge migrado) — ambos en `main`.
- **Este spec cubre:** un shell single-doc compartido + los 4 tools de grilla simples (Rotate, Organize, Quitar páginas, Extraer páginas) + adiciones menores al motor + registro.

---

## 1. Contexto

Plan B dejó el motor listo: `createPageGridStore(config)` (store-factory) y `<PageGrid documentId store capabilities>` (grilla de un documento). merge ya corre sobre ese motor. C1 estrena el **patrón single-doc**: un shell reutilizable que carga UN PDF y renderiza UN `<PageGrid>`, y los 4 primeros tools sobre él.

Los 4 tools de C1 no necesitan lógica pura nueva (el motor ya soporta rotate/reorder/remove/select; el export va por `buildExportRefs` + `exportMergedPdf` de Plan A). Son configs + el shell + adiciones pequeñas al motor + registro.

### Decisiones tomadas (brainstorming)

1. **Plan C se descompone en C1/C2/C3.** C1 primero (shell + 4 simples); Crop (C2) y Resize (C3) aparte por su dificultad.
2. **Quitar/Extraer: selección visual + input de rangos.** La grilla (`<PageGrid>`) y un campo de rangos escriben ambos a la **misma fuente de verdad** (la selección / la acción del tool); sin doble sincronización.
3. **Feedback de export: status inline** (estilo `split-workspace`), no el `ExportFlowModal` de merge. Los tools de grilla son rápidos; evita riesgo al modal de merge y es más honesto.

---

## 2. Alcance

### Dentro (C1)
- `components/page-grid/single-doc-grid-workspace.tsx` — shell compartido.
- `components/page-grid/page-range-control.tsx` — input de rangos compartido (Quitar/Extraer).
- 4 stores `stores/{rotate,organize,remove-pages,extract-pages}-store.ts` + 4 wrappers `components/<tool>-workspace.tsx` + 4 rutas.
- Adiciones al motor: `rotateAll(delta)` y flag `exportUsesSelection` en `use-page-grid`; `setSelection(ids)` en `selection-store`; semántica single-doc "reemplazar al cargar"; `"processing"` en la unión `UiPhase` (`document-store`).
- Fix carry-forward en `<PageGrid>`: gatear `cursor-grab` y los handlers `onDragEnter/onDragOver/onDrop` por `capabilities.canReorder`.
- `merge-store` config gana `exportUsesSelection: true` (preserva su comportamiento).
- Registro: i18n es/en, sitemap, landing grid (retira `secure`), `CLAUDE.md` (mapa + sección "patrón").

### Fuera (C2/C3 u otros)
- Crop (C2): `setPageCrop`, `canCrop`, *focused slot* de `<PageGrid>`, dibujo de rectángulo, MediaBox/rotación.
- Resize (C3): `setResize`, `canResize`, panel de control.
- Categorización de la landing en mega-menú (diferida hasta que el conteo lo empuje).
- Perf-pass del subpath `@ceropdf/pdf-core/storage` (carry-forward de Plan B; no aquí).

---

## 3. Arquitectura

```
app/[locale]/<slug>/page.tsx           ← metadata SEO; renderiza el wrapper del tool
components/<tool>-workspace.tsx         ← wrapper delgado: pasa store + config + controls al shell
components/page-grid/
  single-doc-grid-workspace.tsx         ← shell compartido (4 tools lo reusan)
  page-range-control.tsx                ← input de rangos (Quitar/Extraer)
  page-grid.tsx                         ← (Plan B) + fix de drag-gating por canReorder
stores/<tool>-store.ts                  ← createPageGridStore(config) — 1 por tool, single-doc
lib/page-grid/use-page-grid.ts          ← (Plan B) + rotateAll + exportUsesSelection + replace single-doc
stores/selection-store.ts               ← (existe) + setSelection(ids)
```

**Shell `<SingleDocGridWorkspace>`** — props `{ store, capabilities, title, description, fileSuffix, exportUsesSelection, controls? }`:
- **Estado vacío:** `LandingHeader` + hero (title/description) + `Dropzone` de 1 archivo (→ `store.addDocumentsFromFiles`).
- **Estado cargado:** toolbar (title + "Cambiar PDF" → `store.resetWorkspace` + "Exportar" → `store.exportPdf`) + `controls` (slot opcional) + `<PageGrid documentId={doc.id} store capabilities />` + **status inline** derivado de `uiPhase` (`processing`/`export_success`/`error`).

Cada tool es un wrapper delgado que instancia su store y pasa su config + `controls` al shell.

---

## 4. Adiciones al motor

Tres adiciones pequeñas, todas en `lib/page-grid/use-page-grid.ts` salvo donde se indique.

### 4.1 `exportUsesSelection` (config + exportPdf)
`PageGridConfig` gana `exportUsesSelection: boolean`. En `exportPdf`:
```ts
const selectedIds = config.exportUsesSelection
  ? useSelectionStore.getState().selectedIds
  : [];
const refs = buildExportRefs(pageEntries, { selectedIds: new Set(selectedIds) });
```
- **Extraer / merge** = `true` (exporta seleccionadas). **Quitar / Rotate / Organize** = `false` (exporta todo lo visible; la selección es staging).
- **merge-store config** debe fijar `exportUsesSelection: true` para preservar su comportamiento actual.

### 4.2 `rotateAll(delta: 90 | -90)`
Acción nueva en el factory: rota todas las entries en un solo `set` (evita N sets en docs grandes).
```ts
rotateAll: (delta) =>
  set((s) => ({
    pageEntries: s.pageEntries.map((e) => ({
      ...e, rotation: (((e.rotation ?? 0) + delta) % 360 + 360) % 360,
    })),
  })),
```

### 4.3 Semántica single-doc "reemplazar al cargar"
En `addDocumentsFromFiles`, cuando `config.multiDoc === false` y ya hay documentos cargados, limpiar antes de añadir (cargar un PDF reemplaza al anterior), análogo a `edit-store.loadDocument`:
```ts
if (!config.multiDoc && useDocumentStore.getState().documents.length > 0) {
  useDocumentStore.getState().clearAll();
  useSelectionStore.getState().clear();
  set({ pageEntries: [] });
}
// …luego el append normal
```

### 4.4 `selection-store.setSelection(ids: string[])`
Setter en bloque (para range→selección en Extraer):
```ts
setSelection: (ids) => set({ selectedIds: [...ids], anchorId: ids[ids.length - 1] ?? null }),
```

### 4.5 Añadir `"processing"` a `UiPhase`
Los specs de Plan A/B mencionaron un fase genérica `"processing"` pero nunca se implementó; C1 es el primer consumidor (los tools usan `exportPhase: "processing"`). Hay que añadirla a la unión `UiPhase` en `document-store.ts`:
```ts
export type UiPhase =
  | "idle" | "loading" | "parsing" | "rendering"
  | "merging" | "processing" | "export_success" | "error";
```
`StatusStrip`'s `PHASE_LABEL` es `Record<UiPhase, string>` (exhaustivo) → typecheck obliga a añadir su entrada, p. ej. `processing: "Procesando…"`. El shell de C1 NO usa `StatusStrip` (tiene status inline propio), pero la entrada del Record es necesaria para compilar.

### 4.6 Fix de drag-gating en `<PageGrid>` (carry-forward Plan B)
En `ThumbnailGridItem`: gatear la clase de cursor y los handlers de drop por `capabilities.canReorder`:
```tsx
className={`flex flex-col ${
  capabilities.canReorder
    ? (dragging ? "cursor-grabbing opacity-[0.85]" : "cursor-grab")
    : "cursor-default"
}`}
onDragEnter={capabilities.canReorder ? allowDrop : undefined}
onDragOver={capabilities.canReorder ? allowDrop : undefined}
onDrop={capabilities.canReorder ? (e) => onDropAtLocalIndex(e, localIndex) : undefined}
```

---

## 5. Los 4 tools

| Tool | `capabilities` | `controls` | `exportUsesSelection` | Sufijo |
|---|---|---|---|---|
| **Rotate** (`/rotate`) | `{canRotate}` | "Rotar todo ↻ / ↺" (`rotateAll(±90)`) | `false` | `rotado` |
| **Organize** (`/organize`) | `{canReorder,canRotate,canRemove,canSelect}` | — | `false` | `organizado` |
| **Quitar páginas** (`/remove-pages`) | `{canRemove,canSelect}` | `<PageRangeControl>` + "Quitar seleccionadas" | `false` | `sin-paginas` |
| **Extraer páginas** (`/extract-pages`) | `{canSelect}` | `<PageRangeControl>` + indicador de selección | `true` | `extraido` |

- Todos single-doc (`multiDoc: false`), input PDF, `features: {}` (sin projectName ni optimizeSize), `exportPhase: "processing"`, `buildFilename: (_, docs) => \`${docs[0].name.replace(/\.pdf$/i,"")}.<sufijo>.pdf\``.
- **`<PageRangeControl>`** parsea con `parseRanges(input, pageCount)` y llama `onApply(pages: number[])` (1-based). Mapeo posición→entry: `entries[pos-1].id` (válido porque Quitar/Extraer son `canReorder=false`, orden == original).
  - **Extraer:** `onApply = (pages) => selection.setSelection(pages.map((p) => entries[p-1].id))`.
  - **Quitar:** `onApply = (pages) => pages.forEach((p) => store.removePageEntry(entries[p-1].id))`.

---

## 6. Registro

1. **Rutas:** `app/[locale]/{rotate,organize,remove-pages,extract-pages}/page.tsx` (metadata) + `components/{rotate,organize,remove-pages,extract-pages}-workspace.tsx`.
2. **i18n (es/en):** `tools.rotate`, `tools.organize`, `tools.removePages` (name+description) en ambos JSON; `tools.extract` ya existe.
3. **sitemap:** añadir los 4 slugs a `TOOL_PATHS` en `app/sitemap.ts`.
4. **landing-tools-grid:** 3 entradas nuevas (`rotate`, `organize`, `removePages`) `available` + flip de `extract` a `available` apuntando a `/extract-pages`; 3 glyphs SVG inline nuevos; **retirar la entrada `secure`** (Bucket D, fuera de alcance). `imageConvert` sigue `coming_soon`.
5. **`CLAUDE.md`:** añadir los 4 tools al mapa del código + **corregir la sección "Patrón para añadir herramienta"** al patrón real (createPageGridStore + SingleDocGridWorkspace + ruta).
6. Cada tool corre `/check-design` + `/check-architecture` antes de commit (regla 6).

---

## 7. Errores y límites

- Reusa `document-store`: rechazo no-PDF, `MAX_FILE_BYTES` (250 MB), `MAX_COMBINED_PAGES` (500), parse fallido → `lastError` + `uiPhase`.
- **Guard de export vacío:** el `exportPdf` del factory ya aborta con `setError` si no hay refs (Extraer sin selección lo dispara).
- **Rangos:** `parseRanges` lanza errores en español (fuera de rango, inverso, duplicado) → `<PageRangeControl>` los muestra inline.
- Single-doc replace no altera límites.

---

## 8. Testing

**Unit (vitest node, runner de Plan A):**
- `rotateAll(delta)` → sembrar entries, assertar todas `+90` / `-90` (mod 360).
- `exportUsesSelection` → con `false` + una selección puesta, `exportPdf` llama `exportMergedPdf` con **todos los refs visibles** (mock de `exportMergedPdf`, patrón de Plan B); con `true`, solo los seleccionados.
- `selection-store.setSelection(ids)` → test unitario nuevo (hoy `selection-store` no tiene test).
- **Regresión merge:** con `exportUsesSelection: true` en su config, los tests de export de Plan B (selección aplicada) siguen verdes.

**Smoke manual (sin runner de DOM):**
- Single-doc replace (cargar un PDF, luego otro → reemplaza).
- Por tool: Rotate (rotar todo + por página → exportar), Organize (reordenar/rotar/borrar → exportar), Quitar (rango + selección + "quitar seleccionadas" → exportar restantes), Extraer (rango + selección → exportar solo esas).
- Drag-gating: en Rotate/Quitar/Extraer (canReorder=false) el cursor NO es grab y no hay drop targets; en Organize sí.

**typecheck/lint/build** verdes.

---

## 9. Riesgos

- **`exportUsesSelection` toca el `exportPdf` del factory (medio):** merge debe fijarlo en `true`; los tests de export de Plan B son la red de regresión.
- **Single-doc replace (bajo):** difícil de unit-testear (parse de File); cubierto por smoke.
- **Mapeo rango→entry por posición (bajo):** válido solo con `canReorder=false`; Quitar/Extraer lo son. Documentado.

---

## 10. Entregables (checklist)

- [ ] `document-store`: añadir `"processing"` a la unión `UiPhase` + entrada en `StatusStrip.PHASE_LABEL`.
- [ ] `use-page-grid`: `rotateAll(delta)` + `exportUsesSelection` (config + exportPdf) + replace single-doc; tests unitarios.
- [ ] `selection-store`: `setSelection(ids)` + test.
- [ ] `merge-store` config: `exportUsesSelection: true` (regresión verde).
- [ ] `<PageGrid>`: fix de drag-gating por `canReorder`.
- [ ] `single-doc-grid-workspace.tsx` + `page-range-control.tsx`.
- [ ] 4 stores + 4 workspaces + 4 rutas.
- [ ] i18n es/en (rotate/organize/removePages); sitemap; landing grid (3 nuevos + extract available + retirar secure); 3 glyphs.
- [ ] `CLAUDE.md` (mapa + sección patrón).
- [ ] typecheck/test/lint/build verdes.

---

## 11. Follow-up — C2 (Crop) y C3 (Resize)

- **C2:** `setPageCrop(entryId, rect|null)` + `canCrop` + *focused slot* en `<PageGrid>` + componente de dibujo de rectángulo + manejo del origen no-(0,0) del MediaBox y la inversión crop↔rotación. 1 tool + registro.
- **C3:** `setResize(directive|null)` (estado workspace-level) + `canResize` + panel de control (A4/Letter/Legal/escala %). 1 tool + registro.
