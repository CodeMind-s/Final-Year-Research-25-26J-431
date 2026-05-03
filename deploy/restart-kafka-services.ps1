$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$RG = "rg-brinex"

$services = @("api-gateway", "auth-service", "user-service", "crystallization-service", "crystallization-onnx-service", "email-service", "audit-log-service")

foreach ($svc in $services) {
    Write-Host "Restarting $svc ..."
    $rev = & $az containerapp revision list --name $svc --resource-group $RG --query "[0].name" -o tsv
    if ($rev) {
        & $az containerapp revision restart --name $svc --resource-group $RG --revision $rev -o none 2>&1 | Out-Null
        Write-Host "  OK: $svc restarted (revision: $rev)"
    } else {
        Write-Host "  SKIP: no revision found for $svc"
    }
}
Write-Host "`nAll Kafka-dependent services restarted."
