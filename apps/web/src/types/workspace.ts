import type { CropRect, DocumentBacking } from "@ceropdf/pdf-core";

/** One page in the flat export sequence. */
export type PageEntry = {
  id: string;
  documentId: string;
  /** 0-based page index in the source PDF */
  sourcePageIndex: number;
  /** Excluded from export. */
  hidden: boolean;
  /** Rotación adicional en grados (0, 90, 180, 270) para vista previa y exportación. */
  rotation: number;
  /** Recorte normalizado 0–1 en espacio de página sin rotar. Ausente = sin recorte. */
  crop?: CropRect;
};

/** Parsed PDF on the canvas. Bytes live either in memory (small) or in OPFS (large). */
export type WorkspaceDocument = {
  id: string;
  name: string;
  sizeBytes: number;
  pageCount: number;
  backing: DocumentBacking;
};
