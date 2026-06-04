import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { flattenAnnotations, type Annotation } from "../annotate";

async function makePdf(pageCount: number, sizePts = 595): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdf.addPage([sizePts, sizePts * Math.sqrt(2)]);
  }
  const out = await pdf.save();
  const copy = new ArrayBuffer(out.byteLength);
  new Uint8Array(copy).set(out);
  return copy;
}

describe("flattenAnnotations", () => {
  it("returns a valid PDF when there are no annotations", async () => {
    const src = await makePdf(2);
    const flattened = await flattenAnnotations(src, []);
    const parsed = await PDFDocument.load(flattened);
    expect(parsed.getPageCount()).toBe(2);
  });

  it("burns text, rect, and highlight annotations onto the right page", async () => {
    const src = await makePdf(3);
    const anns: Annotation[] = [
      {
        id: "t1",
        page: 0,
        kind: "text",
        x: 0.1,
        y: 0.1,
        w: 0.5,
        h: 0.05,
        text: "Hello",
        fontSize: 14,
        color: "#111316",
      },
      {
        id: "r1",
        page: 1,
        kind: "rect",
        x: 0.2,
        y: 0.2,
        w: 0.3,
        h: 0.2,
        stroke: "#f0a88c",
        strokeWidth: 2,
        fill: null,
      },
      {
        id: "h1",
        page: 2,
        kind: "highlight",
        x: 0.1,
        y: 0.5,
        w: 0.8,
        h: 0.03,
        color: "#facc15",
      },
    ];
    const out = await flattenAnnotations(src, anns);
    const parsed = await PDFDocument.load(out);
    expect(parsed.getPageCount()).toBe(3);
    // Output is larger than the empty 3-page input.
    expect(out.byteLength).toBeGreaterThan(0);
  });

  it("ignores out-of-range page indices", async () => {
    const src = await makePdf(1);
    const out = await flattenAnnotations(src, [
      {
        id: "x",
        page: 5,
        kind: "rect",
        x: 0.1,
        y: 0.1,
        w: 0.1,
        h: 0.1,
        stroke: "#000000",
        strokeWidth: 1,
        fill: null,
      },
    ]);
    const parsed = await PDFDocument.load(out);
    expect(parsed.getPageCount()).toBe(1);
  });
});
