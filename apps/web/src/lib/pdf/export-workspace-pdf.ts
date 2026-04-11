import { PDFDocument } from "pdf-lib";

export type ExportPageRef = {
  documentId: string;
  /** 0-based index in the source PDF */
  sourcePageIndex: number;
};

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

  for (const ref of pages) {
    const bytes = getBytesForDocument(ref.documentId);
    if (!bytes) {
      throw new Error(`No hay datos en memoria para el documento ${ref.documentId}.`);
    }
    let src = loaded.get(ref.documentId);
    if (!src) {
      src = await PDFDocument.load(bytes);
      loaded.set(ref.documentId, src);
    }
    const copied = await out.copyPages(src, [ref.sourcePageIndex]);
    for (const page of copied) {
      out.addPage(page);
    }
  }

  return out.save({
    useObjectStreams: options.optimizeSize ? false : true,
  });
}
