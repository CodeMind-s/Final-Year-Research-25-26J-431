# Dockerfile for vision-service
# This service uses ONNX Runtime and Sharp for YOLOv8 inference
# NOTE: Using node:20-slim (Debian-based) instead of Alpine because
# onnxruntime-node and sharp require glibc which is not available in Alpine

# ============================================================
# Stage 1: Install dependencies (CACHED unless package.json changes)
# ============================================================
FROM node:20-slim AS deps

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy ONLY package files first — this layer is cached until dependencies change
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Copy workspace-level package.json files
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/auth-service/package.json ./apps/auth-service/
COPY apps/audit-log-service/package.json ./apps/audit-log-service/
COPY apps/crystallization-service/package.json ./apps/crystallization-service/
COPY apps/crystallization-onnx-service/package.json ./apps/crystallization-onnx-service/
COPY apps/email-service/package.json ./apps/email-service/
COPY apps/user-service/package.json ./apps/user-service/
COPY apps/vision-service/package.json ./apps/vision-service/

# Install all dependencies — CACHED when only source code changes
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps

# ============================================================
# Stage 2: Build the service
# ============================================================
FROM deps AS builder

WORKDIR /app

# NOW copy source code
COPY apps/ ./apps/
COPY packages/ ./packages/
COPY proto/ ./proto/
COPY types/ ./types/

# Build the vision-service
RUN npx nx build vision-service --configuration=production

# ============================================================
# Stage 3: Production image (minimal — only prod dependencies)
# ============================================================
FROM node:20-slim AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copy built application (Nx generates package.json with only needed deps)
COPY --from=builder /app/dist/apps/vision-service ./dist/

# Install ONLY production dependencies from the Nx-generated package.json
RUN --mount=type=cache,target=/root/.npm \
    cd dist && npm install --omit=dev --legacy-peer-deps && cd ..

# Copy proto files (protoPath resolves to /proto/vision.proto from /app/dist)
COPY --from=builder /app/proto/ /proto/

# Create models directory (will be mounted as volume)
RUN mkdir -p /app/models

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
