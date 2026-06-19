# CeroPDF

Free, local-first PDF tools that run entirely in your browser. No account, no uploads, no tracking — your files never leave your device unless a tool explicitly needs a server and you opt in.

This is a personal portfolio project, **not** a commercial SaaS: no auth, no payments, no user database. North star: privacy + zero friction + perceived speed.

## Tools

- **Merge** — combine, reorder, rotate, and exclude pages (client-side).
- **Split** — separate a PDF by page ranges or extract pages into individual files (client-side).
- **Edit** — add text, rectangles, and highlights, burned in on export (client-side).
- **Compress** — Ghostscript compression (optional server-side, opt-in).
- **Office → PDF** — convert Word/Excel/PowerPoint/OpenDocument via LibreOffice (optional server-side, opt-in).
- **Media** — convert audio/video between common formats with ffmpeg.wasm (client-side).

## Stack

Next.js 15 (App Router, `output: "standalone"`) · React 19 · TypeScript strict · Tailwind 4 · Zustand 5 · `pdf-lib` · `pdfjs-dist` · `fflate` · `@ffmpeg/ffmpeg` · `next-intl` (es default, en under `/en`) · Vitest · npm workspaces · Node ≥ 20.

## Workspaces

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js standalone app — serves the UI, proxies `/api/heavy/*`. |
| `apps/heavy` | Hono sidecar (Ghostscript + qpdf + LibreOffice), internal network only. |
| `packages/pdf-core` | Pure `pdf-lib` operations (merge, split, annotate, storage). No React. |
| `packages/pdf-render` | `pdfjs-dist` wrapper (cache, lazy load, benign-error handling). |
| `packages/ui` | Shared primitives (BrandMark, Dropzone). |

## Getting started

```bash
npm install          # also copies pdf.js worker + ffmpeg core into public/
npm run dev          # turbopack dev server (apps/web)
npm run build        # standalone production build
npm run start        # serve the build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit across all workspaces
npm test             # vitest run on packages that define a test script
```

## Deploy

```bash
docker compose up --build
# `web` is exposed on localhost:3002 (behind a SafeLine WAF).
# `heavy` stays internal and is never published outside Docker.
```

## Privacy contract

The default for every tool is 100% client-side. Server-side processing is strictly opt-in, gated behind a granular consent banner, with aggressive TTL and delete-on-completion. See [`/privacy`](apps/web/src/app/[locale]/privacy/page.tsx) and [`CLAUDE.md`](CLAUDE.md) for the full rules.
