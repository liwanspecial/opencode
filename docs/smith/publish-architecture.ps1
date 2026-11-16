param(
  [string]$DocId,
  [int]$Start = 1,
  [int]$End = 14
)
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$sourcePath = Join-Path $PSScriptRoot 'architecture-v0.2.xml'
[xml]$source = '<document>' + (Get-Content -LiteralPath $sourcePath -Raw -Encoding utf8) + '</document>'
$nodes = @($source.document.ChildNodes | Where-Object { $_.NodeType -eq 'Element' })

function Invoke-LarkJson([string[]]$CliArguments, [string]$Body) {
  $raw = if ($Body) { $Body | & lark-cli @CliArguments } else { & lark-cli @CliArguments }
  if ($LASTEXITCODE -ne 0) { throw ($raw -join "`n") }
  $response = ($raw -join "`n") | ConvertFrom-Json
  if (-not $response.ok) { throw ($raw -join "`n") }
  if ($response.data.result -and $response.data.result -ne 'success') { throw ($raw -join "`n") }
  return $response
}

if (-not $DocId) {
  $skeleton = [System.Collections.Generic.List[string]]::new()
  $inSection = $false
  foreach ($node in $nodes) {
    if ($node.Name -eq 'h1') { $inSection = $true; $skeleton.Add($node.OuterXml) }
    elseif (-not $inSection) { $skeleton.Add($node.OuterXml) }
  }
  $created = Invoke-LarkJson -CliArguments @('docs','+create','--content','-','--as','user') -Body ($skeleton -join "`n")
  $created | ConvertTo-Json -Depth 30
  exit 0
}

$outline = Invoke-LarkJson -CliArguments @('docs','+fetch','--doc',$DocId,'--scope','outline','--max-depth','1','--detail','with-ids','--as','user')
[xml]$headings = $outline.data.document.content
$anchors = @{}
foreach ($heading in $headings.SelectNodes('//h1')) { $anchors[$heading.InnerText] = $heading.GetAttribute('id') }
$section = 0
$headingText = ''
$chunks = [System.Collections.Generic.List[object]]::new()
$body = [System.Collections.Generic.List[string]]::new()
foreach ($node in $nodes) {
  if ($node.Name -eq 'h1') {
    if ($section -gt 0) { $chunks.Add(@{Number=$section; Heading=$headingText; Content=($body -join "`n")}) }
    $section++
    $headingText = $node.InnerText
    $body = [System.Collections.Generic.List[string]]::new()
  } elseif ($section -gt 0) { $body.Add($node.OuterXml) }
}
$chunks.Add(@{Number=$section; Heading=$headingText; Content=($body -join "`n")})
foreach ($chunk in $chunks | Where-Object { $_.Number -ge $Start -and $_.Number -le $End }) {
  $anchor = $anchors[$chunk.Heading]
  if (-not $anchor) { throw "Missing heading: $($chunk.Heading)" }
  $existing = Invoke-LarkJson -CliArguments @('docs','+fetch','--doc',$DocId,'--scope','section','--start-block-id',$anchor,'--detail','simple','--as','user')
  [xml]$existingXml = $existing.data.document.content
  $elements = @($existingXml.DocumentElement.ChildNodes | Where-Object { $_.NodeType -eq 'Element' })
  if ($elements.Count -ne 1 -or $elements[0].Name -ne 'h1') {
    throw "Section already contains content; refusing duplicate insertion: $($chunk.Heading)"
  }
  $result = Invoke-LarkJson -CliArguments @('docs','+update','--doc',$DocId,'--command','block_insert_after','--block-id',$anchor,'--content','-','--as','user') -Body $chunk.Content
  @{section=$chunk.Number;heading=$chunk.Heading;result=$result.data.result;document=$result.data.document;warnings=$result.data.warnings} | ConvertTo-Json -Depth 15 -Compress
}
