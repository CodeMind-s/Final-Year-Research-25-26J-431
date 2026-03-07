# Dockerfile for compass-ml-service (demand-price-service)
# Build context: project root (set in docker-compose.yml)
# This service no longer uses gRPC - it's a pure FastAPI HTTP service.

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (curl for health check, gcc for some Python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer caching)
COPY apps/compass-ml-service/requirements.txt .
RUN pip install --no-cache-dir --timeout=300 --retries=5 -r requirements.txt

# Copy application source
COPY apps/compass-ml-service/ .

# Create models mount point (will be overridden by volume in docker-compose)
RUN mkdir -p /app/models

EXPOSE 8002

ENV MODEL_DIR=/app/models

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002", "--workers", "1"]
