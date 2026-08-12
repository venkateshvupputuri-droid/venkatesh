# Trimble Extension - Local Development Server
# PowerShell Version
# Usage: .\start-dev.ps1

Write-Host "`n" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  TRIMBLE EXTENSION - DEV SERVER" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`n"

Write-Host "Starting local server on port 8080..." -ForegroundColor Yellow
Write-Host "`n"

Write-Host "Access points:" -ForegroundColor Cyan
Write-Host "  Main:        http://localhost:8080" -ForegroundColor White
Write-Host "  Tests:       http://localhost:8080/TEST_PRODUCT_API.html" -ForegroundColor White
Write-Host "  Index:       http://localhost:8080/index.html" -ForegroundColor White
Write-Host "`n"

Write-Host "To test with Trimble Connect:" -ForegroundColor Yellow
Write-Host "  1. Stop this server (Ctrl+C)" -ForegroundColor White
Write-Host "  2. Run: .\start-dev-with-tunnel.ps1" -ForegroundColor White
Write-Host "  3. Use the ngrok URL in your manifest" -ForegroundColor White
Write-Host "`n"

Write-Host "Press Ctrl+C to stop" -ForegroundColor Red
Write-Host "`n"
Write-Host "========================================`n" -ForegroundColor Green

Set-Location $PSScriptRoot
npx http-server -p 8080 -c-1
