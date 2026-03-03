$ErrorActionPreference = "Stop"

$SERVER_PORT = 4000
$MAX_RETRIES = 60 # 60 seconds
$MOCK_TOKEN = "your-admin-token" # JWT verification is disabled for this test endpoint

Write-Host "Starting backend server in background..."
$process = Start-Process -FilePath "npx" -ArgumentList "ts-node -r dotenv/config index.ts" -PassThru -WindowStyle Hidden

Write-Host "Waiting for server to become healthy..."
$healthy = $false
for ($i = 1; $i -le $MAX_RETRIES; $i++) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:$SERVER_PORT/api/health" -Method Get -ErrorAction Stop
        if ($response.status -eq "OK") {
            $healthy = $true
            Write-Host "Server is healthy!"
            break
        }
    } catch {
        # Ignore errors and retry
    }
    Start-Sleep -Seconds 1
}

if (-not $healthy) {
    Write-Host "ERROR: Server failed to start within timeout."
    Stop-Process -Id $process.Id -Force
    exit 1
}

Write-Host "Server is ready. Attempting to fix user trustline..."
try {
    $result = Invoke-RestMethod -Uri "http://localhost:$SERVER_PORT/api/admin/fix-user" -Method Post -Headers @{ "Authorization" = "Bearer $MOCK_TOKEN"; "Content-Type" = "application/json" } -ErrorAction Stop
    $json = $result | ConvertTo-Json -Depth 10
    Write-Host "SUCCESS: Endpoint executed successfully."
    $json | Out-File -FilePath "fix-user-result.json" -Encoding utf8
    Write-Host "Result saved to fix-user-result.json"
} catch {
    Write-Host "ERROR: Endpoint failed. Response:"
    if ($_.ErrorDetails) {
        Write-Host $_.ErrorDetails.Message
        $_.ErrorDetails.Message | Out-File -FilePath "fix-user-result.json" -Encoding utf8
    } else {
        Write-Host $_.Exception.Message
        $_.Exception.Message | Out-File -FilePath "fix-user-result.json" -Encoding utf8
    }
}

Write-Host "Shutting down the backend server..."
Stop-Process -Id $process.Id -Force
Write-Host "Cleanup complete."
