import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { exportMergedPdf, type ExportPageRef } from "../merge";

async function makePdfWithPages(count: number): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < count; i++) {
    pdf.addPage([595, 842]);
  }
  const out = await pdf.save();
  // Detach to a fresh ArrayBuffer to mimic what file.arrayBuffer() returns.
  const copy = new ArrayBuffer(out.byteLength);
  new Uint8Array(copy).set(out);
  return copy;
}

describe("exportMergedPdf", () => {
  it("merges multiple documents in the requested page order", async () => {
    const docA = await makePdfWithPages(3);
    const docB = await makePdfWithPages(2);

    const pages: ExportPageRef[] = [
      { documentId: "a", sourcePageIndex: 1, rotation: 0 },
      { documentId: "b", sourcePageIndex: 0, rotation: 90 },
      { documentId: "a", sourcePageIndex: 0, rotation: 0 },
    ];

    const merged = await exportMergedPdf(
      pages,
      (id) => (id === "a" ? docA : id === "b" ? docB : undefined),
      { optimizeSize: false },
    );

    const parsed = await PDFDocument.load(merged);
    expect(parsed.getPageCount()).toBe(3);
  });

  it("supports async byte providers (OPFS-style)", async () => {
    const docA = await makePdfWithPages(2);
    const pages: ExportPageRef[] = [
      { documentId: "a", sourcePageIndex: 0, rotation: 0 },
      { documentId: "a", sourcePageIndex: 1, rotation: 0 },
    ];

    const merged = await exportMergedPdf(
      pages,
      async (id) => (id === "a" ? docA : undefined),
      { optimizeSize: true },
    );

    const parsed = await PDFDocument.load(merged);
    expect(parsed.getPageCount()).toBe(2);
    // optimizeSize strips title metadata.
    expect(parsed.getTitle() ?? "").toBe("");
  });

  it("throws a helpful error when a document is missing", async () => {
    const pages: ExportPageRef[] = [
      { documentId: "missing", sourcePageIndex: 0, rotation: 0 },
    ];
    await expect(
      exportMergedPdf(pages, () => undefined, { optimizeSize: false }),
    ).rejects.toThrow(/No hay datos/);
  });
});
