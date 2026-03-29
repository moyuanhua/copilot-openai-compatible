# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

# Copy only production dependencies + compiled output
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# The Copilot CLI binary is bundled inside node_modules at runtime;
# copy the entire node_modules so the bundled CLI is available.
# (The CLI is a native binary shipped as an optional dependency.)
COPY --from=builder /app/node_modules ./node_modules

ENV PORT=8888
ENV SESSION_TTL_MS=600000

EXPOSE 8888

# Mount your GitHub Copilot credentials from the host:
#   -v ~/.config/github-copilot:/root/.config/github-copilot:ro
# or set COPILOT_CLI_PATH to point to a pre-authenticated CLI binary.

CMD ["node", "dist/server.js"]
