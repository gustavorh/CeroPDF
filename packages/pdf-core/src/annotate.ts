import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Annotations are stored in UI-friendly normalized coordinates:
 *   - (0, 0) is the top-left of the page.
 *   - x, y, w, h are in [0, 1] proportional to the page's rendered size.
 * Flatten time converts to pdf-lib's bottom-left origin in PDF points.
 */
export type AnnotationBase = {
  id: string;
  /** 0-based page index */
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TextAnnotation = AnnotationBase & {
  kind: "text";
  text: string;
  /** Size in PDF points. */
  fontSize: number;
  /** Hex color (e.g. "#111316"). */
  color: string;
};

export type RectAnnotation = AnnotationBase & {
  kind: "rect";
  /** Hex stroke color. */
  stroke: string;
  /** Stroke width in PDF points. */
  strokeWidth: number;
  /** Hex fill color, or null for transparent. */
  fill: string | null;
};

export type HighlightAnnotation = AnnotationBase & {
  kind: "highlight";
  /** Hex color; drawn at ~35% opacity to mimic a marker. */
  color: string;
};

export type Annotation =
  | TextAnnotation
  | RectAnnotation
  | HighlightAnnotation;

function hexToColor(hex: string) {
  const cleaned = hex.replace("#", "").padEnd(6, "0").slice(0, 6);
  const r = Number.parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = Number.parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = Number.parseInt(cleaned.slice(4, 6), 16) / 255;
  return rgb(
    Number.isFinite(r) ? r : 0,
    Number.isFinite(g) ? g : 0,
    Number.isFinite(b) ? b : 0,
  );
}

/**
 * Burns annotations into the source PDF, producing a new PDF where the annotations are
 * permanent. Pages without annotations are passed through untouched.
 */
export async function flattenAnnotations(
  sourceBytes: ArrayBuffer,
  annotations: Annotation[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();

  const byPage = new Map<number, Annotation[]>();
  for (const ann of annotations) {
    const list = byPage.get(ann.page);
    if (list) list.push(ann);
    else byPage.set(ann.page, [ann]);
  }

  let yieldCounter = 0;

  for (const [pageIndex, list] of byPage.entries()) {
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    const page = pages[pageIndex];
    const { width: pageW, height: pageH } = page.getSize();

    for (const ann of list) {
      const xPdf = ann.x * pageW;
      const yPdfFromTop = ann.y * pageH;
      const widthPdf = ann.w * pageW;
      const heightPdf = ann.h * pageH;

      if (ann.kind === "text") {
        // Treat (ann.x, ann.y) as the top-left of the text box; convert to baseline.
        const baseline = pageH - yPdfFromTop - ann.fontSize * 0.85;
        page.drawText(ann.text, {
          x: xPdf,
          y: baseline,
          size: ann.fontSize,
          font: helvetica,
          color: hexToColor(ann.color),
        });
      } else if (ann.kind === "rect") {
        const yBottomLeft = pageH - yPdfFromTop - heightPdf;
        page.drawRectangle({
          x: xPdf,
          y: yBottomLeft,
          width: widthPdf,
          height: heightPdf,
          borderColor: hexToColor(ann.stroke),
          borderWidth: ann.strokeWidth,
          color: ann.fill ? hexToColor(ann.fill) : undefined,
        });
      } else if (ann.kind === "highlight") {
        const yBottomLeft = pageH - yPdfFromTop - heightPdf;
        page.drawRectangle({
          x: xPdf,
          y: yBottomLeft,
          width: widthPdf,
          height: heightPdf,
          color: hexToColor(ann.color),
          opacity: 0.35,
          borderWidth: 0,
        });
      }

      yieldCounter += 1;
      if (yieldCounter % 25 === 0) {
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
  }

  return pdf.save({ useObjectStreams: true, objectsPerTick: 50 });
}
