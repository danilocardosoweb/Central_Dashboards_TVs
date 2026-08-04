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

$rendererKey = $keyMatch.Groups['value'].Value.Trim().Trim('"').Trim("'")
if ($rendererKey.StartsWith("sb_publishable_")) {
    throw "SUPABASE_RENDERER_KEY usa uma chave publica. Informe uma chave secreta sb_secret_ no arquivo .env."
}

if ($DashboardIds.Trim() -ne "") {
    $env:CAPTURE_ONLY_IDS = $DashboardIds.Trim()
}
$env:CAPTURE_MAX_DASHBOARDS = "0"
if ($Visible) {
    $env:CAPTURE_HEADLESS = "false"
}
else {
    $env:CAPTURE_HEADLESS = "true"
}

Push-Location $repositoryRoot
try {
    $dashboardExitCode = 0
    $pprExitCode = 0

    & npm.cmd run capture:once
    if ($LASTEXITCODE -ne 0) {
        $dashboardExitCode = $LASTEXITCODE
    }

    if ($env:CAPTURE_INCLUDE_PPR -ne "false") {
        & npm.cmd run capture:ppr
        if ($LASTEXITCODE -ne 0) {
            $pprExitCode = $LASTEXITCODE
        }
    }

    if ($dashboardExitCode -ne 0 -or $pprExitCode -ne 0) {
        throw "A captura local terminou com pendencias. Dashboards=$dashboardExitCode; PPR=$pprExitCode. Consulte as mensagens acima."
    }
}
finally {
    Pop-Location
}

Write-Host "Captura concluida. Dashboards e PPR foram enviados ao Supabase." -ForegroundColor Green
