# Spec — Motor de grilla de páginas + 6 PDF tools de grilla

- **Fecha:** 2026-06-26
- **Estado:** Aprobado (diseño) — pendiente de plan de implementación
- **Cluster:** PDF tools (1 de 4 clusters derivados del catálogo tipo FreeConvert/CloudConvert)
- **Este spec cubre:** el motor de grilla compartido + migración de `merge` + 6 tools de grilla
- **Follow-up (Spec 2):** los 4 tools standalone (Flatten, PDF→JPG, Imagen→PDF, Extraer-imagen)

---

## 1. Contexto y motivación

El usuario quiere ampliar CeroPDF con un catálogo de herramientas inspirado en
FreeConvert/CloudConvert. Tras descomponer ~80 herramientas y filtrarlas contra
el contrato del proyecto (local-first, sin SaaS, sin API de pago), se acotó el
alcance y se priorizó el cluster **PDF tools**.

CeroPDF sigue siendo un **portafolio personal local-first**: ninguna de estas
herramientas sale del navegador. No se añaden dependencias server-side, rutas
API, ni variables de entorno.

### Decisiones ya tomadas (brainstorming)

1. **Espectro cliente↔servidor:** *solo client-side puro*. Se descartan Bucket C
   (OCR, PDF→Word, ebook, CAD, fonts, vector, protect, upscale) y Bucket D
   (website capture, API pública, pricing).
2. **Primer cluster:** *PDF tools (10)*.
3. **Granularidad:** *una página dedicada por tool* (ruta + card propios), para
   replicar FreeConvert y maximizar SEO/portafolio.
4. **Arquitectura:** *enfoque A — generalizar `merge` en un motor de grilla
   compartido* (máximo DRY), aceptando el costo de refactorizar el tool ya
   enviado y blindándolo con regresión.

### Por qué un motor compartido

`merge-store` **ya implementa** rotación por página, reordenamiento, ocultar y
quitar páginas. Seis de los diez PDF tools (Rotate, Organize, Quitar páginas,
Extraer páginas, Crop, Resize) son la **misma grilla de páginas** con UI y
semántica de exportación distintas. Construirlos por separado duplicaría ~6×
esa lógica. El motor la centraliza una vez.

---

## 2. Alcance

### Dentro (Spec 1)

- **Motor de grilla** reutilizable (estado + UI).
- **Migración de `merge`** para que sea el primer consumidor del motor, sin
  cambios observables de comportamiento.
- **6 tools de grilla** como configs delgadas sobre el motor:
  Rotate · Organize · Quitar páginas · Extraer páginas · Crop · Resize.
- Extensión de `exportMergedPdf` (pdf-core) con `crop` y `resize`.
- Registro completo de cada tool (ruta, i18n es/en, sitemap, landing grid).
- Tests de las ramas nuevas de pdf-core + helpers puros del motor.
- Actualización de `CLAUDE.md` (mapa de tools + sección "patrón").

### Fuera (Spec 2 u otros clusters)

- Los 4 tools standalone: Flatten, PDF→JPG, Imagen→PDF, Extraer-imagen.
- Input de imágenes en `document-store` (lo necesita Imagen→PDF).
- Clusters Image tools, Utilidades, Archivos.
- Categorización de la landing en mega-menú (se difiere hasta que el conteo de
  cards lo empuje; correrá `/check-design` cuando llegue).
- Cualquier herramienta server-side.

---

## 3. Arquitectura (3 capas)

Respeta la separación actual: `pdf-core` sin React, stores en `apps/web/src/stores`
(o `lib`), UI en `apps/web/src/components`.

```
┌─ UI ───────────────────────────────────────────────┐
│ components/page-grid/<PageGrid>                     │
│   · grilla de thumbnails (drag-reorder, selección)  │
│   · slot opcional de "página enfocada" (render-prop)│
│ components/<slug>-workspace.tsx  (1 por tool)        │
└─────────────────────────────────────────────────────┘
            │ usa
┌─ Estado ───────────────────────────────────────────┐
│ lib/page-grid/use-page-grid.ts  (store-factory)     │
│   · pageEntries + ops genéricas                     │
│   · compone document-store + selection-store        │
│   · config: { multiDoc, capabilities, buildExport } │
└─────────────────────────────────────────────────────┘
            │ exporta vía
┌─ Lógica pura ──────────────────────────────────────┐
│ packages/pdf-core/exportMergedPdf  (extendido)      │
│   · ExportPageRef gana crop? y resize?              │
│   · única ruta de salida para los 6 tools           │
└─────────────────────────────────────────────────────┘
```

