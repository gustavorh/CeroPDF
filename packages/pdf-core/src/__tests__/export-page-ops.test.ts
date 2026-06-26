import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { exportMergedPdf, type ExportPageRef } from "../merge";

async function makePdf(width: number, height: number): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  pdf.addPage([width, height]);
  const out = await pdf.save();
  const copy = new ArrayBuffer(out.byteLength);
  new Uint8Array(copy).set(out);
  return copy;
}

describe("exportMergedPdf — resize", () => {
  it("scales the page size by a scale factor", async () => {
    const doc = await makePdf(200, 400);
    const pages: ExportPageRef[] = [
      { documentId: "a", sourcePageIndex: 0, rotation: 0, resize: { kind: "scale", factor: 0.5 } },
    ];
    const merged = await exportMergedPdf(pages, () => doc, { optimizeSize: false });
    const parsed = await PDFDocument.load(merged);
    const { width, height } = parsed.getPage(0).getSize();
    expect(Math.round(width)).toBe(100);
    expect(Math.round(height)).toBe(200);
  });

  it("resizes to a target size in points", async () => {
    const doc = await makePdf(200, 400);
    const pages: ExportPageRef[] = [
      { documentId: "a", sourcePageIndex: 0, rotation: 0, resize: { kind: "size", width: 595, height: 842 } },
    ];
    const merged = await exportMergedPdf(pages, () => doc, { optimizeSize: false });
    const parsed = await PDFDocument.load(merged);
    const { width, height } = parsed.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });
});

describe("exportMergedPdf — crop", () => {
  it("applies a normalized crop box in page points", async () => {
    const doc = await makePdf(200, 400);
    const pages: ExportPageRef[] = [
      { documentId: "a", sourcePageIndex: 0, rotation: 0, crop: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } },
    ];
    const merged = await exportMergedPdf(pages, () => doc, { optimizeSize: false });
    const parsed = await PDFDocument.load(merged);
    const box = parsed.getPage(0).getCropBox();
    expect(Math.round(box.x)).toBe(50);
    expect(Math.round(box.y)).toBe(100);
    expect(Math.round(box.width)).toBe(100);
    expect(Math.round(box.height)).toBe(200);
  });

  it("composes resize then crop against the resized size", async () => {
    const doc = await makePdf(200, 400);
    const pages: ExportPageRef[] = [
      {
        documentId: "a",
        sourcePageIndex: 0,
        rotation: 0,
        resize: { kind: "scale", factor: 0.5 },
        crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
      },
    ];
    const merged = await exportMergedPdf(pages, () => doc, { optimizeSize: false });
    const parsed = await PDFDocument.load(merged);
    const box = parsed.getPage(0).getCropBox();
    // resized 200x400 → 100x200; crop 0.5 → 50x100
    expect(Math.round(box.width)).toBe(50);
    expect(Math.round(box.height)).toBe(100);
  });
});
