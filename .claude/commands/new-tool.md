---
description: Scaffold a new PDF tool end-to-end (lib/pdf, store action, UI component, route).
argument-hint: <tool-name>
---

Scaffold a new PDF tool named `$ARGUMENTS`.

**Steps**:

1. **Sanity check**: confirm the tool fits the local-first contract. If it requires server-side processing (OCR pesado, Word/Excel convert, Ghostscript compress), STOP and tell me to invoke the `r2-integration` subagent instead.

2. **Plan first** — before any edit, propose:
   - New file `apps/web/src/lib/pdf/$ARGUMENTS.ts` (pure async logic, yields every ~10 pages).
   - New action(s) on `useWorkspaceStore` in `apps/web/src/stores/workspace-store.ts`.
   - New UI control: either extending `canvas-bottom-pill.tsx` or creating `apps/web/src/components/canvas-$ARGUMENTS.tsx`.
   - New types in `apps/web/src/types/workspace.ts` if needed.
   - (Future) route `apps/web/src/app/(tools)/$ARGUMENTS/page.tsx` — only if tool-based routing has landed.

3. **Confirm with me** before writing files. Show the plan inline.

4. **Implement** — delegate to the `pdf-feature-implementer` subagent with the plan as context.

5. **Review** — after implementation, run in parallel:
   - `/check-design` (design-system-reviewer over the diff)
   - `/check-architecture` (architecture-guardian over the diff)

6. **Lint** — `npm run lint` from repo root. Fix any issues before declaring done.

7. **Do not commit**. Show me the diff and let me commit manually.

Use the patterns in `CLAUDE.md` § Patrón para añadir una herramienta PDF nueva.
