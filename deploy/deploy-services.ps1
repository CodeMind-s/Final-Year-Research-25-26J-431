$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

# ── Load secrets from deploy/.env.azure (gitignored) ──
$envFile = Join-Path $PSScriptRoot ".env.azure"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: $envFile not found. Copy .env.azure.template to .env.azure and fill in real values." -ForegroundColor Red
    exit 1
}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#') { return }
    if ($_ -notmatch '=') { return }
    $name, $value = $_ -split '=', 2
    Set-Variable -Name $name.Trim() -Value $value.Trim() -Scope Script
}

foreach ($required in @('ACR_PASS','EVENTHUB_CONN','MONGO_URI','JWT_SECRET')) {
    if (-not (Get-Variable -Name $required -Scope Script -ErrorAction SilentlyContinue) -or
        -not (Get-Variable -Name $required -Scope Script).Value) {
        Write-Host "ERROR: $required is missing from .env.azure" -ForegroundColor Red
        exit 1
    }
}

# Config
$RG = "rg-brinex"
$ENV_NAME = "brinex-env"
$ACR = "brinexacr.azurecr.io"
$ACR_USER = "brinexacr"
$TAG = "v1"
$ENV_DOMAIN = "graysky-458c04e8.koreacentral.azurecontainerapps.io"
$KAFKA_BROKER = "brinex-kafka.servicebus.windows.net:9093"

function Deploy-Service {
    param(
        [string]$Name,
        [string]$Port,
        [string]$Ingress,
        [string]$Transport,
        [string]$Cpu,
        [string]$Memory,
        [int]$MinReplicas,
        [int]$MaxReplicas,
        [string[]]$Secrets,
        [string[]]$EnvVars
    )

    Write-Host "`n>> Deploying $Name ..." -ForegroundColor Cyan

    $args = @(
        "containerapp", "create",
        "--name", $Name,
        "--resource-group", $RG,
        "--environment", $ENV_NAME,
        "--image", "$ACR/${Name}:${TAG}",
        "--registry-server", $ACR,
        "--registry-username", $ACR_USER,
        "--registry-password", $ACR_PASS,
        "--cpu", $Cpu,
        "--memory", $Memory,
        "--min-replicas", $MinReplicas,
        "--max-replicas", $MaxReplicas,
        "-o", "none"
    )

    if ($Port) {
        $args += "--target-port", $Port
    }
    if ($Ingress) {
        $args += "--ingress", $Ingress
    }
    if ($Transport) {
        $args += "--transport", $Transport
    }
    if ($Secrets.Count -gt 0) {
        $args += "--secrets"
        $args += $Secrets
    }
    if ($EnvVars.Count -gt 0) {
        $args += "--env-vars"
        $args += $EnvVars
    }

    & $az @args 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  OK: $Name deployed" -ForegroundColor Green
    } else {
        Write-Host "  FAILED: $Name" -ForegroundColor Red
    }
}

# ── Tier 1: ML/Inference services ──

Deploy-Service -Name "crystallization-onnx-service" -Port "50055" -Ingress "internal" -Transport "http2" `
    -Cpu "0.5" -Memory "1Gi" -MinReplicas 1 -MaxReplicas 2 `
    -Secrets @("mongo-uri=$MONGO_URI", "kafka-conn=$EVENTHUB_CONN") `
    -EnvVars @(
        "GRPC_URL=0.0.0.0:50055",
        "MONGO_URI=secretref:mongo-uri",
        "KAFKA_BROKER=$KAFKA_BROKER",
        "KAFKA_SASL_ENABLED=true",
        "KAFKA_CONNECTION_STRING=secretref:kafka-conn"
    )

Deploy-Service -Name "vision-service" -Port "50057" -Ingress "internal" -Transport "http2" `
    -Cpu "1.0" -Memory "2Gi" -MinReplicas 0 -MaxReplicas 2 `
    -Secrets @("mongo-uri=$MONGO_URI") `
    -EnvVars @(
        "GRPC_URL=0.0.0.0:50057",
        "MONGO_URI=secretref:mongo-uri",
        "VISION_MODEL_PATH=/app/models/best.onnx"
    )

