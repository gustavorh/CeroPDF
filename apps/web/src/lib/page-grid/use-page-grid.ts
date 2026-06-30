import { create } from "zustand";

import { readDocumentBytes } from "@ceropdf/pdf-core";

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
  /** When true, a non-empty selection narrows the export to selected pages (Extract, merge). */
  exportUsesSelection: boolean;
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
  rotateAll: (delta: 90 | -90) => void;
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
      if (!config.multiDoc && useDocumentStore.getState().documents.length > 0) {
        useDocumentStore.getState().clearAll();
        useSelectionStore.getState().clear();
        set({ pageEntries: [] });
      }
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

    rotateAll: (delta) =>
      set((s) => ({
        pageEntries: s.pageEntries.map((e) => ({
          ...e,
          rotation: ((((e.rotation ?? 0) + delta) % 360) + 360) % 360,
        })),
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
      const selectedIds = config.exportUsesSelection
        ? useSelectionStore.getState().selectedIds
        : [];

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
        const { exportMergedPdf } = await import("@ceropdf/pdf-core");
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
