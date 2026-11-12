$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$dataDir = Join-Path $root "data"

$characters = Get-Content (Join-Path $dataDir "characters.json") -Raw | ConvertFrom-Json
$overridesObj = Get-Content (Join-Path $dataDir "manual-iq-overrides.json") -Raw | ConvertFrom-Json
$proposalMd = Get-Content (Join-Path $dataDir "IQ_REVISION_PROPOSAL.md") -Raw -Encoding UTF8

$proposal = @{}
$section = ""
$anchorPat = [regex]'^\| `([^`]+)` \| (\d+) \| \*\*(\d+)\*\* \| ([^|]+) \|$'
$changePat = [regex]'^\| `([^`]+)` \| (\d+) \| \*\*(\d+)\*\* \| ([^|]+) \| (.+) \|$'

function Get-PipeCount([string]$s) {
  return ([regex]::Matches($s, '\|')).Count
}

foreach ($line in ($proposalMd -split "`n")) {
  if ($line -match '^## Anchor: (.+)') { $section = $Matches[1].Trim() }
  $trim = $line.TrimEnd("`r")
  if ((Get-PipeCount $trim) -eq 5) {
  $am = $anchorPat.Match($trim)
  if ($am.Success) {
    $id = $am.Groups[1].Value
    $proposal[$id] = @{
      was = [int]$am.Groups[2].Value
      proposed = [int]$am.Groups[3].Value
      why = $am.Groups[4].Value.Trim()
      anchor = $section
      pillars = $null
    }
    continue
  }
  }
  if ((Get-PipeCount $trim) -eq 6) {
  $cm = $changePat.Match($trim)
  if ($cm.Success) {
    $id = $cm.Groups[1].Value
    if (-not $proposal.ContainsKey($id)) {
      $proposal[$id] = @{
        was = [int]$cm.Groups[2].Value
        proposed = [int]$cm.Groups[3].Value
        pillars = $cm.Groups[4].Value.Trim()
        why = $cm.Groups[5].Value.Trim()
        anchor = $null
      }
    }
  }
  }
}

$roster = New-Object System.Collections.Generic.List[object]
foreach ($c in $characters) {
  $gameIq = if ($null -ne $c.stats.iq) { [int]$c.stats.iq } else { 40 }
  $overrideIq = $null
  if ($overridesObj.PSObject.Properties.Name -contains $c.id) {
    $overrideIq = [int]$overridesObj.($c.id)
  }
  $currentFromOverride = if ($null -ne $overrideIq) { $overrideIq } else { $gameIq }
  $p = $proposal[$c.id]
  $proposed = if ($p) { $p.proposed } else { $currentFromOverride }
  $was = if ($p) { $p.was } else { $currentFromOverride }
  if ($p) {
    $why = $p.why
  } elseif ($proposed -eq $currentFromOverride) {
    $why = "No change in revision proposal; keeping current curated / in-game IQ."
  } else {
    $why = "-"
  }
  $pillars = $null
  if ($p) {
    if ($p.pillars) { $pillars = $p.pillars }
    elseif ($p.anchor) { $pillars = ('Anchor: ' + $p.anchor) }
  }
  $roster.Add([pscustomobject]@{
      id         = $c.id
      name       = $c.displayName
      series     = if ($c.series) { [string]$c.series } else { "" }
      current    = $was
      gameIq     = $gameIq
      overrideIq = $overrideIq
      proposed   = $proposed
      pillars    = $pillars
      why        = $why
      changed    = ($proposed -ne $was)
    })
}

$rosterSorted = $roster | Sort-Object name
$rosterJson = ($rosterSorted | ConvertTo-Json -Depth 6 -Compress)
$framework = ($proposalMd -split "---", 2)[0].Trim()
$frameworkJson = ($framework | ConvertTo-Json -Compress)

$tplPath = Join-Path $PSScriptRoot "iq-revision-review.template.html"
$tpl = Get-Content $tplPath -Raw -Encoding UTF8
$html = $tpl.Replace("/*ROSTER_JSON*/", $rosterJson).Replace("/*FRAMEWORK_JSON*/", $frameworkJson)

$outPath = Join-Path $dataDir "iq-revision-review.html"
[System.IO.File]::WriteAllText($outPath, $html, [System.Text.UTF8Encoding]::new($true))
Write-Host ("Wrote {0} ({1} characters)" -f $outPath, $rosterSorted.Count)
