param(
    [string]$SourceDirectory = "roku",
    [string]$OutputFile = "dist/Central_Dashboards_TVs_Roku.zip"
)

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $SourceDirectory))
$outputPath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputFile))
$distPath = Split-Path -Parent $outputPath

if (-not (Test-Path -LiteralPath (Join-Path $sourcePath "manifest"))) {
    throw "Manifesto Roku não encontrado em $sourcePath"
}

New-Item -ItemType Directory -Force -Path $distPath | Out-Null
if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
}

$content = Get-ChildItem -LiteralPath $sourcePath -Force |
    Where-Object { $_.Name -notin @("README.md", "bsconfig.json") }
Compress-Archive -Path $content.FullName -DestinationPath $outputPath -CompressionLevel Optimal

Write-Output "Pacote Roku criado: $outputPath"
