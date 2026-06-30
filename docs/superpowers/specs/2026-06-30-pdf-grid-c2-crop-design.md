# Spec — Crop PDF tool (Plan C2)

- **Fecha:** 2026-06-30
- **Estado:** Aprobado (diseño) — pendiente de plan de implementación
- **Cluster:** PDF tools — **Plan C, sub-plan C2 de 3** (C1 = 4 tools simples ✅; C2 = Crop; C3 = Resize)
- **Predecesores:** Plan A (pdf-core `crop`), Plan B (motor), C1 (shell single-doc, `exportUsesSelection`, `"processing"` UiPhase) — todos en `main`.
- **Este spec cubre:** el tool **Crop PDF** — recorte uniforme con override por página, vía un canvas de dibujo propio.

---

## 1. Contexto

El motor (`createPageGridStore`) y el export con crop (`exportMergedPdf` + `PageEntry.crop`, Plan A) ya existen. C2 añade el tool Crop. A diferencia de los 4 tools de C1, Crop **no usa la grilla de thumbnails** — necesita un **canvas grande de dibujo**, así que es su propio workspace (más parecido a `edit` que a los grid tools). El "focused-slot en `<PageGrid>`" que se venía difiriendo **ya no es necesario** con este modelo.

`edit-canvas.tsx` es la plantilla probada: renderiza una página a un canvas, overlay absoluto, coords normalizadas, drag + resize handles.

### Decisiones tomadas (brainstorming)

1. **Modelo de crop: uniforme + override por página.** Dibujas un rect (por defecto aplica a todas); puedes ajustar páginas concretas.
2. **UI: canvas propio**, no la grilla. Render **sin rotación inherente** (`getViewport({ rotation: 0 })`) → la única transformación es el **Y-flip** (cero matemática de rotación).
3. **Datos: `PageEntry.crop` como fuente de verdad.** `setCropAll` (uniforme) + `setPageCrop` (override). Sin estado `defaultCrop` separado.

### Gotchas heredados (resueltos aquí)

