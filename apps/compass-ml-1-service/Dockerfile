FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy proto files and generate Python code
COPY proto/ ./proto/
RUN mkdir -p ./src/generated && python -m grpc_tools.protoc -I./proto --python_out=./src/generated --grpc_python_out=./src/generated ./proto/seller_recommendations.proto

# Copy application code
COPY src/ ./src/
COPY models-Compass/ ./models-Compass/

# Set Python path
ENV PYTHONPATH=/app/src

EXPOSE 50059

CMD ["python", "src/main.py"]