**Principio de blindaje:** `merge` pasa `crop`/`resize` como `undefined` → ramas
no-op → su salida es **byte-idéntica** a la actual. Esa es la garantía de
regresión que hace seguro el refactor.

---

## 4. Cambios en `packages/pdf-core`

Un solo punto de cambio en `merge.ts`, no seis funciones nuevas.

```ts
// merge.ts
export type ExportPageRef = {
  documentId: string;
  sourcePageIndex: number;
  rotation: number;
  /** Recorte normalizado 0–1 respecto del tamaño de página. Opcional. */
  crop?: { x: number; y: number; width: number; height: number };
  /** Redimensionado uniforme. Opcional. */
  resize?:
    | { kind: "size"; width: number; height: number } // puntos PDF (A4, Letter…)
    | { kind: "scale"; factor: number };
};
```

Dentro del loop de `exportMergedPdf`, por página, en **orden definido
`scale → rotate → crop`**:

- `resize` → `page.scaleContent(f, f)` + `page.setSize(w, h)` (pdf-lib).
- `rotation` → ya existente (`page.setRotation`).
- `crop` → convertir lo normalizado a puntos con el tamaño real de la página y
  aplicar `page.setCropBox(x·w, y·h, cw·w, ch·h)`.

El loop **ya yieldea cada ~10 páginas**; el trabajo extra cae dentro del mismo
loop, así que no introduce bloqueo de main-thread.

### Sutileza: crop bajo rotación

`CropBox` vive en el espacio **sin rotar** de la página; el usuario dibuja el
rectángulo sobre el preview **ya rotado**. Convención del spec: el rect se captura
en coordenadas del preview y `exportMergedPdf` lo **invierte según `rotation`**
(0/90/180/270) antes de llamar `setCropBox`. Debe cubrirse con test (ver §9).

---

## 5. Motor de estado — `lib/page-grid/use-page-grid.ts`

Un *store-factory* zustand que generaliza lo que hoy vive en `merge-store`.

- **Estado:** `pageEntries: PageEntry[]` (+ estado derivado del tool).
- **Composición:** carga vía `document-store.addDocumentsFromFiles`; selección vía
  `selection-store`.
- **Ops genéricas:** `reorder`, `rotateCW/CCW`, `removeEntry`, `toggleHidden`,
  `setCrop(entryId, rect)`, `setResize(directive)`, `selectEntry`, `clearSelection`,
  `resetWorkspace`.
- **Config del tool:**
  ```ts
  type PageGridConfig = {
    multiDoc: boolean;            // merge=true; los 6 grid tools=false
    capabilities: Capabilities;   // qué controles expone la UI
    buildExport: (entries: PageEntry[], extra) => ExportPageRef[];
    exportFilename: (...) => string;
  };
  type Capabilities = {
    canReorder?: boolean;
    canRotate?: boolean;
    canRemove?: boolean;
    canSelect?: boolean;
    canCrop?: boolean;
    canResize?: boolean;
  };
  ```
- **`buildExport`** es la pieza tool-específica: filtra entries ocultas/no
  seleccionadas, aplica orden, y emite el `ExportPageRef[]` (con `rotation`,
  `crop`, `resize` según corresponda). Todos los tools de grilla exportan por
  `exportMergedPdf`.

### `PageEntry` (en `types/workspace.ts`)

Gana un campo opcional:

```ts
crop?: { x: number; y: number; width: number; height: number }; // normalizado 0–1
```

`resize` es uniforme → vive como campo del store del tool (no por página) y se
copia a cada `ExportPageRef` en `buildExport`.

### `UiPhase`

Cambio aditivo y seguro: añadir `"processing"` a la unión `UiPhase` en
`document-store`. El motor lo usa durante el export. `merge` puede seguir con
`"merging"` o adoptar `"processing"`; ninguna ruta se rompe.

---

## 6. UI — `components/page-grid/`

`<PageGrid>` con **dos capas**:

1. **Grilla de thumbnails** — render vía `pdf-render` (mismo path lazy+cache que
   merge, con contadores `beginThumbnailRender`/`endThumbnailRender`).
   Drag-reorder, selección, y botones por página. Qué botones aparecen lo decide
   `capabilities`.
2. **Slot opcional de "página enfocada"** (render-prop / children) — al clicar una
   página se abre un lienzo grande. **Crop** lo usa para dibujar el rectángulo;
   los demás no lo usan.

Cada tool tiene `components/<slug>-workspace.tsx` que instancia el store con su
config y renderiza `<PageGrid>` + su panel propio (p. ej. el selector A4/Letter de
Resize, o el input de rangos de Quitar/Extraer).

---

## 7. Los 6 tools de grilla

