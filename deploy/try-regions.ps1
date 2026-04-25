$az = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$regions = @('eastasia', 'koreacentral', 'japaneast', 'australiaeast', 'uksouth', 'westeurope', 'swedencentral', 'canadacentral', 'centralindia', 'francecentral', 'germanywestcentral')

foreach ($region in $regions) {
    Write-Host "Trying: $region ..."
    & $az containerapp env create --name brinex-env --resource-group rg-brinex --location $region --logs-workspace-id d4f19dbe-d3a2-4162-ab91-ec1489041744 --logs-workspace-key 'paloqJCJ39aCqlevwhEcqriAxFyqvoe+6NANygP6ACmlF565Xe5n6A2n66MKuNX4UnAqVlPINkXZw7cdsb//4Q==' -o none 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS in $region"
        exit 0
    } else {
        Write-Host "FAILED in $region"
    }
}
Write-Host "All regions failed"
exit 1
