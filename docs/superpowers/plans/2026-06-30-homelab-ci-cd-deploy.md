# Homelab CI/CD Deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-deploy CeroPDF to the internal `prod-host` VM on every push to `main`, via a self-hosted GitHub Actions runner running `docker compose up -d --build`.

**Architecture:** One workflow with a cloud `ci` job (lint/typecheck/test/build) and a self-hosted `deploy` job (on prod-host) gated to push+main. `compose.yml`/`Dockerfile` bake the internal domain. Runner install + SafeLine/DNS are documented one-time user steps.

**Tech Stack:** GitHub Actions · Docker Compose · Next.js standalone · SafeLine WAF (existing).

## Global Constraints

- **Internal homelab only, no cloud infra.** Target VM `prod-host` = `10.0.30.254` (Proxmox). Internal DNS `pdf.home.gustavorh.com`.
- **Repo is PUBLIC** → the `deploy` job MUST be gated `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` (fork PRs never deploy).
- **No secrets** in the deploy job — the runner is on prod-host, clones the public repo, builds locally (no registry, no SSH).
- Deploy = `docker compose up -d --build` (rebuild local) + `docker image prune -f`.
- `NEXT_PUBLIC_*` is inlined at BUILD time → `NEXT_PUBLIC_SITE_URL` is a build arg, defaulting to `https://pdf.home.gustavorh.com`.
- Concurrency is per-job (NOT workflow-level): `ci` cancels in-progress; `deploy` (group `deploy-prod`) does NOT cancel (queues).
- Runner install, SafeLine app, and the internal DNS record are USER steps (documented in `docs/deploy.md`), not automated by the repo.

## Alcance
**Dentro:** `Dockerfile` + `compose.yml` + `.env.example` (internal domain wiring); `.github/workflows/ci.yml` (ci hardening + deploy job); `docs/deploy.md` runbook + `CLAUDE.md` deploy section.
**Fuera:** installing/registering the runner; SafeLine/DNS config; image registry; blue/green; notifications; any PDF-tool code.

> No automated tests (infra config). Verification per task = `docker compose config` / YAML validity; end-to-end = the `ci` job on the PR + a user-run deploy after the runner is installed.

---

### Task 1: Internal-domain wiring (Dockerfile + compose + env.example)

**Files:**
- Modify: `Dockerfile`
- Modify: `compose.yml`
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Dockerfile — bake `NEXT_PUBLIC_SITE_URL` at build**

In `Dockerfile`, in the `builder` stage, insert these two lines immediately before `RUN npm run build`:

```dockerfile
# Bake the public site URL at build time (Next inlines NEXT_PUBLIC_* into the bundle).
ARG NEXT_PUBLIC_SITE_URL=https://pdf.home.gustavorh.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
```

- [ ] **Step 2: compose.yml — pass the build arg + fix the WAF hostname**

In `compose.yml`, the `web` service `build:` block currently is:
```yaml
    build:
      context: .
      dockerfile: Dockerfile
      target: production
```
Add an `args:` key so it becomes:
```yaml
    build:
      context: .
      dockerfile: Dockerfile
      target: production
      args:
        NEXT_PUBLIC_SITE_URL: "${NEXT_PUBLIC_SITE_URL:-https://pdf.home.gustavorh.com}"
```

And change the WAF hostname label:
```yaml
      - "com.safeline.hostname=ceropdf.gustavorh.com"
```
to:
```yaml
      - "com.safeline.hostname=pdf.home.gustavorh.com"
```

- [ ] **Step 3: .env.example — update the example domain**

In `apps/web/.env.example`, change:
```
NEXT_PUBLIC_SITE_URL=https://ceropdf.example.com
```
to:
```
NEXT_PUBLIC_SITE_URL=https://pdf.home.gustavorh.com
```

- [ ] **Step 4: Validate the compose config**

