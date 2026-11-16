param(
  [int]$PortraitChunk = 20,
  [switch]$SkipScrape,
  [switch]$SkipPortraits
)
$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$nodeDir = Join-Path $env:LOCALAPPDATA "Programs\cursor\resources\app\resources\helpers"
$npmDir = Join-Path $env:APPDATA "npm"
foreach ($d in @($nodeDir, $npmDir)) {
  if (Test-Path $d) { $env:PATH = "$d;$env:PATH" }
}
Set-Location $root
$tsx = Join-Path $root "node_modules\tsx\dist\cli.mjs"

Write-Host "=== Build roster batch entries ==="
node scripts/curate/build-roster-batch2.mjs
& node $tsx scripts/curate/apply-roster-batch.ts

$newList = Join-Path $root "data\sources\roster-batch2-new-ids.txt"
if (-not (Test-Path $newList)) {
  Write-Host "No new ids — done."
  exit 0
}
$count = (Get-Content $newList | Where-Object { $_.Trim() }).Count
Write-Host "New characters: $count"

if (-not $SkipScrape) {
  Write-Host "=== Wiki full scrape (new ids only) ==="
  & node $tsx scripts/scrape/wiki-full-scrape.ts --ids-file data/sources/roster-batch2-new-ids.txt
}

if (-not $SkipPortraits) {
  Write-Host "=== Anime-Planet / AniList portraits ==="
  & node $tsx scripts/portraits/fetch-portraits-batch-file.ts data/sources/roster-batch2-new-ids.txt $PortraitChunk
}

Write-Host "=== Wiki apply + IQ + curated ==="
& node $tsx scripts/scrape/wiki-apply-from-db.ts
& node $tsx scripts/curate/apply-curated-stats.ts
& node $tsx scripts/curate/apply-iq-overrides.ts
& node $tsx scripts/validate/validate-characters.ts --allow-missing-portraits

Write-Host "Done."
