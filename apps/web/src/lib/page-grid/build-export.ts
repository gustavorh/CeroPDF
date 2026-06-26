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