Deploy-Service -Name "compass-ml-service" -Port "8002" -Ingress "internal" -Transport "auto" `
    -Cpu "0.5" -Memory "1Gi" -MinReplicas 1 -MaxReplicas 2 `
    -Secrets @("mongo-uri=$MONGO_URI") `
    -EnvVars @(
        "MODEL_DIR=/app/models",
        "MONGO_URI=secretref:mongo-uri",
        "CRYSTALLIZATION_SERVICE_URL=crystallization-onnx-service.internal.$ENV_DOMAIN`:50055"
    )

# ── Tier 2: Core gRPC services ──

Deploy-Service -Name "auth-service" -Port "50000" -Ingress "internal" -Transport "http2" `
    -Cpu "0.25" -Memory "0.5Gi" -MinReplicas 0 -MaxReplicas 2 `
    -Secrets @("mongo-uri=$MONGO_URI", "jwt-secret=$JWT_SECRET", "kafka-conn=$EVENTHUB_CONN") `
    -EnvVars @(
        "GRPC_URL=0.0.0.0:50000",
        "MONGO_URI=secretref:mongo-uri",
        "JWT_SECRET=secretref:jwt-secret",
        "KAFKA_BROKER=$KAFKA_BROKER",
        "KAFKA_SASL_ENABLED=true",
        "KAFKA_CONNECTION_STRING=secretref:kafka-conn"
    )

Deploy-Service -Name "user-service" -Port "50053" -Ingress "internal" -Transport "http2" `
    -Cpu "0.25" -Memory "0.5Gi" -MinReplicas 0 -MaxReplicas 2 `
    -Secrets @("mongo-uri=$MONGO_URI", "kafka-conn=$EVENTHUB_CONN") `
    -EnvVars @(
        "GRPC_URL=0.0.0.0:50053",
        "MONGO_URI=secretref:mongo-uri",
        "KAFKA_BROKER=$KAFKA_BROKER",
        "KAFKA_SASL_ENABLED=true",
        "KAFKA_CONNECTION_STRING=secretref:kafka-conn"
    )

Deploy-Service -Name "crystallization-service" -Port "50054" -Ingress "internal" -Transport "http2" `
    -Cpu "0.25" -Memory "0.5Gi" -MinReplicas 0 -MaxReplicas 2 `
    -Secrets @("mongo-uri=$MONGO_URI", "kafka-conn=$EVENTHUB_CONN") `
    -EnvVars @(
        "GRPC_URL=0.0.0.0:50054",
        "MONGO_URI=secretref:mongo-uri",
        "ONNX_SERVICE_GRPC_URL=crystallization-onnx-service.internal.$ENV_DOMAIN`:50055",
        "KAFKA_BROKER=$KAFKA_BROKER",
        "KAFKA_SASL_ENABLED=true",
        "KAFKA_CONNECTION_STRING=secretref:kafka-conn"
    )

Deploy-Service -Name "payment-service" -Port "50056" -Ingress "internal" -Transport "http2" `
    -Cpu "0.25" -Memory "0.5Gi" -MinReplicas 0 -MaxReplicas 2 `
    -Secrets @("mongo-uri=$MONGO_URI") `
    -EnvVars @(
        "GRPC_URL=0.0.0.0:50056",
        "MONGO_URI=secretref:mongo-uri",
        "AUTH_SERVICE_URL=auth-service.internal.$ENV_DOMAIN`:50000",
        "PAYHERE_SANDBOX=true"
    )

Deploy-Service -Name "compass-service" -Port "50052" -Ingress "internal" -Transport "http2" `
    -Cpu "0.25" -Memory "0.5Gi" -MinReplicas 0 -MaxReplicas 2 `
    -Secrets @("mongo-uri=$MONGO_URI") `
    -EnvVars @(
        "GRPC_URL=0.0.0.0:50052",
        "MONGO_URI=secretref:mongo-uri",
        "COMPASS_ML_SERVICE_URL=http://compass-ml-service.internal.$ENV_DOMAIN`:8002"
    )

