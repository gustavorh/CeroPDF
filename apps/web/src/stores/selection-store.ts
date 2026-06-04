import { create } from "zustand";

type SelectionState = {
  selectedIds: string[];
  anchorId: string | null;

  /**
   * Selects a single id, or a range from the current anchor when shift is held.
   * Caller passes the full ordered list of selectable ids so range math doesn't
   * couple this store to any specific tool's data shape.
   */
  select: (
    id: string,
    orderedAllIds: string[],
    options: { shiftKey: boolean },
  ) => void;
  clear: () => void;
  /** Drop ids that no longer exist (after entry deletion). */
  pruneTo: (validIds: ReadonlySet<string>) => void;
};

export const useSelectionStore = create<SelectionState>()((set, get) => ({
  selectedIds: [],
  anchorId: null,

  select: (id, orderedAllIds, { shiftKey }) => {
    const { anchorId } = get();
    if (shiftKey && anchorId) {
      const ia = orderedAllIds.indexOf(anchorId);
      const ib = orderedAllIds.indexOf(id);
      if (ia < 0 || ib < 0) return;
      const [start, end] = ia <= ib ? [ia, ib] : [ib, ia];
      set({ selectedIds: orderedAllIds.slice(start, end + 1) });
      return;
    }
    set({ selectedIds: [id], anchorId: id });
  },

  clear: () => set({ selectedIds: [], anchorId: null }),

  pruneTo: (validIds) =>
    set((s) => ({
      selectedIds: s.selectedIds.filter((id) => validIds.has(id)),
      anchorId: s.anchorId && validIds.has(s.anchorId) ? s.anchorId : null,
    })),
}));