| Tool | `capabilities` | Param nuevo | Salida |
|------|---------------|-------------|--------|
| **Rotate** | `canRotate` (+ "rotar todo") | — (usa `rotation`) | 1 PDF |
| **Organize** | `canReorder, canRotate, canRemove` | — | 1 PDF |
| **Quitar páginas** | `canRemove, canSelect` (+ rangos) | — | 1 PDF |
| **Extraer páginas** | `canSelect` (+ rangos) | — | 1 PDF (solo seleccionadas) |
| **Crop** | `canCrop` | `crop` por página | 1 PDF |
| **Resize** | `canResize` | `resize` uniforme | 1 PDF |

- **Rotate / Organize / Quitar / Extraer** son subconjuntos de las capabilities
  que `merge` ya implementa → configs delgadas, sin lógica pura nueva.
- **Quitar / Extraer** aceptan además input de rangos: reusan `parseRanges` de
  pdf-core (ya lanza errores descriptivos en español).
- **Crop / Resize** son los únicos que estrenan ramas en `exportMergedPdf`.
- Todos: input PDF, single-doc (`multiDoc:false`). `merge` se queda multi-doc.

---

## 8. Registro de cada tool

| Tool | Ruta | i18n key |
|------|------|----------|
| Rotate | `/rotate` | `tools.rotate` |
| Organize | `/organize` | `tools.organize` |
| Quitar páginas | `/remove-pages` | `tools.removePages` |
| Extraer páginas | `/extract-pages` | `tools.extract` *(reusa placeholder)* |
| Crop | `/crop` | `tools.crop` |
| Resize | `/resize` | `tools.resize` |

Cinco touchpoints por tool:

1. **Ruta:** `app/[locale]/<slug>/page.tsx` (metadata SEO + `<XWorkspace/>`) +
   `components/<slug>-workspace.tsx`.
2. **i18n:** `name`/`description` en `messages/es.json` y `en.json` para las 6 keys.
   `tools.extract` ya existe en ambos y se reaprovecha. Strings propios del tool
   cuelgan bajo `tools.<key>.*`.
3. **sitemap:** añadir los 6 slugs a `TOOL_PATHS` en `app/sitemap.ts`.
4. **landing-tools-grid:** 5 entradas nuevas en `TOOLS` (`status:"available"`,
   slug, glyph) + flip de `extract` a `available` apuntando a `/extract-pages`.
   5 glyphs SVG inline nuevos (rotate/organize/remove/crop/resize), siguiendo el
   patrón del archivo. **Retirar el placeholder `secure`** (era Protect/Unlock →
   fuera de alcance). `imageConvert` se queda `coming_soon` (Spec 2).
5. **Revisiones:** cada tool pasa por `/check-design` y `/check-architecture`
   antes de commit (regla 6 del CLAUDE.md). Todo client-side, sin deps/API/env
   nuevos → architecture-guardian debería pasar limpio.

**Design-system:** la grilla pasa de 9 → ~12 cards; el grid plano de 3 columnas
aún respira (4 filas). La categorización tipo mega-menú se **difiere** a cuando
Spec 2 la empuje a ~19 cards (correrá `/check-design` entonces).

**`CLAUDE.md`:** actualizar el mapa de tools y **corregir la sección "Patrón para
añadir herramienta"**, que hoy referencia `lib/pdf/<tool>.ts` + `workspace-store.ts`
(no existen). El patrón real es: **pdf-core (puro) + motor `page-grid` + config
por tool**.

---

## 9. Manejo de errores y límites

**Reusado tal cual:**

- `document-store` valida: rechazo de no-PDF, `MAX_FILE_BYTES` (250 MB),
  `MAX_COMBINED_PAGES` (500), parse fallido (corrupto / protegido) → `lastError`
  + `uiPhase`.
- Lectura uniforme memoria/OPFS con `readDocumentBytes(backing)`.
- Yield cada ~10 páginas en `exportMergedPdf`.
- Thumbnails con el path lazy+cache de `pdf-render`.

**Guardas nuevas (centralizadas en el motor):**

- **Export vacío:** entries visibles/seleccionadas == 0 → `setError` y abortar
  (como hace `merge` hoy).
- **Crop:** rect no-degenerado y dentro de límites; sin crop dibujado → export =
  original (no-op grácil, con hint).
- **Resize:** factor de escala acotado (p. ej. 0.1–10) y tamaño objetivo válido.
- **Rangos (Quitar/Extraer):** errores de `parseRanges` se surfacean con `setError`.

---

## 10. Testing

**Capa pura pdf-core (alto valor, determinista, Vitest):**

