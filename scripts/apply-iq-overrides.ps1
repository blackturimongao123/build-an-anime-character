$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$charsPath = Join-Path $root "data\characters.json"
$iqPath = Join-Path $root "data\manual-iq-overrides.json"
$overrides = Get-Content $iqPath -Raw | ConvertFrom-Json
$text = [System.IO.File]::ReadAllText($charsPath)
$changed = 0
foreach ($prop in $overrides.PSObject.Properties) {
  $idEsc = [regex]::Escape($prop.Name)
  $iq = [int]$prop.Value
  if ($iq -lt 0) { $iq = 0 }
  if ($iq -gt 100) { $iq = 100 }
  $pattern = '(?s)("id":\s*"' + $idEsc + '"[\s\S]*?"iq":\s*)\d+'
  $evaluator = [System.Text.RegularExpressions.MatchEvaluator]{
    param($m)
    return $m.Groups[1].Value + $iq
  }
  $newText = [regex]::Replace($text, $pattern, $evaluator, 1)
  if ($newText -ne $text) {
    $changed++
    $text = $newText
  }
}
[System.IO.File]::WriteAllText($charsPath, $text, [System.Text.UTF8Encoding]::new($false))
Write-Host "Applied anime IQ overrides: $changed characters updated"
