#!/usr/bin/env bash
# =============================================================================
# Brinex Backend — Azure Container Apps Deployment Script
#
# Deploys all 13 microservices to Azure Container Apps (Consumption plan).
# Prerequisites: az CLI logged in, Docker running, .env file populated.
#
# Usage:
#   1. Copy deploy/.env.azure.template → deploy/.env.azure and fill in values
#   2. ./deploy/azure-deploy.sh          (full deploy)
#   3. ./deploy/azure-deploy.sh build    (build & push images only)
#   4. ./deploy/azure-deploy.sh deploy   (deploy to ACA only, images must exist)
#   5. ./deploy/azure-deploy.sh topics   (create Event Hubs topics only)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

# ── Load config ──────────────────────────────────────────────────────────────
if [[ -f "$SCRIPT_DIR/.env.azure" ]]; then
  set -a; source "$SCRIPT_DIR/.env.azure"; set +a
else
  echo "ERROR: deploy/.env.azure not found. Copy .env.azure.template and fill in values."
  exit 1
fi

# ── Required variables ───────────────────────────────────────────────────────
: "${RESOURCE_GROUP:=rg-brinex}"
: "${LOCATION:=eastus}"
: "${ACR_NAME:=brinexacr}"
: "${ACA_ENV:=brinex-env}"
: "${EVENTHUB_NAMESPACE:=brinex-kafka}"
: "${IMAGE_TAG:=v1}"

# Secrets (must be in .env.azure)
for var in MONGO_URI JWT_SECRET; do
  if [[ -z "${!var:-}" ]]; then
    echo "ERROR: $var is not set in .env.azure"
    exit 1
  fi
done

# ── Helper functions ─────────────────────────────────────────────────────────
log() { echo -e "\n\033[1;34m▸ $*\033[0m"; }
ok()  { echo -e "\033[1;32m  ✓ $*\033[0m"; }

get_acr_creds() {
  ACR_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer -o tsv)
  ACR_USER=$(az acr credential show --name "$ACR_NAME" --query username -o tsv)
  ACR_PASS=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv)
}

get_env_domain() {
  ENV_DOMAIN=$(az containerapp env show \
    --name "$ACA_ENV" --resource-group "$RESOURCE_GROUP" \
    --query "properties.defaultDomain" -o tsv)
}

get_eventhub_conn() {
  EVENTHUB_CONN=$(az eventhubs namespace authorization-rule keys list \
    --resource-group "$RESOURCE_GROUP" --namespace-name "$EVENTHUB_NAMESPACE" \
    --name RootManageSharedAccessKey --query primaryConnectionString -o tsv)
}

# ── Step 1: Azure Foundation ─────────────────────────────────────────────────
setup_foundation() {
  log "Setting up Azure foundation resources..."

  az extension add --name containerapp --upgrade --yes 2>/dev/null || true
  az provider register --namespace Microsoft.App --wait 2>/dev/null || true
  az provider register --namespace Microsoft.OperationalInsights --wait 2>/dev/null || true
  az provider register --namespace Microsoft.EventHub --wait 2>/dev/null || true

  log "Creating resource group: $RESOURCE_GROUP"
  az group create --name "$RESOURCE_GROUP" --location "$LOCATION" -o none
  ok "Resource group ready"

  log "Creating container registry: $ACR_NAME"
  az acr create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$ACR_NAME" \
    --sku Basic \
    --admin-enabled true -o none
  ok "ACR ready"

  log "Creating Event Hubs namespace: $EVENTHUB_NAMESPACE"
  az eventhubs namespace create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$EVENTHUB_NAMESPACE" \
    --location "$LOCATION" \
    --sku Basic \
    --enable-kafka true -o none
  ok "Event Hubs namespace ready"

  log "Creating Container Apps environment: $ACA_ENV"
  az containerapp env create \
    --name "$ACA_ENV" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" -o none
  ok "ACA environment ready"
}

