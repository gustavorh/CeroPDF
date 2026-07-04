# Deploy — CeroPDF (homelab / prod-host)

CeroPDF se despliega en la VM interna **prod-host** (`10.0.30.254`, Proxmox) con
`docker compose`. El deploy es automático: **cada push a `main`** ejecuta el
workflow CI/CD, y su job `deploy` corre en un **self-hosted runner** instalado en
prod-host. Acceso interno vía `https://pdf.home.gustavorh.com`.

El ingress sigue el patrón canónico del homelab (igual que Linkly / MiPlata):
**Traefik (hermes) → Caddy (prod-host) → contenedor en la red `edge`**. Runbook
genérico del homelab: `~/dev/homelab/homelab-deploy-runbook.md` (local, privado).

## Flujo

**Deploy (push → producción):**
```
push a main ─► job ci  (GitHub cloud): lint · typecheck · test · build
            └► job deploy (self-hosted, prod-host, sólo si push+main):
               docker compose up -d --build --wait
               → smoke test /api/health vía Caddy → docker image prune -f
```

**Request (navegador → contenedor):**
```
Navegador (https://pdf.home.gustavorh.com)
  → Pi-hole DNS       (*.home.gustavorh.com → 10.0.20.2)
  → Traefik (hermes)  (443, termina TLS, enruta por Host)
  → Caddy (prod-host) (10.0.30.254:8080, enruta por Host)
  → contenedor web    (red `edge`, alias `ceropdf-web:3000`)
```

El job `deploy` está gateado a `push` + `main`, así que **ese job** nunca corre en
PRs. **Ojo:** eso NO basta para blindar el runner en un repo público — ver
"Seguridad del runner" abajo.

`web` es el único servicio en la red `edge`. `heavy` (Ghostscript + qpdf +
LibreOffice) queda sólo en `ceropdf-internal`, nunca expuesto; el `web` lo alcanza
por `HEAVY_API_URL=http://heavy:3001`.

## Provisioning (una sola vez)

La infra compartida (Traefik, Caddy, Pi-hole, red externa `edge`) ya corre. Añadir
CeroPDF = registrar el runner + una entrada en cada proxy. **No** usa MySQL, Redis
ni `.env` en el servidor (todo `NEXT_PUBLIC_*` se hornea en build).

### 1. Seguridad de GitHub (hacer PRIMERO)

Repo público + self-hosted runner = superficie sensible: en un `pull_request`,
GitHub ejecuta el workflow **desde el head del PR**, así que un fork podría añadir
un job con `runs-on: [self-hosted, prod-host]` y ejecutar código en prod-host (RCE
en la VM interna). El gate `if: push && main` NO cierra esto por sí solo.

→ **Settings → Actions → General → "Fork pull request workflows from outside
collaborators" → "Require approval for all outside collaborators"** (la opción más
estricta). Hazlo **antes** de registrar el runner. No pongas secrets en el workflow
(este deploy no usa ninguno — mantenerlo así).

### 2. Registrar el runner (en prod-host)

Prerequisitos: `docker` + plugin `compose`; el usuario del runner en el grupo
`docker`; la red externa `edge` presente.

```bash
# token efímero (~1h), desde la laptop (gh con scope repo + admin del repo):
TOKEN=$(gh api --method POST \
  repos/gustavorh/CeroPDF/actions/runners/registration-token -q .token)

# en prod-host:
ssh prod-host "RUNNER_TOKEN='$TOKEN' bash -s" <<'EOF'
VER=2.335.1
mkdir -p ~/actions-runner-ceropdf && cd ~/actions-runner-ceropdf
curl -fsSL -o r.tgz \
  https://github.com/actions/runner/releases/download/v$VER/actions-runner-linux-x64-$VER.tar.gz
tar xzf r.tgz
./config.sh --url https://github.com/gustavorh/CeroPDF \
  --token "$RUNNER_TOKEN" --name prod-host-ceropdf --labels prod-host \
  --unattended --replace
sudo ./svc.sh install "$USER" && sudo ./svc.sh start
EOF
```

Verifica: `systemctl status actions.runner.gustavorh-CeroPDF.prod-host-ceropdf` → `active`
y "Listening for Jobs". El workflow selecciona este runner con
`runs-on: [self-hosted, prod-host]`.

