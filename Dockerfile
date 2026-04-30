# syntax=docker/dockerfile:1.7

# --- Build stage: install all deps, run typecheck (so TS errors fail the
#     image build instead of leaking through to runtime), then build.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.server.json vite.config.ts ./
COPY shared ./shared
COPY client ./client
COPY server/src ./server/src

# Server tests aren't copied above (we don't ship them), so the typecheck's
# tests-only configs don't apply here — only the real client + server source
# is type-checked, which is what we want.
RUN npm run typecheck && npm run build

# --- Runtime stage: production deps only + compiled output. Drops to the
#     non-root `node` user (uid:gid 1000:1000, baked into node:* images) so a
#     container escape doesn't grant root inside the namespace.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "dist/server/server/src/index.js"]
