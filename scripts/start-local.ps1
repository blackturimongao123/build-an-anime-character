# Local playtest: shared build + WebSocket server + Vite client
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$nodeDir = Join-Path $env:LOCALAPPDATA "Programs\cursor\resources\app\resources\helpers"
$npmDir = Join-Path $env:APPDATA "npm"
$prepend = @()
if (Test-Path (Join-Path $nodeDir "node.exe")) { $prepend += $nodeDir }
if (Test-Path (Join-Path $npmDir "npm.cmd")) { $prepend += $npmDir }
if ($prepend.Count -gt 0) {
  $env:PATH = ($prepend -join ";") + ";" + $env:PATH
}
Set-Location $root

foreach ($port in 8781, 8081, 5173) {
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

npm run dev:local
