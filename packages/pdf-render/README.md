# @ceropdf/pdf-render

Thin wrapper around [`pdfjs-dist`](https://github.com/mozilla/pdf.js) for rendering PDF thumbnails and previews in the browser.

## What it provides

- **`config`** — pdf.js worker configuration. The worker is served **same-origin** from `public/pdf.worker.min.mjs` (copied by the `apps/web` postinstall). Do not move it to a CDN.
- **`document-cache`** — caches parsed pdf.js documents by id and invalidates on removal.
- **`load-document`** — lazy-loads a document from bytes.
- **`errors`** — `isBenignPdfPreviewError`, so cancelled renders (React Strict Mode / unmount) are not surfaced as failures.

## Gotcha

If you bump `pdfjs-dist`, re-run `npm install` so the worker asset in `public/` matches the library version. A mismatch makes renders crash silently.
