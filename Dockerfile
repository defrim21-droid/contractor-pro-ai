# Build the worker from repo root (used when Railway root = repo)
FROM node:20-slim AS builder

WORKDIR /app

COPY worker/package*.json ./
RUN npm ci

COPY worker/tsconfig.json ./
COPY worker/src/ ./src/
RUN npm run build

FROM node:20-slim

WORKDIR /app

COPY worker/package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
