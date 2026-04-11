"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

const cache = new Map<string, PDFDocumentProxy>();

export function getCachedPdfJsDocument(
  documentId: string,
): PDFDocumentProxy | undefined {
  return cache.get(documentId);
}

export function setCachedPdfJsDocument(
  documentId: string,
  doc: PDFDocumentProxy,
): void {
  const prev = cache.get(documentId);
  if (prev && prev !== doc) {
    void prev.destroy();
  }
  cache.set(documentId, doc);
}

export function invalidatePdfJsDocument(documentId: string): void {
  const doc = cache.get(documentId);
  if (doc) {
    void doc.destroy();
    cache.delete(documentId);
  }
}

export function clearPdfJsDocumentCache(): void {
  for (const doc of cache.values()) {
    void doc.destroy();
  }
  cache.clear();
}
