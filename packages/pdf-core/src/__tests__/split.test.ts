import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  parseRanges,
  splitPdfByPage,
  splitPdfByRanges,
} from "../split";

async function makePdf(pageCount: number): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    pdf.addPage([595, 842]);
  }
  const out = await pdf.save();
  const copy = new ArrayBuffer(out.byteLength);
  new Uint8Array(copy).set(out);
  return copy;
}

describe("parseRanges", () => {
  it("parses single pages and ranges", () => {
    expect(parseRanges("1-3, 5, 7-10", 10)).toEqual([
      { start: 1, end: 3 },
      { start: 5, end: 5 },
      { start: 7, end: 10 },
    ]);
  });

  it("rejects empty input", () => {
    expect(() => parseRanges("", 10)).toThrow();
  });

  it("rejects out-of-bounds ranges", () => {
    expect(() => parseRanges("1-15", 10)).toThrow(/fuera del documento/);
  });

  it("rejects inverted ranges", () => {
    expect(() => parseRanges("5-3", 10)).toThrow(/inverso/);
  });

  it("rejects overlapping ranges", () => {
    expect(() => parseRanges("1-3, 2-4", 10)).toThrow(/más de una vez/);
  });

  it("rejects malformed tokens", () => {
    expect(() => parseRanges("a-b", 10)).toThrow();
    expect(() => parseRanges("--", 10)).toThrow();
  });
});

describe("splitPdfByRanges", () => {
  it("produces one output per range with correct page counts", async () => {
    const src = await makePdf(10);
    const out = await splitPdfByRanges(src, [
      { start: 1, end: 3 },
      { start: 5, end: 5 },
      { start: 7, end: 10 },
    ]);
    expect(out.map((c) => c.label)).toEqual(["1-3", "5", "7-10"]);
    const pageCounts = await Promise.all(
      out.map(async (c) => (await PDFDocument.load(c.bytes)).getPageCount()),
    );
    expect(pageCounts).toEqual([3, 1, 4]);
  });
});

describe("splitPdfByPage", () => {
  it("returns one PDF per page", async () => {
    const src = await makePdf(4);
    const out = await splitPdfByPage(src);
    expect(out.length).toBe(4);
    expect(out.map((c) => c.label)).toEqual(["1", "2", "3", "4"]);
  });
});
