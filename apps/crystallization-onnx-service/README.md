# Crystallization ONNX Service

This service provides ML predictions for salt crystallization using ONNX Runtime instead of TensorFlow/Python.

## Overview

This is a Node.js/NestJS implementation of the crystallization ML service that uses ONNX Runtime for inference.
It provides the exact same gRPC interface as the Python-based `crystallization-ml-service` but without requiring Python.

## Benefits

| Aspect | Python/TensorFlow | Node.js/ONNX |
|--------|-------------------|--------------|
| Runtime Size | ~1.5GB (TensorFlow) | ~20-50MB (ONNX Runtime) |
| Docker Image | ~2-3GB | ~200-300MB |
| Startup Time | 10-30 seconds | 1-2 seconds |
| Language | Python | TypeScript |
| Consistency | Mixed stack | Unified Node.js stack |

## Setup

### Step 1: Convert the Keras Model to ONNX

The conversion requires specific package versions due to NumPy 2.x compatibility issues.

#### Option A: Using Docker (Recommended)

```bash
cd apps/crystallization-ml-service

docker run -it --rm \
  -v ${PWD}:/app \
  -w /app \
  tensorflow/tensorflow:2.15.0 \
  bash -c "pip install tf2onnx onnx --quiet && python scripts/convert_to_onnx.py"
```

#### Option B: Using a Virtual Environment

```bash
cd apps/crystallization-ml-service

# Create isolated environment
python -m venv onnx_convert_env

# Activate (Windows)
onnx_convert_env\Scripts\activate

# Activate (Linux/Mac)
source onnx_convert_env/bin/activate

# Install compatible versions
pip install tensorflow==2.15.0 tf2onnx==1.15.1 onnx==1.14.1 numpy==1.24.3 protobuf==3.20.3

# Run conversion
python scripts/convert_to_onnx.py

# Deactivate
deactivate
```

### Step 2: Copy the ONNX Model

```bash
# Windows
copy apps\crystallization-ml-service\models\crystallization_model.onnx apps\crystallization-onnx-service\models\

# Linux/Mac
cp apps/crystallization-ml-service/models/crystallization_model.onnx apps/crystallization-onnx-service/models/
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Run the Service

```bash
# Run just this service
npx nx serve @brinex-server/crystallization-onnx-service

# Or run with all services
npx nx run-many -t serve --all
```

## Switching from Python to ONNX Service

To switch from the Python service to this ONNX service:

1. Complete the model conversion above
2. Stop the Python `crystallization-ml-service`
3. Start the ONNX service (it uses the same port 50055)
4. No changes needed in clients - the gRPC interface is identical

## gRPC Interface

- **Port**: 50055
- **Package**: predictions
- **Service**: PredictionsService
- **Method**: GetPredictions

The proto file is at `proto/crystallization-prediction.proto`.

## Model Files

The `models/` directory should contain:

- `crystallization_model.onnx` - The converted ONNX model (required)
- `weather_scaler.json` - Weather scaler parameters (optional)
- `log_scaler.json` - Log scaler parameters (optional)

## Architecture

```
src/
├── main.ts                              # Entry point (gRPC server on port 50055)
├── app/
│   ├── app.module.ts                    # Root module
│   └── predictions/
│       ├── predictions.module.ts        # Feature module
│       ├── predictions.controller.ts    # gRPC controller
│       ├── predictions.service.ts       # Business logic
│       ├── ml-predictor.service.ts      # ONNX Runtime inference
│       └── interfaces.ts                # TypeScript types
```

## Troubleshooting

### Model not found error

Make sure the ONNX model exists at `models/crystallization_model.onnx`. You need to run the conversion script first.

### Conversion fails (NumPy/TensorFlow compatibility)

If standard conversion fails due to TensorFlow/Keras version mismatch (common with Keras 3 models):

1. **Use the manual graph creation script** to generate a compatible structure:
   ```bash
   python scripts/create_manual_onnx.py
   copy models\crystallization_model.onnx ..\crystallization-onnx-service\models\
   ```
   *Note: This creates a model with random weights but correct structure, allowing the service to start.*

2. **For real conversion**, you must use an environment matching the model's training environment exactly (likely Keras 3.x), which strictly requires NumPy 1.x.

### Shape mismatch errors

The ONNX model expects two inputs:
- `log_input`: `[batch, 30, 8]`
- `weather_input`: `[batch, 30, 7]`

The service handles reshaping automatically.

## Development

### Build

```bash
npx nx build @brinex-server/crystallization-onnx-service
```

### Test

```bash
npx nx test @brinex-server/crystallization-onnx-service
```
