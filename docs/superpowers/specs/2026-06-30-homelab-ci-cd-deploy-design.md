# Spec — Homelab CI/CD deploy (push-to-main → prod-host)

- **Fecha:** 2026-06-30
- **Estado:** Aprobado (diseño) — pendiente de plan de implementación
- **Contexto:** despliegue interno de homelab (no cloud). Separado del trabajo de PDF tools.

---

## 1. Contexto y objetivo

Desplegar automáticamente una nueva versión de CeroPDF en cada push a `main`, sobre la VM **prod-host** (IP `10.0.30.254`, hipervisor Proxmox) dentro del homelab / red interna del usuario. Acceso **solo interno** vía DNS `pdf.home.gustavorh.com`. Sin infraestructura cloud.

El proyecto ya se despliega con **`docker compose`** (`compose.yml` raíz): servicio `web` (Next.js standalone, `127.0.0.1:3002:3000`) + `heavy` (sidecar interno), detrás de **SafeLine WAF** (red externa `safeline-ce`; hostname vía label `com.safeline.hostname`). El CI actual (`.github/workflows/ci.yml`) solo hace lint+build en runners cloud.

### Restricciones / hechos

- **La VM es interna**: los runners cloud de GitHub no la alcanzan.
- **El repo es PÚBLICO** (`github.com/gustavorh/CeroPDF`): un self-hosted runner debe blindarse contra PRs de forks.
- `NEXT_PUBLIC_*` se **inlinea en build** (Next) → `NEXT_PUBLIC_SITE_URL` debe fijarse como build-arg, no runtime.
- Deploy = `docker compose up -d --build` en prod-host (rebuild local, sin registry).

### Decisiones tomadas (brainstorming)

1. **Mecanismo: self-hosted GitHub Actions runner en prod-host** (event-driven, "tras cada commit"; patrón idiomático de homelab).
2. **Seguridad repo público:** el job de deploy se **gatea a `push` + `main`** → los PRs de forks nunca lo ejecutan.
3. **CI reforzado:** añadir `typecheck` + `test` al job CI (hoy solo lint+build) para que el gate de deploy sea real.
4. **DNS interno:** `pdf.home.gustavorh.com` — se refleja en el label WAF y en `NEXT_PUBLIC_SITE_URL`.

---

## 2. Alcance

### Dentro
- Extender `.github/workflows/ci.yml` (→ "CI/CD"): job `ci` (lint+typecheck+test+build, cloud) + job `deploy` (self-hosted, prod-host).
- `compose.yml`: label WAF → `pdf.home.gustavorh.com`; build-arg `NEXT_PUBLIC_SITE_URL`.
- `Dockerfile`: `ARG`/`ENV NEXT_PUBLIC_SITE_URL` antes del build.
- `apps/web/.env.example`: ejemplo → `pdf.home.gustavorh.com`.
- `docs/deploy.md`: runbook (setup del runner, DNS/WAF, primer deploy, rollback) + puntero en `CLAUDE.md`.

### Fuera
- Instalar/registrar el runner en prod-host (paso manual del usuario, documentado — no automatizable desde el repo).
- Configurar SafeLine (app/hostname) y la DNS interna (lado del usuario).
- Registry de imágenes, blue/green, healthcheck externo, notificaciones (YAGNI para homelab interno).
- No se tocan los tools PDF ni su código.

---

## 3. Workflow — `.github/workflows/ci.yml`

Se renombra `name: CI` → `name: CI/CD`. Dos jobs:

**Job `ci`** (`runs-on: ubuntu-latest`, en push + PR):
- checkout → setup-node 20 (cache npm) → `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`.
- (Añade `typecheck` + `test` a los pasos actuales.)

**Job `deploy`** (`runs-on: [self-hosted, prod-host]`):
- `needs: ci`.
- `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`.
- Pasos: checkout → `docker compose up -d --build` → `docker image prune -f`.

**Concurrency — se mueve de workflow-level a per-job.** El `ci.yml` actual tiene un `concurrency` a nivel workflow con `cancel-in-progress: true`; eso cancelaría un deploy en curso si llega otro push. Se **elimina el bloque a nivel workflow** y se define por job:
- Job `ci`: `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` (cancela CI viejo, ahorra minutos cloud).
- Job `deploy`: `concurrency: { group: deploy-prod, cancel-in-progress: false }` (encola deploys, nunca corta un `compose` a medias).

**Sin secrets:** el runner vive en prod-host, clona el repo público y buildea local. El único token es el de registro del runner (una vez, en el setup manual).

---

## 4. Cambios en compose / Dockerfile

**`compose.yml` (servicio `web`):**
- `labels`: `com.safeline.hostname=ceropdf.gustavorh.com` → `com.safeline.hostname=pdf.home.gustavorh.com`.
- `build`: añadir `args: { NEXT_PUBLIC_SITE_URL: "${NEXT_PUBLIC_SITE_URL:-https://pdf.home.gustavorh.com}" }`.

