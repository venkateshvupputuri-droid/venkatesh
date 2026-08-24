$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverDir = Join-Path $root "server"
$port = 4000
$configPath = Join-Path $root "config.js"

function Get-PortOwner {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess
}

$owner = Get-PortOwner
if ($owner) {
  try {
    $health = Invoke-RestMethod "http://localhost:$port/health" -TimeoutSec 3
    if (-not $health.ok) { throw "The existing process is not the Erection Planner API." }
    Write-Host "API already running on http://localhost:$port; reusing process $owner."
  } catch {
    throw "Port $port is occupied by process $owner. Stop it or change PORT in server/.env."
  }
} else {
  $api = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $serverDir -PassThru -RedirectStandardOutput (Join-Path $serverDir "launcher.out.log") -RedirectStandardError (Join-Path $serverDir "launcher.err.log")
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 500
    try {
      $health = Invoke-RestMethod "http://localhost:$port/health" -TimeoutSec 2
      if ($health.ok) { $ready = $true; break }
    } catch { }
  }
  if (-not $ready) {
    Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
    $errorLog = Join-Path $serverDir "launcher.err.log"
    $details = if (Test-Path $errorLog) { Get-Content $errorLog -Raw } else { "No launcher error log was created." }
    throw "The API did not start: $details"
  }
  Write-Host "API started on http://localhost:$port (process $($api.Id))."
}

$publicApi = $env:ERECTION_PLANNER_API_BASE
if ($publicApi) {
  $publicApi = $publicApi.TrimEnd('/')
  $config = Get-Content $configPath -Raw
  $config = [regex]::Replace($config, 'window\.ERECTION_PLANNER_API_BASE\s*=\s*"[^"]*";', "window.ERECTION_PLANNER_API_BASE = `"$publicApi`";")
  Set-Content -Path $configPath -Value $config -NoNewline
  Write-Host "Using configured permanent API: $publicApi"
} elseif ($env:CLOUDFLARE_TUNNEL_NAME) {
  $tunnel = Get-Process cloudflared -ErrorAction SilentlyContinue
  if ($tunnel) { Write-Host "Cloudflare tunnel already running; reusing process $($tunnel[0].Id)." }
  else {
    Write-Host "Starting named Cloudflare tunnel '$($env:CLOUDFLARE_TUNNEL_NAME)'."
    Start-Process cloudflared -ArgumentList "tunnel run $($env:CLOUDFLARE_TUNNEL_NAME)" -WorkingDirectory $root
  }
  Write-Host "Set ERECTION_PLANNER_API_BASE to the named tunnel HTTPS URL before publishing."
} else {
  $tunnel = Get-Process cloudflared -ErrorAction SilentlyContinue
  $configuredTunnel = $null
  $config = Get-Content $configPath -Raw
  $configuredMatch = [regex]::Match($config, 'window\.ERECTION_PLANNER_API_BASE\s*=\s*"(https://[^"]+\.trycloudflare\.com)/api";')
  if ($configuredMatch.Success) { $configuredTunnel = $configuredMatch.Groups[1].Value }
  $tunnelHealthy = $false
  if ($tunnel -and $configuredTunnel) {
    try {
      $health = Invoke-WebRequest "$configuredTunnel/health" -UseBasicParsing -TimeoutSec 5
      $tunnelHealthy = $health.StatusCode -eq 200
    } catch { }
  }
  if ($tunnelHealthy) { Write-Host "Cloudflare tunnel already running and healthy; reusing process $($tunnel[0].Id)." }
  else {
    if ($tunnel) {
      Write-Host "Existing Cloudflare tunnel is stale; restarting it."
      $tunnel | Stop-Process -Force
    }
    Write-Host "No permanent API URL configured. Starting one temporary quick tunnel."
    Write-Host "For a permanent deployment, set ERECTION_PLANNER_API_BASE to your named tunnel URL."
    $tunnelOutLog = Join-Path $serverDir "quick-tunnel.out.log"
    $tunnelErrLog = Join-Path $serverDir "quick-tunnel.err.log"
    Remove-Item $tunnelOutLog, $tunnelErrLog -Force -ErrorAction SilentlyContinue
    Start-Process cloudflared -ArgumentList "tunnel --url http://localhost:$port" -WorkingDirectory $root -RedirectStandardOutput $tunnelOutLog -RedirectStandardError $tunnelErrLog
    $publicUrl = $null
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
      Start-Sleep -Milliseconds 500
      foreach ($log in @($tunnelOutLog, $tunnelErrLog)) {
        if (Test-Path $log) {
          try { $text = [string](Get-Content $log -Raw -ErrorAction Stop) } catch { $text = "" }
          if ($text.Length -gt 0) {
            $match = [regex]::Match($text, 'https://[a-z0-9-]+\.trycloudflare\.com')
            if ($match.Success) { $publicUrl = $match.Value; break }
          }
        }
      }
      if ($publicUrl) { break }
    }
    if (-not $publicUrl) { throw "Cloudflare tunnel did not provide a public URL. Check server/quick-tunnel.out.log and server/quick-tunnel.err.log." }
    $config = Get-Content $configPath -Raw
    $config = [regex]::Replace($config, 'window\.ERECTION_PLANNER_API_BASE\s*=\s*"[^"]*";', "window.ERECTION_PLANNER_API_BASE = `"$publicUrl/api`";")
    Set-Content -Path $configPath -Value $config -NoNewline
    Write-Host "Updated config.js to $publicUrl/api"
  }
}

Write-Host "Done. Keep this PowerShell window open while the local API/tunnel is needed."
