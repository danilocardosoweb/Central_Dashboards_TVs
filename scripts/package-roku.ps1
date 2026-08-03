param(
    [string]$SourceDirectory = "roku",
    [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $SourceDirectory))
$manifestPath = Join-Path $sourcePath "manifest"

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Manifesto Roku não encontrado em $sourcePath"
}

$versionLine = Get-Content -LiteralPath $manifestPath |
    Where-Object { $_ -match '^build_version=(\d+)\s*$' } |
    Select-Object -First 1

if (-not $versionLine -or $versionLine -notmatch '^build_version=(\d+)\s*$') {
    throw "build_version não encontrado no manifesto Roku."
}

$buildVersion = [int]$Matches[1]
if ([string]::IsNullOrWhiteSpace($OutputFile)) {
    $OutputFile = "dist/Central_Dashboard_Tvs_Roku_V_$buildVersion.zip"
}

$outputPath = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputFile))
$distPath = Split-Path -Parent $outputPath

New-Item -ItemType Directory -Force -Path $distPath | Out-Null
if (Test-Path -LiteralPath $outputPath) {
    Remove-Item -LiteralPath $outputPath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$archive = [System.IO.Compression.ZipFile]::Open(
    $outputPath,
    [System.IO.Compression.ZipArchiveMode]::Create
)

try {
    $files = Get-ChildItem -LiteralPath $sourcePath -File -Recurse -Force |
        Where-Object {
            $_.Name -notin @(
                "README.md",
                "bsconfig.json",
                "splash_hd.png",
                "splash_fhd.png",
                "splash_hd.jpg",
                "splash_fhd.jpg"
            )
        }

    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($sourcePath.Length)
        $relativePath = $relativePath.TrimStart([char[]]@('\', '/'))
        $entryName = $relativePath.Replace('\', '/')

        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $file.FullName,
            $entryName,
            [System.IO.Compression.CompressionLevel]::Optimal
        ) | Out-Null
    }
}
finally {
    $archive.Dispose()
}

Write-Output "Pacote Roku criado: $outputPath"
Write-Output "Versão do pacote: V_$buildVersion"