**`Dockerfile` (stage `builder`, antes de `RUN npm run build`):**
```dockerfile
ARG NEXT_PUBLIC_SITE_URL=https://pdf.home.gustavorh.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
```
Así el build hornea el canonical/sitemap/OG con el dominio interno. Default en compose y Dockerfile → no requiere secret ni `.env` en prod-host.

**`apps/web/.env.example`:** cambiar el ejemplo `NEXT_PUBLIC_SITE_URL=https://ceropdf.example.com` → `https://pdf.home.gustavorh.com` (documental).

---

## 5. Runner — setup manual (documentado en `docs/deploy.md`)

Pasos que el usuario ejecuta **una vez** en prod-host (no automatizables desde el repo):

1. **Prereqs:** `docker` + plugin `compose`; el usuario del runner en el grupo `docker`; la red externa `safeline-ce` existente (la WAF ya la crea).
2. **Runner:** en GitHub → repo → Settings → Actions → Runners → *New self-hosted runner* (Linux x64). En prod-host:
   ```bash
   mkdir actions-runner && cd actions-runner
   curl -o runner.tar.gz -L <URL_del_runner>
   tar xzf runner.tar.gz
   ./config.sh --url https://github.com/gustavorh/CeroPDF --token <TOKEN> --labels prod-host --name prod-host
   sudo ./svc.sh install && sudo ./svc.sh start
   ```
3. **Red/WAF:** DNS interna `pdf.home.gustavorh.com → 10.0.30.254`; en SafeLine, una app/route para ese hostname → contenedor `web` (`127.0.0.1:3002`).
4. **Primer deploy:** push a `main` → el job `deploy` corre en prod-host y levanta el stack.

El runbook incluye también **rollback** (`git checkout <commit-previo> && docker compose up -d --build` en el checkout del runner, o re-ejecutar un run anterior) y **verificación** (`docker compose ps`, `curl -f http://127.0.0.1:3002/`).

Puntero en `CLAUDE.md`: la sección de deploy actual menciona `docker compose up --build`; se actualiza el hostname a `pdf.home.gustavorh.com` y se enlaza `docs/deploy.md`.

---

## 6. Errores y consideraciones

- **Repo público + self-hosted:** el gate `if: push && main` es la mitigación clave (los forks/PRs no ejecutan el job de deploy). No exponer secrets al job de deploy (no los necesita).
- **Deploy fallido:** si `docker compose up --build` falla, el job falla (rojo en Actions); los contenedores previos siguen corriendo (`up -d` solo recrea si el build tuvo éxito). Rollback documentado.
- **Build pesado:** `heavy` (Ghostscript+qpdf+LibreOffice) es lento de buildear; aceptable en homelab (deploys infrecuentes). El cache de Docker en el runner acelera rebuilds.
- **Runner offline:** si el runner de prod-host está caído, el job `deploy` queda en cola hasta que vuelva; el CI cloud no se ve afectado.

---

## 7. Testing / verificación

No hay tests automatizados (es config de infra). Verificación:
- **CI:** los pasos `lint/typecheck/test/build` corren en cloud en el primer push (validan el propio cambio de workflow).
- **Deploy (manual, extremo a extremo):** tras instalar el runner, un push a `main` debe: pasar `ci` → correr `deploy` en prod-host → `docker compose ps` muestra `web`+`heavy` healthy → `curl -f http://127.0.0.1:3002/` responde → `https://pdf.home.gustavorh.com` accesible en la red interna.
- **Gate de seguridad:** abrir un PR (desde una rama del repo o un fork) y confirmar que el job `deploy` **no** se ejecuta (solo `ci`).

---

## 8. Entregables (checklist)

- [ ] `ci.yml` → `name: CI/CD`; job `ci` con `typecheck`+`test` añadidos; job `deploy` (self-hosted, `needs: ci`, gate push+main, concurrency propia, `docker compose up -d --build` + prune).
- [ ] `compose.yml`: hostname `pdf.home.gustavorh.com` + build-arg `NEXT_PUBLIC_SITE_URL`.
- [ ] `Dockerfile`: `ARG`/`ENV NEXT_PUBLIC_SITE_URL`.
- [ ] `apps/web/.env.example`: ejemplo actualizado.
- [ ] `docs/deploy.md`: runbook (runner, DNS/WAF, primer deploy, rollback, verificación).
- [ ] `CLAUDE.md`: sección deploy actualizada + puntero al runbook.
- [ ] El workflow es válido (YAML) y el job `ci` reforzado pasa en el propio PR/push.

> Nota: instalar el runner y configurar SafeLine/DNS son pasos del usuario (fuera del repo); el spec entrega el workflow + config + runbook para que funcionen.
