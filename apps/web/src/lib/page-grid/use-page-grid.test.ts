import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ceropdf/pdf-render", () => ({
  invalidatePdfJsDocument: vi.fn(),
  clearPdfJsDocumentCache: vi.fn(),
}));

const exportMergedPdfMock = vi.hoisted(() => vi.fn(async () => new Uint8Array()));
vi.mock("@ceropdf/pdf-core", async (orig) => ({
  ...(await orig<typeof import("@ceropdf/pdf-core")>()),
  exportMergedPdf: exportMergedPdfMock,
}));

vi.mock("@/lib/trigger-download", () => ({ triggerDownload: vi.fn() }));

import { useDocumentStore } from "@/stores/document-store";
import { useSelectionStore } from "@/stores/selection-store";
import type { PageEntry } from "@/types/workspace";

import { createPageGridStore, type PageGridConfig } from "./use-page-grid";

const CONFIG: PageGridConfig = {
  multiDoc: true,
  capabilities: { canReorder: true, canRotate: true, canHide: true, canRemove: true, canSelect: true },
  features: { projectName: true, optimizeSize: true },
  exportPhase: "merging",
  buildFilename: () => "out.pdf",
};

function entry(p: Partial<PageEntry> & { id: string }): PageEntry {
  return { documentId: "d1", sourcePageIndex: 0, hidden: false, rotation: 0, ...p };
}

beforeEach(() => {
  exportMergedPdfMock.mockClear();
  useSelectionStore.setState({ selectedIds: [], anchorId: null });
  useDocumentStore.setState({ documents: [], uiPhase: "idle", lastError: null });
});

describe("createPageGridStore — page ops", () => {
  it("rotates a page clockwise", () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({ pageEntries: [entry({ id: "p1" })] });
    useStore.getState().rotatePageClockwise("p1");
    expect(useStore.getState().pageEntries[0].rotation).toBe(90);
  });

  it("toggles a page hidden", () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({ pageEntries: [entry({ id: "p1" })] });
    useStore.getState().togglePageHidden("p1");
    expect(useStore.getState().pageEntries[0].hidden).toBe(true);
  });

  it("rotates a page counterclockwise", () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({ pageEntries: [entry({ id: "p1" })] });
    useStore.getState().rotatePageCounterClockwise("p1");
    expect(useStore.getState().pageEntries[0].rotation).toBe(270);
  });

  it("treats a same-index reorder as a no-op", () => {
    const useStore = createPageGridStore(CONFIG);
    const entries = [entry({ id: "p1" }), entry({ id: "p2", sourcePageIndex: 1 })];
    useStore.setState({ pageEntries: entries });
    useStore.getState().reorderPageEntriesInDocument("d1", 0, 0);
    expect(useStore.getState().pageEntries.map((e) => e.id)).toEqual(["p1", "p2"]);
  });

  it("removes a page entry and prunes the selection", () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({ pageEntries: [entry({ id: "p1" }), entry({ id: "p2", sourcePageIndex: 1 })] });
    useSelectionStore.setState({ selectedIds: ["p1", "p2"], anchorId: "p1" });
    useStore.getState().removePageEntry("p1");
    expect(useStore.getState().pageEntries.map((e) => e.id)).toEqual(["p2"]);
    expect(useSelectionStore.getState().selectedIds).toEqual(["p2"]);
  });

  it("removeDocument drops its page entries and prunes the selection", () => {
    const useStore = createPageGridStore(CONFIG);
    useDocumentStore.setState({
      documents: [
        { id: "A", name: "a.pdf", sizeBytes: 1, pageCount: 1, backing: { kind: "memory", bytes: new ArrayBuffer(0) } },
        { id: "B", name: "b.pdf", sizeBytes: 1, pageCount: 1, backing: { kind: "memory", bytes: new ArrayBuffer(0) } },
      ],
    });
    useStore.setState({ pageEntries: [entry({ id: "a0", documentId: "A" }), entry({ id: "b0", documentId: "B" })] });
    useSelectionStore.setState({ selectedIds: ["a0", "b0"], anchorId: "a0" });
    useStore.getState().removeDocument("A");
    expect(useStore.getState().pageEntries.map((e) => e.id)).toEqual(["b0"]);
    expect(useSelectionStore.getState().selectedIds).toEqual(["b0"]);
  });

  it("reorderDocuments reorders pages to follow the new document order", () => {
    const useStore = createPageGridStore(CONFIG);
    useDocumentStore.setState({
      documents: [
        { id: "A", name: "a.pdf", sizeBytes: 1, pageCount: 1, backing: { kind: "memory", bytes: new ArrayBuffer(0) } },
        { id: "B", name: "b.pdf", sizeBytes: 1, pageCount: 1, backing: { kind: "memory", bytes: new ArrayBuffer(0) } },
      ],
    });
    useStore.setState({ pageEntries: [entry({ id: "a0", documentId: "A" }), entry({ id: "b0", documentId: "B" })] });
    useStore.getState().reorderDocuments(0, 1);
    expect(useStore.getState().pageEntries.map((e) => e.id)).toEqual(["b0", "a0"]);
  });
});

describe("createPageGridStore — exportPdf semantics", () => {
  it("exports visible entries in order, carrying rotation, with optimizeSize", async () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({
      pageEntries: [
        entry({ id: "p1", sourcePageIndex: 0, rotation: 90 }),
        entry({ id: "p2", sourcePageIndex: 1, hidden: true }),
        entry({ id: "p3", sourcePageIndex: 2 }),
      ],
      optimizeSize: true,
    });
    await useStore.getState().exportPdf();
    expect(exportMergedPdfMock).toHaveBeenCalledTimes(1);
    const call = exportMergedPdfMock.mock.calls[0] as unknown as [
      Array<{ sourcePageIndex: number; rotation: number }>,
      unknown,
      { optimizeSize: boolean },
    ];
    expect(call[0].map((r) => r.sourcePageIndex)).toEqual([0, 2]);
    expect(call[0][0].rotation).toBe(90);
    expect(call[2]).toEqual({ optimizeSize: true });
  });

  it("exports only selected entries when a selection exists", async () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({
      pageEntries: [
        entry({ id: "p1", sourcePageIndex: 0 }),
        entry({ id: "p2", sourcePageIndex: 1 }),
        entry({ id: "p3", sourcePageIndex: 2 }),
      ],
    });
    useSelectionStore.setState({ selectedIds: ["p1", "p3"], anchorId: "p1" });
    await useStore.getState().exportPdf();
    const call = exportMergedPdfMock.mock.calls[0] as unknown as [
      Array<{ sourcePageIndex: number }>,
      unknown,
      unknown,
    ];
    expect(call[0].map((r) => r.sourcePageIndex)).toEqual([0, 2]);
  });

  it("blocks export and sets an error when nothing is visible", async () => {
    const useStore = createPageGridStore(CONFIG);
    useStore.setState({ pageEntries: [entry({ id: "p1", hidden: true })] });
    await useStore.getState().exportPdf();
    expect(exportMergedPdfMock).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().lastError ?? "").toMatch(/No hay páginas/);
  });
});
