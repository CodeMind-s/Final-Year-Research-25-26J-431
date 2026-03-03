# Multi-stage Dockerfile for NestJS microservices
# Usage: docker build --build-arg SERVICE_NAME=api-gateway -t api-gateway .

# ============================================================
# Stage 1: Install dependencies (CACHED unless package.json changes)
# ============================================================
FROM node:20-alpine AS deps

WORKDIR /app

# Install native build dependencies
RUN apk add --no-cache python3 make g++

# Copy ONLY package files first — this layer is cached until dependencies change
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Copy workspace-level package.json files (for Nx workspace resolution)
# Using a find-and-copy approach to only grab package.json files, not source
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY apps/auth-service/package.json ./apps/auth-service/
COPY apps/audit-log-service/package.json ./apps/audit-log-service/
COPY apps/crystallization-service/package.json ./apps/crystallization-service/
COPY apps/crystallization-onnx-service/package.json ./apps/crystallization-onnx-service/
COPY apps/email-service/package.json ./apps/email-service/
COPY apps/user-service/package.json ./apps/user-service/
COPY apps/vision-service/package.json ./apps/vision-service/
COPY apps/payment-service/package.json ./apps/payment-service/
COPY apps/compass-service/package.json ./apps/compass-service/
COPY apps/waste-valorization-service/package.json ./apps/waste-valorization-service/

# Install all dependencies — this layer is CACHED when only source.json files change
# --mount=type=cache persists npm download cache across Docker builds for faster installs
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps

# ============================================================
# Stage 2: Build the specific service
# ============================================================
FROM deps AS builder

WORKDIR /app

# NOW copy source code (this layer changes often, but npm install above is cached)
COPY apps/ ./apps/
COPY packages/ ./packages/
COPY proto/ ./proto/
COPY types/ ./types/

# Build argument for service name
ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}

# Build the specific service
RUN npx nx build ${SERVICE_NAME} --configuration=production --skip-nx-cache

# ============================================================
# Stage 3: Production image (minimal — only prod dependencies)
# ============================================================
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache dumb-init

ARG SERVICE_NAME
ENV SERVICE_NAME=${SERVICE_NAME}
ENV NODE_ENV=production

# Copy built application (Nx generates a package.json with only needed deps)
COPY --from=builder /app/dist/apps/${SERVICE_NAME} ./dist/

# Install ONLY production dependencies from the Nx-generated package.json
# This is much smaller than copying the full monorepo node_modules (~500MB)
RUN --mount=type=cache,target=/root/.npm \
    cd dist && npm install --omit=dev --legacy-peer-deps && cd ..

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
