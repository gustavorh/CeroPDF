import { PDFDocument } from "pdf-lib";
import { create } from "zustand";

import { MAX_COMBINED_PAGES, MAX_FILE_BYTES } from "@/lib/constants";
import {
  buildExportDownloadFilename,
  defaultProjectDisplayName,
} from "@/lib/project-display-name";
import { exportMergedPdf } from "@/lib/pdf/export-workspace-pdf";
import { invalidatePdfJsDocument } from "@/lib/pdf/pdfjs-document-cache";
import type { PageEntry, WorkspaceDocument } from "@/types/workspace";

/** Fases de feedback de estado (PRD §4). */
export type UiPhase =
  | "idle"
  | "loading"
  | "parsing"
  | "rendering"
  | "merging"
  | "export_success"
  | "error";

type WorkspaceState = {
  /** Nombre editable del proyecto en el lienzo; si es null, se deriva del primer PDF. */
  projectName: string | null;
  documents: WorkspaceDocument[];
  pageEntries: PageEntry[];
  expandedDocumentIds: string[];
  uiPhase: UiPhase;
  /** Miniaturas pdf.js en curso (PRD §4 feedback “Renderizando”). */
  thumbnailRenderCount: number;
  optimizeSize: boolean;
  lastError: string | null;
  /** Páginas seleccionadas para extracción (ids de `pageEntries`). */
  selectedPageIds: string[];
  selectionAnchorId: string | null;

  beginThumbnailRender: () => void;
  endThumbnailRender: () => void;

  addDocumentsFromFiles: (files: FileList | File[]) => Promise<void>;
  removeDocument: (id: string) => void;
  toggleExpanded: (id: string) => void;
  reorderDocuments: (fromIndex: number, toIndex: number) => void;
  togglePageHidden: (entryId: string) => void;
  selectPageEntry: (entryId: string, options: { shiftKey: boolean }) => void;
  clearSelection: () => void;
  reorderPageEntriesInDocument: (
    documentId: string,
    fromLocalIndex: number,
    toLocalIndex: number,
  ) => void;
  setProjectName: (name: string) => void;
  removePageEntry: (entryId: string) => void;
  rotatePageClockwise: (entryId: string) => void;
  rotatePageCounterClockwise: (entryId: string) => void;
  resetWorkspace: () => void;
  setOptimizeSize: (value: boolean) => void;
  setUiPhase: (phase: UiPhase) => void;
  clearError: () => void;
  exportPdf: () => Promise<void>;
};

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function isPdfFile(file: File): boolean {
  const byMime =
    file.type === "application/pdf" || file.type === "application/x-pdf";
  const byName = file.name.toLowerCase().endsWith(".pdf");
  return byMime || byName;
}

function buildPageEntries(documentId: string, pageCount: number): PageEntry[] {
  const out: PageEntry[] = [];
  for (let i = 0; i < pageCount; i++) {
    out.push({
      id: newId(),
      documentId,
      sourcePageIndex: i,
      hidden: false,
      rotation: 0,
    });
  }
  return out;
}

