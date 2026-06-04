"use client";

let workerConfigured = false;

/**
 * pdf.js must load its worker from same origin (no third-party fetch of user data).
 */
export async function ensurePdfjsConfigured(): Promise<void> {
  if (typeof window === "undefined" || workerConfigured) return;
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
  workerConfigured = true;
}
