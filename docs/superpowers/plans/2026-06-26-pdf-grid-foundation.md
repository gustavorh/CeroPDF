# PDF Grid Foundation — Implementation Plan (Plan A of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender el primitivo de exportación de pdf-core con `crop`/`resize`, y construir la capa pura de transformación de páginas (`build-export.ts`) que consumirá el motor de grilla — todo unit-tested, sin tocar `merge` ni UI.

**Architecture:** Una sola función de salida (`exportMergedPdf`) gana dos campos opcionales por página (`crop`, `resize`); `merge` los omite → su comportamiento queda intacto. La lógica de "entries → export refs" se extrae a funciones puras testeables sin DOM en `apps/web/src/lib/page-grid/build-export.ts`.

**Tech Stack:** TypeScript strict · pdf-lib 1.17 · Vitest 2.1 · npm workspaces · Next.js 15.3 / React 19 (no se ejecuta UI en este plan).

## Global Constraints

- **100% client-side.** No se añaden dependencias de runtime, rutas API ni variables de entorno. (Vitest entra **solo** como `devDependency`.)
- **Vitest `^2.1.9`** en `apps/web`, igual que en `packages/pdf-core`.
- **Límites duros:** `MAX_FILE_BYTES` = 250 MB, `MAX_COMBINED_PAGES` = 500 (no se modifican aquí).
- **Node ≥ 20.**
- **Naming:** `kebab-case.tsx` para componentes, `camelCase.ts` para utilidades.
- **Copy UI en español; código y comentarios en inglés.** Comentarios solo para el "por qué".
- **Sin hex/rgb crudos**, tokens Tailwind (no aplica a este plan — sin UI).
- Commits conventional cortos (español OK).

## Alcance de este plan (Plan A)

**Dentro:**
1. `ExportPageRef` gana `crop?` y `resize?`; `exportMergedPdf` los aplica.
2. `PageEntry` gana `crop?`.
3. `apps/web` estrena runner de Vitest.
4. `lib/page-grid/build-export.ts` — helpers puros (`buildExportRefs`, `reorderInDocument`, `regroupByDocumentOrder`).

**Fuera (planes siguientes, se redactan tras ejecutar A):**
- **Plan B** — `use-page-grid.ts` (store-factory) + `<PageGrid>` + **migración de `merge`** al motor (el gate de de-risking, verificado con smoke manual).
- **Plan C** — los 6 tools de grilla + registro (rutas/i18n/sitemap/landing) + `CLAUDE.md`.

> **Refinamiento respecto al spec §4/§10 (a validar):** la inversión del rectángulo de recorte según la rotación se **mueve a la capa web** (UI de Crop, Plan C), dejando el `crop` de pdf-core como una operación pura en espacio de página. Por eso `CropRect` se define en **espacio de página sin rotar** (origen abajo-izquierda, normalizado 0–1). El test "rotation + crop" del spec §10 se reubica al nivel de la UI de Crop en Plan C.

---

### Task 1: Extender `ExportPageRef` con `crop` y `resize` (pdf-core)

**Files:**
- Modify: `packages/pdf-core/src/merge.ts`
- Modify: `packages/pdf-core/src/index.ts`
- Test (create): `packages/pdf-core/src/__tests__/export-page-ops.test.ts`

**Interfaces:**
- Produces:
  - `type CropRect = { x: number; y: number; width: number; height: number }` (normalizado 0–1, espacio de página sin rotar).
  - `type ResizeDirective = { kind: "size"; width: number; height: number } | { kind: "scale"; factor: number }` (puntos PDF).
  - `ExportPageRef` extendido con `resize?: ResizeDirective` y `crop?: CropRect`.
  - `exportMergedPdf(pages, getBytesForDocument, { optimizeSize })` — firma sin cambios; aplica `resize` → `rotation` → `crop` por página.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `packages/pdf-core/src/__tests__/export-page-ops.test.ts`:

