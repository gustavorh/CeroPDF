# syntax=docker/dockerfile:1

# Build stage: install + compile TypeScript with full devDeps.
FROM node:20-alpine AS builder

WORKDIR /app

# Workspace root manifest (heavy is a workspace) — needed for npm to resolve the workspaces graph.
COPY package*.json ./
COPY apps/heavy/package*.json ./apps/heavy/

# Install only the heavy workspace and its transitive deps.
RUN npm ci -w heavy --include-workspace-root

COPY apps/heavy ./apps/heavy

RUN npm run build -w heavy && \
    npm prune --omit=dev -w heavy --include-workspace-root

# Runtime stage: alpine + ghostscript + qpdf + Node, no devDeps.
FROM node:20-alpine AS production

# Ghostscript = real PDF compression. qpdf = password unlock.
# libreoffice (+ fonts) = Office/OpenDocument → PDF conversion. tini = clean signals.
# NOTE: libreoffice adds ~0.5–1 GB to the image.
RUN apk add --no-cache \
        ghostscript qpdf tini \
        libreoffice font-noto ttf-dejavu && \
    addgroup -g 1001 -S nodejs && \
    adduser -S -D -H -u 1001 -s /sbin/nologin -G nodejs -g nodejs appuser

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
# soffice headless needs a writable HOME (appuser was created with -H / no home).
ENV HOME=/tmp

COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/apps/heavy/node_modules ./apps/heavy/node_modules
COPY --from=builder --chown=appuser:nodejs /app/apps/heavy/dist ./apps/heavy/dist
COPY --from=builder --chown=appuser:nodejs /app/apps/heavy/package.json ./apps/heavy/package.json

USER appuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/heavy/dist/server.js"]
