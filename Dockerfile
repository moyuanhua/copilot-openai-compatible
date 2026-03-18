# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Production stage ────────────────────────────────────────────────────────────
FROM node:20-slim AS production

# Install the Copilot CLI (must be authenticated separately via volume mount or
# environment variables – see README for setup instructions).
# The CLI binary is expected to be present at /usr/local/bin/copilot or in PATH.

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/dist ./dist

# Non-root user for security
RUN useradd --create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 3000

CMD ["node", "dist/server.js"]
