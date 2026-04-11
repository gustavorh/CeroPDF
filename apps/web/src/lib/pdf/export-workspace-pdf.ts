import { degrees, PDFDocument } from "pdf-lib";

export type ExportPageRef = {
  documentId: string;
  /** 0-based index in the source PDF */
  sourcePageIndex: number;
  /** Rotación de salida en grados (0, 90, 180, 270). */
  rotation: number;
};

/** Reduce metadata on the merged output (PRD §5.4 — optimizar tamaño). */
function stripMergedDocumentMetadata(pdf: PDFDocument): void {
  pdf.setTitle("");
  pdf.setAuthor("");
  pdf.setSubject("");
  pdf.setKeywords([]);
  pdf.setCreator("");
  pdf.setProducer("");
  pdf.setLanguage("");
}

/**
 * Builds a merged PDF from ordered page refs. Each source document is loaded once.
 */
export async function exportMergedPdf(
  pages: ExportPageRef[],
  getBytesForDocument: (documentId: string) => ArrayBuffer | undefined,
  options: { optimizeSize: boolean },
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const loaded = new Map<string, PDFDocument>();

  for (let i = 0; i < pages.length; i++) {
    const ref = pages[i];
    const bytes = getBytesForDocument(ref.documentId);
    if (!bytes) {
      throw new Error(`No hay datos en memoria para el documento ${ref.documentId}.`);
    }
    let src = loaded.get(ref.documentId);
    if (!src) {
      src = await PDFDocument.load(bytes, { updateMetadata: false });
      loaded.set(ref.documentId, src);
    }
    const copied = await out.copyPages(src, [ref.sourcePageIndex]);
    for (const page of copied) {
      const rot = ((ref.rotation ?? 0) % 360 + 360) % 360;
      if (rot !== 0) {
        page.setRotation(degrees(rot));
      }
      out.addPage(page);
    }
    if (i > 0 && i % 10 === 0) {
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  if (options.optimizeSize) {
    stripMergedDocumentMetadata(out);
  }

  return out.save({
    useObjectStreams: options.optimizeSize ? false : true,
    objectsPerTick: 50,
  });
}
