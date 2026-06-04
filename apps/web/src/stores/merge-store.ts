import { create } from "zustand";

import { readDocumentBytes } from "@ceropdf/pdf-core";

import {
  buildExportDownloadFilename,
  defaultProjectDisplayName,
} from "@/lib/project-display-name";
import type { PageEntry, WorkspaceDocument } from "@/types/workspace";

import { useDocumentStore } from "./document-store";
import { useSelectionStore } from "./selection-store";

type MergeState = {
  pageEntries: PageEntry[];
  projectName: string | null;
  optimizeSize: boolean;
  expandedDocumentIds: string[];

  addDocumentsFromFiles: (files: FileList | File[]) => Promise<void>;
  removeDocument: (id: string) => void;
  resetWorkspace: () => void;

  reorderDocuments: (fromIndex: number, toIndex: number) => void;
  toggleExpanded: (id: string) => void;

  togglePageHidden: (entryId: string) => void;
  removePageEntry: (entryId: string) => void;
  rotatePageClockwise: (entryId: string) => void;
  rotatePageCounterClockwise: (entryId: string) => void;
  reorderPageEntriesInDocument: (
    documentId: string,
    fromLocalIndex: number,
    toLocalIndex: number,
  ) => void;

  selectPageEntry: (entryId: string, options: { shiftKey: boolean }) => void;
  clearSelection: () => void;

  setProjectName: (name: string) => void;
  setOptimizeSize: (value: boolean) => void;

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

function pruneSelectionToCurrentEntries(pageEntries: PageEntry[]): void {
  const validIds = new Set(pageEntries.map((e) => e.id));
  useSelectionStore.getState().pruneTo(validIds);
}

export const useMergeStore = create<MergeState>()((set, get) => ({
  pageEntries: [],
  projectName: null,
  optimizeSize: false,
  expandedDocumentIds: [],

  addDocumentsFromFiles: async (files) => {
    const newDocs = await useDocumentStore.getState().addDocumentsFromFiles(files);
    if (newDocs.length === 0) return;

    const newEntries = newDocs.flatMap((d) =>
      buildPageEntries(d.id, d.pageCount),
    );

    set((s) => {
      const allDocs: WorkspaceDocument[] = [
        ...useDocumentStore.getState().documents,
      ];
      return {
        pageEntries: [...s.pageEntries, ...newEntries],
        projectName: s.projectName ?? defaultProjectDisplayName(allDocs),
      };
    });
  },

  removeDocument: (id) => {
    useDocumentStore.getState().removeDocument(id);
    set((s) => ({
      pageEntries: s.pageEntries.filter((e) => e.documentId !== id),
      expandedDocumentIds: s.expandedDocumentIds.filter((x) => x !== id),
    }));
    pruneSelectionToCurrentEntries(get().pageEntries);
  },

  resetWorkspace: () => {
    useDocumentStore.getState().clearAll();
    useSelectionStore.getState().clear();
    set({
      pageEntries: [],
      projectName: null,
      optimizeSize: false,
      expandedDocumentIds: [],
    });
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
    set((s) => ({
      pageEntries: regroupPageEntries(s.pageEntries, newOrderIds),
    }));
  },

  toggleExpanded: (id) =>
    set((s) => ({
      expandedDocumentIds: s.expandedDocumentIds.includes(id)
        ? s.expandedDocumentIds.filter((x) => x !== id)
        : [...s.expandedDocumentIds, id],
    })),

  togglePageHidden: (entryId) =>
    set((s) => ({
      pageEntries: s.pageEntries.map((e) =>
        e.id === entryId ? { ...e, hidden: !e.hidden } : e,
      ),
    })),

  removePageEntry: (entryId) => {
    set((s) => ({
      pageEntries: s.pageEntries.filter((e) => e.id !== entryId),
    }));
    pruneSelectionToCurrentEntries(get().pageEntries);
  },

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

  selectPageEntry: (entryId, { shiftKey }) => {
    const orderedIds = get().pageEntries.map((e) => e.id);
    useSelectionStore.getState().select(entryId, orderedIds, { shiftKey });
  },

  clearSelection: () => useSelectionStore.getState().clear(),

  setProjectName: (name) => set({ projectName: name.trim() || null }),

  setOptimizeSize: (optimizeSize) => set({ optimizeSize }),

  exportPdf: async () => {
    const { pageEntries, optimizeSize, projectName } = get();
    const { documents, setUiPhase, setError } = useDocumentStore.getState();
    const { selectedIds } = useSelectionStore.getState();
    const useSelection = selectedIds.length > 0;
    const selectionSet = new Set(selectedIds);

    const pages: {
      documentId: string;
      sourcePageIndex: number;
      rotation: number;
    }[] = [];
    for (const e of pageEntries) {
      if (e.hidden) continue;
      if (useSelection && !selectionSet.has(e.id)) continue;
      pages.push({
        documentId: e.documentId,
        sourcePageIndex: e.sourcePageIndex,
        rotation: e.rotation ?? 0,
      });
    }

    if (pages.length === 0) {
      setError(
        "No hay páginas para exportar (todas excluidas o la selección no coincide).",
      );
      return;
    }

    setUiPhase("merging");
    useDocumentStore.getState().clearError();

    try {
      // Lazy-load the pdf-lib-backed merge entry point.
      const { exportMergedPdf } = await import("@ceropdf/pdf-core");
      const docsById = new Map(documents.map((d) => [d.id, d]));
      const pdfBytes = await exportMergedPdf(
        pages,
        (id) => {
          const doc = docsById.get(id);
          return doc ? readDocumentBytes(doc.backing) : undefined;
        },
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
      useDocumentStore.getState().setUiPhase("export_success");
      useSelectionStore.getState().clear();
    } catch (err) {
      console.error(err);
      setUiPhase("error");
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo generar el PDF de salida.",
      );
    }
  },
}));