### 3. DNS en Pi-hole

El wildcard `*.home.gustavorh.com` ya resuelve a hermes; el registro explícito es
opcional pero recomendado. Preserva los existentes:

```bash
docker exec pihole pihole-FTL --config dns.hosts \
  '[ "<...existentes...>", "10.0.20.2 pdf.home.gustavorh.com" ]'

dig +short @10.0.40.5 pdf.home.gustavorh.com   # verifica desde la laptop
```

### 4. Traefik (hermes): router + service

Edita `~/services/traefik/config/dynamic/gateway.yml`. **Backup antes**
(`cp gateway.yml gateway.yml.bak.$(date +%s)`) — un YAML inválido tumba el enrutado
de todos los servicios. El file provider recarga solo.

```yaml
http:
  routers:
    # ...existentes...
    ceropdf:
      rule: "Host(`pdf.home.gustavorh.com`)"
      service: ceropdf
      tls:
        certResolver: cloudflare
      entryPoints:
        - websecure
  services:
    # ...existentes...
    ceropdf:
      loadBalancer:
        servers:
          - url: "http://10.0.30.254:8080"   # el Caddy de prod-host
```

### 5. Caddy (prod-host): la ruta interna

```bash
cat >> ~/services/caddy/Caddyfile <<'BLOCK'

http://pdf.home.gustavorh.com:8080 {
	encode gzip
	reverse_proxy ceropdf-web:3000
}
BLOCK

docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Caddy valida antes de aplicar; si falla, mantiene la config previa. Resuelve el
upstream `ceropdf-web` en tiempo de request, así que puedes añadir el bloque antes
de que el contenedor exista.

### 6. Primer deploy

Con runner activo y ambos proxies listos, un `git push` a `main` dispara todo.
Sigue el run en la pestaña **Actions**. El smoke test del job `deploy` pega a Caddy
(`10.0.30.254:8080`) con el `Host` header; `--wait` bloquea hasta que el
healthcheck `/api/health` pase, así que el contenedor ya está en `edge` cuando corre
el smoke test.

## Verificación

De adentro hacia afuera (en prod-host, dir del checkout del runner
`~/actions-runner-ceropdf/_work/CeroPDF/CeroPDF`):

```bash
docker compose ps                        # web + heavy 'healthy'
docker compose exec web wget -qO- http://localhost:3000/api/health
curl -fsS -H 'Host: pdf.home.gustavorh.com' \
  http://10.0.30.254:8080/api/health     # directo contra Caddy (salta el gateway)
# end-to-end vía Traefik (TLS real, desde la LAN/VPN):
curl -fsS https://pdf.home.gustavorh.com/api/health
```

## Rollback

En prod-host, en el checkout del runner:

```bash
git checkout <commit-anterior>
docker compose up -d --build --wait
```

O re-ejecuta un run anterior del workflow desde la pestaña Actions. Para revertir
el ingress, quita el router/service de `gateway.yml` (Traefik) y el bloque del
`Caddyfile`, y `caddy reload`.

## Troubleshooting

| Síntoma | Causa probable | Fix |
|---|---|---|
| El job queda en cola, no corre | Runner caído o sin la label | `systemctl status actions.runner.gustavorh-CeroPDF.prod-host-ceropdf` → "Listening for Jobs" |
| Caddy responde **502** | El web no está en `edge` o no arrancó | `docker compose ps`; revisa el health del servicio `web` |
| Traefik responde **404** | Falta router/service o YAML inválido | Revisa `gateway.yml` y `docker logs traefik` |
| Aviso de cert en el 1er acceso | Cert Cloudflare emitiéndose | Espera unos segundos y reintenta |
| El nombre no resuelve | — | `dig @10.0.40.5 pdf.home.gustavorh.com` (el wildcard ya cubre) |

## Notas

- El deploy no usa secrets: el runner clona el repo público y buildea local.
- `NEXT_PUBLIC_SITE_URL` se hornea en build (default `https://pdf.home.gustavorh.com`
  en `Dockerfile`/`compose.yml`); para otro dominio, pásalo como build-arg.
- El sidecar `heavy` (Ghostscript+qpdf+LibreOffice) es lento de buildear; el cache
  de Docker en el runner acelera rebuilds posteriores.
