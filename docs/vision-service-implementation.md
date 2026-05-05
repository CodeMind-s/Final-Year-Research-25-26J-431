# Vision Service Integration Guide

## Overview

The **vision-service** is a new microservice that performs real-time salt crystal detection using YOLOv8 (ONNX runtime) within the Brinex monorepo. It classifies crystals as pure, impure, or unwanted, calculates purity and whiteness metrics, and supports real-time video frame streaming via WebSocket.

**Origin**: Migrated from the standalone `salt-detection-backend` NestJS app. Key changes:
- PostgreSQL/Prisma → MongoDB/Mongoose
- REST endpoints → gRPC microservice
- WebSocket gateway moved to API Gateway (namespace `/vision`)

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Frontend (React)                │
│         WebSocket (/vision) + REST API           │
└─────────────┬───────────────────┬───────────────┘
              │ WS frames         │ REST
              ▼                   ▼
┌─────────────────────────────────────────────────┐
│             API Gateway (port 3400)              │
│  ┌────────────────┐  ┌───────────────────────┐  │
│  │ VisionGateway  │  │  VisionController     │  │
│  │ (WS /vision)   │  │  (REST /api/v1/vision)│  │
│  └───────┬────────┘  └──────────┬────────────┘  │
│          │ gRPC                  │ gRPC          │
└──────────┼──────────────────────┼───────────────┘
           ▼                      ▼
