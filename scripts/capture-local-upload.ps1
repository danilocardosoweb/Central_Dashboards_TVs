param(
    [switch]$Visible,
    [string]$DashboardIds = ""
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$environmentPath = Join-Path $repositoryRoot ".env"
$examplePath = Join-Path $repositoryRoot ".env.capture.example"

if (-not (Test-Path -LiteralPath $environmentPath)) {
    Copy-Item -LiteralPath $examplePath -Destination $environmentPath
    throw "O arquivo .env foi criado. Abra-o, informe SUPABASE_RENDERER_KEY e execute novamente."
}

$environmentText = Get-Content -Raw -LiteralPath $environmentPath
$keyMatch = [regex]::Match(
    $environmentText,
    '(?m)^SUPABASE_RENDERER_KEY\s*=\s*(?<value>[^\r\n]+)'
)
if (-not $keyMatch.Success -or
    $keyMatch.Groups['value'].Value.Trim() -eq "" -or
    $keyMatch.Groups['value'].Value.Contains("COLE_A_CHAVE")) {
    throw "Preencha SUPABASE_RENDERER_KEY no arquivo .env antes de capturar."
}

if ($DashboardIds.Trim() -ne "") {
    $env:CAPTURE_ONLY_IDS = $DashboardIds.Trim()
}
$env:CAPTURE_MAX_DASHBOARDS = "0"
if ($Visible) {
    $env:CAPTURE_HEADLESS = "false"
}

Push-Location $repositoryRoot
try {
    & npm.cmd run capture:once
    if ($LASTEXITCODE -ne 0) {
        throw "A captura local terminou com erro. Consulte as mensagens acima."
    }
}
finally {
    Pop-Location
}

Write-Host "Captura concluida. As imagens e o estado foram enviados ao Supabase." -ForegroundColor Green
