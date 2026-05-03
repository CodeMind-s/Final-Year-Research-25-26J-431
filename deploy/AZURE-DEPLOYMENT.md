# Brinex Backend — Azure Deployment Guide

This document covers the complete process of deploying the Brinex backend microservices (13 services) from a local Docker Compose setup to Azure Container Apps.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Azure Resources Created](#azure-resources-created)
3. [Cost Estimate](#cost-estimate)
4. [Pre-Deployment Code Changes](#pre-deployment-code-changes)
5. [Step-by-Step Deployment](#step-by-step-deployment)
6. [Service Configurations](#service-configurations)
7. [Post-Deployment Configuration](#post-deployment-configuration)
8. [Troubleshooting & Fixes](#troubleshooting--fixes)
9. [Management Scripts](#management-scripts)
10. [Frontend Integration](#frontend-integration)

---

## Architecture Overview

```
Internet
    |
    v
API Gateway (external, HTTPS)
  https://api-gateway.graysky-458c04e8.koreacentral.azurecontainerapps.io
    |
    | gRPC over TLS (port 443, internal ingress)
    v
+--------------------------------------------------+
| Azure Container Apps Environment (brinex-env)     |
|                                                    |
|  Core Services (gRPC, internal):                   |
|    auth-service, user-service,                     |
|    crystallization-service, payment-service,       |
|    compass-service, waste-valorization-service,    |
|    gemini-service                                  |
|                                                    |
|  ML/Inference Services (gRPC, internal):           |
|    crystallization-onnx-service (LSTM/ONNX)        |
|    vision-service (YOLOv8/ONNX)                    |
|    compass-ml-service (Python HTTP)                |
|                                                    |
|  Async Consumers (Kafka, no ingress):              |
|    email-service, audit-log-service                |
+--------------------------------------------------+
    |                           |
    v                           v
Azure Event Hubs            MongoDB Atlas
(Kafka protocol,            (Cloud-hosted,
 Standard tier)              unchanged)
```

**Key design decisions:**
- Only the API Gateway is exposed to the internet; all other services communicate internally via gRPC over TLS
- Azure Event Hubs replaces self-hosted Kafka (speaks Kafka protocol with SASL/SSL auth)
- MongoDB Atlas remains unchanged (already cloud-hosted)
- ML models are baked into Docker images (no volume mounts needed)

---

## Azure Resources Created

| Resource | Name | SKU/Tier | Region | Purpose |
|----------|------|----------|--------|---------|
| Resource Group | `rg-brinex` | — | — | Container for all resources |
| Container Registry | `brinexacr` | Basic | Southeast Asia | Docker image storage |
| Event Hubs Namespace | `brinex-kafka` | Standard | Southeast Asia | Kafka-compatible message broker |
| Log Analytics Workspace | `brinex-logs` | — | Southeast Asia | Container Apps logging |
| Container Apps Environment | `brinex-env` | Consumption | Korea Central | Hosting environment for all services |
| Container Apps | 13 services | Consumption | Korea Central | Individual microservices |

**Why two regions?** The SLIIT Azure for Students subscription has tenant-level policies that restrict which resources can be created in which regions. Container Registry and Event Hubs work in Southeast Asia, while Container Apps Environment required Korea Central.

---

## Cost Estimate

| Resource | Monthly Cost |
|----------|-------------|
| Container Apps (Consumption, scale-to-zero) | ~$25–50 |
| Container Registry (Basic) | ~$5 |
| Event Hubs (Standard) | ~$22 |
| MongoDB Atlas | Existing (free/shared tier) |
| **Total** | **~$52–77** |

---

## Pre-Deployment Code Changes

### 1. Shared Kafka Config (`packages/kafka-config/index.ts`)

Created a shared npm workspace package (`@brinex-server/kafka-config`) to centralize Kafka connection logic. Azure Event Hubs requires SASL/SSL authentication, which local Kafka does not.

```typescript
// When KAFKA_SASL_ENABLED=true (Azure), adds SSL + SASL/PLAIN credentials
// When false/unset (local), uses plain connection to localhost:29092
export function getKafkaClientConfig(clientId: string) {
  const config: any = {
    clientId,
    brokers: [process.env.KAFKA_BROKER || 'localhost:29092'],
  };
  if (process.env.KAFKA_SASL_ENABLED === 'true') {
    config.ssl = true;
    config.sasl = {
      mechanism: 'plain',
      username: '$ConnectionString',
      password: process.env.KAFKA_CONNECTION_STRING,
    };
  }
  return config;
}
```

**Files updated to use this helper:**
- `apps/email-service/src/main.ts` (Kafka consumer)
- `apps/audit-log-service/src/main.ts` (Kafka consumer)
- `apps/auth-service/src/app/auth/auth.module.ts` (Kafka producer)
- `apps/user-service/src/app/user/user.module.ts` (Kafka producer)
- `apps/api-gateway/src/app/audit-logs/audit-log.module.ts` (Kafka producer)
- `apps/crystallization-service/src/app/crystallization/crystallization.module.ts` (Kafka producer)
- `apps/crystallization-service/src/app/salt-production/salt-production.module.ts` (Kafka producer)
- `apps/crystallization-onnx-service/src/app/predictions/predictions.module.ts` (Kafka producer)

### 2. gRPC SSL Credentials (`apps/api-gateway/src/grpc-credentials.ts`)

Azure Container Apps internal ingress uses TLS on port 443. The gRPC clients in the API Gateway need SSL channel credentials to connect.

```typescript
import { ChannelCredentials } from '@grpc/grpc-js';

export function getGrpcCredentials(): ChannelCredentials | undefined {
  if (process.env.GRPC_SSL === 'true') {
    return ChannelCredentials.createSsl();
  }
  return undefined;
}
```

**Added `credentials: getGrpcCredentials()` to all 10 gRPC client modules in the API Gateway:**
- `app.module.ts`, `auth.module.ts`, `user.module.ts`, `payment.module.ts`
- `ai.module.ts`, `vision.module.ts`, `compass.module.ts`
- `waste-valorization.module.ts`, `salt-production.module.ts`, `crystallization.module.ts`

### 3. Dockerfile Fixes

Added `COPY packages/ ./packages/` to the deps stage in both Dockerfiles so that the `@brinex-server/kafka-config` workspace package resolves during `npm install`:

- `Dockerfile` (root, used by most services)
- `apps/crystallization-onnx-service/Dockerfile` (uses `node:20-slim` for glibc/ONNX compatibility)

---

## Step-by-Step Deployment

### Step 1: Azure Foundation

```powershell
# Login
az login
az extension add --name containerapp --upgrade

# Register providers
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.EventHub

# Resource Group
az group create --name rg-brinex --location southeastasia

# Container Registry (Basic, ~$5/month)
az acr create --resource-group rg-brinex --name brinexacr --sku Basic --admin-enabled true

# Capture ACR credentials
$ACR_SERVER = az acr show --name brinexacr --query loginServer -o tsv
$ACR_USER   = az acr credential show --name brinexacr --query username -o tsv
$ACR_PASS   = az acr credential show --name brinexacr --query "passwords[0].value" -o tsv
```

### Step 2: Azure Event Hubs (Kafka Replacement)

```powershell
# Create namespace (Standard tier required for Kafka protocol)
az eventhubs namespace create `
    --resource-group rg-brinex `
    --name brinex-kafka `
    --location southeastasia `
    --sku Standard `
    --enable-kafka true

# Pre-create topics (Event Hubs doesn't support Kafka auto-create)
$topics = @(
    "email.send_email",
    "email.send_verification_code_email",
    "audit-log.create_log",
    "email.send_email.reply",
    "email.send_verification_code_email.reply",
    "audit-log.create_log.reply",
    "get_audit_log_by_id.reply",
    "get_audit_logs.reply",
    "get_audit_logs_by_user.reply",
    "get_audit_logs_by_service.reply"
)
foreach ($topic in $topics) {
    az eventhubs eventhub create `
        --resource-group rg-brinex `
        --namespace-name brinex-kafka `
        --name $topic `
        --partition-count 1 `
        --retention-time 24 `
        --cleanup-policy Delete
}

# Get connection string
$EVENTHUB_CONN = az eventhubs namespace authorization-rule keys list `
    --resource-group rg-brinex `
    --namespace-name brinex-kafka `
    --name RootManageSharedAccessKey `
    --query primaryConnectionString -o tsv
```

### Step 3: Container Apps Environment

```powershell
# Log Analytics workspace (required, must be in a non-restricted region)
az monitor log-analytics workspace create `
    --resource-group rg-brinex `
    --workspace-name brinex-logs `
    --location southeastasia

$LOG_ID  = az monitor log-analytics workspace show --resource-group rg-brinex --workspace-name brinex-logs --query customerId -o tsv
$LOG_KEY = az monitor log-analytics workspace get-shared-keys --resource-group rg-brinex --workspace-name brinex-logs --query primarySharedKey -o tsv

# Container Apps environment
az containerapp env create `
    --name brinex-env `
    --resource-group rg-brinex `
    --location koreacentral `
    --logs-workspace-id $LOG_ID `
    --logs-workspace-key $LOG_KEY
```

### Step 4: Build & Push Docker Images

```powershell
az acr login --name brinexacr

# Standard services (shared Dockerfile, --build-arg SERVICE_NAME)
$services = @(
    "api-gateway", "auth-service", "user-service",
    "crystallization-service", "payment-service",
    "compass-service", "waste-valorization-service",
    "gemini-service", "email-service", "audit-log-service"
)
foreach ($svc in $services) {
    docker build --build-arg SERVICE_NAME=$svc -t brinexacr.azurecr.io/${svc}:v1 -f Dockerfile .
    docker push brinexacr.azurecr.io/${svc}:v1
}

# Custom Dockerfile services
docker build -t brinexacr.azurecr.io/crystallization-onnx-service:v1 -f apps/crystallization-onnx-service/Dockerfile .
docker push brinexacr.azurecr.io/crystallization-onnx-service:v1

docker build -t brinexacr.azurecr.io/vision-service:v1 -f apps/vision-service/Dockerfile .
docker push brinexacr.azurecr.io/vision-service:v1

docker build -t brinexacr.azurecr.io/compass-ml-service:v1 -f apps/compass-ml-service/Dockerfile .
docker push brinexacr.azurecr.io/compass-ml-service:v1
```

### Step 5: Deploy Services

Services are deployed in dependency order using `deploy/deploy-services.ps1`. See [Service Configurations](#service-configurations) below for details.

```powershell
powershell -ExecutionPolicy Bypass -File deploy/deploy-services.ps1
```

### Step 6: Post-Deployment Secrets

```powershell
powershell -ExecutionPolicy Bypass -File deploy/update-secrets.ps1
```

---

## Service Configurations

### Resource Allocations

| Service | CPU | Memory | Min Replicas | Max Replicas | Ingress | Transport | Port |
|---------|-----|--------|--------------|--------------|---------|-----------|------|
| api-gateway | 0.5 | 1Gi | 1 | 3 | **external** | auto | 3400 |
| crystallization-onnx-service | 0.5 | 1Gi | 1 | 2 | internal | http2 | 50055 |
| vision-service | 1.0 | 2Gi | 0 | 2 | internal | http2 | 50057 |
| compass-ml-service | 0.5 | 1Gi | 1 | 2 | internal | auto | 8002 |
| auth-service | 0.25 | 0.5Gi | 1 | 2 | internal | http2 | 50000 |
| user-service | 0.25 | 0.5Gi | 0 | 2 | internal | http2 | 50053 |
| crystallization-service | 0.25 | 0.5Gi | 0 | 2 | internal | http2 | 50054 |
| payment-service | 0.25 | 0.5Gi | 0 | 2 | internal | http2 | 50056 |
| compass-service | 0.25 | 0.5Gi | 0 | 2 | internal | http2 | 50052 |
| waste-valorization-service | 0.25 | 0.5Gi | 0 | 2 | internal | http2 | 50058 |
| gemini-service | 0.25 | 0.5Gi | 0 | 2 | internal | http2 | 50059 |
| email-service | 0.25 | 0.5Gi | 1 | 1 | none | — | — |
| audit-log-service | 0.25 | 0.5Gi | 1 | 1 | none | — | — |

### Deployment Order (Dependency Tiers)

**Tier 1 — ML/Inference (no upstream dependencies):**
- crystallization-onnx-service, vision-service, compass-ml-service

**Tier 2 — Core gRPC + Kafka consumers:**
- auth-service, user-service, crystallization-service, payment-service
- compass-service, waste-valorization-service, gemini-service
- email-service, audit-log-service

**Tier 3 — API Gateway (depends on all other services):**
- api-gateway

### Environment Variables (API Gateway)

```
PORT=3400
JWT_SECRET=secretref:jwt-secret
GRPC_SSL=true
KAFKA_BROKER=brinex-kafka.servicebus.windows.net:9093
KAFKA_SASL_ENABLED=true
KAFKA_CONNECTION_STRING=secretref:kafka-conn

# Internal service URLs (all on port 443 via TLS ingress)
AUTH_SERVICE_URL=auth-service.internal.graysky-458c04e8.koreacentral.azurecontainerapps.io:443
USER_SERVICE_URL=user-service.internal.graysky-458c04e8.koreacentral.azurecontainerapps.io:443
CRYSTALLIZATION_SERVICE_URL=crystallization-service.internal.graysky-458c04e8.koreacentral.azurecontainerapps.io:443
VISION_SERVICE_URL=vision-service.internal.graysky-458c04e8.koreacentral.azurecontainerapps.io:443
PAYMENT_SERVICE_URL=payment-service.internal.graysky-458c04e8.koreacentral.azurecontainerapps.io:443
COMPASS_SERVICE_URL=compass-service.internal.graysky-458c04e8.koreacentral.azurecontainerapps.io:443
WASTE_VALORIZATION_SERVICE_URL=waste-valorization-service.internal.graysky-458c04e8.koreacentral.azurecontainerapps.io:443
AI_SERVICE_URL=gemini-service.internal.graysky-458c04e8.koreacentral.azurecontainerapps.io:443
```

---

## Post-Deployment Configuration

### Secrets Updated After Deployment

| Service | Secrets |
|---------|---------|
| auth-service | `NOTIFY_LK_USER_ID`, `NOTIFY_LK_API_KEY`, `NOTIFY_LK_SENDER_ID` (SMS OTP via Notify.lk) |
| crystallization-onnx-service | `OPENWEATHER_API_KEY`, `OPENWEATHER_LAT`, `OPENWEATHER_LON` |
| crystallization-service | `OPENWEATHER_API_KEY`, `OPENWEATHER_LAT`, `OPENWEATHER_LON` |
| email-service | `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` (Gmail SMTP) |

### Still Unconfigured (Add When Ready)

| Service | Missing Secrets |
|---------|-----------------|
| payment-service | `PAYHERE_MERCHANT_ID`, `PAYHERE_MERCHANT_SECRET`, `PAYHERE_NOTIFY_URL`, `FRONTEND_URL` |
| gemini-service | `GEMINI_API_KEY` |
| waste-valorization-service | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SQS_QUEUE_URL`, `AWS_ACCOUNT_ID` |

To add secrets to a running service:
```powershell
az containerapp update --name <service-name> --resource-group rg-brinex `
    --set-env-vars "KEY=value" "KEY2=value2" -o none
```

---

## Troubleshooting & Fixes

### Issue 1: SLIIT Tenant Region Restrictions

**Problem:** `RequestDisallowedByAzure` when creating resources in eastus, centralus, westus2, northeurope.

**Fix:** Used `southeastasia` for ACR/Event Hubs and `koreacentral` for Container Apps Environment. Discovered by iterating through regions with `deploy/try-regions.ps1`.

### Issue 2: Event Hubs Basic Tier Doesn't Support Kafka Protocol

**Problem:** `Kafka protocol is supported for Standard, Premium and Dedicated SKU only`.

**Fix:** Deleted and recreated the Event Hubs namespace with `--sku Standard`. Cannot upgrade Basic to Standard in-place. Cost increased from ~$11/month to ~$22/month.

### Issue 3: Docker Build — `Can't resolve '@brinex-server/kafka-config'`

**Problem:** The shared workspace package `packages/kafka-config/` was not copied during the Docker deps stage, so npm workspace symlinks weren't created.

**Fix:** Added `COPY packages/ ./packages/` before `npm install` in both Dockerfiles.

### Issue 4: gRPC Connection Timeout (`14 UNAVAILABLE: connect ETIMEDOUT`)

**Problem:** API Gateway couldn't reach internal services. Service URLs were set to custom ports (e.g., `:50000`) but Azure Container Apps internal ingress only exposes ports 80 (HTTP) and 443 (HTTPS).

**Fix (3 parts):**
1. Changed all service URLs to use port **443** (TLS)
2. Created `grpc-credentials.ts` helper returning `ChannelCredentials.createSsl()` when `GRPC_SSL=true`
3. Added `credentials: getGrpcCredentials()` to all 10 gRPC client registrations in API Gateway
4. Set `GRPC_SSL=true` environment variable on the API Gateway
5. Rebuilt and redeployed API Gateway as image tag `v2`

### Issue 5: Auth-Service Scale-to-Zero Timeout

**Problem:** Auth-service scaled to zero replicas, causing gRPC timeouts on first request (~30s cold start exceeded timeout).

**Fix:** Set `--min-replicas 1` for auth-service to keep it always running.

---

## Management Scripts

All scripts are in the `deploy/` directory:

| Script | Purpose |
|--------|---------|
| `deploy-services.ps1` | Full deployment of all 13 services to Azure Container Apps |
| `update-secrets.ps1` | Update service environment variables (Notify.lk, OpenWeather, SMTP) |
| `restart-kafka-services.ps1` | Restart all Kafka-dependent services |
| `verify-full.ps1` | List all services and test API Gateway health |
| `test-health.ps1` | Simple API Gateway HTTP health check |
| `try-regions.ps1` | Test Azure regions for Container Apps availability |
| `.env.azure` | Actual deployment configuration with secrets (gitignored) |
| `.env.azure.template` | Template for `.env.azure` (safe to commit) |

---

## Frontend Integration

To connect the Next.js frontend to the Azure-hosted backend:

### 1. Set Environment Variables

Create `.env.local` in the frontend root:

```
NEXT_PUBLIC_API_BASE_URL=https://api-gateway.graysky-458c04e8.koreacentral.azurecontainerapps.io/api/v1
NEXT_PUBLIC_VISION_WS_URL=wss://api-gateway.graysky-458c04e8.koreacentral.azurecontainerapps.io
```

### 2. Update CORS (After Frontend Deployment)

Once the frontend is deployed (e.g., to Vercel), update the API Gateway's CORS allowlist:

```powershell
az containerapp update --name api-gateway --resource-group rg-brinex `
    --set-env-vars "FRONTEND_URL=https://your-frontend-domain.vercel.app" -o none
```

The API Gateway CORS config (`main.ts`) already reads `process.env.FRONTEND_URL` and includes `localhost:3000` for local development.

---

## Verified Working

- **Swagger UI**: `https://api-gateway.graysky-458c04e8.koreacentral.azurecontainerapps.io/api/v1` (HTTP 200)
- **Sign-up with SMS OTP**: `POST /auth/sign-up` with phone number (HTTP 201, OTP sent via Notify.lk)
- **gRPC over TLS**: API Gateway to auth-service communication verified
- **Kafka (Event Hubs)**: Audit log events emitted successfully
- **CORS**: Preflight requests from `localhost:3000` pass correctly
