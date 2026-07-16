import { create } from "zustand";

import type { Annotation } from "@ceropdf/pdf-core";
import { readDocumentBytes } from "@ceropdf/pdf-core/storage";

import { useDocumentStore } from "./document-store";

export type EditTool = "select" | "text" | "rect" | "highlight";

type EditState = {
  /** Edit is single-doc by design. */
  activeDocumentId: string | null;
  activePageIndex: number;
  pageCount: number;
  annotations: Annotation[];
  activeTool: EditTool;
  selectedAnnotationId: string | null;

  loadDocument: (files: FileList | File[]) => Promise<void>;
  setActivePage: (page: number) => void;
  setActiveTool: (tool: EditTool) => void;

  addAnnotation: (ann: Annotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  clearAllAnnotations: () => void;

  exportFlattened: () => Promise<void>;
  resetWorkspace: () => void;
};

export const useEditStore = create<EditState>()((set, get) => ({
  activeDocumentId: null,
  activePageIndex: 0,
  pageCount: 0,
  annotations: [],
  activeTool: "select",
  selectedAnnotationId: null,

  loadDocument: async (files) => {
    const { addDocumentsFromFiles, clearAll } = useDocumentStore.getState();
    // Edit is single-doc; replace the workspace.
    if (get().activeDocumentId) clearAll();

    const added = await addDocumentsFromFiles(files);
    if (added.length === 0) return;
    const first = added[0];
    set({
      activeDocumentId: first.id,
      pageCount: first.pageCount,
      activePageIndex: 0,
      annotations: [],
      activeTool: "select",
      selectedAnnotationId: null,
    });
  },

  setActivePage: (page) => {
    const { pageCount } = get();
    if (page < 0 || page >= pageCount) return;
    set({ activePageIndex: page, selectedAnnotationId: null });
  },

  setActiveTool: (activeTool) =>
    set({ activeTool, selectedAnnotationId: null }),

  addAnnotation: (ann) =>
    set((s) => ({
      annotations: [...s.annotations, ann],
      selectedAnnotationId: ann.id,
    })),

  updateAnnotation: (id, patch) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? ({ ...a, ...patch } as Annotation) : a,
      ),
    })),

  removeAnnotation: (id) =>
    set((s) => ({
      annotations: s.annotations.filter((a) => a.id !== id),
      selectedAnnotationId:
        s.selectedAnnotationId === id ? null : s.selectedAnnotationId,
    })),

  selectAnnotation: (selectedAnnotationId) => set({ selectedAnnotationId }),

  clearAllAnnotations: () =>
    set({ annotations: [], selectedAnnotationId: null }),

  exportFlattened: async () => {
    const { activeDocumentId, annotations } = get();
    if (!activeDocumentId) return;
    const { documents, setUiPhase, setError } = useDocumentStore.getState();
    const doc = documents.find((d) => d.id === activeDocumentId);
    if (!doc) {
      setError("El documento ya no está cargado.");
      return;
    }

    // Clear any prior error before entering the export phase (no stale-error flash).
    useDocumentStore.getState().clearError();
    setUiPhase("merging");

    try {
      const { flattenAnnotations } = await import("@ceropdf/pdf-core");
      const bytes = await readDocumentBytes(doc.backing);
      const outBytes = await flattenAnnotations(bytes, annotations);
      const blob = new Blob([new Uint8Array(outBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const base = doc.name.replace(/\.pdf$/i, "");
      a.download = `${base}.editado.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setUiPhase("export_success");
    } catch (err) {
      console.error(err);
      setUiPhase("error");
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo exportar el PDF editado.",
      );
    }
  },

  resetWorkspace: () => {
    useDocumentStore.getState().clearAll();
    set({
      activeDocumentId: null,
      activePageIndex: 0,
      pageCount: 0,
      annotations: [],
      activeTool: "select",
      selectedAnnotationId: null,
    });
  },
}));
