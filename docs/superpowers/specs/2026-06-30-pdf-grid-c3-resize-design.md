# Spec — Resize PDF tool (Plan C3)

- **Fecha:** 2026-06-30
- **Estado:** Aprobado (diseño) — pendiente de plan de implementación
- **Cluster:** PDF tools — **Plan C, sub-plan C3 de 3** (C1 = 4 tools simples ✅; C2 = Crop ✅; C3 = Resize). **Último tool — completa los 6.**
- **Predecesores:** Plan A (pdf-core `resize`), Plan B (motor), C1 (`<SingleDocGridWorkspace>`, `exportUsesSelection`, `"processing"`) — todos en `main`.
- **Este spec cubre:** el tool **Resize PDF** — escala por porcentaje + presets de papel (A4/Letter/Legal) con aspecto preservado.

---

## 1. Contexto

El export path **ya soporta resize**: `buildExportRefs(entries, { resize })` aplica un `ResizeDirective` uniforme a todos los refs (Plan A), y `exportMergedPdf` lo aplica por página. Resize es el tool más simple del cluster: reusa el shell single-doc de C1 con un panel de control, y sólo cablea el `resize` en el store + un cambio en pdf-core para preservar aspecto en los presets.

### Decisiones tomadas (brainstorming)

1. **Modos:** escala por porcentaje (uniforme) + presets de papel (A4/Letter/Legal).
2. **Presets: aspecto preservado** (fit uniforme centrado), no estirado. Requiere un cambio en la rama `{kind:"size"}` de pdf-core.
3. **UI: reusa `<SingleDocGridWorkspace>`** de C1 (panel de resize en el slot `controls`; el grid muestra las páginas como preview).

### Estado de pdf-core (Plan A)

`ResizeDirective = { kind: "size"; width; height } | { kind: "scale"; factor }`. `exportMergedPdf`:
- `scale` → `page.scale(factor, factor)` (uniforme, sin distorsión). **Sin cambios.**
- `size` → hoy `page.scale(w/W, h/H)` (**estira** al tamaño exacto). **Se reescribe a fit con aspecto preservado.**

---

## 2. Alcance

### Dentro (C3)
- pdf-core: rama `{kind:"size"}` → fit con aspecto preservado + helper puro `computeFitResize` (+ test).
- engine (`use-page-grid`): estado `resize` + `setResize(directive|null)` + `canResize`; `exportPdf` pasa `resize` a `buildExportRefs`.
- `stores/resize-store.ts`, `components/resize-workspace.tsx` (usa el shell C1 + panel de control), ruta `/resize`.
- Registro: i18n es/en, sitemap, landing, `CLAUDE.md`.

### Fuera (follow-up)
- App-wide design-token pass del gradiente/rgba (carry-forward acumulado).
- Perf-pass del subpath `@ceropdf/pdf-core/storage`.
- Move/resize handles de Crop (C2 follow-up).

---

## 3. pdf-core — presets con aspecto preservado

**Helper puro (`packages/pdf-core/src/merge.ts` o un módulo propio, exportado):**
```ts
export function computeFitResize(srcW: number, srcH: number, targetW: number, targetH: number) {
  const scale = Math.min(targetW / srcW, targetH / srcH);
  return { scale, dx: (targetW - srcW * scale) / 2, dy: (targetH - srcH * scale) / 2 };
}
```

**Rama `{kind:"size"}` de `exportMergedPdf`** (reemplaza el `page.scale(w/W, h/H)` actual):
```ts
} else {
  const { width: w, height: h } = page.getSize();
  const { scale, dx, dy } = computeFitResize(w, h, ref.resize.width, ref.resize.height);
  page.scaleContent(scale, scale);
  page.translateContent(dx, dy);
  page.setSize(ref.resize.width, ref.resize.height);
}
```
- `{kind:"scale"}` no cambia.
- **El test de Plan A `"resizes to a target size"` sigue verde**: asserta `getSize() == target`, que `setSize` mantiene. El contenido queda escalado/centrado (propiedad visual, no cubierta por getSize) — como el `setCropBox` glue de C2, la aplicación pdf-lib es glue no-testeado; **la fórmula sí se testea** vía `computeFitResize`.

---

## 4. Engine — resize uniforme

**Adiciones a `use-page-grid.ts`:**
- `Capabilities` gana `canResize?: boolean`.
- `PageGridState` gana `resize: ResizeDirective | null` (estado, default `null`) y `setResize: (directive: ResizeDirective | null) => void`.
- `exportPdf` pasa el resize activo:
```ts
const refs = buildExportRefs(pageEntries, {
  selectedIds: new Set(selectedIds),
  resize: get().resize ?? undefined,
});
```
- `resetWorkspace` limpia `resize` a `null`.

`resize` es **workspace-level (uniforme)**, no por página (a diferencia de crop). `setResize` es mutuamente excluyente por naturaleza (un solo campo): elegir un preset pone `{kind:"size"}`, elegir escala pone `{kind:"scale"}`.

---

## 5. UI

