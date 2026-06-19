# heavy

Server-side sidecar for the CeroPDF tools that cannot run in the browser. Built with [Hono](https://hono.dev/) and packaged in Docker alongside Ghostscript, qpdf, and LibreOffice.

This service is **internal only**: it is reachable solely from `web` over the `ceropdf-internal` Docker network (DNS `heavy:3001`) and is never published outside Docker. The web app proxies requests through `/api/heavy/*` to keep it that way.

## Endpoints

- `POST /compress` — Ghostscript PDF compression.
- `POST /unlock` — qpdf password removal.
- `POST /office-to-pdf` — LibreOffice `soffice --headless --convert-to pdf`.
- `GET /health` — liveness probe.

## Scripts

```bash
npm run dev        # tsx watch src/server.ts
npm run build      # tsc → dist/
npm run start      # node dist/server.js
npm run typecheck  # tsc --noEmit
```

## Notes

- Each Office job uses its own isolated `-env:UserInstallation` profile to avoid LibreOffice profile locks under concurrency; `HOME=/tmp` is set because `appuser` has no home.
- A reaper runs every 10 min and deletes scratch entries older than `SCRATCH_TTL_MS` (default 60 min), backing the consent banner's "deleted within 60 minutes" promise even if a job process dies mid-run.
- Privacy contract: aggressive TTL + delete-on-completion on every job.
