---
description: Pre-flight release checklist (lint, build, architecture+design review). Does NOT push.
---

Run a release pre-flight check sequentially:

1. **Status** — `git status` to confirm what's about to ship. Stop if there's uncommitted work the user might not want included.

2. **Lint** — `npm run lint` from repo root. Stop on errors; show them and ask for direction.

3. **Build** — `npm run build` from repo root. Stop on errors; show them.

4. **Verify standalone artifact** — confirm `apps/web/.next/standalone/` exists and `apps/web/public/pdf.worker.min.mjs` is present.

5. **Architecture review** — run `/check-architecture` over the current diff vs `main` (or last release tag).

6. **Design review** — run `/check-design` over the same diff.

7. **Commit message suggestion** — based on the diff, propose a conventional commit message (Spanish OK). Do NOT commit. Do NOT push. Do NOT tag.

Output a final summary:

```
✅ Lint
✅ Build
✅ Standalone artifact
🟢 Architecture
🟡 Design (2 minor)
Suggested commit: refactor: extract split logic to lib/pdf
Next step: review, commit, push manually.
```
