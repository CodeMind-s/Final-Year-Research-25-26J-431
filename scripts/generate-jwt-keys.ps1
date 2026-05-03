# Generates an RSA-2048 keypair for Brinex JWT signing (RS256 mode).
#
# Why: Phase 4 of the Lab Agent rollout switches JWT signing from a shared HS256
# secret to an asymmetric RS256 keypair so the agent can verify tokens without
# trusting a shared secret. The public key is exposed via /api/v1/auth/jwks; the
# private key stays in auth-service env only.
#
# Usage (run from the repo root):
#   .\scripts\generate-jwt-keys.ps1
#
# Output:
#   - scripts/jwt-keys/jwt-private.pem  (auth-service env: JWT_PRIVATE_KEY)
#   - scripts/jwt-keys/jwt-public.pem   (auth-service + api-gateway env: JWT_PUBLIC_KEY)
#   - prints `.env`-ready single-line versions to stdout
#
# Requires Docker. Uses node:20-alpine for keypair generation so no host Node
# install is needed.

$ErrorActionPreference = 'Stop'

$keysDir = Join-Path $PSScriptRoot 'jwt-keys'
New-Item -ItemType Directory -Force -Path $keysDir | Out-Null

# Pass keysDir into the container; mount and run an inline Node generator.
$generator = @'
const fs = require('fs');
const { generateKeyPairSync } = require('crypto');
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
fs.writeFileSync('/keys/jwt-private.pem', privateKey);
fs.writeFileSync('/keys/jwt-public.pem', publicKey);
'@

docker run --rm -v "${keysDir}:/keys" node:20-alpine node -e $generator

if ($LASTEXITCODE -ne 0) {
  Write-Error "Keypair generation failed inside Docker."
  exit 1
}

$priv = (Get-Content -Raw (Join-Path $keysDir 'jwt-private.pem')).TrimEnd("`r","`n")
$pub  = (Get-Content -Raw (Join-Path $keysDir 'jwt-public.pem')).TrimEnd("`r","`n")

# `.env` files don't tolerate raw newlines inside values. Replace newlines with
# the literal `\n` so the JWT helper's normalizePem() step puts them back.
$privEsc = $priv -replace "`r?`n", '\n'
$pubEsc  = $pub  -replace "`r?`n", '\n'

Write-Host ''
Write-Host 'Keys written to:' $keysDir
Write-Host ''
Write-Host 'Add these to apps/auth-service/.env (and apps/api-gateway/.env for JWT_PUBLIC_KEY):'
Write-Host ''
Write-Host "JWT_PRIVATE_KEY=`"$privEsc`""
Write-Host "JWT_PUBLIC_KEY=`"$pubEsc`""
Write-Host ''
Write-Host 'After updating .env files, rebuild + restart with:'
Write-Host '  docker-compose up -d --build api-gateway auth-service'
