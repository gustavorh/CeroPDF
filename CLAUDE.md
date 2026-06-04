# CeroPDF

PDF editor free, local-first, portafolio personal. **No es un SaaS comercial** — sin auth, sin pagos, sin DB de usuarios. North star: privacidad + zero-friction + velocidad percibida.

## Stack

- Next.js 15.3 (App Router, `output: "standalone"`) + React 19 + TypeScript strict
- Tailwind 4 (tokens en `@theme inline` dentro de `globals.css`)
- Zustand 5 para estado (stores divididos por responsabilidad)
- `pdf-lib` para operaciones binarias sobre PDFs (lazy-loaded por tool)
- `pdfjs-dist` para render de thumbnails (Web Worker, lazy)
- `fflate` para empaquetado ZIP (split por rangos)
- `@ffmpeg/ffmpeg` (ffmpeg.wasm) para conversión de audio/video 100% client-side (lazy, same-origin)
- `next-intl` para i18n (es por defecto, en con prefijo `/en`)
- Vitest para tests, GitHub Actions para CI
- Node ≥ 20, npm workspaces.

## Workspaces

- `apps/web/` — Next.js standalone (sirve la UI, expone proxies `/api/heavy/*`).
- `apps/heavy/` — Sidecar Hono + Ghostscript + qpdf + LibreOffice en Docker. Sólo accesible vía red interna `ceropdf-internal`.
- `packages/pdf-core/` — Operaciones puras sobre `pdf-lib` (merge, split, constants, storage types). Sin React. Testable con Vitest.
- `packages/pdf-render/` — Wrapper de `pdfjs-dist` (cache, lazy load, errores benignos).
- `packages/ui/` — Primitivos compartidos (BrandMark, Dropzone genérico).

## Cómo correr

```bash
npm run dev          # turbopack dev sobre apps/web
npm run build        # build standalone
npm run start        # serve build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit sobre todos los workspaces
npm test             # vitest run sobre packages que tengan test script

# Deploy en VPS con Docker:
docker compose up --build
# `web` queda en localhost:3002 (detrás de SafeLine WAF).
# `heavy` queda interno; no se expone fuera de Docker.
```

El `postinstall` de `apps/web/package.json` copia `pdf.worker.min.mjs` a `public/` vía `apps/web/scripts/copy-pdf-worker.cjs` y los cores de ffmpeg.wasm a `public/ffmpeg/` vía `apps/web/scripts/copy-ffmpeg-core.cjs`. **NO eliminar**. Al bumpear `pdfjs-dist` o `@ffmpeg/*` hay que re-correr `npm install` para que los assets se actualicen.

## Reglas inquebrantables

1. **Default = 100% client-side.** El PDF del usuario nunca sale del navegador a menos que la herramienta lo requiera explícitamente y el usuario lo apruebe.
2. **Server-side opt-in**: si una tool necesita backend (OCR pesado, conversión Word/Excel, compresión Ghostscript), debe (a) tener un banner de consentimiento granular, (b) usar TTL agresivo en R2, (c) hacer delete-on-completion, (d) actualizar este CLAUDE.md con la nueva tool y su modo. Sin excepciones.
3. **Límites duros**: 250 MB por archivo, 500 páginas combinadas. Ver `apps/web/src/lib/constants.ts` (`MAX_FILE_BYTES`, `MAX_COMBINED_PAGES`).
4. **pdf.js worker mismo origen**: ver `apps/web/src/lib/pdf/pdfjs-config.ts`. No mover a CDN.
5. **CSP narrow**: ampliar `apps/web/next.config.ts` solo intencionalmente, host por host, no globs.

## Mapa del código

