"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";

import { ensurePdfjsConfigured } from "./config";
import {
  getCachedPdfJsDocument,
  setCachedPdfJsDocument,
} from "./document-cache";

/** One in-flight load per document so concurrent thumbnails share a single `getDocument` (avoids destroying each other's proxy). */
const inFlightLoads = new Map<string, Promise<PDFDocumentProxy>>();

export async function loadPdfJsDocument(
  documentId: string,
  bytes: ArrayBuffer,
): Promise<PDFDocumentProxy> {
  const cached = getCachedPdfJsDocument(documentId);
  if (cached) return cached;

  const existing = inFlightLoads.get(documentId);
  if (existing) return existing;

  const promise = loadPdfDocumentOnce(documentId, bytes);
  inFlightLoads.set(documentId, promise);
  void promise.finally(() => {
    inFlightLoads.delete(documentId);
  });

  return promise;
}

async function loadPdfDocumentOnce(
  documentId: string,
  bytes: ArrayBuffer,
): Promise<PDFDocumentProxy> {
  await ensurePdfjsConfigured();

  const cachedAgain = getCachedPdfJsDocument(documentId);
  if (cachedAgain) return cachedAgain;

  const pdfjs = await import("pdfjs-dist");
  // pdf.js may transfer/detach the buffer to the worker; keep the store copy intact for pdf-lib export.
  const task = pdfjs.getDocument({ data: bytes.slice(0), useSystemFonts: true });
  const doc = await task.promise;
  setCachedPdfJsDocument(documentId, doc);
  return doc;
}