Run: `docker compose config -q`
Expected: exits 0 (no output) — the YAML + `${NEXT_PUBLIC_SITE_URL:-…}` interpolation + build args render cleanly. (`docker compose config` does NOT require the external `safeline-ce` network to exist.)
If Docker is unavailable on this machine, instead run `python3 -c "import yaml; yaml.safe_load(open('compose.yml'))"` (expect no error) and note that `docker compose config` must be run on a Docker host before deploy.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile compose.yml apps/web/.env.example
git commit -m "chore(deploy): bake internal domain (pdf.home.gustavorh.com) into build + WAF label"
```

---

### Task 2: CI/CD workflow (ci hardening + self-hosted deploy job)

**Files:**
- Modify (rewrite): `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the npm scripts `lint`, `typecheck`, `test`, `build` (all exist in the repo root `package.json`); the `web`/`heavy` services in `compose.yml` (Task 1).
- Produces: a `deploy` job that runs on a runner labeled `[self-hosted, prod-host]`.

- [ ] **Step 1: Rewrite the workflow**

Replace the entire contents of `.github/workflows/ci.yml` with:

```yaml
name: CI/CD

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    concurrency:
      group: ci-${{ github.ref }}
      cancel-in-progress: true
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm test

      - name: Build
        run: npm run build

  deploy:
    needs: ci
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: [self-hosted, prod-host]
    timeout-minutes: 30
    concurrency:
      group: deploy-prod
      cancel-in-progress: false
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy (docker compose up -d --build)
        run: docker compose up -d --build

      - name: Prune dangling images
        run: docker image prune -f
```

- [ ] **Step 2: Validate the workflow YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`
Expected: no output / no error (valid YAML).
If `actionlint` is available, also run `actionlint .github/workflows/ci.yml` (expect no findings). If not installed, skip — the `ci` job will validate itself when this branch is pushed/PR'd.

- [ ] **Step 3: Sanity-check the referenced npm scripts exist**

Run: `node -e "const s=require('./package.json').scripts; ['lint','typecheck','test','build'].forEach(k=>{if(!s[k])throw new Error('missing script: '+k)}); console.log('all CI scripts present')"`
Expected: `all CI scripts present`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add typecheck+test to CI and a self-hosted deploy job (push→main→prod-host)"
```

---

### Task 3: Deploy runbook + CLAUDE.md

**Files:**
- Create: `docs/deploy.md`
- Modify: `CLAUDE.md` (deploy section + pointer)

- [ ] **Step 1: Create `docs/deploy.md`**

Create `docs/deploy.md` with:

````markdown
# Deploy — CeroPDF (homelab / prod-host)

CeroPDF se despliega en la VM interna **prod-host** (`10.0.30.254`, Proxmox) con
`docker compose`. El deploy es automático: **cada push a `main`** ejecuta el
workflow CI/CD, y su job `deploy` corre en un **self-hosted runner** instalado en
prod-host. Acceso interno vía `https://pdf.home.gustavorh.com` (SafeLine WAF).

## Flujo

```
push a main ─► job ci (GitHub cloud): lint · typecheck · test · build
            └► job deploy (self-hosted, prod-host, si push+main):
               docker compose up -d --build  →  docker image prune -f
```

El job `deploy` está gateado a `push` + `main`, así que los PRs (incluidos los de
forks del repo público) **nunca** despliegan.

## Setup del runner (una vez, en prod-host)

Prerequisitos: `docker` + plugin `compose`; el usuario del runner en el grupo
`docker`; la red externa `safeline-ce` presente (la crea SafeLine).

En GitHub: repo → **Settings → Actions → Runners → New self-hosted runner**
(Linux x64). Copia la URL de descarga y el token que muestra, y en prod-host:

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o runner.tar.gz -L <URL_DEL_RUNNER>
tar xzf runner.tar.gz
./config.sh \
  --url https://github.com/gustavorh/CeroPDF \
  --token <TOKEN> \
  --labels prod-host \
  --name prod-host
