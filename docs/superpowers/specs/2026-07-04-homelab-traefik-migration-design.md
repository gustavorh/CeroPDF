# Design — Migrate CeroPDF deploy onto the Traefik→Caddy homelab runbook

**Date:** 2026-07-04
**Status:** approved (design), pending implementation
**Runbook reference:** `/Users/gustavorh/dev/homelab/homelab-deploy-runbook.md` (private, local)

## Goal

Bring CeroPDF's deployment onto the homelab's new canonical ingress pattern (same
as Linkly / MiPlata): **Traefik (hermes) → Caddy (prod-host) → container on the
`edge` network**, replacing the current SafeLine-WAF wiring. This is CeroPDF's
**first real deploy** — no live cutover.

## Context / current state (verified 2026-07-04)

- Repo `gustavorh/CeroPDF`, branch `main` fully pushed to origin (0 ahead).
- Existing deploy files: `.github/workflows/ci.yml` (CI gate + self-hosted deploy),
  root `compose.yml` (`web` + `heavy`), root `Dockerfile`, `docs/deploy.md`.
- Current ingress = **SafeLine WAF** → `web` on `127.0.0.1:3002`, networks
  `safeline-ce` + `ceropdf-internal`.
- App shape: monorepo, `web` (Next.js standalone) + `heavy` sidecar
  (Ghostscript/qpdf/LibreOffice). **No DB, Redis, workers, or migrations** — the
  runbook's MySQL/Redis/BullMQ template services do not apply.
- Shared infra (Traefik on hermes, Caddy on prod-host, Pi-hole, `edge` external
  network) is **already running** and serving other projects.
- A self-hosted runner for this repo is **not yet registered** (or unconfirmed).

## Decisions

1. **Ingress:** migrate fully to Traefik/Caddy; retire SafeLine wiring in the repo.
2. **Hostname:** keep `pdf.home.gustavorh.com` (already baked into
   `NEXT_PUBLIC_SITE_URL`, wildcard DNS covers it). Container `edge` alias =
   `ceropdf-web`.
3. **Deploy mechanism:** keep the existing combined `ci.yml` (CI gate →
   `docker compose up -d --build --wait` in the runner checkout). Do **not** adopt
   the runbook's `rsync`-to-`~/services/<proj>` step — that exists to hold a secret
   `.env`, and CeroPDF has none (all `NEXT_PUBLIC_*` baked at build). Keeping the CI
   gate is a deliberate improvement over the runbook template, which has none.
4. **Health endpoint:** add a real `/api/health` route; use it for both the compose
   healthcheck and the deploy smoke test (runbook convention).
5. **`heavy` sidecar:** unchanged — stays on `ceropdf-internal` only, never on
   `edge`. Web reaches it via `HEAVY_API_URL=http://heavy:3001`.

## Repo changes

| File | Change |
|---|---|
| `compose.yml` | `web`: network `safeline-ce` → `edge` (external) with `aliases: [ceropdf-web]`; remove `ports: 127.0.0.1:3002:3000`; remove `com.safeline.*` labels; healthcheck `/` → `/api/health`. Keep `ceropdf-internal`. `heavy` unchanged. Replace `safeline-ce` network def with `edge: { external: true }`. Update header comment. |
| `apps/web/src/app/api/health/route.ts` | New route handler: `GET` → `200 {"status":"ok"}`. `export const dynamic = "force-static"` not needed; keep it a plain handler. Root `api/` (middleware excludes `/api`, so no locale prefix). |
| `.github/workflows/ci.yml` | Deploy job: after `docker compose up -d --build --wait`, add a smoke-test step: `curl -fsS --retry 5 --retry-delay 3 -H 'Host: pdf.home.gustavorh.com' http://10.0.30.254:8080/api/health`. Keep prune. CI job untouched. |
| `docs/deploy.md` | Rewrite for the Traefik→Caddy topology: request path, provisioning order, verify, rollback, troubleshooting. |
| `CLAUDE.md` | Update the "Deploy" note in the run section (SafeLine → Traefik/Caddy; `web` no longer publishes `127.0.0.1:3002`). |
| memory `homelab-deploy.md` | Update to reflect Traefik/Caddy pattern + first-deploy state. |

### Smoke-test timing note

The deploy job's smoke test hits Caddy (`10.0.30.254:8080`, local to the runner
host) with the `Host` header. Caddy resolves the `ceropdf-web` upstream at request
time, so the Caddy block can be provisioned before the container exists. `--wait`
blocks until the compose healthcheck (`/api/health`) passes, so the container is on
`edge` before the smoke test runs. Provisioning (Traefik + Caddy) must therefore be
in place **before** the first push.

## One-time provisioning (user runs from laptop; not automatable from the repo)

Ordered; values already substituted for CeroPDF.

1. **GitHub security (do FIRST):** Settings → Actions → General → *Fork pull request
   workflows from outside collaborators* → **Require approval for all outside
   collaborators**. Public repo + self-hosted runner = RCE surface; the `if:` gate
   protects the deploy job, not the runner host.
2. **Register runner** (label `prod-host`) for `gustavorh/CeroPDF` on prod-host.
3. **Pi-hole:** explicit record `10.0.20.2 pdf.home.gustavorh.com` (wildcard already
   covers it; explicit is recommended).
4. **Traefik (hermes):** router + service for `Host(pdf.home.gustavorh.com)` →
   `http://10.0.30.254:8080`. Backup `gateway.yml` first.
5. **Caddy (prod-host):** `http://pdf.home.gustavorh.com:8080 { encode gzip;
   reverse_proxy ceropdf-web:3000 }` + `caddy reload`.
6. **Push/merge to `main`** → deploy fires → smoke test 200.

Skipped runbook steps: Paso 2 (MySQL) and Paso 4 (`.env` on server) — CeroPDF needs
neither.

## Verification (end to end)

```bash
# on prod-host
cd ~/actions-runner/.../CeroPDF && docker compose ps        # web + heavy healthy
docker compose exec web wget -qO- http://localhost:3000/api/health
curl -fsS -H 'Host: pdf.home.gustavorh.com' http://10.0.30.254:8080/api/health   # via Caddy
# from LAN/VPN
curl -fsS https://pdf.home.gustavorh.com/api/health          # full chain, real TLS
```

## Out of scope

- No changes to app tools, stores, or the local-first client behaviour.
- No MySQL/Redis/worker services.
- No change to the `heavy` sidecar's internal-only exposure.

## Rollback

Repo changes are reverted with a normal git revert (they only affect deploy
plumbing). Infra: remove the Traefik router/service and Caddy block, stop the
compose stack. Nothing here touches other homelab services except the additive
one-line entries in each proxy.

---

*Process note: given the small, well-bounded scope (deploy plumbing, ~4 file
edits + a provisioning checklist), this design doc doubles as the implementation
plan. The ordered "Repo changes" and "provisioning" sections are the plan; no
separate writing-plans artifact is produced.*
