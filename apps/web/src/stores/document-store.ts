import { create } from "zustand";

import {
  type DocumentBacking,
  MAX_COMBINED_PAGES,
  MAX_FILE_BYTES,
  OPFS_THRESHOLD_BYTES,
  clearOpfsDir,
  deleteOpfsFile,
  isOpfsSupported,
  writeOpfsFile,
} from "@ceropdf/pdf-core";
import {
  clearPdfJsDocumentCache,
  invalidatePdfJsDocument,
} from "@ceropdf/pdf-render";

import type { WorkspaceDocument } from "@/types/workspace";

/** Feedback de estado compartido por todas las herramientas. */
export type UiPhase =
  | "idle"
  | "loading"
  | "parsing"
  | "rendering"
  | "merging"
  | "processing"
  | "export_success"
  | "error";

type DocumentState = {
  documents: WorkspaceDocument[];
  uiPhase: UiPhase;
  lastError: string | null;
  thumbnailRenderCount: number;

  setUiPhase: (phase: UiPhase) => void;
  setError: (message: string) => void;
  clearError: () => void;
  beginThumbnailRender: () => void;
  endThumbnailRender: () => void;

  /**
   * Parses files, validates limits, appends to `documents`, and returns the new docs.
   * Tool stores wrap this to add their own derived state (e.g. page entries for merge).
   * Large files are written to OPFS to keep heap usage flat.
   */
  addDocumentsFromFiles: (files: FileList | File[]) => Promise<WorkspaceDocument[]>;
  /** Removes one document, invalidates pdfjs cache, deletes OPFS file if any. */
  removeDocument: (id: string) => void;
  /** Clears all documents, pdfjs caches, and the OPFS sandbox. */
  clearAll: () => void;
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

async function makeBacking(
  documentId: string,
  bytes: ArrayBuffer,
  fileSizeBytes: number,
): Promise<DocumentBacking> {
  if (fileSizeBytes <= OPFS_THRESHOLD_BYTES) {
    return { kind: "memory", bytes };
  }
  if (!(await isOpfsSupported())) {
    return { kind: "memory", bytes };
  }
  const handle = await writeOpfsFile(`${documentId}.pdf`, bytes);
  return { kind: "opfs", handle };
}

async function releaseBacking(backing: DocumentBacking): Promise<void> {
  if (backing.kind === "opfs") {
    await deleteOpfsFile(backing.handle.name);
  }
}

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  documents: [],
  uiPhase: "idle",
  lastError: null,
  thumbnailRenderCount: 0,

  setUiPhase: (uiPhase) => set({ uiPhase }),
  setError: (lastError) => set({ lastError }),
  clearError: () => set({ lastError: null }),

  beginThumbnailRender: () =>
    set((s) => ({ thumbnailRenderCount: s.thumbnailRenderCount + 1 })),

  endThumbnailRender: () =>
    set((s) => ({
      thumbnailRenderCount: Math.max(0, s.thumbnailRenderCount - 1),
    })),

  addDocumentsFromFiles: async (files) => {
    const list = Array.from(files).filter(isPdfFile);
    if (list.length === 0) {
      set({
        lastError:
          "Solo se admiten archivos PDF. Comprueba el nombre o el tipo.",
      });
      return [];
    }

    for (const file of list) {
      if (file.size > MAX_FILE_BYTES) {
        set({
          lastError:
            "Archivo muy pesado. Límite de 250 MB para procesamiento seguro en navegador.",
        });
        return [];
      }
    }

    set({ uiPhase: "loading", lastError: null });

    // Lazy-load pdf-lib only when the user actually opens a file.
    const { PDFDocument } = await import("pdf-lib");

    const parsed: Array<{
      id: string;
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
        parsed.push({ id: newId(), file, bytes, pageCount });
      } catch {
        set({
          lastError:
            "No se pudo leer el archivo. Puede estar corrupto o protegido por contraseña.",
          uiPhase: "idle",
        });
        return [];
      }
    }

    const existingTotal = get().documents.reduce((s, d) => s + d.pageCount, 0);
    const newTotal = parsed.reduce((s, p) => s + p.pageCount, 0);
    if (existingTotal + newTotal > MAX_COMBINED_PAGES) {
      set({
        lastError: `Demasiadas páginas en total. El límite es ${MAX_COMBINED_PAGES} páginas combinadas.`,
        uiPhase: "idle",
      });
      return [];
    }

    const newDocs: WorkspaceDocument[] = await Promise.all(
      parsed.map(async (p) => ({
        id: p.id,
        name: p.file.name,
        sizeBytes: p.file.size,
        pageCount: p.pageCount,
        backing: await makeBacking(p.id, p.bytes, p.file.size),
      })),
    );

    set((s) => ({
      documents: [...s.documents, ...newDocs],
      uiPhase: "idle",
      lastError: null,
    }));

    return newDocs;
  },

  removeDocument: (id) => {
    invalidatePdfJsDocument(id);
    const doc = get().documents.find((d) => d.id === id);
    if (doc) {
      void releaseBacking(doc.backing);
    }
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== id),
    }));
  },

  clearAll: () => {
    const { documents } = get();
    for (const d of documents) {
      invalidatePdfJsDocument(d.id);
    }
    clearPdfJsDocumentCache();
    void clearOpfsDir();
    set({
      documents: [],
      uiPhase: "idle",
      lastError: null,
      thumbnailRenderCount: 0,
    });
  },
}));
