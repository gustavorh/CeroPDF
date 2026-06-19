# @ceropdf/pdf-core

Pure binary operations over [`pdf-lib`](https://github.com/Hopding/pdf-lib). No React, no DOM — fully testable with Vitest.

## Public API

```ts
import {
  MAX_FILE_BYTES,
  MAX_COMBINED_PAGES,
  exportMergedPdf,
  parseRanges,
  splitPdfByRanges,
  splitPdfByPage,
  flattenAnnotations,
  readDocumentBytes,
} from "@ceropdf/pdf-core";
```

Subpath exports are also available (`@ceropdf/pdf-core/merge`, `/split`, `/annotate`, `/constants`, `/storage`, `/storage/opfs`).

- **`constants`** — hard limits (`MAX_FILE_BYTES`, `MAX_COMBINED_PAGES`).
- **`merge`** — `exportMergedPdf` (async getter over page refs).
- **`split`** — `parseRanges`, `splitPdfByRanges`, `splitPdfByPage`.
- **`annotate`** — `flattenAnnotations` (burn text/rect/highlight annotations into the page content).
- **`storage`** — `DocumentBacking` (memory | opfs) + `readDocumentBytes`, plus OPFS helpers.

## Conventions

Any loop over more than ~50 pages must yield to the main thread every ~10 iterations:

```ts
await new Promise((r) => setTimeout(r, 0));
```

See `src/merge.ts` for the canonical template.

## Test

```bash
npm test -w @ceropdf/pdf-core
```
