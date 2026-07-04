# syntax=docker/dockerfile:1

# Multi-stage build para CeroPDF - Aplicación Next.js 100% Client-Side
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias del workspace raíz
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Copiar scripts necesarios para postinstall
COPY apps/web/scripts ./apps/web/scripts

# Instalar dependencias del workspace
RUN npm ci

# Copiar todo el código fuente
COPY . .

# Bake the public site URL at build time (Next inlines NEXT_PUBLIC_* into the bundle).
ARG NEXT_PUBLIC_SITE_URL=https://pdf.home.gustavorh.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# Build de la aplicación Next.js
RUN npm run build

# Etapa de producción - imagen mínima
FROM node:20-alpine AS production

# Instalar curl para healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Configurar entorno de producción
ENV NODE_ENV=production
# Next standalone se bindea a $HOSTNAME; Docker lo fija al container-id, lo que
# lo dejaría escuchando sólo en la IP del contenedor. 0.0.0.0 = todas las interfaces.
ENV HOSTNAME=0.0.0.0

# Con standalone output, solo copiamos los archivos necesarios
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S -D -H -u 1001 -s /sbin/nologin -G nodejs -g nodejs appuser && \
    chown -R appuser:nodejs /app

USER appuser

# Exponer puerto
EXPOSE 3000

# Health check (127.0.0.1: localhost puede resolver a ::1 en Alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://127.0.0.1:3000/api/health || exit 1

# Iniciar servidor standalone
CMD ["node", "apps/web/server.js"]