# ── Step 2: Create Event Hub topics ─────────────────────────────────────────
create_topics() {
  log "Creating Event Hub topics (Kafka topics)..."

  for TOPIC in send_verification_code_email create_audit_log; do
    az eventhubs eventhub create \
      --resource-group "$RESOURCE_GROUP" \
      --namespace-name "$EVENTHUB_NAMESPACE" \
      --name "$TOPIC" \
      --partition-count 1 \
      --message-retention 1 -o none 2>/dev/null || true
    ok "Topic: $TOPIC"
  done
}

# ── Step 3: Build & push Docker images ───────────────────────────────────────
build_and_push() {
  log "Logging into ACR..."
  get_acr_creds
  az acr login --name "$ACR_NAME"

  cd "$REPO_DIR"

  # Standard services (shared Dockerfile with SERVICE_NAME build arg)
  STANDARD_SERVICES=(
    api-gateway
    auth-service
    user-service
    crystallization-service
    payment-service
    compass-service
    waste-valorization-service
    gemini-service
    email-service
    audit-log-service
  )

  for SVC in "${STANDARD_SERVICES[@]}"; do
    log "Building $SVC..."
    docker build \
      --build-arg SERVICE_NAME="$SVC" \
      -t "$ACR_SERVER/$SVC:$IMAGE_TAG" \
      -f Dockerfile . --quiet
    docker push "$ACR_SERVER/$SVC:$IMAGE_TAG" --quiet
    ok "$SVC"
  done

  # Custom Dockerfile services
  log "Building crystallization-onnx-service (custom Dockerfile)..."
  docker build -t "$ACR_SERVER/crystallization-onnx-service:$IMAGE_TAG" \
    -f apps/crystallization-onnx-service/Dockerfile . --quiet
  docker push "$ACR_SERVER/crystallization-onnx-service:$IMAGE_TAG" --quiet
  ok "crystallization-onnx-service"

  log "Building vision-service (custom Dockerfile)..."
  docker build -t "$ACR_SERVER/vision-service:$IMAGE_TAG" \
    -f apps/vision-service/Dockerfile . --quiet
  docker push "$ACR_SERVER/vision-service:$IMAGE_TAG" --quiet
  ok "vision-service"

  log "Building compass-ml-service (Python, custom Dockerfile)..."
  docker build -t "$ACR_SERVER/compass-ml-service:$IMAGE_TAG" \
    -f apps/compass-ml-service/Dockerfile . --quiet
  docker push "$ACR_SERVER/compass-ml-service:$IMAGE_TAG" --quiet
  ok "compass-ml-service"
}