Deploy-Service -Name "waste-valorization-service" -Port "50058" -Ingress "internal" -Transport "http2" `
    -Cpu "0.25" -Memory "0.5Gi" -MinReplicas 0 -MaxReplicas 2 `
    -Secrets @("mongo-uri=$MONGO_URI") `
    -EnvVars @(
        "GRPC_URL=0.0.0.0:50058",
        "MONGO_URI=secretref:mongo-uri",
        "ENVIRONMENT=production"
    )

Deploy-Service -Name "gemini-service" -Port "50059" -Ingress "internal" -Transport "http2" `
    -Cpu "0.25" -Memory "0.5Gi" -MinReplicas 0 -MaxReplicas 2 `
    -EnvVars @(
        "GRPC_URL=0.0.0.0:50059",
        "CRYSTALLIZATION_SERVICE_URL=crystallization-service.internal.$ENV_DOMAIN`:50054"
    )

# ── Tier 2b: Kafka consumers (no ingress) ──

Deploy-Service -Name "email-service" -Port "" -Ingress "" -Transport "" `
    -Cpu "0.25" -Memory "0.5Gi" -MinReplicas 1 -MaxReplicas 1 `
    -Secrets @("kafka-conn=$EVENTHUB_CONN") `
    -EnvVars @(
        "KAFKA_BROKER=$KAFKA_BROKER",
        "KAFKA_SASL_ENABLED=true",
        "KAFKA_CONNECTION_STRING=secretref:kafka-conn",
        "EMAIL_HOST=smtp.gmail.com",
        "EMAIL_PORT=587"
    )

Deploy-Service -Name "audit-log-service" -Port "" -Ingress "" -Transport "" `
    -Cpu "0.25" -Memory "0.5Gi" -MinReplicas 1 -MaxReplicas 1 `
    -Secrets @("mongo-uri=$MONGO_URI", "kafka-conn=$EVENTHUB_CONN") `
    -EnvVars @(
        "MONGO_URI=secretref:mongo-uri",
        "KAFKA_BROKER=$KAFKA_BROKER",
        "KAFKA_SASL_ENABLED=true",
        "KAFKA_CONNECTION_STRING=secretref:kafka-conn"
    )

# ── Tier 3: API Gateway (external) ──

Deploy-Service -Name "api-gateway" -Port "3400" -Ingress "external" -Transport "auto" `
    -Cpu "0.5" -Memory "1Gi" -MinReplicas 1 -MaxReplicas 3 `
    -Secrets @("jwt-secret=$JWT_SECRET", "kafka-conn=$EVENTHUB_CONN") `
    -EnvVars @(
        "PORT=3400",
        "JWT_SECRET=secretref:jwt-secret",
        "KAFKA_BROKER=$KAFKA_BROKER",
        "KAFKA_SASL_ENABLED=true",
        "KAFKA_CONNECTION_STRING=secretref:kafka-conn",
        "AUTH_SERVICE_URL=auth-service.internal.$ENV_DOMAIN`:50000",
        "USER_SERVICE_URL=user-service.internal.$ENV_DOMAIN`:50053",
        "CRYSTALLIZATION_SERVICE_URL=crystallization-service.internal.$ENV_DOMAIN`:50054",
        "VISION_SERVICE_URL=vision-service.internal.$ENV_DOMAIN`:50057",
        "PAYMENT_SERVICE_URL=payment-service.internal.$ENV_DOMAIN`:50056",
        "COMPASS_SERVICE_URL=compass-service.internal.$ENV_DOMAIN`:50052",
        "WASTE_VALORIZATION_SERVICE_URL=waste-valorization-service.internal.$ENV_DOMAIN`:50058",
        "AI_SERVICE_URL=gemini-service.internal.$ENV_DOMAIN`:50059"
    )

# ── Print result ──
Write-Host "`n============================================" -ForegroundColor Yellow
Write-Host "  Deployment complete!" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow

$apiUrl = & $az containerapp show --name api-gateway --resource-group $RG --query "properties.configuration.ingress.fqdn" -o tsv
Write-Host "  API Gateway: https://$apiUrl/api/v1"
Write-Host "  Swagger:     https://$apiUrl/api/v1"
Write-Host "============================================" -ForegroundColor Yellow
