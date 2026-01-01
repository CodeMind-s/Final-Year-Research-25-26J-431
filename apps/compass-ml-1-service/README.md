# Compass ML 1 Service - Seller Recommendations

A Python-based gRPC microservice for seller recommendations using a CatBoost machine learning model with continuous learning capabilities.

---

## Quick Start

### Running the Service

From the **project root**:

```bash
# Activate virtual environment
source .venv/bin/activate

# Navigate to service directory
cd apps/compass-ml-1-service

# Run the service
python src/main.py
```

Expected output:
```
✓ Seller Recommendation Predictor initialized with X sellers
Compass ML 1 Service (Seller Recommendations) is running on gRPC port 50059
```

The service is now running and listening on port **50059**.

Press `Ctrl+C` to stop the service.

---

## First Time Setup

If this is your first time running the service or dependencies are missing:

### 1. Activate Virtual Environment

```bash
# From project root
source .venv/bin/activate
```

### 2. Install Dependencies (if needed)

```bash
cd apps/compass-ml-1-service
pip install -r requirements.txt
```

### 3. Generate Proto Files (if needed)

```bash
# From project root
./apps/compass-ml-1-service/generate_proto.sh
```

This creates the gRPC Python code in `src/generated/`.

### 4. Verify Model Files

Ensure these files exist in `models/` directory:
- ✅ `catboost_seller_model_pricing_focused.cbm`
- ✅ `seller_pricing_stats.json`
- ✅ `global_stats.json`
- ✅ `catboost_features_pricing_focused.json`

---

## Configuration

**Environment variables** (`.env` file):

```env
GRPC_PORT=50059              # gRPC server port
MODELS_DIR=models            # Directory containing model files
```

---

## Verifying the Service

### Check if service is running:

```bash
lsof -i :50059
```

Expected output:
```
COMMAND   PID   USER   FD   TYPE   NODE NAME
Python  xxxxx  user    3u  IPv6   TCP *:50059 (LISTEN)
```

### View service logs:

The service outputs detailed logs when running via `nx serve`, including:
- Model loading status
- Number of sellers in database
- gRPC server startup confirmation

---

## Running Methods

### Option 1: Direct Python (Recommended)

```bash
# From project root
source .venv/bin/activate
cd apps/compass-ml-1-service
python src/main.py
```

**Advantages:**
- Simple and direct
- Consistent with other ML services (crystallization-ml-service)
- Easy to debug

### Option 2: Using Nx

```bash
# From project root
nx serve compass-ml-1-service
```

**Advantages:**
- Part of monorepo workflow
- Automatic dependency resolution

### Option 3: Docker

```bash
docker build -t compass-ml-1-service .
docker run -p 50059:50059 compass-ml-1-service
```
---

## Troubleshooting

### `ModuleNotFoundError: No module named 'grpc'`

**Solution:** Install dependencies in the virtual environment:
```bash
source .venv/bin/activate
cd apps/compass-ml-1-service
pip install -r requirements.txt
```

### `Could not make proto path relative`

**Solution:** Run the script from the project root:
```bash
# From project root
./apps/compass-ml-1-service/generate_proto.sh
```

### `Model file not found`

**Solution:** Ensure model files exist in the `models/` directory. Check the "Verify Model Files" section above.

### Port 50059 already in use

**Solution:** 
```bash
# Find the process using port 50059
lsof -i :50059

# Kill the process
kill -9 <PID>
```

---

## API Overview

This service provides two gRPC endpoints:

### 1. GetSellerRecommendations

Get seller recommendations based on production parameters.

**Input:**
- `total_production_bags` - Production volume in bags
- `price_per_bag` - Asking price per bag
- `area_sqft` - Farm area in square feet
- `season` - "summer" or "winter"
- `top_k` - Number of recommendations (default: 5)

**Output:**
- List of recommended sellers with confidence scores and rankings

### 2. LearnFromDeal

Update model statistics after a deal is completed (continuous learning).

**Input:**
- `seller_id` - ID of the seller
- Deal parameters (price, production, area, season)

**Output:**
- Update confirmation with new seller statistics

For complete API documentation, see the [proto definition](proto/seller_recommendations.proto).

---

## Development

### Project Structure

```
compass-ml-1-service/
├── proto/
│   └── seller_recommendations.proto    # gRPC service definition
├── src/
│   ├── generated/                      # Auto-generated gRPC code
│   ├── ml_predictor.py                 # ML model logic
│   └── main.py                         # gRPC server
├── models/                             # Model files and statistics
├── requirements.txt                    # Python dependencies
└── README.md                           # This file
```

### Model Features

The CatBoost model uses 16 features including:
- Production metrics (bags, area, pricing)
- Temporal features (month, quarter, season)
- Derived features (price_per_sqft, bags_per_sqft)
- Seller statistics (historical pricing patterns)

### Continuous Learning

When deals are completed:
1. Call `LearnFromDeal` endpoint
2. Seller statistics updated using exponential moving average (30% new, 70% old)
3. Global statistics updated conservatively (10% new, 90% old)
4. Changes persisted to statistics JSON files

---

## Integration with Compass Service

The compass-service calls this ML service to get seller recommendations. Currently, compass-service has mock data at [`landowner.service.ts:237-287`](file:///../compass-service/src/app/landowner/landowner.service.ts#L237-L287) with a TODO to integrate with the ML service.

### Integration Steps

1. **Add gRPC client** to compass-service
2. **Call ML service** from `getSellerRecommendations` method
3. **Map response** to existing DTO structure

Example integration:
```typescript
// In compass-service landowner.service.ts
const mlResponse = await this.mlClient.GetSellerRecommendations({
  total_production_bags: data.availableTons * 1000,
  price_per_bag: marketPrice,
  area_sqft: landownerProfile.area,
  season: getCurrentSeason(),
  top_k: 3
});

return {
  success: true,
  recommendations: mlResponse.recommendations.map(rec => ({
    seller_id: parseInt(rec.seller_id),
    confidence: rec.confidence,
    ranking: rec.rank
  }))
};
```

---

## Additional Information

### Model File Formats

**seller_pricing_stats.json:**
```json
{
  "SELLER_001": {
    "avg_price": 12.5,
    "median_production": 45000,
    "price_std": 1.2
  }
}
```

**global_stats.json:**
```json
{
  "global_avg_price": 12.0,
  "global_median_prod": 50000.0,
  "global_price_std": 1.5
}
```

### Logs and Monitoring

Service logs include:
- Model loading status and seller count
- gRPC request/response details
- Continuous learning updates
- Error messages with stack traces

---

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review service logs when running via `nx serve`
3. Verify model files are present and valid
4. Ensure port 50059 is available

---

**License:** Private - BrineX Backend Services

