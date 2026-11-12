param(
  [Parameter(Mandatory = $true)]
  [string]$ExportPath
)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$overridesPath = Join-Path $root "data\manual-iq-overrides.json"
$export = Get-Content $ExportPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $export.overrides) { throw "Export missing overrides object" }

$current = @{}
if (Test-Path $overridesPath) {
  $cur = Get-Content $overridesPath -Raw | ConvertFrom-Json
  $cur.PSObject.Properties | ForEach-Object { $current[$_.Name] = [int]$_.Value }
}
$merged = 0
$export.overrides.PSObject.Properties | ForEach-Object {
  $current[$_.Name] = [int]$_.Value
  $merged++
}
$sorted = [ordered]@{}
$current.Keys | Sort-Object | ForEach-Object { $sorted[$_] = $current[$_] }
$json = ($sorted | ConvertTo-Json -Depth 3)
if (-not $json.EndsWith("`n")) { $json += "`n" }
[System.IO.File]::WriteAllText($overridesPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Merged $merged ids from export into manual-iq-overrides.json ($($sorted.Count) total)"