```
apps/
├── web/src/
│   ├── app/
│   │   ├── [locale]/         # rutas localizadas (es en raíz, en con prefijo /en)
│   │   │   ├── layout.tsx    # root layout: <html lang>, metadata SEO, setRequestLocale, NextIntlClientProvider, Analytics
│   │   │   ├── page.tsx      # landing con grid de tools
│   │   │   ├── merge/page.tsx    # tool: unir PDFs (client-side)
│   │   │   ├── split/page.tsx    # tool: dividir PDF por rangos (client-side)
│   │   │   ├── compress/page.tsx # tool: comprimir con Ghostscript (server-side opt-in)
│   │   │   ├── office-to-pdf/page.tsx # tool: Office→PDF con LibreOffice (server-side opt-in)
│   │   │   ├── media/page.tsx    # tool: convertir audio/video con ffmpeg.wasm (client-side)
│   │   │   ├── privacy/page.tsx  # contrato de privacidad
│   │   │   └── security/page.tsx # contrato de seguridad
│   │   ├── api/heavy/*       # proxies internos al sidecar (sin locale)
│   │   ├── sitemap.ts        # sitemap dinámico (raíz, sin locale)
│   │   ├── robots.ts         # robots.txt (raíz, sin locale)
│   │   └── globals.css       # tokens Tailwind v4
│   ├── components/
│   │   ├── merge-workspace.tsx       # shell del tool merge
│   │   ├── split-workspace.tsx       # shell del tool split
│   │   ├── compress-workspace.tsx    # shell del tool compress
│   │   ├── office-workspace.tsx       # shell del tool Office→PDF (server-side opt-in)
│   │   ├── media-workspace.tsx        # shell del tool audio/video (client-side, ffmpeg.wasm)
│   │   ├── server-consent-banner.tsx # opt-in para herramientas server-side
│   │   ├── analytics.tsx             # tracker privacy-first (env-driven)
│   │   ├── canvas-*                  # UI del estado canvas del merge tool
│   │   ├── landing-*                 # UI compartida (header, hero, grid, footer)
│   │   ├── legal-page-shell.tsx      # shell para /privacy + /security
│   │   ├── error-banner.tsx
│   │   ├── export-flow-modal.tsx
│   │   ├── page-thumbnails-panel.tsx
│   │   ├── status-strip.tsx
│   │   └── workspace-dropzone.tsx
│   ├── stores/
│   │   ├── document-store.ts   # documents + uiPhase + lastError (compartido)
│   │   ├── selection-store.ts  # selección de ids (tool-agnostic)
│   │   └── merge-store.ts      # estado del tool merge (compone los anteriores)
│   ├── types/workspace.ts      # WorkspaceDocument, PageEntry
│   ├── lib/                    # format-bytes, project-display-name
│   │   └── ffmpeg/             # load-ffmpeg (singleton lazy), formats, convert (ffmpeg.wasm)
│   └── scripts/
│       ├── copy-pdf-worker.cjs    # postinstall: pdf.js worker → public/
│       └── copy-ffmpeg-core.cjs   # postinstall: ffmpeg core → public/ffmpeg/{st,esm}
└── heavy/                      # sidecar Hono + Ghostscript + qpdf + LibreOffice
    └── src/server.ts           # endpoints /compress, /unlock, /office-to-pdf, /health

packages/
├── pdf-core/src/
│   ├── constants.ts            # MAX_FILE_BYTES, MAX_COMBINED_PAGES
│   ├── merge.ts                # exportMergedPdf (async getter)
│   ├── split.ts                # parseRanges, splitPdfByRanges, splitPdfByPage
│   ├── storage/types.ts        # DocumentBacking (memory | opfs) + readDocumentBytes
│   └── storage/opfs.ts         # write/delete/clear OPFS files
├── pdf-render/src/             # pdfjs config + cache + load + error helpers
└── ui/src/                     # BrandMark, Dropzone genérico
```

## Convenciones

- **Naming**: `kebab-case.tsx` para componentes, `camelCase.ts` para utilidades.
- **Prefijos**: `canvas-*` cuando vive en estado canvas, `landing-*` cuando vive en estado vacío.
- **Alias**: `@/*` → `apps/web/src/*` (ver `tsconfig.json`).
- **Commits**: conventional cortos, español OK (`refactor: mvp completed`, `chore: update next config`).
- **Copy UI**: español. **Código y comentarios**: inglés.
- **Comentarios**: solo cuando el "por qué" no es obvio. Nada de explicar "qué" hace el código.

## Patrón para añadir una herramienta PDF nueva

