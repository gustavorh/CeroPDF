import { describe, expect, it } from "vitest";

import type { PageEntry } from "@/types/workspace";

import {
  buildExportRefs,
  regroupByDocumentOrder,
  reorderInDocument,
} from "./build-export";

function entry(partial: Partial<PageEntry> & { id: string }): PageEntry {
  return {
    documentId: "d1",
    sourcePageIndex: 0,
    hidden: false,
    rotation: 0,
    ...partial,
  };
}

describe("buildExportRefs", () => {
  it("excludes hidden entries and preserves order + rotation", () => {
    const entries = [
      entry({ id: "p1", sourcePageIndex: 0, rotation: 90 }),
      entry({ id: "p2", sourcePageIndex: 1, hidden: true }),
      entry({ id: "p3", sourcePageIndex: 2 }),
    ];
    const refs = buildExportRefs(entries);
    expect(refs.map((r) => r.sourcePageIndex)).toEqual([0, 2]);
    expect(refs[0].rotation).toBe(90);
  });

  it("includes only selected entries when a selection is provided", () => {
    const entries = [
      entry({ id: "p1", sourcePageIndex: 0 }),
      entry({ id: "p2", sourcePageIndex: 1 }),
      entry({ id: "p3", sourcePageIndex: 2 }),
    ];
    const refs = buildExportRefs(entries, { selectedIds: new Set(["p1", "p3"]) });
    expect(refs.map((r) => r.sourcePageIndex)).toEqual([0, 2]);
  });

  it("carries the per-entry crop and applies a uniform resize to all refs", () => {
    const entries = [
      entry({ id: "p1", crop: { x: 0, y: 0, width: 0.5, height: 0.5 } }),
      entry({ id: "p2", sourcePageIndex: 1 }),
    ];
    const refs = buildExportRefs(entries, { resize: { kind: "scale", factor: 0.5 } });
    expect(refs[0].crop).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
    expect(refs[1].crop).toBeUndefined();
    expect(refs.every((r) => r.resize?.kind === "scale")).toBe(true);
  });
});

describe("reorderInDocument", () => {
  it("moves a page within its document, leaving other docs untouched", () => {
    const entries = [
      entry({ id: "a0", documentId: "A", sourcePageIndex: 0 }),
      entry({ id: "a1", documentId: "A", sourcePageIndex: 1 }),
      entry({ id: "a2", documentId: "A", sourcePageIndex: 2 }),
      entry({ id: "b0", documentId: "B", sourcePageIndex: 0 }),
    ];
    const next = reorderInDocument(entries, "A", 0, 2);
    expect(next.map((e) => e.id)).toEqual(["a1", "a2", "a0", "b0"]);
  });

  it("returns the same reference when indices are equal", () => {
    const entries = [entry({ id: "a0", documentId: "A" })];
    expect(reorderInDocument(entries, "A", 0, 0)).toBe(entries);
  });
});

describe("regroupByDocumentOrder", () => {
  it("reorders entries to follow a new document order", () => {
    const entries = [
      entry({ id: "a0", documentId: "A" }),
      entry({ id: "b0", documentId: "B" }),
      entry({ id: "a1", documentId: "A", sourcePageIndex: 1 }),
    ];
    const next = regroupByDocumentOrder(entries, ["B", "A"]);
    expect(next.map((e) => e.id)).toEqual(["b0", "a0", "a1"]);
  });

  it("drops entries whose documentId is absent from the order", () => {
    const entries = [
      entry({ id: "a0", documentId: "A" }),
      entry({ id: "b0", documentId: "B" }),
    ];
    const next = regroupByDocumentOrder(entries, ["A"]);
    expect(next.map((e) => e.id)).toEqual(["a0"]);
  });
});
