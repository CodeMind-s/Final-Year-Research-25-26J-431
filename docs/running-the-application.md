# Running the Application

This guide covers how to run the Brinex Server, with particular focus on the vision-service for salt crystal detection.

---

## 1. Docker & Infrastructure Setup

### What Docker Compose Provides

Docker Compose runs **Kafka + Zookeeper only**. MongoDB is hosted on **MongoDB Atlas** (cloud) and requires no local setup.

```bash
# Start Zookeeper (port 22181) and Kafka (port 29092)
docker-compose up -d

# Verify containers are running
docker-compose ps

# Stop infrastructure
docker-compose down
```

| Container  | Port  | Purpose                        |
| ---------- | ----- | ------------------------------ |
| Zookeeper  | 22181 | Kafka coordination             |
| Kafka      | 29092 | Message broker (auth & email)  |

### Which Services Need Kafka?

Only **auth-service** and **email-service** use Kafka. The vision-service, user-service, crystallization-service, and logs-service communicate exclusively via gRPC and do **not** require Kafka.

### ONNX Model File

The vision-service requires a YOLOv8 ONNX model file. This file is gitignored and must be placed manually:

```
apps/vision-service/models/best.onnx
```

The model path can be overridden via environment variable:

```bash
VISION_MODEL_PATH=apps/vision-service/models/best.onnx  # default (relative to repo root)
```

---

## 2. Running & Verifying Vision-Service in Isolation

The vision-service is **fully independent** — it does not need Kafka, the API Gateway, or any other microservice. It only requires:

- **MongoDB Atlas** connectivity (connection string is configured in the app module)
- **ONNX model file** at `apps/vision-service/models/best.onnx`

### Build and Serve

```bash
# Build the service
npx nx build @brinex-server/vision-service

# Serve in development mode (with watch)
npx nx serve @brinex-server/vision-service
```

On successful startup you should see:

```
Vision Service is running on gRPC port 50057
```

### Health Check

The vision-service exposes a `GetHealth` gRPC method. You can verify it through the API Gateway's REST endpoint:

```bash
# Start the API Gateway (in a separate terminal)
npx nx serve @brinex-server/api-gateway

# Check health via REST
curl http://localhost:3400/api/v1/vision/health
```

The health endpoint is **public** (no JWT token required). Expected response:

```json
{
  "modelLoaded": true,
  "modelPath": "apps/vision-service/models/best.onnx",
  "status": "healthy"
}
```

If `modelLoaded` is `false`, verify the ONNX model file exists at the expected path.

### WebSocket Testing

The API Gateway exposes a WebSocket gateway at the `/vision` namespace. To test real-time frame processing:

1. **Connect** to `ws://localhost:3400/vision` using a Socket.IO client.

2. **On connect**, the server emits `connection_status`:
   ```json
   { "connected": true, "modelLoaded": true }
   ```

3. **Start a session** by emitting `start_stream`:
   ```json
   { "cameraSource": "test", "roi": { "x": 0.05, "y": 0.05, "width": 0.9, "height": 0.9 } }
   ```
   The server responds with `stream_started`:
   ```json
   { "sessionId": "<id>", "roi": { ... } }
   ```

4. **Start a batch** by emitting `start_batch`:
   ```json
   {}
   ```
   The server responds with `batch_started`:
   ```json
   { "batchId": "<id>", "batchNumber": 1, "roi": { ... } }
   ```

5. **Send frames** by emitting `frame`:
   ```json
   { "data": "<base64-encoded-image>", "timestamp": 1700000000000 }
   ```
   The server responds with `detection_result` containing crystal counts, purity percentage, bounding boxes, and whiteness metrics.

6. **End the batch** by emitting `end_batch`. The server responds with `batch_ended` containing aggregated batch statistics.

7. **Stop the session** by emitting `stop_stream`. The server responds with `stream_stopped` and a session summary.

#### Additional WebSocket Events

| Emit (client -> server)  | Description                                  |
| ------------------------ | -------------------------------------------- |
| `update_roi`             | Update the region of interest mid-stream     |
| `update_settings`        | Change `saveDetections` or `confidenceThreshold` |
| `get_batch_history`      | Retrieve batch history for the current session |

---

## 3. Running the Full Application

### Startup Order

Services must be started in this order:

```
1. Docker (Kafka + Zookeeper)    docker-compose up -d
2. Python ML Service             cd apps/crystallization-ml-service && python src/main.py
3. NestJS Microservices          npx nx run-many -t serve --projects=auth-service,user-service,crystallization-service,logs-service,email-service,vision-service
4. API Gateway                   npx nx serve @brinex-server/api-gateway
```

### Port Map

| Service                    | Transport | Port  |
| -------------------------- | --------- | ----- |
| API Gateway                | HTTP      | 3400  |
| Auth Service               | gRPC      | 50000 |
| User Service               | gRPC      | 50053 |
| Crystallization Service    | gRPC      | 50054 |
| Crystallization ML Service | gRPC      | 50055 |
| Logs Service               | gRPC      | 50056 |
| Vision Service             | gRPC      | 50057 |
| Kafka                      | TCP       | 29092 |
| Zookeeper                  | TCP       | 22181 |

### Environment Variables

**Vision Service:**

| Variable                       | Default             | Description                    |
| ------------------------------ | ------------------- | ------------------------------ |
| `MONGO_URI`                    | Atlas connection    | MongoDB connection string      |
| `GRPC_URL`                     | `localhost:50057`   | gRPC listen address            |
| `VISION_MODEL_PATH`            | `apps/vision-service/models/best.onnx`| Path to ONNX model file (relative to repo root) |
| `VISION_INPUT_SIZE`            | `320`               | Model input resolution         |
| `VISION_CONFIDENCE_THRESHOLD`  | `0.5`               | Detection confidence threshold |
| `VISION_IOU_THRESHOLD`         | `0.45`              | NMS IoU threshold              |

**API Gateway (vision-related):**

| Variable              | Default           | Description                        |
| --------------------- | ----------------- | ---------------------------------- |
| `VISION_SERVICE_URL`  | `localhost:50057` | Vision service gRPC address        |
| `JWT_SECRET`          | `secret`          | JWT signing secret                 |

### Swagger Documentation

When the API Gateway is running, Swagger docs are available at:

```
http://localhost:3400/api/v1
```

All vision REST endpoints are under the **Vision** tag.

### Common Troubleshooting

| Problem                                  | Solution                                                       |
| ---------------------------------------- | -------------------------------------------------------------- |
| `modelLoaded: false` in health check     | Ensure `best.onnx` exists at `apps/vision-service/models/`     |
| `ECONNREFUSED` on port 50057             | Vision service isn't running — check `npx nx serve` output     |
| MongoDB connection timeout               | Check network connectivity to Atlas cluster                    |
| Kafka connection errors on auth/email    | Run `docker-compose up -d` and wait for healthy status         |
| `npm ci` fails with peer dependency errors | Use `npm ci --legacy-peer-deps`                              |
| WebSocket connects but no `detection_result` | Verify you emitted `start_stream` before sending `frame`   |
| API Gateway crashes with `proto not found` after hot-reload | Webpack dev rebuild clears the dist directory. Re-copy protos: `cp proto/*.proto dist/apps/api-gateway/proto/` then touch a source file to restart |
| `Cannot determine a type for...` Mongoose error | Add explicit `type` to `@Prop()` for union-typed fields, e.g. `@Prop({ type: Date, default: null })` for `Date \| null` |
