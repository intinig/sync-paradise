# syntax=docker/dockerfile:1.7

# --- Build stage: install all deps, run typecheck and build.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.server.json vite.config.ts ./
COPY shared ./shared
COPY client ./client
COPY server/src ./server/src

RUN npm run build

# --- Runtime stage: production deps only + compiled output.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server/server/src/index.js"]
