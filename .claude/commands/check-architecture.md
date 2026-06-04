---
description: Audit the current diff against the local-first / privacy-first contract. Read-only.
---

Invoke the `architecture-guardian` subagent on the current diff (`git diff` + `git diff --staged` + `git status`).

Pay extra attention to:

- New dependencies in `apps/web/package.json` (size, transitive risk).
- New files in `apps/web/src/app/api/` (forbidden by default).
- Changes to `apps/web/next.config.ts` CSP (must be exact hosts, no wildcards).
- New env vars (must not leak to client bundle).
- Changes to `apps/web/src/lib/pdf/pdfjs-config.ts` (worker must stay same-origin).
- Changes to `apps/web/src/lib/constants.ts` that raise file/page limits.

Output a traffic-light report per rule. End with a recommendation: **Block** / **Proceed with caveats** / **Proceed**.

Do NOT edit any files.