- Nuevo `export-page-ops.test.ts` (o extender `merge.test.ts`):
  - `crop` → cargar output y assertar `page.getCropBox()`.
  - `resize` size → assertar tamaño; scale → assertar dimensiones escaladas.
  - **rotation + crop** → assertar que el rect mapea bien a través de la rotación.
  - **Regresión backward-compat:** refs sin crop/resize → output idéntico al de
    `merge` previo (blinda "merge byte-idéntico").

**Núcleo del motor:** extraer los helpers de orden/transform como **funciones
puras** (siguiendo a `regroupPageEntries`, ya puro en merge) y testearlos sin DOM:
`buildExport(entries, config)` produce el `ExportPageRef[]` correcto; reorder /
rotate / remove / setCrop. Estos helpers operan sobre `PageEntry` (tipo web), así
que viven en `apps/web` — y `apps/web` **hoy no tiene runner de Vitest**.
Resolución: añadir una config mínima de Vitest a `apps/web` (este es su primer
target de test) y mantener los helpers en un módulo puro e importable sin React
(`lib/page-grid/build-export.ts`), separado del store-factory que sí toca zustand.

**Sin E2E** en este spec; smoke manual por tool (cargar → operar → exportar →
abrir el PDF).

**Recomendado (opcional):** añadir `npm test` + `typecheck` a `ci.yml`, ya que se
introducen ramas nuevas en pdf-core y los primeros tests de lógica de `apps/web`.

---

## 11. Secuencia de implementación (de-risking)

Orden obligado para el plan:

1. **Extender pdf-core** (`ExportPageRef` + ramas crop/resize) con sus tests,
   incluida la regresión backward-compat. Verde antes de seguir.
2. **Construir el motor** (`use-page-grid` + `<PageGrid>`) extrayendo la lógica de
   `merge-store`/UI de merge.
3. **Migrar `merge`** a consumir el motor (config `multiDoc:true`, todas las
   capabilities). Correr tests de merge existentes + **smoke manual de merge**.
   *Si merge sigue verde, la generalización es segura — gate para el paso 4.*
4. **Construir los 6 tools de grilla** como configs (en paralelo posible) + su
   registro. Empezar por los subconjuntos triviales (Rotate, Organize, Quitar,
   Extraer) y cerrar con Crop y Resize (los que estrenan ramas pdf-core/UI).
5. **Actualizar `CLAUDE.md`** y registros (sitemap/i18n/landing).
6. `/check-design` + `/check-architecture` antes de commit.

---

## 12. Riesgos y puntos delicados

- **Refactor de merge (alto):** mitigado por la garantía byte-idéntica + tests de
  regresión + smoke manual como gate del paso 4.
- **Crop bajo rotación (medio):** mapeo del rect a través de `rotation`; cubierto
  por test dedicado.
- **Resize fidelidad (medio):** `scaleContent` + `setSize` debe preservar
  contenido sin recortes; validar con A4/Letter en el smoke.
- **Sobre-acoplamiento del motor (medio):** seis tools dependen de un store-factory;
  mantener `buildExport` como único punto tool-específico evita que el motor
  acumule ramas por-tool.
- **`crop` per-page vs `resize` uniforme:** asimetría deliberada; documentada en §5.

---

## 13. Entregables (checklist)

- [ ] `ExportPageRef` extendido + ramas crop/resize en `exportMergedPdf`.
- [ ] Tests pdf-core (crop, resize, rotation+crop, regresión backward-compat).
- [ ] `lib/page-grid/use-page-grid.ts` (store-factory) + `lib/page-grid/build-export.ts` (puro).
- [ ] Config mínima de Vitest en `apps/web` + tests de los helpers del motor.
- [ ] `components/page-grid/<PageGrid>` (grilla + slot de página enfocada).
- [ ] `merge` migrado al motor; tests + smoke de merge verdes.
- [ ] 6 workspaces + 6 rutas `app/[locale]/<slug>/page.tsx`.
- [ ] i18n es/en para las 6 keys; sitemap; landing grid (incl. retiro de `secure`).
- [ ] `UiPhase` con `"processing"`.
- [ ] `CLAUDE.md` actualizado (mapa + sección patrón).
- [ ] (Opcional) CI corre `test` + `typecheck`.

---

## 14. Follow-up — Spec 2 (tools standalone)

Diseño aparte para Flatten · PDF→JPG · Imagen→PDF · Extraer-imagen. Dependencias
propias: `flattenPdf` (form.flatten), `rasterizePages` (pdf-render) + helper ZIP
(fflate), input de imágenes en `document-store`, y extracción de XObjects
(la pieza más arriesgada — posible descope). No bloquea Spec 1.
