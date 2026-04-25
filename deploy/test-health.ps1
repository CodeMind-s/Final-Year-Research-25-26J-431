try {
    $r = Invoke-WebRequest -Uri "https://api-gateway.graysky-458c04e8.koreacentral.azurecontainerapps.io/api/v1" -UseBasicParsing -TimeoutSec 30
    Write-Host "HTTP $($r.StatusCode) - API Gateway is healthy!"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "HTTP $code - $($_.Exception.Message)"
}
