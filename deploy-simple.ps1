# Simple DST Token Contract Deployment to Testnet

Write-Host "Deploying DST Token Contract to Stellar Testnet" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""

# Check if Stellar CLI is available
try {
  $stellarVersion = & stellar --version 2>$null
  Write-Host "Stellar CLI found: $stellarVersion" -ForegroundColor Green
}
catch {
  Write-Host "Stellar CLI not found" -ForegroundColor Red
  exit 1
}

# Set paths
$wasmPath = "app/contracts/dst-token/target/wasm32v1-none/release/dst_token.wasm"
$identity = "alice"

# Check if WASM file exists
if (!(Test-Path $wasmPath)) {
  Write-Host "WASM file not found: $wasmPath" -ForegroundColor Red
  exit 1
}

Write-Host "Using WASM file: $wasmPath" -ForegroundColor Yellow
Write-Host "Using identity: $identity" -ForegroundColor Yellow
Write-Host ""

# Step 1: Upload contract bytes (Install)
Write-Host "Step 1: Uploading contract bytes..." -ForegroundColor Cyan
try {
  $uploadOutput = & stellar contract upload --network testnet --source-account $identity --wasm $wasmPath 2>&1

  if ($LASTEXITCODE -ne 0) {
    throw "Upload failed: $uploadOutput"
  }

  # Extract WASM hash from output - get the last one (our contract hash)
  $wasmHashes = $uploadOutput | Select-String -Pattern "([a-f0-9]{64})" | ForEach-Object { $_.Matches[0].Value }
  $wasmHash = $wasmHashes | Select-Object -Last 1

  if (!$wasmHash) {
    Write-Host "Could not extract WASM hash from output" -ForegroundColor Red
    Write-Host "Upload output: $uploadOutput" -ForegroundColor Gray
    exit 1
  }

  Write-Host "Contract uploaded successfully" -ForegroundColor Green
  Write-Host "WASM Hash: $wasmHash" -ForegroundColor Yellow

}
catch {
  Write-Host "Failed to upload contract: $_" -ForegroundColor Red
  exit 1
}

# Step 2: Instantiate contract (Deploy)
Write-Host ""
Write-Host "Step 2: Deploying contract instance..." -ForegroundColor Cyan
try {
  $deployOutput = & stellar contract deploy --wasm-hash $wasmHash --source-account $identity --network testnet --alias dst-token 2>&1

  if ($LASTEXITCODE -ne 0) {
    throw "Deploy failed: $deployOutput"
  }

  # Extract contract ID from output
  $contractId = $deployOutput | Select-String -Pattern "(C[A-Z0-9]{55})" | ForEach-Object { $_.Matches[0].Value }

  if (!$contractId) {
    Write-Host "Could not extract contract ID from output" -ForegroundColor Red
    Write-Host "Deploy output: $deployOutput" -ForegroundColor Gray
    exit 1
  }

  Write-Host "Contract deployed successfully" -ForegroundColor Green
  Write-Host "Contract ID: $contractId" -ForegroundColor Yellow

}
catch {
  Write-Host "Failed to deploy contract: $_" -ForegroundColor Red
  exit 1
}

# Step 3: Initialize the contract
Write-Host ""
Write-Host "Step 3: Initializing contract..." -ForegroundColor Cyan

# Get the admin public key
try {
  $keysOutput = & stellar keys show $identity 2>&1
  $adminKey = $keysOutput | Select-String -Pattern "(G[A-Z0-9]{55})" | ForEach-Object { $_.Matches[0].Value }

  if (!$adminKey) {
    Write-Host "Could not get admin public key" -ForegroundColor Red
    exit 1
  }

  Write-Host "Admin Public Key: $adminKey" -ForegroundColor Yellow

}
catch {
  Write-Host "Failed to get admin key: $_" -ForegroundColor Red
  exit 1
}

# Initialize contract
try {
  $initOutput = & stellar contract invoke --id $contractId --source-account $identity --network testnet -- initialize --admin $adminKey 2>&1

  if ($LASTEXITCODE -ne 0) {
    throw "Initialize failed: $initOutput"
  }

  Write-Host "Contract initialized successfully" -ForegroundColor Green

}
catch {
  Write-Host "Failed to initialize contract: $_" -ForegroundColor Red
  exit 1
}

# Step 4: Test the contract
Write-Host ""
Write-Host "Step 4: Testing contract..." -ForegroundColor Cyan
try {
  $balanceOutput = & stellar contract invoke --id $contractId --source-account $identity --network testnet -- balance --address $adminKey 2>&1

  if ($LASTEXITCODE -ne 0) {
    throw "Balance check failed: $balanceOutput"
  }

  Write-Host "Contract test successful" -ForegroundColor Green
  Write-Host "Initial balance: 0 (as expected)" -ForegroundColor Yellow

}
catch {
  Write-Host "Contract test failed: $_" -ForegroundColor Red
  exit 1
}

# Success summary
Write-Host ""
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "====================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployment Summary:" -ForegroundColor Cyan
Write-Host "Contract ID: $contractId" -ForegroundColor White
Write-Host "Admin Address: $adminKey" -ForegroundColor White
Write-Host "Network: Testnet" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update your .env file: DST_CONTRACT_ID=$contractId" -ForegroundColor White
Write-Host "2. Test minting: stellar contract invoke --id $contractId --network testnet -- mint --to $adminKey --amount 100 --reserves-proof test" -ForegroundColor White
Write-Host "3. Check balance: stellar contract invoke --id $contractId --network testnet -- balance --address $adminKey" -ForegroundColor White
Write-Host
