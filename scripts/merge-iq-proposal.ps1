$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$dataDir = Join-Path $root "data"
$overridesPath = Join-Path $dataDir "manual-iq-overrides.json"
$proposalMd = Get-Content (Join-Path $dataDir "IQ_REVISION_PROPOSAL.md") -Raw -Encoding UTF8

$overrides = Get-Content $overridesPath -Raw | ConvertFrom-Json
$ht = [ordered]@{}
$overrides.PSObject.Properties | ForEach-Object { $ht[$_.Name] = [int]$_.Value }

$anchorPat = [regex]'^\| `([^`]+)` \| (\d+) \| \*\*(\d+)\*\* \| ([^|]+) \|$'
$changePat = [regex]'^\| `([^`]+)` \| (\d+) \| \*\*(\d+)\*\* \| ([^|]+) \| (.+) \|$'
function Get-PipeCount([string]$s) { return ([regex]::Matches($s, '\|')).Count }

$patched = 0
foreach ($line in ($proposalMd -split "`n")) {
  $trim = $line.TrimEnd("`r")
  $m = $null
  if ((Get-PipeCount $trim) -eq 5) { $m = $anchorPat.Match($trim) }
  elseif ((Get-PipeCount $trim) -eq 6) { $m = $changePat.Match($trim) }
  if (-not $m.Success) { continue }
  $id = $m.Groups[1].Value
  $iq = [int]$m.Groups[3].Value
  $ht[$id] = $iq
  $patched++
}

$sorted = [ordered]@{}
$ht.Keys | Sort-Object | ForEach-Object { $sorted[$_] = $ht[$_] }
$json = ($sorted | ConvertTo-Json -Depth 3)
# ConvertFrom-Json output uses CRLF-friendly formatting
if (-not $json.EndsWith("`n")) { $json += "`n" }
[System.IO.File]::WriteAllText($overridesPath, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Updated $overridesPath ($patched proposal rows, $($sorted.Count) override ids)"