sudo ./svc.sh install
sudo ./svc.sh start
```

El workflow selecciona este runner con `runs-on: [self-hosted, prod-host]`.

## Red / WAF

- DNS interna: registrar `pdf.home.gustavorh.com` → `10.0.30.254` (prod-host).
- SafeLine: crear una app/route para `pdf.home.gustavorh.com` hacia el contenedor
  `web` (publicado en `127.0.0.1:3002`). El servicio `web` ya lleva el label
  `com.safeline.hostname=pdf.home.gustavorh.com`.

## Primer deploy

Con el runner activo, un `git push` a `main` dispara todo. Sigue el run en la
pestaña **Actions**.

## Verificación (en prod-host)

```bash
docker compose ps                       # web + heavy 'healthy'
curl -f http://127.0.0.1:3002/          # responde 200
# y desde la red interna: https://pdf.home.gustavorh.com
```

## Rollback

En prod-host, en el checkout del runner (`~/actions-runner/_work/CeroPDF/CeroPDF`):

```bash
git checkout <commit-anterior>
docker compose up -d --build
```

O re-ejecuta un run anterior del workflow desde la pestaña Actions.

## Notas

- El deploy no usa secrets: el runner clona el repo público y buildea local.
- `NEXT_PUBLIC_SITE_URL` se hornea en build (default `https://pdf.home.gustavorh.com`
  en `Dockerfile`/`compose.yml`); para otro dominio, pásalo como build-arg.
- El sidecar `heavy` (Ghostscript+qpdf+LibreOffice) es lento de buildear; el cache
  de Docker en el runner acelera rebuilds posteriores.
````

- [ ] **Step 2: Update the deploy note in `CLAUDE.md`**

In `CLAUDE.md`, in the `## Cómo correr` section, the deploy comment block currently reads:
```
# Deploy en VPS con Docker:
docker compose up --build
# `web` queda en localhost:3002 (detrás de SafeLine WAF).
# `heavy` queda interno; no se expone fuera de Docker.
```
Replace it with:
```
# Deploy (homelab / prod-host): automático en cada push a `main` vía un
# self-hosted GitHub Actions runner que corre `docker compose up -d --build`.
# `web` queda en 127.0.0.1:3002 detrás de SafeLine WAF (pdf.home.gustavorh.com).
# `heavy` queda interno; no se expone fuera de Docker.
# Runbook completo (setup del runner, DNS/WAF, rollback): docs/deploy.md
```

- [ ] **Step 3: Verify Markdown + commit**

Run: `test -f docs/deploy.md && grep -q "pdf.home.gustavorh.com" docs/deploy.md CLAUDE.md && echo "docs ok"`
Expected: `docs ok`.

```bash
git add docs/deploy.md CLAUDE.md
git commit -m "docs(deploy): homelab deploy runbook + update CLAUDE.md"
```

---

## Self-Review (autor del plan)

**Cobertura del spec:**
- §3 workflow (ci hardening: typecheck+test; deploy job self-hosted, gate push+main, needs ci, per-job concurrency, compose up --build + prune) → Task 2. ✓
- §4 compose hostname + build-arg; Dockerfile ARG/ENV; .env.example → Task 1. ✓
- §5 runner setup + DNS/WAF + first deploy + rollback + verification → `docs/deploy.md` (Task 3). ✓
- §5 CLAUDE.md deploy section + pointer → Task 3 Step 2. ✓
- §2 out-of-scope (runner install, SafeLine/DNS) → documented as user steps in Task 3, not automated. ✓

**Placeholder scan:** the only `<...>` are `<URL_DEL_RUNNER>` / `<TOKEN>` / `<commit-anterior>` in the runbook — these are per-install/per-rollback values the USER supplies (a runbook can't hardcode a one-time registration token). Not plan-failure placeholders. Every code/config step shows the exact content. ✓

**Consistency:** the `deploy` job's `runs-on: [self-hosted, prod-host]` matches the runner `--labels prod-host` in the runbook; `docker compose up -d --build` and the `NEXT_PUBLIC_SITE_URL` default `https://pdf.home.gustavorh.com` are identical across Dockerfile, compose, workflow, and docs; the gate `github.event_name == 'push' && github.ref == 'refs/heads/main'` matches the spec. ✓

**Note:** end-to-end deploy can only be verified after the user installs the runner + configures SafeLine/DNS (out-of-repo). The repo-side deliverables are verified by `docker compose config`, YAML validity, and the `ci` job running on this branch's PR.