function regroupPageEntries(
  pageEntries: PageEntry[],
  newDocumentOrder: string[],
): PageEntry[] {
  const buckets = new Map<string, PageEntry[]>();
  for (const id of newDocumentOrder) {
    buckets.set(id, []);
  }
  for (const pe of pageEntries) {
    buckets.get(pe.documentId)?.push(pe);
  }
  return newDocumentOrder.flatMap((id) => buckets.get(id) ?? []);
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  projectName: null,
  documents: [],
  pageEntries: [],
  expandedDocumentIds: [],
  uiPhase: "idle",
  thumbnailRenderCount: 0,
  optimizeSize: false,
  lastError: null,
  selectedPageIds: [],
  selectionAnchorId: null,

  beginThumbnailRender: () =>
    set((s) => ({
      thumbnailRenderCount: s.thumbnailRenderCount + 1,
    })),

  endThumbnailRender: () =>
    set((s) => ({
      thumbnailRenderCount: Math.max(0, s.thumbnailRenderCount - 1),
    })),

  clearError: () => set({ lastError: null }),

  setProjectName: (name) => set({ projectName: name.trim() || null }),

  removePageEntry: (entryId) =>
    set((s) => ({
      pageEntries: s.pageEntries.filter((e) => e.id !== entryId),
      selectedPageIds: s.selectedPageIds.filter((id) => id !== entryId),
      selectionAnchorId:
        s.selectionAnchorId === entryId ? null : s.selectionAnchorId,
    })),

  rotatePageClockwise: (entryId) =>
    set((s) => ({
      pageEntries: s.pageEntries.map((e) =>
        e.id === entryId
          ? { ...e, rotation: ((e.rotation ?? 0) + 90) % 360 }
          : e,
      ),
    })),

  rotatePageCounterClockwise: (entryId) =>
    set((s) => ({
      pageEntries: s.pageEntries.map((e) =>
        e.id === entryId
          ? { ...e, rotation: ((e.rotation ?? 0) - 90 + 360) % 360 }
          : e,
      ),
    })),

  resetWorkspace: () => {
    const { documents } = get();
    for (const d of documents) {
      invalidatePdfJsDocument(d.id);
    }
    set({
      projectName: null,
      documents: [],
      pageEntries: [],
      expandedDocumentIds: [],
      uiPhase: "idle",
      thumbnailRenderCount: 0,
      optimizeSize: false,
      lastError: null,
      selectedPageIds: [],
      selectionAnchorId: null,
    });
  },

  clearSelection: () => set({ selectedPageIds: [], selectionAnchorId: null }),

  addDocumentsFromFiles: async (files) => {
    const list = Array.from(files).filter(isPdfFile);
    if (list.length === 0) {
      set({
        lastError:
          "Solo se admiten archivos PDF. Comprueba el nombre o el tipo.",
      });
      return;
    }

    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        set({
          lastError:
            "Archivo muy pesado. Límite de 250 MB para procesamiento seguro en navegador.",
        });
        return;
      }
    }

    set({ uiPhase: "loading", lastError: null });

    const parsed: Array<{
      file: File;
      bytes: ArrayBuffer;
      pageCount: number;
    }> = [];

    for (const file of list) {
      try {
        const bytes = await file.arrayBuffer();
        set({ uiPhase: "parsing" });
        const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
        const pageCount = pdf.getPageCount();
        parsed.push({ file, bytes, pageCount });
      } catch {
        set({
          lastError:
            "No se pudo leer el archivo. Puede estar corrupto o protegido por contraseña.",
          uiPhase: "idle",
        });
        return;
      }
    }

    const existingTotal = get().documents.reduce((s, d) => s + d.pageCount, 0);
    const newTotal = parsed.reduce((s, p) => s + p.pageCount, 0);
    if (existingTotal + newTotal > MAX_COMBINED_PAGES) {
      set({
        lastError: `Demasiadas páginas en total. El límite es ${MAX_COMBINED_PAGES} páginas combinadas (PRD).`,
        uiPhase: "idle",
      });
      return;
    }

    const newDocs: WorkspaceDocument[] = parsed.map((p) => ({
      id: newId(),
      name: p.file.name,
      sizeBytes: p.file.size,
      bytes: p.bytes,
      pageCount: p.pageCount,
    }));

    const newEntries = newDocs.flatMap((d) =>
      buildPageEntries(d.id, d.pageCount),
    );

    set((s) => {
      const mergedDocs = [...s.documents, ...newDocs];
      return {
        documents: mergedDocs,
        pageEntries: [...s.pageEntries, ...newEntries],
        uiPhase: "idle",
        lastError: null,
        projectName:
          s.projectName ?? defaultProjectDisplayName(mergedDocs),
      };
    });
  },

  removeDocument: (id) => {
    invalidatePdfJsDocument(id);
    set((s) => {
      const remainingEntryIds = new Set(
        s.pageEntries.filter((e) => e.documentId !== id).map((e) => e.id),
      );
      return {
        documents: s.documents.filter((d) => d.id !== id),
        pageEntries: s.pageEntries.filter((e) => e.documentId !== id),
        expandedDocumentIds: s.expandedDocumentIds.filter((x) => x !== id),
        selectedPageIds: s.selectedPageIds.filter((pid) =>
          remainingEntryIds.has(pid),
        ),
        selectionAnchorId:
          s.selectionAnchorId && remainingEntryIds.has(s.selectionAnchorId)
            ? s.selectionAnchorId
            : null,
      };
    });
  },

  toggleExpanded: (id) =>
    set((s) => ({
      expandedDocumentIds: s.expandedDocumentIds.includes(id)
        ? s.expandedDocumentIds.filter((x) => x !== id)
        : [...s.expandedDocumentIds, id],
    })),

  reorderDocuments: (fromIndex, toIndex) => {
    const { documents, pageEntries } = get();
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
    set({
      documents: copy,
      pageEntries: regroupPageEntries(pageEntries, newOrderIds),
    });
  },

  togglePageHidden: (entryId) =>
    set((s) => ({
      pageEntries: s.pageEntries.map((e) =>
        e.id === entryId ? { ...e, hidden: !e.hidden } : e,
      ),
    })),

  selectPageEntry: (entryId, { shiftKey }) => {
    const { pageEntries, selectionAnchorId } = get();
    if (shiftKey && selectionAnchorId) {
      const ia = pageEntries.findIndex((e) => e.id === selectionAnchorId);
      const ib = pageEntries.findIndex((e) => e.id === entryId);
      if (ia < 0 || ib < 0) return;
      const [start, end] = ia <= ib ? [ia, ib] : [ib, ia];
      const ids = pageEntries.slice(start, end + 1).map((e) => e.id);
      set({ selectedPageIds: ids });
      return;
    }
    set({ selectedPageIds: [entryId], selectionAnchorId: entryId });
  },

  reorderPageEntriesInDocument: (documentId, fromLocalIndex, toLocalIndex) => {
    if (fromLocalIndex === toLocalIndex) return;
    const { pageEntries } = get();
    const positions: number[] = [];
    pageEntries.forEach((e, i) => {
      if (e.documentId === documentId) positions.push(i);
    });
    const local = positions.map((i) => pageEntries[i]);
    if (
      fromLocalIndex < 0 ||
      toLocalIndex < 0 ||
      fromLocalIndex >= local.length ||
      toLocalIndex >= local.length
    ) {
      return;
    }
    const reordered = [...local];
    const [moved] = reordered.splice(fromLocalIndex, 1);
    reordered.splice(toLocalIndex, 0, moved);
    const next = [...pageEntries];
    positions.forEach((pos, k) => {
      next[pos] = reordered[k];
    });
    set({ pageEntries: next });
  },

  setOptimizeSize: (optimizeSize) => set({ optimizeSize }),

  setUiPhase: (uiPhase) => set({ uiPhase }),

  exportPdf: async () => {
    const { pageEntries, documents, optimizeSize, selectedPageIds, projectName } =
      get();
    const useSelection = selectedPageIds.length > 0;

    const pages: {
      documentId: string;
      sourcePageIndex: number;
      rotation: number;
    }[] = [];
    for (const e of pageEntries) {
      if (e.hidden) continue;
      if (useSelection && !selectedPageIds.includes(e.id)) continue;
      pages.push({
        documentId: e.documentId,
        sourcePageIndex: e.sourcePageIndex,
        rotation: e.rotation ?? 0,
      });
    }

    if (pages.length === 0) {
      set({
        lastError:
          "No hay páginas para exportar (todas excluidas o la selección no coincide).",
      });
      return;
    }

    set({ uiPhase: "merging", lastError: null });

    try {
      const bytesMap = new Map(documents.map((d) => [d.id, d.bytes]));
      const pdfBytes = await exportMergedPdf(
        pages,
        (id) => bytesMap.get(id),
        { optimizeSize },
      );
      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildExportDownloadFilename(projectName, documents);
      a.click();
      URL.revokeObjectURL(url);
      set({
        uiPhase: "export_success",
        selectedPageIds: [],
        selectionAnchorId: null,
      });
    } catch (err) {
      console.error(err);
      set({
        uiPhase: "error",
        lastError:
          err instanceof Error
            ? err.message
            : "No se pudo generar el PDF de salida.",
      });
    }
  },
}));
