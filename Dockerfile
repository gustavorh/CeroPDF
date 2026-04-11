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

# Build de la aplicación Next.js
RUN npm run build

# Etapa de producción - imagen mínima
FROM node:20-alpine AS production

# Instalar curl para healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Configurar entorno de producción
ENV NODE_ENV=production

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

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Iniciar servidor standalone
CMD ["node", "apps/web/server.js"]