┌─────────────────────────────────────────────────┐
│           Vision Service (port 50057)            │
│  ┌──────────┐ ┌───────────┐ ┌────────────────┐ │
│  │Inference │ │ Detection │ │   Statistics    │ │
│  │ (ONNX)   │ │  + Batch  │ │   Aggregation  │ │
│  └──────────┘ └───────────┘ └────────────────┘ │
│                      │                           │
│              MongoDB (Mongoose)                  │
└─────────────────────────────────────────────────┘
```

## Port Allocation

| Service | Port | Protocol |
|---------|------|----------|
| API Gateway | 3400 | HTTP + WebSocket |
| Vision Service | 50057 | gRPC |
| Webpack DevServer (vision) | 9234 | Debug |

## Proto Contract (`proto/vision.proto`)

### RPCs

| RPC | Description |
|-----|-------------|
| `ProcessFrame` | Per-frame YOLO inference — accepts image bytes, returns detection results with bounding boxes, purity, whiteness |
| `CreateSession` / `EndSession` / `GetSession` | Session lifecycle management |
| `CreateBatch` / `EndBatch` / `GetBatch` | Batch lifecycle within sessions |
| `GetSessionBatches` / `GetBatchTrends` | Batch queries |
| `GetDetections` / `GetDetection` / `DeleteDetection` | Detection CRUD |
| `GetStatsSummary` / `GetStatsHourly` / `GetStatsDaily` / `GetStatsTrends` | Analytics aggregations |
| `GetHealth` | Model status health check |

### Key Messages

- **`ROI`** — Region of Interest (normalized 0-1 coordinates)
- **`BoundingBox`** — Detection box with class, confidence, whiteness metrics
- **`Detection`** — Per-frame detection with all counts, ROI stats, embedded bounding boxes
- **`DetectionSession`** — Session with accumulated stats and ROI config
- **`BatchSummary`** — Batch with snapshot stats and ROI settings

## MongoDB Schemas

### DetectionSession
```
{
  startTime: Date,
  endTime: Date | null,
  totalFrames: Number (default 0),
  totalPureCount: Number (default 0),
  totalImpureCount: Number (default 0),
  totalUnwantedCount: Number (default 0),
  avgPurityPercent: Number | null,
  totalBatches: Number (default 0),
  avgWhiteness: Number | null,
  avgQualityScore: Number | null,
  roi: { x, y, width, height },  // embedded subdocument
  cameraSource: String | null,
  notes: String | null,
}
```

### Detection
```
{
  timestamp: Date,
  frameWidth: Number,
  frameHeight: Number,
  processingTimeMs: Number,
  pureCount, impureCount, unwantedCount, totalCount: Number,
  purityPercentage: Number,
  roiPureCount, roiImpureCount, roiUnwantedCount, roiTotalCount: Number,
  roiPurityPercentage: Number | null,
  avgWhiteness, avgQualityScore: Number | null,
  roiAvgWhiteness, roiAvgQualityScore: Number | null,
  sessionId: ObjectId (ref DetectionSession),
  batchId: ObjectId (ref Batch),
  boundingBoxes: [{                // EMBEDDED array (not separate collection)
    x, y, width, height: Number,
    classId: Number,
    className: String,
    confidence: Number,
    whitenessPercentage: Number | null,
    qualityScore: Number | null,
  }],
}
```

### Batch
```
{
  sessionId: ObjectId (ref DetectionSession),
  batchNumber: Number,
  startTime: Date,
  endTime: Date | null,
  roi: { x, y, width, height },
  pureCount, impureCount, unwantedCount, totalCount: Number,
  purityPercentage: Number | null,
  avgWhiteness, avgQualityScore: Number | null,
  frameCount: Number (default 0),
}
```

## File Structure

```
apps/vision-service/
├── webpack.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.spec.json
├── jest.config.ts
├── eslint.config.mjs
├── .spec.swcrc
├── models/
│   └── .gitkeep              # ONNX model goes here (gitignored)
└── src/
    ├── main.ts               # gRPC bootstrap on port 50057
    └── app/
        ├── app.module.ts
        ├── common/
        │   └── interfaces/
        │       └── detection-result.interface.ts
        ├── inference/
        │   ├── inference.module.ts
        │   ├── inference.service.ts       # ONNX runtime (copied as-is)
        │   ├── preprocessing.service.ts   # sharp image preprocessing (copied as-is)
        │   ├── postprocessing.service.ts  # NMS + box processing (copied as-is)
        │   └── whiteness.service.ts       # HSV whiteness calc (copied as-is)
        ├── roi/
        │   ├── roi.module.ts
        │   └── roi.service.ts             # ROI filtering (copied as-is)
        ├── detection/
        │   ├── detection.module.ts
        │   ├── detection.service.ts       # Mongoose (rewritten from Prisma)
        │   ├── detection.controller.ts    # gRPC handlers
        │   └── schemas/
        │       ├── detection-session.schema.ts
        │       ├── detection.schema.ts
        │       ├── bounding-box.schema.ts # Embedded subdocument
        │       └── batch.schema.ts
        ├── batch/
        │   ├── batch.module.ts
        │   ├── batch.service.ts           # Mongoose (rewritten from Prisma)
        │   └── batch.controller.ts        # gRPC handlers
        ├── statistics/
        │   ├── statistics.module.ts
        │   ├── statistics.service.ts      # Mongoose aggregation pipelines
        │   └── statistics.controller.ts   # gRPC handlers
        └── health/
            ├── health.module.ts
            └── health.controller.ts       # gRPC health check

apps/api-gateway/src/app/vision-service/
├── vision.module.ts           # Self-contained module (own ClientsModule, guards)
├── vision.controller.ts       # REST → gRPC proxy
├── vision.gateway.ts          # WebSocket gateway (/vision namespace)
└── dtos/
    ├── process-frame.dto.ts
    ├── session.dto.ts
    ├── batch.dto.ts
    ├── detection-filter.dto.ts
    └── statistics.dto.ts