1. **Tipos** en `apps/web/src/types/workspace.ts` si necesitas shape nuevo.
2. **Lógica pura** en `apps/web/src/lib/pdf/<tool-name>.ts`. Async, yields cada ~10 páginas con `await new Promise(r => setTimeout(r, 0))` para no bloquear el main thread (template: `export-workspace-pdf.ts:52-54`).
3. **Acción en store** `apps/web/src/stores/workspace-store.ts`. Usar `setUiPhase` para feedback (`idle | loading | parsing | rendering | merging | export_success | error`).
4. **UI** en un nuevo `canvas-<tool-name>.tsx` o extiende `canvas-bottom-pill.tsx`.
5. **Validar límites** contra `MAX_FILE_BYTES` y `MAX_COMBINED_PAGES`.
6. **Invocar `/check-design` y `/check-architecture`** antes de commit.

## Design system

Referencia obligatoria: `/docs/design-system.md`. Reglas operativas:

- Tres estados de pantalla: **Hook** (landing), **Lienzo** (canvas), **Exportación** (modal).
- Paleta: tinta `#111316` (no negro puro), terracota (primary CTA), esmeralda (trust).
- Tipografía: Public Sans para prosa, mono para bytes/límites/contadores.
- **Regla sin línea**: no usar 1px opaco para separar secciones. Si necesitas borde, ~15% opacity ghost.
- Dark mode only — no `dark:` variants que impliquen modo claro.
- Sin hex/rgb crudos en componentes — usar tokens Tailwind mapeados en `globals.css`.

## Gotchas

- **pdf.js worker desfasado**: si actualizas `pdfjs-dist` sin re-correr `npm install`, el worker en `public/` no coincide con la lib y los renders crashean silenciosamente. Re-correr `npm install` resuelve.
- **CSP solo en producción**: `next.config.ts` inyecta los headers de seguridad solo con `NODE_ENV=production`. Probar siempre con `npm run build && npm run start` antes de deploy.
- **`output: "standalone"`**: el `Dockerfile` y `compose.yml` dependen de esto. No cambiar sin actualizar deploy.
- **Memoria + OPFS**: archivos > 20 MB (`OPFS_THRESHOLD_BYTES`) se mueven al sandbox OPFS automáticamente. Los consumidores usan `readDocumentBytes(doc.backing)` que es async y devuelve los bytes uniformemente.
- **Cache invalidation**: al borrar un doc, `document-store.removeDocument` llama `invalidatePdfJsDocument(id)` y borra el archivo OPFS si aplica. `clearAll` además vacía la carpeta OPFS entera.
- **Yield en loops pdf-lib**: cualquier loop > 50 iteraciones debe yieldear o bloquea la UI con PDFs grandes. Plantilla: `packages/pdf-core/src/merge.ts:52-54`.
- **Heavy sidecar**: el contenedor `heavy` sólo es alcanzable desde `web` vía la red `ceropdf-internal` (DNS = `heavy:3001`). No publicar puertos. El web app hace proxy desde `/api/heavy/*` para mantenerlo así.
- **`ServerConsentBanner`**: toda tool que toque servidor debe envolverse en este componente. El consent persiste en `localStorage` con clave `ceropdf:server-consent:<toolKey>`.
- **ffmpeg.wasm single-thread only**: se usa el core single-thread (`public/ffmpeg/st`). El multi-thread necesita `SharedArrayBuffer` (cross-origin isolation con COOP/COEP) y en la práctica cuelga al levantar su pool de pthreads en varios navegadores — un cuelgue es peor que una conversión más lenta pero fiable. Por eso `/media` **no** necesita headers especiales. Audio va rápido; video es más lento pero funciona en todos lados. Los assets se sirven same-origin desde `public/ffmpeg/`; **no** mover a CDN. El class worker (`/ffmpeg/esm/worker.js`) se sirve como archivo real (no blob) porque usa imports ESM relativos.
- **LibreOffice en el sidecar**: el endpoint `/office-to-pdf` shell-ea `soffice --headless --convert-to pdf`. Cada job usa su propio `-env:UserInstallation` (perfil aislado) para evitar el lock de perfil con conversiones concurrentes; `appuser` no tiene home, por eso el Dockerfile fija `ENV HOME=/tmp`. LibreOffice infla la imagen ~0.5–1 GB y arranca en frío lento (timeout `OFFICE_TIMEOUT_MS`, default 120s).
- **Reaper de scratch**: además del `finally` por job (delete-on-completion), `server.ts` corre un reaper cada 10 min que borra cualquier entrada de `SCRATCH_DIR` más vieja que `SCRATCH_TTL_MS` (default 60 min). Respalda la promesa del `ServerConsentBanner` ("se borra en 60 minutos") aun si un proceso muere a mitad de un job.
- **Tamaño de ffmpeg.wasm**: `@ffmpeg/core` trae un `.wasm` de ~25–30 MB (gzip). **No** va en el bundle JS: se sirve como asset estático same-origin desde `public/ffmpeg/st/` y se descarga lazy en la primera conversión (singleton en `load-ffmpeg.ts`). El overage de presupuesto es intencional y acotado a `/media`.

