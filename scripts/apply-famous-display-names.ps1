$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$namesPath = Join-Path $root "data\famous-display-names.json"
$charsPath = Join-Path $root "data\characters.json"
$rosterPath = Join-Path $root "data\roster-expansion.json"

$raw = Get-Content $namesPath -Raw | ConvertFrom-Json
$text = [System.IO.File]::ReadAllText($charsPath)
$changed = 0
foreach ($prop in $raw.PSObject.Properties) {
  if ($prop.Name.StartsWith("_")) { continue }
  $idEsc = [regex]::Escape($prop.Name)
  $nameEsc = ($prop.Value -replace '\\', '\\\\') -replace '"', '\"'
  $pattern = '(?s)("displayName":\s*)"[^"]*"(\s*,\s*"id":\s*"' + $idEsc + '")'
  $evaluator = [System.Text.RegularExpressions.MatchEvaluator]{
    param($m)
    return $m.Groups[1].Value + '"' + $nameEsc + '"' + $m.Groups[2].Value
  }
  $newText = [regex]::Replace($text, $pattern, $evaluator, 1)
  if ($newText -ne $text) { $changed++; $text = $newText }
}
[System.IO.File]::WriteAllText($charsPath, $text, [System.Text.UTF8Encoding]::new($false))
Write-Host "Updated displayName on $changed characters in characters.json"

if (Test-Path $rosterPath) {
  $exp = Get-Content $rosterPath -Raw | ConvertFrom-Json
  $rChanged = 0
  foreach ($entry in $exp) {
    $id = $entry.id
    if ($raw.PSObject.Properties.Name -contains $id) {
      $next = $raw.$id
      if ($entry.displayName -ne $next) {
        $entry.displayName = $next
        $rChanged++
      }
    }
  }
  $json = $exp | ConvertTo-Json -Depth 10
  if (-not $json.EndsWith("`n")) { $json += "`n" }
  [System.IO.File]::WriteAllText($rosterPath, $json, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Updated displayName on $rChanged entries in roster-expansion.json"
}
