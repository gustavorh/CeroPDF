/** One page in the flat export sequence (PRD §6). */
export type PageEntry = {
  id: string;
  documentId: string;
  /** 0-based page index in the source PDF */
  sourcePageIndex: number;
  /** Excluded from export (PRD Feature 3). */
  hidden: boolean;
};

/** Parsed PDF on the canvas (metadata + bytes in memory). */
export type WorkspaceDocument = {
  id: string;
  name: string;
  sizeBytes: number;
  bytes: ArrayBuffer;
  pageCount: number;
};
