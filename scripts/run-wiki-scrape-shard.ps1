param(
  [Parameter(Mandatory = $true)][int] $Shard,
  [int] $ShardCount = 8
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$nodeDir = Join-Path $env:LOCALAPPDATA "Programs\cursor\resources\app\resources\helpers"
$npmDir = Join-Path $env:APPDATA "npm"
foreach ($d in @($nodeDir, $npmDir)) {
  if (Test-Path $d) { $env:PATH = "$d;$env:PATH" }
}
Set-Location $root
$tsx = Join-Path $root "scripts\node_modules\tsx\dist\cli.mjs"
if (-not (Test-Path $tsx)) {
  npm install --workspace=@build-character/scripts 2>&1 | Out-Host
}
node $tsx scripts/wiki-full-scrape.ts --shard $Shard --shards $ShardCount
