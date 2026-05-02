# Dockerfile for lab-agent (Phase 2 dev container)
#
# In production (Phase 5+) the lab agent ships as an Electron Windows installer
# that runs on the laboratory PC. This Dockerfile is for local development and
# CI smoke-tests so the agent can be exercised without a Windows host.
#
# Uses node:20-slim (Debian) instead of Alpine because onnxruntime-node and
# sharp require glibc.

# ============================================================
# Stage 1: install dependencies
# ============================================================
FROM node:20-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Workspace package.json files (Nx workspace resolution)
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/auth-service/package.json ./apps/auth-service/
COPY apps/audit-log-service/package.json ./apps/audit-log-service/
COPY apps/crystallization-service/package.json ./apps/crystallization-service/
COPY apps/crystallization-onnx-service/package.json ./apps/crystallization-onnx-service/
COPY apps/email-service/package.json ./apps/email-service/
COPY apps/lab-agent/package.json ./apps/lab-agent/
COPY apps/user-service/package.json ./apps/user-service/
COPY apps/vision-service/package.json ./apps/vision-service/
COPY apps/payment-service/package.json ./apps/payment-service/

RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps

# ============================================================
# Stage 2: build
# ============================================================
FROM deps AS builder

WORKDIR /app

COPY apps/ ./apps/
COPY packages/ ./packages/
COPY proto/ ./proto/
COPY types/ ./types/

RUN npx nx build lab-agent --configuration=production

# ============================================================
# Stage 3: production image
# ============================================================
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=builder /app/dist/apps/lab-agent ./dist/

RUN --mount=type=cache,target=/root/.npm \
    cd dist && npm install --omit=dev --legacy-peer-deps && cd ..

# Optional: a model file can be mounted at runtime via -v
# (the assets pipeline ships any model under src/assets/models/ into dist/assets/models/)
# Set VISION_MODEL_PATH=/models/best.onnx and -v ./models:/models if mounting.

EXPOSE 5005

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
