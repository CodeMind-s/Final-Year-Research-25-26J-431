# Compass Service - Local Test Runner (Windows)
# This script helps developers run tests locally with the correct environment setup

param(
    [string]$TestType = "unit"
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Green "🚀 Compass Service Test Runner"
Write-Output "================================"

# Check if MongoDB is running
function Test-MongoDB {
    Write-ColorOutput Yellow "`nChecking MongoDB..."
    $mongoRunning = docker ps --format "{{.Names}}" | Select-String -Pattern "mongo" -Quiet
    
    if (-not $mongoRunning) {
        Write-ColorOutput Red "❌ MongoDB is not running"
        Write-ColorOutput Yellow "Starting MongoDB..."
        
        docker run -d --name compass-mongo `
            -p 27017:27017 `
            -e MONGO_INITDB_ROOT_USERNAME=root `
            -e MONGO_INITDB_ROOT_PASSWORD=testpassword `
            mongo:7.0
        
        Write-ColorOutput Green "✅ MongoDB started"
        Start-Sleep -Seconds 5
    }
    else {
        Write-ColorOutput Green "✅ MongoDB is running"
    }
}

# Load environment variables
function Set-TestEnvironment {
    Write-ColorOutput Yellow "`nLoading environment variables..."
    
    $envFile = "apps\compass-service\.env.test"
    
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            if ($_ -match '^([^#][^=]+)=(.*)$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                Set-Item -Path "env:$name" -Value $value
            }
        }
        Write-ColorOutput Green "✅ Environment loaded from .env.test"
    }
    else {
        Write-ColorOutput Yellow "⚠️  .env.test not found, using defaults"
        $env:MONGO_URI = "mongodb://root:testpassword@localhost:27017/compass-test?authSource=admin"
        $env:GRPC_URL = "0.0.0.0:50052"
        $env:NODE_ENV = "test"
    }
}

# Run tests
function Invoke-Tests {
    param($Type)
    
    switch ($Type) {
        "unit" {
            Write-ColorOutput Yellow "`nRunning unit tests..."
            npx nx test compass-service
        }
        "coverage" {
            Write-ColorOutput Yellow "`nRunning tests with coverage..."
            npx nx test compass-service --coverage
        }
        "watch" {
            Write-ColorOutput Yellow "`nRunning tests in watch mode..."
            npx nx test compass-service --watch
        }
        "e2e" {
            Write-ColorOutput Yellow "`nRunning E2E tests..."
            try {
                npx nx test:e2e compass-service
            }
            catch {
                Write-ColorOutput Yellow "⚠️  E2E tests not configured"
            }
        }
        "all" {
            Write-ColorOutput Yellow "`nRunning all tests..."
            npx nx lint compass-service
            npx nx typecheck compass-service
            npx nx test compass-service --coverage
            npx nx build compass-service
        }
        default {
            Write-ColorOutput Red "Unknown test type: $Type"
            Write-Output "Usage: .\run-tests.ps1 [-TestType <unit|coverage|watch|e2e|all>]"
            exit 1
        }
    }
}

# Cleanup
function Invoke-Cleanup {
    Write-ColorOutput Yellow "`nCleanup (optional)"
    $response = Read-Host "Do you want to stop MongoDB? (y/N)"
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        try {
            docker stop compass-mongo 2>$null
            docker rm compass-mongo 2>$null
            Write-ColorOutput Green "✅ MongoDB stopped and removed"
        }
        catch {
            Write-ColorOutput Yellow "⚠️  MongoDB cleanup skipped"
        }
    }
}

# Main execution
try {
    # Check dependencies
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-ColorOutput Red "❌ Docker is not installed"
        exit 1
    }
    
    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
        Write-ColorOutput Red "❌ Node.js/npm is not installed"
        exit 1
    }
    
    # Setup
    Test-MongoDB
    Set-TestEnvironment
    
    # Run tests
    Invoke-Tests -Type $TestType
    
    # Results
    Write-ColorOutput Green "`n✅ Tests completed successfully!"
    
    # Cleanup
    Invoke-Cleanup
}
catch {
    Write-ColorOutput Red "`n❌ Tests failed!"
    Write-ColorOutput Red $_.Exception.Message
    exit 1
}
