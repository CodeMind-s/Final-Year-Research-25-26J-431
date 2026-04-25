$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

Write-Host "=== Brinex Azure Deployment Status ===" -ForegroundColor Cyan

# List all services
& $az containerapp list --resource-group rg-brinex -o table

# Test API Gateway
Write-Host "`n=== API Gateway Health ===" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri "https://api-gateway.graysky-458c04e8.koreacentral.azurecontainerapps.io/api/v1" -UseBasicParsing -TimeoutSec 15
    Write-Host "HTTP $($r.StatusCode) - Healthy!" -ForegroundColor Green
} catch {
    Write-Host "HTTP $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
}

Write-Host "`n=== URLs ===" -ForegroundColor Cyan
Write-Host "API Gateway:  https://api-gateway.graysky-458c04e8.koreacentral.azurecontainerapps.io/api/v1"
Write-Host "Swagger:      https://api-gateway.graysky-458c04e8.koreacentral.azurecontainerapps.io/api/v1"
Write-Host ""
Write-Host "Frontend .env: NEXT_PUBLIC_API_BASE_URL=https://api-gateway.graysky-458c04e8.koreacentral.azurecontainerapps.io/api/v1"
