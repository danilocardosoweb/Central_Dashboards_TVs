param(
    [string[]]$DeviceIps = @("192.168.0.195", "192.168.0.199", "192.168.0.148"),
    [double]$DurationHours = 24,
    [int]$IntervalSeconds = 30,
    [switch]$AutoRelaunch,
    [string]$OutputDirectory = "dist/soak-test"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$resolvedOutput = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputDirectory))
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

$startedAt = Get-Date
$endsAt = $startedAt.AddHours($DurationHours)
$stamp = $startedAt.ToString("yyyyMMdd-HHmmss")
$csvPath = Join-Path $resolvedOutput "roku-soak-$stamp.csv"
$summaryPath = Join-Path $resolvedOutput "roku-soak-$stamp-summary.txt"
$rows = [System.Collections.Generic.List[object]]::new()

function Read-ActiveApp([string]$deviceIp) {
    try {
        $response = Invoke-WebRequest -Uri "http://${deviceIp}:8060/query/active-app" -TimeoutSec 8 -UseBasicParsing
        [xml]$document = $response.Content
        $node = $document.'active-app'.app
        if ($null -eq $node) {
            return [pscustomobject]@{ Reachable = $true; Id = ""; Name = ""; Error = "active-app vazio" }
        }
        return [pscustomobject]@{
            Reachable = $true
            Id = [string]$node.id
            Name = [string]$node.'#text'
            Error = ""
        }
    }
    catch {
        return [pscustomobject]@{ Reachable = $false; Id = ""; Name = ""; Error = $_.Exception.Message }
    }
}

function Start-DeveloperApp([string]$deviceIp) {
    try {
        Invoke-WebRequest -Method Post -Uri "http://${deviceIp}:8060/launch/dev" -TimeoutSec 8 -UseBasicParsing | Out-Null
        return "relaunch-requested"
    }
    catch {
        return "relaunch-failed: $($_.Exception.Message)"
    }
}

Write-Host "Teste Roku iniciado em $($startedAt.ToString('s')). Termino previsto: $($endsAt.ToString('s'))."
Write-Host "O app de desenvolvimento deve aparecer como id 'dev'. Log: $csvPath"

while ((Get-Date) -lt $endsAt) {
    foreach ($deviceIp in $DeviceIps) {
        $sampledAt = Get-Date
        $active = Read-ActiveApp $deviceIp
        $isDashboard = $active.Reachable -and ($active.Id -eq "dev" -or $active.Name -like "*Central Dashboards*")
        $action = ""
        if (-not $isDashboard -and $AutoRelaunch -and $active.Reachable) {
            $action = Start-DeveloperApp $deviceIp
        }

        $row = [pscustomobject]@{
            Timestamp = $sampledAt.ToString("o")
            DeviceIp = $deviceIp
            Reachable = $active.Reachable
            DashboardActive = $isDashboard
            AppId = $active.Id
            AppName = $active.Name
            Action = $action
            Error = $active.Error
        }
        $rows.Add($row)
        $row | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8 -Append
        Write-Host ("{0} {1} online={2} dashboard={3} app={4} {5}" -f $sampledAt.ToString("HH:mm:ss"), $deviceIp, $active.Reachable, $isDashboard, $active.Id, $action)
    }
    Start-Sleep -Seconds ([Math]::Max(5, $IntervalSeconds))
}

$summaryLines = @(
    "Roku soak test",
    "Inicio: $($startedAt.ToString('o'))",
    "Fim: $((Get-Date).ToString('o'))",
    "Intervalo: $IntervalSeconds segundos",
    "Auto relaunch: $AutoRelaunch",
    ""
)

foreach ($deviceIp in $DeviceIps) {
    $deviceRows = @($rows | Where-Object DeviceIp -eq $deviceIp)
    $reachableCount = @($deviceRows | Where-Object Reachable).Count
    $activeCount = @($deviceRows | Where-Object DashboardActive).Count
    $summaryLines += "${deviceIp}: amostras=$($deviceRows.Count), alcancavel=$reachableCount, appAtivo=$activeCount, falhas=$($deviceRows.Count - $activeCount)"
}

$summaryLines | Set-Content -LiteralPath $summaryPath -Encoding UTF8
Write-Host "Teste concluido. Resumo: $summaryPath"
