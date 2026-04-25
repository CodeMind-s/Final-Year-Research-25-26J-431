$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$RG = "rg-brinex"

# ── auth-service: add Notify.lk SMS secrets ──
Write-Host "`n>> Updating auth-service (Notify.lk SMS) ..." -ForegroundColor Cyan
& $az containerapp update --name auth-service --resource-group $RG `
    --set-env-vars `
        "NOTIFY_LK_USER_ID=29446" `
        "NOTIFY_LK_API_KEY=wIy63GkcXPJxnDeP3cFw" `
        "NOTIFY_LK_SENDER_ID=NotifyDEMO" `
    -o none
Write-Host "  OK" -ForegroundColor Green

# ── crystallization-onnx-service: add OpenWeather keys ──
Write-Host "`n>> Updating crystallization-onnx-service (OpenWeather) ..." -ForegroundColor Cyan
& $az containerapp update --name crystallization-onnx-service --resource-group $RG `
    --set-env-vars `
        "OPENWEATHER_API_KEY=c1406b25c6c34edb8974a6a332d4d0b9" `
        "OPENWEATHER_LAT=8.061542" `
        "OPENWEATHER_LON=79.814714" `
    -o none
Write-Host "  OK" -ForegroundColor Green

# ── crystallization-service: add OpenWeather keys ──
Write-Host "`n>> Updating crystallization-service (OpenWeather) ..." -ForegroundColor Cyan
& $az containerapp update --name crystallization-service --resource-group $RG `
    --set-env-vars `
        "OPENWEATHER_API_KEY=c1406b25c6c34edb8974a6a332d4d0b9" `
        "OPENWEATHER_LAT=8.061542" `
        "OPENWEATHER_LON=79.814714" `
    -o none
Write-Host "  OK" -ForegroundColor Green

# ── email-service: add SMTP credentials ──
Write-Host "`n>> Updating email-service (SMTP) ..." -ForegroundColor Cyan
& $az containerapp update --name email-service --resource-group $RG `
    --set-env-vars `
        "EMAIL_HOST=smtp.gmail.com" `
        "EMAIL_PORT=587" `
        "EMAIL_USER=arshaq0506@gmail.com" `
        "EMAIL_PASSWORD=yrhl knmc cyla cfoz" `
        "EMAIL_FROM=Brinex <no-reply@brinex.com>" `
    -o none
Write-Host "  OK" -ForegroundColor Green

Write-Host "`nAll services updated!" -ForegroundColor Yellow
