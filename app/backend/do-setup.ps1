$ErrorActionPreference = "Stop"
Write-Host "Starting backend..."
$Job = Start-Job -ScriptBlock {
  Set-Location "C:\Users\tejak\OneDrive\Desktop\Mint2Metal\app\backend"
  npx ts-node-dev --respawn --transpile-only index.ts
}

$Success = $false
for ($i=0; $i -lt 15; $i++) {
  Start-Sleep -Seconds 2
  Write-Host "Checking if server is up... $i"
  try {
    $Response = Invoke-WebRequest -Uri "http://localhost:4000/admin/users" -Method Get -ErrorAction Stop
    $Success = $true
    break
  } catch {
    # It's not up yet 
  }
}

if ($Success) {
  Write-Host "Server is up! Making setup-clawback call..."
  try {
    $Result = Invoke-RestMethod -Uri "http://localhost:4000/admin/setup-clawback" -Method POST
    $Result | ConvertTo-Json -Depth 5 | Out-File -FilePath "C:\Users\tejak\OneDrive\Desktop\Mint2Metal\app\backend\setup-success.json"
    Write-Host "Call succeeded!"
  } catch {
    $_.Exception.Message | Out-File -FilePath "C:\Users\tejak\OneDrive\Desktop\Mint2Metal\app\backend\setup-error.txt"
    Write-Host "Call failed! Error saved to setup-error.txt"
  }
} else {
  Write-Host "Server never started."
  "Server never started." | Out-File -FilePath "C:\Users\tejak\OneDrive\Desktop\Mint2Metal\app\backend\setup-error.txt"
}

Stop-Job $Job
Remove-Job $Job -Force
Write-Host "Done."