## i18n

- `next-intl` con `localePrefix: "as-needed"`: español en raíz (`/`, `/merge`), inglés con prefijo (`/en`, `/en/merge`).
- **Estructura `[locale]`**: las páginas viven bajo `app/[locale]/`. El middleware reescribe toda request a `/<locale>/...`, así que sin ese segmento todas las rutas darían 404. El root layout `app/[locale]/layout.tsx` valida el locale (`notFound` si no), llama `setRequestLocale`, exporta `generateStaticParams`, y **pasa `messages={await getMessages()}` al `NextIntlClientProvider`** (si no, los client components muestran las claves crudas). `api/`, `sitemap.ts`, `robots.ts` quedan en la raíz de `app/` (sin locale).
- Locales y default en `apps/web/src/i18n/routing.ts`. Mensajes en `apps/web/src/i18n/messages/{es,en}.json`.
- Middleware en `apps/web/src/middleware.ts` excluye `/api`, `_next`, `_vercel` y assets.
- Para enlaces, usar `Link` de `@/i18n/navigation` (no `next/link`) — mantiene el locale activo.
- En server components: `getTranslations()`. En client components: `useTranslations()`.
- Switcher de idioma en `LanguageSwitcher` (cliente) — preserva el path actual al cambiar locale.
- Cuando añadas una nueva tool, añade su entrada en ambos `messages/*.json` bajo `tools.<key>` y lista la ruta en `app/sitemap.ts` para que aparezca en ambos idiomas con hreflang.

## Variables de entorno

```bash
NEXT_PUBLIC_SITE_URL=https://ceropdf.example.com   # canonical, sitemap, OG
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=                      # opcional; sin esto, sin analítica
NEXT_PUBLIC_PLAUSIBLE_SRC=                         # opcional; URL del script self-hosted
HEAVY_API_URL=http://heavy:3001                     # interno Docker; web → heavy
```

`apps/web/.env.example` documenta todos los valores.

## Subagents disponibles

Ver `.claude/agents/`:

- **`pdf-feature-implementer`** — implementa herramientas PDF nuevas siguiendo store + lib/pdf + UI canvas.
- **`design-system-reviewer`** — verifica que cambios UI respeten `docs/design-system.md`. Read-only.
- **`architecture-guardian`** — guardián del contrato local-first. Audita deps, CSP, env vars, rutas API. Read-only.
- **`r2-integration`** — especialista en Cloudflare R2 + Workers cuando aparezcan features server-side.
- **`perf-auditor`** — busca regresiones de performance (yields faltantes, observers ausentes, buffers en selectors). Read-only.

## Slash commands

Ver `.claude/commands/`:

- **`/new-tool <name>`** — scaffold completo de una herramienta nueva.
- **`/check-design`** — review de design system sobre el diff actual.
- **`/check-architecture`** — review de contrato local-first sobre el diff actual.
- **`/release`** — pre-flight de release (lint + build + checks). No pushea.
- **`/explain-store`** — primer rápido del store para sesiones nuevas.

## Roadmap

El roadmap vivo está en `/Users/gustavorh/.claude/plans/identifica-mejoras-de-funcionalidad-happy-pearl.md` (refactor a monorepo + features tipo iLovePDF + infra híbrida con R2 opt-in). Cualquier feature server-side debe pasar por `/check-architecture` antes de implementarse.
