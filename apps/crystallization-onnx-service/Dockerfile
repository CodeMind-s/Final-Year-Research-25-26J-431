# Dockerfile for crystallization-onnx-service
# This service uses ONNX Runtime for ML inference
# NOTE: Using node:20-slim (Debian-based) instead of Alpine because ONNX Runtime
# requires glibc which is not available in Alpine (uses musl libc)

FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files from root
COPY package*.json ./
COPY nx.json ./
COPY tsconfig*.json ./

# Copy workspace files
COPY apps/ ./apps/
COPY packages/ ./packages/
COPY proto/ ./proto/
COPY types/ ./types/

# Install all dependencies
RUN npm install --legacy-peer-deps

# Build the crystallization-onnx-service
RUN npx nx build crystallization-onnx-service --configuration=production

# Production stage - using slim (Debian-based) for glibc compatibility
FROM node:20-slim AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# Copy built application (includes proto files copied by webpack)
COPY --from=builder /app/dist/apps/crystallization-onnx-service ./dist/
COPY --from=builder /app/node_modules ./node_modules/

# Create models directory (will be mounted as volume)
RUN mkdir -p /app/models

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