- **`stores/resize-store.ts`** = `createPageGridStore({ multiDoc:false, capabilities:{canResize:true}, exportPhase:"processing", exportUsesSelection:false, buildFilename: (_, docs) => \`${stem}.redimensionado.pdf\` })`. Exporta `RESIZE_CAPS`.
- **`components/resize-workspace.tsx`** = `<SingleDocGridWorkspace store={useResizeStore} capabilities={RESIZE_CAPS} title="Redimensionar PDF" ... controls={<ResizeControls/>} />`. El grid muestra los thumbnails como preview (tiles sin botones — `canResize` no mapea a acción de tile; `canReorder=false`).
- **`ResizeControls`** (componente, en el mismo archivo o aparte): lee/setea el `resize` del store.
  - **Escala:** input numérico % (10–400, clamp) → `setResize({ kind: "scale", factor: pct/100 })`.
  - **Tamaño de papel:** botones A4 (595×842), Letter (612×792), Legal (612×1008) pt → `setResize({ kind: "size", width, height })`. (Valores hardcodeados; no importar pdf-lib al cliente por constantes.)
  - **Tamaño original:** → `setResize(null)`.
  - **Indicador** del destino activo (p. ej. "A4 · 595×842 pt" o "Escala 50 %").
  - El botón "Exportar" del shell dispara `exportPdf` (aplica el resize). Si `resize` es `null`, exporta el original (no-op grácil).

---

## 6. Registro

1. **Ruta:** `app/[locale]/resize/page.tsx` (metadata) + `components/resize-workspace.tsx`.
2. **i18n (es/en):** `tools.resize` (name+description) en ambos JSON.
3. **sitemap:** `/resize` en `TOOL_PATHS`.
4. **landing-tools-grid:** `"resize"` en `ToolKey`, `GlyphResize`, card `available`.
5. **`CLAUDE.md`:** añadir `/resize` al mapa de tools. (Con los 6 tools completos, es buen momento para una **nota** de que el cluster PDF-tools está cerrado.)
6. `/check-design` + `/check-architecture` antes de commit.

---

## 7. Errores y límites

- Reusa `document-store` (no-PDF, `MAX_FILE_BYTES`, `MAX_COMBINED_PAGES`, parse).
- `resize` null → export = original (no-op).
- Escala clamp 10–400 % en el input; preset siempre válido.
- Single-doc replace (C1) aplica al cargar otro PDF.
- El `resize-workspace` deriva el doc del **store del tool** (aislamiento de C1) y limpia selección al montar — vía el propio `<SingleDocGridWorkspace>`, que ya lo hace.

---

## 8. Testing

**Puro (vitest):**
- pdf-core `computeFitResize`: factor = min ratio, centrado (p. ej. `computeFitResize(200,400,595,842)` → `scale≈2.105, dx≈87, dy≈0`; caso aspecto-igual → dx=dy=0). Plan A `"size"` test sigue verde.
- (Opcional) un test de que la rama `size` produce `getSize() == target` con el nuevo código — ya cubierto por el test existente de Plan A.

**Engine (vitest node):**
- `setResize(directive)` setea el estado; `setResize(null)` lo limpia.
- `exportPdf` con `resize` puesto → `exportMergedPdf` (mock) recibe refs con `resize`; con `resize` null → refs sin `resize`. (Patrón de los tests de export de C1.)

**UI (smoke manual):** cargar PDF → elegir A4 / Letter / escala 50 % → exportar → abrir el PDF y verificar el tamaño de página (y que aspecto-distinto no distorsiona: contenido centrado).

---

## 9. Riesgos

- **pdf-lib `scaleContent`/`translateContent` (bajo-medio):** API existente; el orden scaleContent → translateContent → setSize centra el contenido. La fórmula se testea; la aplicación es glue, smoke-verificado.
- **Cambio a la rama `size` (bajo):** el test de Plan A (getSize == target) protege la invariante de tamaño; sólo cambia la semántica de contenido (mejor).
- **`canResize` inerte (bajo):** como `canCrop`, no gatea UI de tile (Resize usa panel de control); es flag forward-looking, documentado.

---

## 10. Entregables (checklist)

- [ ] pdf-core: `computeFitResize` (exportado) + rama `size` aspecto-preservado; test de `computeFitResize`; Plan A resize tests verdes.
- [ ] `use-page-grid`: `resize` state + `setResize` + `canResize`; `exportPdf` pasa `resize`; `resetWorkspace` limpia; tests unitarios (setResize + exportPdf-pasa-resize).
- [ ] `resize-store.ts` + `resize-workspace.tsx` (+ `ResizeControls`).
- [ ] ruta `/resize`; i18n es/en; sitemap; landing (card + `GlyphResize`); `CLAUDE.md`.
- [ ] typecheck/test/lint/build verdes.

---

## 11. Cierre del cluster PDF tools

Con Resize, los **6 PDF tools** del Plan C están completos (Rotate, Organize, Quitar, Extraer, Crop, Resize), sobre el motor de Plan B y la fundación de Plan A. Carry-forwards abiertos (no bloqueantes, en memoria): app-wide design-token pass del gradiente; perf-pass del subpath `/storage`; move/resize handles de Crop; vista natural de páginas con `/Rotate` inherente en Crop.
