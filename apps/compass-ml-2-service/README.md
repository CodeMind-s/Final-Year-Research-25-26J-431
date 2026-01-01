# Compass ML 2 Service

A Python-based gRPC microservice for demand and price prediction using machine learning.

---

## Quick Start

### Running the Service

From the **project root**:

```bash
# Activate virtual environment
source .venv/bin/activate

# Navigate to service directory
cd apps/compass-ml-2-service

# Run the service
python src/main.py
```

Expected output:
```
Compass ML 2 Service is running on gRPC port 50058
```

The service is now running and listening on port **50058**.

Press `Ctrl+C` to stop the service.

---

## First Time Setup

### 1. Activate Virtual Environment

```bash
# From project root
source .venv/bin/activate
```

### 2. Install Dependencies (if needed)

```bash
cd apps/compass-ml-2-service
pip install -r requirements.txt
```

### 3. Add Your Model File

Place your `.pkl` model in the `models/` directory:

```bash
cp /path/to/your/model.pkl models/demand_forecast_models.pkl
```

> **Note:** If your model has a different name, update the `MODEL_PATH` in `.env` file

### 4. Generate Proto Files

**IMPORTANT:** Run from the **project root**:

```bash
./apps/compass-ml-2-service/generate_proto.sh
```

This creates the gRPC Python code in `src/generated/`.

---

## Running Methods

### Option 1: Direct Python (Recommended)

```bash
# From project root
source .venv/bin/activate
cd apps/compass-ml-2-service
python src/main.py
```

**Advantages:**
- Simple and direct
- Consistent with other ML services (crystallization-ml-service)
- Easy to debug

### Option 2: Using Nx

```bash
# From project root
nx serve compass-ml-2-service
```

**Advantages:**
- Part of monorepo workflow
- Automatic dependency resolution

### Option 3: Docker

```bash
docker build -t compass-ml-2-service .
docker run -p 50058:50058 compass-ml-2-service
```



## Configuration

### Environment Variables

Copy `.env.example` to `.env` to customize:

```bash
cp .env.example .env
```

Default settings:
- `GRPC_PORT=50056` - gRPC service port
- `MODEL_PATH=models/demand_price_model.pkl` - Path to your model file

---

## Service Details

- **Port:** 50056 (gRPC)
- **Protocol:** gRPC with Protocol Buffers
- **Model Type:** Pickle (.pkl) files (scikit-learn compatible)
- **Returns:** 6 months historical + 6 months future predictions

---

## Troubleshooting

### "Model file not found"
- Ensure your `.pkl` file is in `apps/compass-ml-2-service/models/`
- Check that the filename matches `MODEL_PATH` in `.env`
- The service will still run but use placeholder predictions

### "Proto files not found"
- Run the proto generation script from the **project root**
- Correct: `./apps/compass-ml-2-service/generate_proto.sh`
- Incorrect: Running from service directory

### "externally-managed-environment" error
- You need to activate the virtual environment first
- Run `source .venv/bin/activate` (Mac/Linux) or `.venv\Scripts\activate` (Windows)

### scikit-learn version warning
- Your model was trained with a different scikit-learn version
- The service will still work, but consider retraining with the current version
- Or downgrade scikit-learn to match your model's version

---

## API Documentation

### GetDemandPricePrediction

**Request:**
```protobuf
message PredictionRequest {
  string date = 1;                     // Format: YYYY-MM-DD
  map<string, double> features = 2;    // Optional additional features
}
```

**Response:**
```protobuf
message PredictionResponse {
  string status = 1;                   // "success" or "error"
  PredictionData prediction_data = 2;  // Historical + future data
  ModelInfo model_info = 3;            // Model metadata
}
```

**Returns:**
- **Historical Data:** Past 6 months of demand/price
- **Future Predictions:** Next 6 months forecast
- **Confidence Intervals:** Upper/lower bounds for predictions
- **Trends:** Percentage changes in demand and price
- **Model Metrics:** R², MAE, RMSE, accuracy scores

---

## Model Customization

To use your own model, edit `src/ml_predictor.py`:

1. **`_generate_future_predictions()`** - Replace placeholder logic with actual model predictions
2. **`_prepare_features()`** - Implement feature engineering for your model
3. **`performance_metrics`** - Update with your model's training metrics

---

## Docker Deployment

Build and run with Docker:

```bash
docker build -t compass-ml-2-service .
docker run -p 50056:50056 compass-ml-2-service
```

---

## Project Structure

```
compass-ml-2-service/
├── models/
│   ├── demand_price_model.pkl  # Your model file (add this)
│   └── README.md
├── proto/
│   └── compass_predictions.proto
├── src/
│   ├── generated/              # Auto-generated (don't edit)
│   ├── main.py                 # Server entry point
│   ├── server.py               # gRPC servicer
│   └── ml_predictor.py         # ML logic (customize here)
├── .env                        # Your config (create from .env.example)
├── .env.example
├── Dockerfile
├── generate_proto.bat          # Windows proto generation
├── generate_proto.sh           # Mac/Linux proto generation
├── package.json                # NX configuration
├── README.md
└── requirements.txt
```
