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
