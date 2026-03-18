# syntax=docker/dockerfile:1
FROM node:20-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# ── Install dependencies ────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Build TypeScript ────────────────────────────────────────────────────────
FROM base AS builder
COPY package.json package-lock.json* tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

# ── Production image ────────────────────────────────────────────────────────
FROM base AS runner
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode===200?0:1))"

CMD ["node", "dist/server.js"]
