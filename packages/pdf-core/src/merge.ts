import { degrees, PDFDocument } from "pdf-lib";

export type CropRect = {
  /** Normalized 0–1 against the (post-resize) page size, PDF user space
   *  (origin bottom-left), measured on the unrotated page. */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResizeDirective =
  | { kind: "size"; width: number; height: number } // target size in PDF points
  | { kind: "scale"; factor: number };

export type ExportPageRef = {
  documentId: string;
  /** 0-based index in the source PDF */
  sourcePageIndex: number;
  /** Output rotation in degrees (0, 90, 180, 270). */
  rotation: number;
  /** Resize directive, applied before rotation/crop. `size` may change the aspect ratio. */
  resize?: ResizeDirective;
  /** Crop box in normalized page coordinates. */
  crop?: CropRect;
};

/** Callback used by the merger to fetch bytes per document. May be async (OPFS) or sync (memory). */
export type BytesProvider = (
  documentId: string,
) => Promise<ArrayBuffer | undefined> | ArrayBuffer | undefined;

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
 * Tolerates async byte providers so callers can stream from OPFS without buffering all docs in memory.
 */
export async function exportMergedPdf(
  pages: ExportPageRef[],
  getBytesForDocument: BytesProvider,
  options: { optimizeSize: boolean },
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const loaded = new Map<string, PDFDocument>();

  for (let i = 0; i < pages.length; i++) {
    const ref = pages[i];
    let src = loaded.get(ref.documentId);
    if (!src) {
      const bytes = await Promise.resolve(getBytesForDocument(ref.documentId));
      if (!bytes) {
        throw new Error(
          `No hay datos en memoria para el documento ${ref.documentId}.`,
        );
      }
      src = await PDFDocument.load(bytes, { updateMetadata: false });
      loaded.set(ref.documentId, src);
    }
    const copied = await out.copyPages(src, [ref.sourcePageIndex]);
    for (const page of copied) {
      if (ref.resize) {
        if (ref.resize.kind === "scale") {
          page.scale(ref.resize.factor, ref.resize.factor);
        } else {
          const { width, height } = page.getSize();
          page.scale(ref.resize.width / width, ref.resize.height / height);
        }
      }
      const rot = (((ref.rotation ?? 0) % 360) + 360) % 360;
      if (rot !== 0) {
        page.setRotation(degrees(rot));
      }
      if (ref.crop) {
        const mb = page.getMediaBox();
        page.setCropBox(
          mb.x + ref.crop.x * mb.width,
          mb.y + ref.crop.y * mb.height,
          ref.crop.width * mb.width,
          ref.crop.height * mb.height,
        );
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