- **Y-flip:** `edit-canvas` usa origen arriba-izquierda (CSS); `setCropBox` de pdf-lib usa abajo-izquierda. Se convierte en helpers puros.
- **MediaBox origin (carry-forward #1 de Plan A):** `setCropBox` actual asume MediaBox en (0,0). Se corrige con offset por `getMediaBox().x/y`.

---

## 2. Alcance

### Dentro (C2)
- pdf-core: fix de MediaBox-origin en la rama crop de `exportMergedPdf`.
- engine (`use-page-grid`): `setCropAll(rect|null)`, `setPageCrop(entryId, rect|null)`, `canCrop` en `Capabilities`.
- `lib/page-grid/crop-coords.ts` — helpers puros de coordenadas (Y-flip).
- `components/crop-canvas.tsx` (dibujo), `components/crop-workspace.tsx` (workspace propio), `stores/crop-store.ts`, ruta `/crop`.
- Registro: i18n es/en, sitemap, landing, `CLAUDE.md`.

### Fuera (C3 u otros)
- Resize (C3).
- Vista natural de páginas con `/Rotate` inherente + mapeo rotación-invertido (follow-up; ver §3).
- Strip de thumbnails con preview de crop (nav es prev/next en MVP).
- App-wide design-token pass del gradiente (carry-forward de C1).

---

## 3. Coordenadas (el corazón fiddly) + fix de pdf-core

**Render sin rotación inherente** (`getViewport({ rotation: 0 })`): el espacio mostrado == espacio sin-rotar de la página → única transformación = **Y-flip**.

**Helpers puros — `apps/web/src/lib/page-grid/crop-coords.ts`:**
```ts
import type { CropRect } from "@ceropdf/pdf-core";

/** Display rect (top-left origin, 0–1) → CropRect (bottom-left origin, 0–1). */
export function displayToCrop(r: { x: number; y: number; w: number; h: number }): CropRect;
//   = { x: r.x, y: 1 - r.y - r.h, width: r.w, height: r.h }  (con clamp01 + min-size 0.02)

/** CropRect → display rect (para dibujar el rect existente). */
export function cropToDisplay(c: CropRect): { x: number; y: number; w: number; h: number };
//   = { x: c.x, y: 1 - c.y - c.height, w: c.width, h: c.height }
```
Ambas puras y testeables (round-trip + correctitud del flip).

**Fix de MediaBox en `packages/pdf-core/src/merge.ts`** (rama `if (ref.crop)`):
```ts
if (ref.crop) {
  const mb = page.getMediaBox(); // { x, y, width, height }
  page.setCropBox(
    mb.x + ref.crop.x * mb.width,
    mb.y + ref.crop.y * mb.height,
    ref.crop.width * mb.width,
    ref.crop.height * mb.height,
  );
}
```
Para páginas con origen (0,0) (lo normal) se reduce al comportamiento de Plan A → sus tests siguen verdes.

**Limitación documentada:** páginas con `/Rotate` inherente se muestran en su orientación PDF cruda (pueden verse de lado al recortar); el crop sale **correcto** (cropbox en espacio sin-rotar, la página conserva su `/Rotate`). La vista natural + el mapeo rotación-invertido son follow-up, no MVP.

---

## 4. Engine + UX de scope

**Adiciones a `use-page-grid.ts`:**
- `Capabilities` gana `canCrop?: boolean`.
- `PageGridState` gana:
  - `setCropAll: (rect: CropRect | null) => void` — pone `crop` en todas las entries (análogo a `rotateAll`).
  - `setPageCrop: (entryId: string, rect: CropRect | null) => void` — override/limpiar una.

**UX de scope (un solo canvas):** un toggle **"Aplicar a: Todas / Solo esta página"** decide si un ajuste del rect llama `setCropAll` o `setPageCrop`. Default = "Todas" (caso uniforme). Para overridear: navegar a la página, cambiar a "Solo esta", ajustar. Reset: "Quitar recorte (esta / todas)" → `setPageCrop(id, null)` / `setCropAll(null)`.
- *Nota:* re-aplicar "a todas" sobrescribe los overrides — intencional, documentado.

El export ya lee `entry.crop` por página (`buildExportRefs`, Plan A) → sin cambios al export path salvo el fix de MediaBox.

---

## 5. Componentes UI

- **`components/crop-canvas.tsx`** (generaliza `edit-canvas.tsx`): renderiza la página actual **sin rotar** a un canvas (escala-a-ancho, clamp como edit), overlay absoluto para **dibujar / mover / redimensionar UN rect** en coords display (top-left, 0–1), con sombreado del área fuera del recorte. Props: `{ store, pageIndex, scope, ... }` o callbacks `onCropChange(displayRect)`. Al cambiar, convierte con `displayToCrop` y llama el setter de scope. El rect mostrado = `cropToDisplay(entry.crop)` de la página actual; sin crop → sin rect (dibujar desde vacío).
- **`components/crop-workspace.tsx`** (workspace propio, patrón `edit-workspace`): vacío = `LandingHeader` + hero + `Dropzone(1 archivo)`; cargado = barra (título + "Cambiar PDF" → `resetWorkspace` + "Exportar" → `exportPdf`) + **toggle de scope** + `crop-canvas` + **nav** ("‹ Anterior · Página X de N · Siguiente ›") + reset + status inline (`uiPhase`). `pageIndex` = `useState` local.
  - **Aislamiento (lección del review final de C1):** derivar el doc cargado del **store del tool** (`useCropStore((s) => s.pageEntries[0]?.documentId)` → `documents.find(...)`), NO de `document-store.documents[0]`, y limpiar selección al montar. Igual que `edit-workspace` (keys off `edit-store.activeDocumentId`). Esto evita el estado "cargado" obsoleto al navegar entre tools.
- **`stores/crop-store.ts`** = `createPageGridStore({ multiDoc:false, capabilities:{canCrop:true}, exportPhase:"processing", exportUsesSelection:false, buildFilename: (_, docs) => \`${stem}.recortado.pdf\` })`. Exporta `CROP_CAPS`.

---

## 6. Registro

1. **Ruta:** `app/[locale]/crop/page.tsx` (metadata) + `components/crop-workspace.tsx`.
2. **i18n (es/en):** `tools.crop` (name+description) en ambos JSON.
3. **sitemap:** `/crop` en `TOOL_PATHS`.
4. **landing-tools-grid:** `"crop"` en `ToolKey`, `GlyphCrop`, card `available`.
5. **`CLAUDE.md`:** añadir `/crop` al mapa de tools.
6. `/check-design` + `/check-architecture` antes de commit.

---

## 7. Errores y límites

- Reusa `document-store`: no-PDF, `MAX_FILE_BYTES`, `MAX_COMBINED_PAGES`, parse fallido.
- Sin crop dibujado → export = original (no-op grácil; `entry.crop` undefined → sin `setCropBox`).
- Crop degenerado → `min-size` (0.02) y `clamp01` en `displayToCrop`.
- Single-doc replace (de C1) aplica al cargar otro PDF.

---

## 8. Testing

**Puro (vitest node):**
- `crop-coords`: `displayToCrop`/`cropToDisplay` round-trip; el Y-flip produce los valores esperados (p. ej. display `{x:0.1,y:0.2,w:0.5,h:0.3}` → crop `{x:0.1,y:0.5,width:0.5,height:0.3}`); clamp/min-size.
- pdf-core: nuevo test de **MediaBox-origin** (página con mediabox `[100, 50, 300, 400]` + crop normalizado → assertar `getCropBox()` con offset). Los tests de crop de Plan A (origen 0) siguen verdes.

**Engine (vitest node):**
- `setCropAll(rect)` → todas las entries tienen ese `crop`; `setCropAll(null)` → todas sin crop.
- `setPageCrop(id, rect)` → solo esa entry; `setPageCrop(id, null)` → la limpia.

**UI (smoke manual):** dibujar un rect (scope Todas) → todas las páginas recortadas; navegar a una página, scope "Solo esta", ajustar → override; "Quitar recorte (todas)"; exportar → abrir el PDF y verificar el recorte (y que páginas sin override usan el uniforme).

---

## 9. Riesgos

- **Coordenadas (medio):** mitigado por render sin-rotar (Y-flip único) + helpers puros testeados. La rotación inherente queda fuera de alcance (limitación documentada).
- **Reuso de `edit-canvas` (bajo-medio):** `crop-canvas` adapta su mecánica de drag/resize a UN rect; trabajo de UI, smoke-verificado.
- **`getMediaBox()` de pdf-lib (bajo):** API existente; el fix reduce al comportamiento previo para origen (0,0).

---

## 10. Entregables (checklist)

- [ ] pdf-core: fix de MediaBox-origin en la rama crop + test; tests de crop de Plan A verdes.
- [ ] `crop-coords.ts` (puro) + tests.
- [ ] `use-page-grid`: `setCropAll` + `setPageCrop` + `canCrop`; tests unitarios.
- [ ] `crop-canvas.tsx` + `crop-workspace.tsx` + `crop-store.ts`.
- [ ] ruta `/crop`; i18n es/en; sitemap; landing (card + `GlyphCrop`); `CLAUDE.md`.
- [ ] typecheck/test/lint/build verdes.

---

## 11. Follow-up — C3 (Resize)

`setResize(directive|null)` (workspace-level) + `canResize` + panel de control (A4/Letter/Legal/escala %). 1 tool + registro. Reusa el shell single-doc de C1 (Resize sí encaja en `<SingleDocGridWorkspace>` con un panel de control, no necesita canvas de dibujo).
