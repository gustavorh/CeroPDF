import { beforeEach, describe, expect, it } from "vitest";

import { useSelectionStore } from "./selection-store";

beforeEach(() => useSelectionStore.setState({ selectedIds: [], anchorId: null }));

describe("selection-store setSelection", () => {
  it("replaces the selection and anchors on the last id", () => {
    useSelectionStore.getState().setSelection(["a", "b", "c"]);
    expect(useSelectionStore.getState().selectedIds).toEqual(["a", "b", "c"]);
    expect(useSelectionStore.getState().anchorId).toBe("c");
  });

  it("clears the anchor for an empty selection", () => {
    useSelectionStore.setState({ selectedIds: ["x"], anchorId: "x" });
    useSelectionStore.getState().setSelection([]);
    expect(useSelectionStore.getState().selectedIds).toEqual([]);
    expect(useSelectionStore.getState().anchorId).toBeNull();
  });
});
