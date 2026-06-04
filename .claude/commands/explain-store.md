---
description: Quick primer of the Zustand workspace store for fresh sessions.
---

Read `apps/web/src/stores/workspace-store.ts` and `apps/web/src/types/workspace.ts`. Summarize for me:

1. **State shape**: what's in the store (documents, pageEntries, selection, uiPhase, projectDisplayName, etc.).
2. **UI phase state machine**: list the phases and what triggers transitions (`idle → loading → parsing → rendering → merging → export_success → error`).
3. **Action surface area**: group actions by responsibility (load, mutate pages, reorder, hide, export, reset). One line each.
4. **Hot patterns I should reuse** when adding a new tool: the yield-every-10-pages pattern, the cache invalidation pattern, the validation against `MAX_FILE_BYTES`/`MAX_COMBINED_PAGES`.

Keep it under 250 words. Cite file:line for each pattern.