```

## ProcessFrame Pipeline (Core Logic)

The frame processing pipeline (from `detection.gateway.ts` → gRPC `ProcessFrame`):

1. **Decode**: Base64 string → Buffer (in API Gateway WS handler)
2. **Inference**: `InferenceService.runInference(imageBuffer)` → raw detections
3. **ROI filtering**: `ROIService.calculateROIStats()` + `markBoxesWithROI()`
4. **Whiteness**: `WhitenessService.calculateWhiteness()` for each box region
5. **Aggregate**: `calculateAggregateStats()` + `calculateROIAggregateStats()`
6. **Persist** (if saveDetection=true): Save detection to MongoDB, `$inc` session stats, `$set` batch snapshot
7. **Return**: Full `ProcessFrameResponse` with all metrics

## WebSocket Protocol (API Gateway `/vision` namespace)

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `start_stream` | `{ cameraSource?, roi? }` | Creates session, initializes client state |
| `stop_stream` | `{}` | Ends active batch and session |
| `start_batch` | `{ roi? }` | Starts new batch (ends previous if active) |
| `end_batch` | `{}` | Ends current batch |
| `frame` | `{ data: base64, timestamp }` | Process a video frame |
| `update_roi` | `{ roi: {x,y,width,height} }` | Update ROI config |
| `update_settings` | `{ saveDetections?, confidenceThreshold? }` | Update stream settings |
| `get_batch_history` | `{ limit? }` | Request recent batches |

### Server → Client Events

| Event | Description |
|-------|-------------|
| `connection_status` | Model loaded status on connect |
| `stream_started` | Session created, includes sessionId + ROI |
| `stream_stopped` | Session ended with summary stats |
| `detection_result` | Full frame detection results |
| `batch_started` | New batch created |
| `batch_ended` | Batch ended with final stats |
| `batch_stats_updated` | Real-time batch snapshot |
| `roi_updated` | ROI config confirmed |
| `settings_updated` | Settings confirmed |
| `error` | `{ code, message }` |

## Dependencies Added

```json
{
  "dependencies": {
    "onnxruntime-node": "^1.23.2",
    "sharp": "^0.34.5",
    "uuid": "^13.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^10.0.0"
  }
}
```

**Already in monorepo**: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `@nestjs/mongoose`, `mongoose`

## Webpack Externals

`onnxruntime-node` and `sharp` contain native C++ bindings and **must not** be bundled by webpack:

```javascript
externals: {
  'onnxruntime-node': 'commonjs onnxruntime-node',
  'sharp': 'commonjs sharp',
},
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VISION_SERVICE_URL` | `localhost:50057` | gRPC endpoint |
| `VISION_MODEL_PATH` | `./models/best.onnx` | Path to ONNX model file |
| `VISION_CONFIDENCE_THRESHOLD` | `0.5` | Min detection confidence |
| `VISION_IOU_THRESHOLD` | `0.45` | NMS IoU threshold |
| `VISION_INPUT_SIZE` | `320` | Model input dimensions |
| `MONGO_URI` | (shared) | MongoDB connection string |

### gRPC Config

- **Max message size**: 10MB (`maxReceiveMessageLength: 10 * 1024 * 1024`) for image frame data
- **Proto loader**: `keepCase: true, longs: String, enums: String, defaults: true, oneofs: true`

## Verification Checklist

1. `npx nx serve vision-service` — gRPC on port 50057
2. `npx nx serve api-gateway` — VisionModule loaded, WebSocket on `/vision`
3. `npx nx lint vision-service` — passes
4. `npx nx build vision-service` — builds successfully
5. WebSocket test: connect to `ws://localhost:3400/vision`, emit `start_stream`, send `frame`, expect `detection_result`
6. REST test: `GET /api/v1/vision/health` returns model status
7. Existing services unaffected: `GET /api/v1/crystallization/daily-measurement` still works

## Impact on Existing Code

**Only one existing file modified**: `apps/api-gateway/src/app/app.module.ts` — add `VisionModule` to imports array.

The VisionModule is fully self-contained with its own:
- `ClientsModule.register()` for gRPC connection
- `JwtModule.register()` for auth
- Guards and filters scoped to this module only
- WebSocket namespace `/vision` (isolated from other namespaces)