# ── Step 4: Deploy all services ──────────────────────────────────────────────
deploy_services() {
  get_acr_creds
  get_env_domain
  get_eventhub_conn

  KAFKA_BROKER="${EVENTHUB_NAMESPACE}.servicebus.windows.net:9093"

  # ── Tier 1: ML/Inference services (no upstream dependencies) ──

  log "Deploying crystallization-onnx-service..."
  az containerapp create \
    --name crystallization-onnx-service \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/crystallization-onnx-service:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 50055 \
    --ingress internal \
    --transport http2 \
    --min-replicas 1 --max-replicas 2 \
    --cpu 0.5 --memory 1Gi \
    --secrets \
      mongo-uri="$MONGO_URI" \
      kafka-conn="$EVENTHUB_CONN" \
    --env-vars \
      GRPC_URL=0.0.0.0:50055 \
      MONGO_URI=secretref:mongo-uri \
      OPENWEATHER_API_KEY="${OPENWEATHER_API_KEY:-}" \
      OPENWEATHER_LAT="${OPENWEATHER_LAT:-}" \
      OPENWEATHER_LON="${OPENWEATHER_LON:-}" \
      KAFKA_BROKER="$KAFKA_BROKER" \
      KAFKA_SASL_ENABLED=true \
      KAFKA_CONNECTION_STRING=secretref:kafka-conn \
    -o none
  ok "crystallization-onnx-service deployed"

  log "Deploying vision-service..."
  az containerapp create \
    --name vision-service \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/vision-service:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 50057 \
    --ingress internal \
    --transport http2 \
    --min-replicas 0 --max-replicas 2 \
    --cpu 1.0 --memory 2Gi \
    --secrets \
      mongo-uri="$MONGO_URI" \
    --env-vars \
      GRPC_URL=0.0.0.0:50057 \
      MONGO_URI=secretref:mongo-uri \
      VISION_MODEL_PATH=/app/models/best.onnx \
    -o none
  ok "vision-service deployed"

  log "Deploying compass-ml-service..."
  az containerapp create \
    --name compass-ml-service \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/compass-ml-service:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 8002 \
    --ingress internal \
    --transport auto \
    --min-replicas 1 --max-replicas 2 \
    --cpu 0.5 --memory 1Gi \
    --secrets \
      mongo-uri="$MONGO_URI" \
    --env-vars \
      MODEL_DIR=/app/models \
      MONGO_URI=secretref:mongo-uri \
      CRYSTALLIZATION_SERVICE_URL=crystallization-onnx-service.internal."$ENV_DOMAIN":50055 \
    -o none
  ok "compass-ml-service deployed"

  # ── Tier 2: Core gRPC services ──

  log "Deploying auth-service..."
  az containerapp create \
    --name auth-service \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/auth-service:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 50000 \
    --ingress internal \
    --transport http2 \
    --min-replicas 0 --max-replicas 2 \
    --cpu 0.25 --memory 0.5Gi \
    --secrets \
      mongo-uri="$MONGO_URI" \
      jwt-secret="$JWT_SECRET" \
      kafka-conn="$EVENTHUB_CONN" \
    --env-vars \
      GRPC_URL=0.0.0.0:50000 \
      MONGO_URI=secretref:mongo-uri \
      JWT_SECRET=secretref:jwt-secret \
      KAFKA_BROKER="$KAFKA_BROKER" \
      KAFKA_SASL_ENABLED=true \
      KAFKA_CONNECTION_STRING=secretref:kafka-conn \
      NOTIFY_LK_USER_ID="${NOTIFY_LK_USER_ID:-}" \
      NOTIFY_LK_API_KEY="${NOTIFY_LK_API_KEY:-}" \
      NOTIFY_LK_SENDER_ID="${NOTIFY_LK_SENDER_ID:-}" \
    -o none
  ok "auth-service deployed"

  log "Deploying user-service..."
  az containerapp create \
    --name user-service \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/user-service:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 50053 \
    --ingress internal \
    --transport http2 \
    --min-replicas 0 --max-replicas 2 \
    --cpu 0.25 --memory 0.5Gi \
    --secrets \
      mongo-uri="$MONGO_URI" \
      kafka-conn="$EVENTHUB_CONN" \
    --env-vars \
      GRPC_URL=0.0.0.0:50053 \
      MONGO_URI=secretref:mongo-uri \
      KAFKA_BROKER="$KAFKA_BROKER" \
      KAFKA_SASL_ENABLED=true \
      KAFKA_CONNECTION_STRING=secretref:kafka-conn \
    -o none
  ok "user-service deployed"

  log "Deploying crystallization-service..."
  az containerapp create \
    --name crystallization-service \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/crystallization-service:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 50054 \
    --ingress internal \
    --transport http2 \
    --min-replicas 0 --max-replicas 2 \
    --cpu 0.25 --memory 0.5Gi \
    --secrets \
      mongo-uri="$MONGO_URI" \
      kafka-conn="$EVENTHUB_CONN" \
    --env-vars \
      GRPC_URL=0.0.0.0:50054 \
      MONGO_URI=secretref:mongo-uri \
      OPENWEATHER_API_KEY="${OPENWEATHER_API_KEY:-}" \
      OPENWEATHER_LAT="${OPENWEATHER_LAT:-}" \
      OPENWEATHER_LON="${OPENWEATHER_LON:-}" \
      ONNX_SERVICE_GRPC_URL=crystallization-onnx-service.internal."$ENV_DOMAIN":50055 \
      KAFKA_BROKER="$KAFKA_BROKER" \
      KAFKA_SASL_ENABLED=true \
      KAFKA_CONNECTION_STRING=secretref:kafka-conn \
    -o none
  ok "crystallization-service deployed"

  log "Deploying payment-service..."
  az containerapp create \
    --name payment-service \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/payment-service:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 50056 \
    --ingress internal \
    --transport http2 \
    --min-replicas 0 --max-replicas 2 \
    --cpu 0.25 --memory 0.5Gi \
    --secrets \
      mongo-uri="$MONGO_URI" \
    --env-vars \
      GRPC_URL=0.0.0.0:50056 \
      MONGO_URI=secretref:mongo-uri \
      AUTH_SERVICE_URL=auth-service.internal."$ENV_DOMAIN":50000 \
      PAYHERE_MERCHANT_ID="${PAYHERE_MERCHANT_ID:-}" \
      PAYHERE_MERCHANT_SECRET="${PAYHERE_MERCHANT_SECRET:-}" \
      PAYHERE_SANDBOX="${PAYHERE_SANDBOX:-true}" \
      PAYHERE_NOTIFY_URL="${PAYHERE_NOTIFY_URL:-}" \
      FRONTEND_URL="${FRONTEND_URL:-}" \
    -o none
  ok "payment-service deployed"

  log "Deploying compass-service..."
  az containerapp create \
    --name compass-service \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/compass-service:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 50052 \
    --ingress internal \
    --transport http2 \
    --min-replicas 0 --max-replicas 2 \
    --cpu 0.25 --memory 0.5Gi \
    --secrets \
      mongo-uri="$MONGO_URI" \
    --env-vars \
      GRPC_URL=0.0.0.0:50052 \
      MONGO_URI=secretref:mongo-uri \
      COMPASS_ML_SERVICE_URL=http://compass-ml-service.internal."$ENV_DOMAIN":8002 \
    -o none
  ok "compass-service deployed"

  log "Deploying waste-valorization-service..."
  az containerapp create \
    --name waste-valorization-service \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/waste-valorization-service:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 50058 \
    --ingress internal \
    --transport http2 \
    --min-replicas 0 --max-replicas 2 \
    --cpu 0.25 --memory 0.5Gi \
    --secrets \
      mongo-uri="$MONGO_URI" \
    --env-vars \
      GRPC_URL=0.0.0.0:50058 \
      MONGO_URI=secretref:mongo-uri \
      AWS_REGION="${AWS_REGION:-}" \
      AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}" \
      AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}" \
      AWS_SQS_QUEUE_URL="${AWS_SQS_QUEUE_URL:-}" \
      AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}" \
      ENVIRONMENT="${ENVIRONMENT:-production}" \
    -o none
  ok "waste-valorization-service deployed"

  log "Deploying gemini-service..."
  az containerapp create \
    --name gemini-service \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/gemini-service:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 50059 \
    --ingress internal \
    --transport http2 \
    --min-replicas 0 --max-replicas 2 \
    --cpu 0.25 --memory 0.5Gi \
    --env-vars \
      GRPC_URL=0.0.0.0:50059 \
      CRYSTALLIZATION_SERVICE_URL=crystallization-service.internal."$ENV_DOMAIN":50054 \
      GEMINI_API_KEY="${GEMINI_API_KEY:-}" \
    -o none
  ok "gemini-service deployed"

  # ── Tier 2b: Kafka consumers ──

  log "Deploying email-service..."
  az containerapp create \
    --name email-service \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/email-service:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --min-replicas 1 --max-replicas 1 \
    --cpu 0.25 --memory 0.5Gi \
    --secrets \
      kafka-conn="$EVENTHUB_CONN" \
    --env-vars \
      KAFKA_BROKER="$KAFKA_BROKER" \
      KAFKA_SASL_ENABLED=true \
      KAFKA_CONNECTION_STRING=secretref:kafka-conn \
      EMAIL_HOST="${EMAIL_HOST:-}" \
      EMAIL_PORT="${EMAIL_PORT:-587}" \
      EMAIL_USER="${EMAIL_USER:-}" \
      EMAIL_PASSWORD="${EMAIL_PASSWORD:-}" \
      EMAIL_FROM="${EMAIL_FROM:-}" \
    -o none
  ok "email-service deployed"

  log "Deploying audit-log-service..."
  az containerapp create \
    --name audit-log-service \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/audit-log-service:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --min-replicas 1 --max-replicas 1 \
    --cpu 0.25 --memory 0.5Gi \
    --secrets \
      mongo-uri="$MONGO_URI" \
      kafka-conn="$EVENTHUB_CONN" \
    --env-vars \
      MONGO_URI=secretref:mongo-uri \
      KAFKA_BROKER="$KAFKA_BROKER" \
      KAFKA_SASL_ENABLED=true \
      KAFKA_CONNECTION_STRING=secretref:kafka-conn \
    -o none
  ok "audit-log-service deployed"

  # ── Tier 3: API Gateway (depends on all services) ──

  log "Deploying api-gateway (external)..."
  az containerapp create \
    --name api-gateway \
    --resource-group "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$ACR_SERVER/api-gateway:$IMAGE_TAG" \
    --registry-server "$ACR_SERVER" \
    --registry-username "$ACR_USER" \
    --registry-password "$ACR_PASS" \
    --target-port 3400 \
    --ingress external \
    --transport auto \
    --min-replicas 1 --max-replicas 3 \
    --cpu 0.5 --memory 1Gi \
    --secrets \
      jwt-secret="$JWT_SECRET" \
      kafka-conn="$EVENTHUB_CONN" \
    --env-vars \
      PORT=3400 \
      JWT_SECRET=secretref:jwt-secret \
      KAFKA_BROKER="$KAFKA_BROKER" \
      KAFKA_SASL_ENABLED=true \
      KAFKA_CONNECTION_STRING=secretref:kafka-conn \
      FRONTEND_URL="${FRONTEND_URL:-}" \
      AUTH_SERVICE_URL=auth-service.internal."$ENV_DOMAIN":50000 \
      USER_SERVICE_URL=user-service.internal."$ENV_DOMAIN":50053 \
      CRYSTALLIZATION_SERVICE_URL=crystallization-service.internal."$ENV_DOMAIN":50054 \
      VISION_SERVICE_URL=vision-service.internal."$ENV_DOMAIN":50057 \
      PAYMENT_SERVICE_URL=payment-service.internal."$ENV_DOMAIN":50056 \
      COMPASS_SERVICE_URL=compass-service.internal."$ENV_DOMAIN":50052 \
      WASTE_VALORIZATION_SERVICE_URL=waste-valorization-service.internal."$ENV_DOMAIN":50058 \
      AI_SERVICE_URL=gemini-service.internal."$ENV_DOMAIN":50059 \
    -o none
  ok "api-gateway deployed"

  # ── Print access info ──
  API_URL=$(az containerapp show --name api-gateway \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.configuration.ingress.fqdn" -o tsv)

  echo ""
  echo "=============================================="
  echo "  Deployment complete!"
  echo "=============================================="
  echo "  API Gateway: https://$API_URL/api/v1"
  echo "  Swagger:     https://$API_URL/api/v1"
  echo ""
  echo "  Set FRONTEND_URL in your frontend .env to:"
  echo "  NEXT_PUBLIC_API_BASE_URL=https://$API_URL/api/v1"
  echo "=============================================="
}

# ── Step 5: Verification ─────────────────────────────────────────────────────
verify() {
  log "Verifying deployment..."

  echo ""
  az containerapp list --resource-group "$RESOURCE_GROUP" \
    --query "[].{Name:name, Status:properties.runningStatus, Replicas:properties.template.containers[0].resources}" \
    -o table

  API_URL=$(az containerapp show --name api-gateway \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.configuration.ingress.fqdn" -o tsv)

  echo ""
  log "Testing API Gateway health..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$API_URL/api/v1" || echo "000")
  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "301" ]]; then
    ok "API Gateway responding (HTTP $HTTP_CODE)"
  else
    echo "  ⚠ API Gateway returned HTTP $HTTP_CODE — check logs:"
    echo "    az containerapp logs show --name api-gateway --resource-group $RESOURCE_GROUP --type console --follow"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────────────
case "${1:-all}" in
  foundation) setup_foundation ;;
  topics)     create_topics ;;
  build)      build_and_push ;;
  deploy)     deploy_services ;;
  verify)     verify ;;
  all)
    setup_foundation
    create_topics
    build_and_push
    deploy_services
    verify
    ;;
  *)
    echo "Usage: $0 {all|foundation|topics|build|deploy|verify}"
    exit 1
    ;;
esac
