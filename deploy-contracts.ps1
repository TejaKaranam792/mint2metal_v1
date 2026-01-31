# Mint2Metal Soroban Contract Deployment Script
# Demonstrates the two-step deployment process

Write-Host "🚀 Mint2Metal Soroban Contract Deployment" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Check if Stellar CLI is available
try {
    $stellarVersion = & stellar --version 2>$null
    Write-Host "✅ Stellar CLI found: $stellarVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Stellar CLI not found. Please install it from: https://github.com/stellar/stellar-cli" -ForegroundColor Red
    exit 1
}

# Set the contract directory
$contractDir = "app/contracts/dst-token"

# Check if contract directory exists
if (!(Test-Path $contractDir)) {
    Write-Host "❌ Contract directory not found: $contractDir" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Using contract directory: $contractDir" -ForegroundColor Yellow

# Step 1: Build the contract
Write-Host ""
Write-Host "🔨 Step 1: Building DST Token Contract..." -ForegroundColor Cyan
try {
    Push-Location $contractDir
    & stellar contract build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed"
    }
    Write-Host "✅ Contract built successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to build contract: $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

# Check if WASM file exists
$wasmPath = "$contractDir/target/wasm32v1-none/release/dst_token.wasm"
if (!(Test-Path $wasmPath)) {
    Write-Host "❌ WASM file not found: $wasmPath" -ForegroundColor Red
    exit 1
}

Write-Host "📦 WASM file ready: $wasmPath" -ForegroundColor Green

# Step 2: Demonstrate the two-step deployment process
Write-Host ""
Write-Host "🚀 Step 2: Two-Step Deployment Process" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Note: These are example commands - you'll need real accounts and network access
Write-Host ""
Write-Host "📋 Two-Step Deployment Commands:" -ForegroundColor Yellow
Write-Host ""

Write-Host "# Step 2a: Upload contract bytes (Install)" -ForegroundColor Magenta
Write-Host "stellar contract upload \`"
Write-Host "  --network testnet \`"
Write-Host "  --source-account alice \`"
Write-Host "  --wasm $wasmPath"
Write-Host ""
Write-Host "# This returns a WASM hash like: 6ddb28e0980f643bb97350f7e3bacb0ff1fe74d846c6d4f2c625e766210fbb5b" -ForegroundColor Gray
Write-Host ""

Write-Host "# Step 2b: Instantiate contract (Deploy)" -ForegroundColor Magenta
Write-Host "stellar contract deploy \`"
Write-Host "  --wasm-hash <WASM_HASH_FROM_STEP_2A> \`"
Write-Host "  --source-account alice \`"
Write-Host "  --network testnet \`"
Write-Host "  --alias dst-token"
Write-Host ""
Write-Host "# This returns a contract ID like: CACDYF3CYMJEJTIVFESQYZTN67GO2R5D5IUABTCUG3HXQSRXCSOROBAN" -ForegroundColor Gray
Write-Host ""

Write-Host "# Step 2c: Initialize the contract" -ForegroundColor Magenta
Write-Host "stellar contract invoke ``"
Write-Host "  --id CONTRACT_ID_FROM_STEP_2B ``"
Write-Host "  --source-account alice ``"
Write-Host "  --network testnet ``"
Write-Host "  -- ``"
Write-Host "  initialize ``"
Write-Host "  --admin ADMIN_PUBLIC_KEY"
Write-Host ""

Write-Host "# Step 2d: Test the contract" -ForegroundColor Magenta
Write-Host "stellar contract invoke ``"
Write-Host "  --id CONTRACT_ID ``"
Write-Host "  --source-account alice ``"
Write-Host "  --network testnet ``"
Write-Host "  -- ``"
Write-Host "  balance ``"
Write-Host "  --user USER_PUBLIC_KEY"
Write-Host ""

Write-Host "🎯 Next Steps:" -ForegroundColor Green
Write-Host "1. Create/fund a testnet account with 'stellar keys generate alice --network testnet --fund'" -ForegroundColor White
Write-Host "2. Replace CONTRACT_ID, ADMIN_PUBLIC_KEY, etc. with actual values" -ForegroundColor White
Write-Host "3. Run the commands above in sequence" -ForegroundColor White
Write-Host "4. Update your .env file with the deployed contract ID" -ForegroundColor White
Write-Host ""

Write-Host "📚 For local development, you can also run:" -ForegroundColor Yellow
Write-Host "stellar network start --local" -ForegroundColor White
Write-Host ""

Write-Host "✨ Contract deployment script ready!" -ForegroundColor Green