```ts
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { exportMergedPdf, type ExportPageRef } from "../merge";

async function makePdf(width: number, height: number): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([width, height]);
  const out = await pdf.save();
  const copy = new ArrayBuffer(out.byteLength);
  new Uint8Array(copy).set(out);
  return copy;
}

describe("exportMergedPdf — resize", () => {
  it("scales the page size by a scale factor", async () => {
    const doc = await makePdf(200, 400);
    const pages: ExportPageRef[] = [
      { documentId: "a", sourcePageIndex: 0, rotation: 0, resize: { kind: "scale", factor: 0.5 } },
    ];
    const merged = await exportMergedPdf(pages, () => doc, { optimizeSize: false });
    const parsed = await PDFDocument.load(merged);
    const { width, height } = parsed.getPage(0).getSize();
    expect(Math.round(width)).toBe(100);
    expect(Math.round(height)).toBe(200);
  });

  it("resizes to a target size in points", async () => {
    const doc = await makePdf(200, 400);
    const pages: ExportPageRef[] = [
      { documentId: "a", sourcePageIndex: 0, rotation: 0, resize: { kind: "size", width: 595, height: 842 } },
    ];
    const merged = await exportMergedPdf(pages, () => doc, { optimizeSize: false });
    const parsed = await PDFDocument.load(merged);
    const { width, height } = parsed.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });
});

describe("exportMergedPdf — crop", () => {
  it("applies a normalized crop box in page points", async () => {
    const doc = await makePdf(200, 400);
    const pages: ExportPageRef[] = [
      { documentId: "a", sourcePageIndex: 0, rotation: 0, crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } },
    ];
    const merged = await exportMergedPdf(pages, () => doc, { optimizeSize: false });
    const parsed = await PDFDocument.load(merged);
    const box = parsed.getPage(0).getCropBox();
    expect(Math.round(box.x)).toBe(50);
    expect(Math.round(box.y)).toBe(100);
    expect(Math.round(box.width)).toBe(100);
    expect(Math.round(box.height)).toBe(200);
  });

  it("composes resize then crop against the resized size", async () => {
    const doc = await makePdf(200, 400);
    const pages: ExportPageRef[] = [
      {
        documentId: "a",
        sourcePageIndex: 0,
        rotation: 0,
        resize: { kind: "scale", factor: 0.5 },
        crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
      },
    ];
    const merged = await exportMergedPdf(pages, () => doc, { optimizeSize: false });
    const parsed = await PDFDocument.load(merged);
    const box = parsed.getPage(0).getCropBox();
    // resized 200x400 → 100x200; crop 0.5 → 50x100
    expect(Math.round(box.width)).toBe(50);
    expect(Math.round(box.height)).toBe(100);
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `npm test -w @ceropdf/pdf-core`
Expected: los 4 tests nuevos FALLAN (los campos `crop`/`resize` aún no existen en el tipo → fallo de typecheck en el test, o el output no tiene el tamaño/cropbox esperado). Los 3 tests existentes de `merge.test.ts` siguen pasando.

- [ ] **Step 3: Extender los tipos en `merge.ts`**

En `packages/pdf-core/src/merge.ts`, reemplazar el bloque de tipo `ExportPageRef` (líneas 3–9) por:

```ts
export type CropRect = {
  /** Normalized 0–1 against the (post-resize) page size, PDF user space
   *  (origin bottom-left), measured on the unrotated page. */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResizeDirective =
  | { kind: "size"; width: number; height: number } // target size in PDF points
  | { kind: "scale"; factor: number };

export type ExportPageRef = {
  documentId: string;
  /** 0-based index in the source PDF */
  sourcePageIndex: number;
  /** Rotación de salida en grados (0, 90, 180, 270). */
  rotation: number;
  /** Redimensionado uniforme, aplicado antes de rotación/recorte. */
  resize?: ResizeDirective;
  /** Recorte en coordenadas de página normalizadas. */
  crop?: CropRect;
};
```

- [ ] **Step 4: Aplicar `resize` y `crop` en el loop de `exportMergedPdf`**

En `merge.ts`, reemplazar el bloque `for (const page of copied) { ... }` (líneas 52–58) por:

```ts
    for (const page of copied) {
      if (ref.resize) {
        if (ref.resize.kind === "scale") {
          page.scale(ref.resize.factor, ref.resize.factor);
        } else {
          const { width, height } = page.getSize();
          page.scale(ref.resize.width / width, ref.resize.height / height);
        }
      }
      const rot = (((ref.rotation ?? 0) % 360) + 360) % 360;
      if (rot !== 0) {
        page.setRotation(degrees(rot));
      }
      if (ref.crop) {
        const { width, height } = page.getSize();
        page.setCropBox(
          ref.crop.x * width,
          ref.crop.y * height,
          ref.crop.width * width,
          ref.crop.height * height,
        );
      }
      out.addPage(page);
    }
```

- [ ] **Step 5: Exportar los tipos nuevos desde `index.ts`**

En `packages/pdf-core/src/index.ts`, reemplazar la línea 3:

```ts
export type { BytesProvider, ExportPageRef } from "./merge";
```

por:

```ts
export type { BytesProvider, CropRect, ExportPageRef, ResizeDirective } from "./merge";
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `npm test -w @ceropdf/pdf-core`
Expected: PASS — los 4 nuevos + los 3 de `merge.test.ts` (7 en total verdes; la regresión de merge confirma backward-compat).

- [ ] **Step 7: Commit**

```bash
git add packages/pdf-core/src/merge.ts packages/pdf-core/src/index.ts packages/pdf-core/src/__tests__/export-page-ops.test.ts
git commit -m "feat(pdf-core): crop y resize opcionales en exportMergedPdf"
```

---

### Task 2: Vitest en `apps/web` + `PageEntry.crop` + helpers puros `build-export`

**Files:**
- Modify: `apps/web/package.json` (script `test` + devDep `vitest`)
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/src/types/workspace.ts` (campo `crop?`)
- Create: `apps/web/src/lib/page-grid/build-export.ts`
- Test (create): `apps/web/src/lib/page-grid/build-export.test.ts`

**Interfaces:**
- Consumes (de Task 1): `CropRect`, `ResizeDirective`, `ExportPageRef` desde `@ceropdf/pdf-core`.
- Produces:
  - `PageEntry.crop?: CropRect`.
  - `type BuildExportOptions = { selectedIds?: ReadonlySet<string>; resize?: ResizeDirective }`.
  - `buildExportRefs(entries: PageEntry[], opts?: BuildExportOptions): ExportPageRef[]` — excluye `hidden`, filtra por selección si la hay, conserva `rotation`/`crop`, aplica `resize` a todas.
  - `reorderInDocument(entries: PageEntry[], documentId: string, fromLocalIndex: number, toLocalIndex: number): PageEntry[]` — puro.
  - `regroupByDocumentOrder(entries: PageEntry[], documentOrder: string[]): PageEntry[]` — puro.

- [ ] **Step 1: Instalar Vitest como devDependency en `apps/web`**

Run: `npm install -w web -D vitest@^2.1.9`
Expected: `apps/web/package.json` gana `"vitest": "^2.1.9"` en `devDependencies`. (El `postinstall` copia los workers de pdf/ffmpeg; es esperado.)

- [ ] **Step 2: Añadir el script `test` a `apps/web/package.json`**

En `apps/web/package.json`, dentro de `"scripts"`, añadir tras `"lint": "eslint",`:

```json
    "test": "vitest run",
```

- [ ] **Step 3: Crear `apps/web/vitest.config.ts`**

```ts
import path from "node:path";

import { defineConfig } from "vitest/config";

// Pure-logic tests only (no DOM). UI is verified manually in later plans.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
```

- [ ] **Step 4: Añadir `crop?` a `PageEntry`**

En `apps/web/src/types/workspace.ts`, cambiar la primera línea de import:

```ts
import type { DocumentBacking } from "@ceropdf/pdf-core";
```

por:

```ts
import type { CropRect, DocumentBacking } from "@ceropdf/pdf-core";
```

y dentro de `export type PageEntry = { ... }`, tras la línea `rotation: number;`, añadir:

```ts
  /** Recorte normalizado 0–1 en espacio de página sin rotar. Ausente = sin recorte. */
  crop?: CropRect;
```

- [ ] **Step 5: Escribir el test que falla**

Crear `apps/web/src/lib/page-grid/build-export.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { PageEntry } from "@/types/workspace";

import {
  buildExportRefs,
  regroupByDocumentOrder,
  reorderInDocument,
} from "./build-export";

function entry(partial: Partial<PageEntry> & { id: string }): PageEntry {
  return {
    documentId: "d1",
    sourcePageIndex: 0,
    hidden: false,
    rotation: 0,
    ...partial,
  };
}

describe("buildExportRefs", () => {
  it("excludes hidden entries and preserves order + rotation", () => {
    const entries = [
      entry({ id: "p1", sourcePageIndex: 0, rotation: 90 }),
      entry({ id: "p2", sourcePageIndex: 1, hidden: true }),
      entry({ id: "p3", sourcePageIndex: 2 }),
    ];
    const refs = buildExportRefs(entries);
    expect(refs.map((r) => r.sourcePageIndex)).toEqual([0, 2]);
    expect(refs[0].rotation).toBe(90);
  });

  it("includes only selected entries when a selection is provided", () => {
    const entries = [
      entry({ id: "p1", sourcePageIndex: 0 }),
      entry({ id: "p2", sourcePageIndex: 1 }),
      entry({ id: "p3", sourcePageIndex: 2 }),
    ];
    const refs = buildExportRefs(entries, { selectedIds: new Set(["p1", "p3"]) });
    expect(refs.map((r) => r.sourcePageIndex)).toEqual([0, 2]);
  });

  it("carries the per-entry crop and applies a uniform resize to all refs", () => {
    const entries = [
      entry({ id: "p1", crop: { x: 0, y: 0, width: 0.5, height: 0.5 } }),
      entry({ id: "p2", sourcePageIndex: 1 }),
    ];
    const refs = buildExportRefs(entries, { resize: { kind: "scale", factor: 0.5 } });
    expect(refs[0].crop).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
    expect(refs[1].crop).toBeUndefined();
    expect(refs.every((r) => r.resize?.kind === "scale")).toBe(true);
  });
});

describe("reorderInDocument", () => {
  it("moves a page within its document, leaving other docs untouched", () => {
    const entries = [
      entry({ id: "a0", documentId: "A", sourcePageIndex: 0 }),
      entry({ id: "a1", documentId: "A", sourcePageIndex: 1 }),
      entry({ id: "a2", documentId: "A", sourcePageIndex: 2 }),
      entry({ id: "b0", documentId: "B", sourcePageIndex: 0 }),
    ];
    const next = reorderInDocument(entries, "A", 0, 2);
    expect(next.map((e) => e.id)).toEqual(["a1", "a2", "a0", "b0"]);
  });

  it("returns the same reference when indices are equal", () => {
    const entries = [entry({ id: "a0", documentId: "A" })];
    expect(reorderInDocument(entries, "A", 0, 0)).toBe(entries);
  });
});

describe("regroupByDocumentOrder", () => {
  it("reorders entries to follow a new document order", () => {
    const entries = [
      entry({ id: "a0", documentId: "A" }),
      entry({ id: "b0", documentId: "B" }),
      entry({ id: "a1", documentId: "A", sourcePageIndex: 1 }),
    ];
    const next = regroupByDocumentOrder(entries, ["B", "A"]);
    expect(next.map((e) => e.id)).toEqual(["b0", "a0", "a1"]);
  });
});
```

- [ ] **Step 6: Correr el test para verificar que falla**

Run: `npm test -w web`
Expected: FAIL con "Cannot find module './build-export'" (el módulo aún no existe).

- [ ] **Step 7: Implementar `build-export.ts`**

Crear `apps/web/src/lib/page-grid/build-export.ts`:

```ts
import type { ExportPageRef, ResizeDirective } from "@ceropdf/pdf-core";

import type { PageEntry } from "@/types/workspace";

export type BuildExportOptions = {
  /** Cuando trae ids, solo esas entries se exportan (extraer). Vacío/ausente = todas las visibles. */
  selectedIds?: ReadonlySet<string>;
  /** Redimensionado uniforme aplicado a cada página exportada. */
  resize?: ResizeDirective;
};

/** Convierte las page entries visibles/seleccionadas (en orden) en export refs. */
export function buildExportRefs(
  entries: PageEntry[],
  opts: BuildExportOptions = {},
): ExportPageRef[] {
  const useSelection = !!opts.selectedIds && opts.selectedIds.size > 0;
  const refs: ExportPageRef[] = [];
  for (const e of entries) {
    if (e.hidden) continue;
    if (useSelection && !opts.selectedIds!.has(e.id)) continue;
    const ref: ExportPageRef = {
      documentId: e.documentId,
      sourcePageIndex: e.sourcePageIndex,
      rotation: e.rotation ?? 0,
    };
    if (e.crop) ref.crop = e.crop;
    if (opts.resize) ref.resize = opts.resize;
    refs.push(ref);
  }
  return refs;
}

/** Mueve una página dentro de su documento. Puro: devuelve un array nuevo (o el mismo si no hay cambio). */
export function reorderInDocument(
  entries: PageEntry[],
  documentId: string,
  fromLocalIndex: number,
  toLocalIndex: number,
): PageEntry[] {
  if (fromLocalIndex === toLocalIndex) return entries;
  const positions: number[] = [];
  entries.forEach((e, i) => {
    if (e.documentId === documentId) positions.push(i);
  });
  const local = positions.map((i) => entries[i]);
  if (
    fromLocalIndex < 0 ||
    toLocalIndex < 0 ||
    fromLocalIndex >= local.length ||
    toLocalIndex >= local.length
  ) {
    return entries;
  }
  const reordered = [...local];
  const [moved] = reordered.splice(fromLocalIndex, 1);
  reordered.splice(toLocalIndex, 0, moved);
  const next = [...entries];
  positions.forEach((pos, k) => {
    next[pos] = reordered[k];
  });
  return next;
}

/** Reagrupa las entries para seguir un nuevo orden de documentos. Puro. */
export function regroupByDocumentOrder(
  entries: PageEntry[],
  documentOrder: string[],
): PageEntry[] {
  const buckets = new Map<string, PageEntry[]>();
  for (const id of documentOrder) buckets.set(id, []);
  for (const e of entries) buckets.get(e.documentId)?.push(e);
  return documentOrder.flatMap((id) => buckets.get(id) ?? []);
}
```

- [ ] **Step 8: Correr el test para verificar que pasa**

Run: `npm test -w web`
Expected: PASS (los 6 tests de `build-export.test.ts`).

- [ ] **Step 9: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/vitest.config.ts apps/web/src/types/workspace.ts apps/web/src/lib/page-grid/build-export.ts apps/web/src/lib/page-grid/build-export.test.ts
git commit -m "feat(web): helpers puros build-export + runner de Vitest"
```

> Nota: el lockfile puede estar en la raíz (`package-lock.json`). Incluir el que git reporte como modificado tras el `npm install` del Step 1.

---

### Task 3: Verificación cruzada de la fundación

**Files:** ninguno nuevo — corre las verificaciones del repo completo para confirmar que Task 1 (pdf-core) y Task 2 (web) no rompieron typecheck/lint/build.

**Interfaces:** —

- [ ] **Step 1: Typecheck de todos los workspaces**

Run: `npm run typecheck`
Expected: PASS (incluye `apps/web`, `apps/heavy`, los 3 packages). Confirma que `CropRect`/`ResizeDirective`/`PageEntry.crop` cuadran en todo el grafo de tipos.

- [ ] **Step 2: Tests de todos los workspaces**

Run: `npm test`
Expected: PASS — pdf-core (7 tests: 3 merge + 4 nuevos) y web (6 tests de build-export). `apps/heavy` y los otros packages se saltan con `--if-present`.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS (sin errores nuevos).

- [ ] **Step 4: Build standalone**

Run: `npm run build`
Expected: PASS. Los módulos nuevos aún no se importan desde la app, así que el bundle no debe cambiar de forma significativa; el objetivo es confirmar que nada se rompió.

- [ ] **Step 5: Commit (si algo requirió ajuste)**

Si los pasos anteriores no necesitaron cambios, no hay commit. Si hubo que ajustar tipos/imports:

```bash
git add -A
git commit -m "chore: ajustes de typecheck/lint tras la fundación de grilla"
```

---

## Self-Review (autor del plan)

**Cobertura del spec (alcance de Plan A):**
- Spec §4 (ExportPageRef + crop/resize, orden scale→rotate→crop) → Task 1. ✓
- Spec §5 (`PageEntry.crop`) → Task 2 Step 4. ✓
- Spec §5 (helpers puros del motor: `buildExport`, reorder, regroup) → Task 2 (`build-export.ts`). ✓
- Spec §10 (tests pdf-core crop/resize; regresión backward-compat vía tests de merge existentes) → Task 1. ✓
- Spec §10 (runner de Vitest en `apps/web`) → Task 2. ✓
- Spec §10 "rotation + crop" → **reubicado a Plan C** (UI de Crop) por el refinamiento documentado arriba. ✓ (gap intencional, anotado)
- Spec §5 `UiPhase "processing"`, §6 `<PageGrid>`, §7 los 6 tools, §8 registro, migración de merge → **Plan B / Plan C** (fuera de alcance de A). ✓

**Escaneo de placeholders:** sin "TBD/TODO/etc."; todo paso con código muestra el código completo. ✓

**Consistencia de tipos:** `CropRect`/`ResizeDirective` definidos en Task 1 y consumidos por nombre exacto en Task 2 (`build-export.ts`, `PageEntry.crop`). `buildExportRefs`/`reorderInDocument`/`regroupByDocumentOrder` con firmas idénticas entre el bloque Interfaces, los tests (Step 5) y la implementación (Step 7). ✓

---

## Planes siguientes (se redactan tras ejecutar Plan A)

- **Plan B — Motor + migración de merge:** `lib/page-grid/use-page-grid.ts` (store-factory que generaliza `merge-store`, delegando transforms a `build-export.ts`), `UiPhase "processing"`, `components/page-grid/<PageGrid>` (grilla single-doc + slot de página enfocada), y **migración de `merge`** a consumir el motor. Gate: tests de pdf-core + smoke manual de merge verdes antes de continuar.
- **Plan C — Los 6 tools:** Rotate · Organize · Quitar páginas · Extraer páginas · Crop (incluye la inversión rect↔rotación) · Resize, cada uno con ruta + workspace + config + i18n es/en + sitemap + landing grid (reusa `extract`, retira `secure`), y actualización de `CLAUDE.md`.
