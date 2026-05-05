# Dockerize the Vision-Service

This document describes how to run the vision-service inside Docker using a multi-stage Dockerfile and Docker Compose.

---

## Why Docker?

- Avoids the proto-file-hot-reload issue where Nx dev rebuilds clear the `dist/` directory
- Consistent runtime environment (Linux) regardless of host OS
- Matches the pattern set for `crystallization-ml-service` (commented out in docker-compose.yml)
- Simpler deployment: `docker-compose up vision-service`

---

## Key Technical Details

| Item | Detail |
|------|--------|
| **Base image** | `node:20-slim` (Debian). Alpine won't work — `onnxruntime-node` and `sharp` need glibc. |
| **Native modules** | `onnxruntime-node` and `sharp` are webpack externals (not bundled into main.js). Must be installed inside the Linux container. |
| **Proto path** | `main.ts` resolves `join(__dirname, '../../../proto/vision.proto')`. With `main.js` at `/app/main.js`, this becomes `/proto/vision.proto`. |
| **ONNX model** | 99MB file. Volume-mounted from host, not baked into the image. |
| **gRPC bind** | Must be `0.0.0.0:50057` inside Docker (set via `GRPC_URL` env var). |
| **Expected image size** | ~400-600MB (onnxruntime-node alone is 100MB+). |

---

## Step 1: Create `apps/vision-service/Dockerfile`

```dockerfile
# ============================================================
# Stage 1: Build the application
# ============================================================
FROM node:20-slim AS builder

WORKDIR /workspace

# Copy root package manifest
COPY package.json ./

# Install all dependencies (no lockfile in repo)
RUN npm install --legacy-peer-deps --ignore-scripts

# Copy Nx configuration and TypeScript configs
COPY tsconfig.base.json tsconfig.json nx.json ./

# Copy proto definitions
COPY proto/ ./proto/

# Copy only the vision-service source
COPY apps/vision-service/ ./apps/vision-service/

# Run the Nx build
RUN npx nx build @brinex-server/vision-service

# ============================================================
# Stage 2: Production runtime image
# ============================================================
FROM node:20-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the webpack bundle
COPY --from=builder /workspace/dist/apps/vision-service/main.js ./main.js

# Place proto file where the path resolution expects it: /proto/vision.proto
# main.js uses join(__dirname, '../../../proto/vision.proto')
# With __dirname=/app, this resolves to /proto/vision.proto
COPY --from=builder /workspace/proto/vision.proto /proto/vision.proto

# Install only the native external modules needed at runtime
# (sharp and onnxruntime-node are webpack externals, not bundled)
RUN npm init -y \
    && npm install --omit=dev \
       onnxruntime-node@1.24.1 \
       sharp@0.34.5 \
    && npm cache clean --force

# Create models directory for volume mount
RUN mkdir -p /app/models

# Runtime configuration
ENV NODE_ENV=production
ENV GRPC_URL=0.0.0.0:50057
ENV VISION_MODEL_PATH=/app/models/best.onnx
ENV VISION_INPUT_SIZE=320
ENV VISION_CONFIDENCE_THRESHOLD=0.5
ENV VISION_IOU_THRESHOLD=0.45

EXPOSE 50057

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "main.js"]
```

---

## Step 2: Create `.dockerignore` (repo root)

```
# Dependencies
node_modules
**/node_modules

# Build output
dist
**/dist

# IDE
.idea
.vscode
.cursor

# Git
.git
.gitignore

# Other services (not needed for vision-service build)
apps/api-gateway
apps/auth-service
apps/user-service
apps/crystallization-service
apps/crystallization-ml-service
apps/logs-service
apps/email-service
apps/*-e2e

# Large binary files
**/*.onnx
**/models/*.onnx

# Test files
**/*.spec.ts
**/*.test.ts
**/jest.config.*

# Misc
.nx
.claude
coverage
test-output
tmp
docs
```

---

## Step 3: Add to `docker-compose.yml`

Add this block after the `kafka` service, before the commented-out `crystallization-ml-service`:

```yaml
  vision-service:
    build:
      context: .
      dockerfile: apps/vision-service/Dockerfile
    container_name: vision-service
    ports:
      - "50057:50057"
    networks:
      - app-network
    environment:
      - GRPC_URL=0.0.0.0:50057
      - MONGO_URI=${MONGO_URI:-mongodb+srv://brinexAdmin:1no83DWF6n31kkj3@cluster0.tk0ipzf.mongodb.net/brinex?appName=Cluster0}
      - VISION_MODEL_PATH=/app/models/best.onnx
      - VISION_INPUT_SIZE=${VISION_INPUT_SIZE:-320}
      - VISION_CONFIDENCE_THRESHOLD=${VISION_CONFIDENCE_THRESHOLD:-0.5}
      - VISION_IOU_THRESHOLD=${VISION_IOU_THRESHOLD:-0.45}
    volumes:
      - ./apps/vision-service/models:/app/models:ro
    healthcheck:
      test: ["CMD-SHELL", "node -e \"const net=require('net');const s=new net.Socket();s.connect(50057,'localhost',()=>{s.destroy();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),3000)\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    restart: unless-stopped
```

---

## Step 4: Build & Run

```bash
# Ensure the ONNX model is in place
ls apps/vision-service/models/best.onnx

# Build the Docker image
docker-compose build vision-service

# Run vision-service (and Kafka/Zookeeper if needed)
docker-compose up -d vision-service

# Check status
docker-compose ps

# View logs
docker-compose logs -f vision-service
```

Expected startup logs:
```
[InferenceService] Loading ONNX model from: /app/models/best.onnx
[InferenceService] ONNX model loaded successfully
[InferenceService] Model warmup complete
Vision Service is running on gRPC port 50057
```

---

## Step 5: Verify via API Gateway

The API Gateway runs on the host and connects to the Docker container via `localhost:50057`:

```bash
# Start API Gateway on host (separate terminal)
npx nx serve @brinex-server/api-gateway

# Test health endpoint
curl http://localhost:3400/api/v1/vision/health
```

Expected response:
```json
{
  "modelLoaded": true,
  "modelPath": "/app/models/best.onnx",
  "status": "healthy"
}
```

---

## Environment Variables Reference

| Variable | Default in Docker | Description |
|----------|-------------------|-------------|
| `GRPC_URL` | `0.0.0.0:50057` | gRPC listen address (must be `0.0.0.0` in Docker) |
| `MONGO_URI` | Atlas connection string | MongoDB connection |
| `VISION_MODEL_PATH` | `/app/models/best.onnx` | Path to ONNX model inside container |
| `VISION_INPUT_SIZE` | `320` | Model input resolution |
| `VISION_CONFIDENCE_THRESHOLD` | `0.5` | Detection confidence threshold |
| `VISION_IOU_THRESHOLD` | `0.45` | NMS IoU threshold |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails with npm errors | Ensure `.dockerignore` exists to exclude `node_modules` from build context |
| Model not found at startup | Verify `apps/vision-service/models/best.onnx` exists on the host |
| Container starts but health check fails | Wait 60s for model loading. Check logs: `docker-compose logs vision-service` |
| API Gateway can't reach vision-service | Ensure port `50057` is mapped in docker-compose and vision-service container is running |
| `sharp` or `onnxruntime-node` install fails | Ensure using `node:20-slim` (Debian), not Alpine |
| Proto file not found | The Dockerfile copies `vision.proto` to `/proto/` — verify the COPY step succeeded |
