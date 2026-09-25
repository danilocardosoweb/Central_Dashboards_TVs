param(
    [string]$ConfigFile = (Join-Path $PSScriptRoot "roku-tv-monitor.config.json"),
    [switch]$SelfTest
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ConfigFile)) {
    throw "Arquivo de configuracao nao encontrado: $ConfigFile"
}

$configJson = Get-Content -LiteralPath $ConfigFile -Raw -Encoding UTF8
$config = $configJson | ConvertFrom-Json
$projectRoot = Split-Path -Parent $PSScriptRoot
$emergencyServerScript = Join-Path $PSScriptRoot "emergency-server.mjs"
$preferredEmergencyMediaRoot = Join-Path $env:USERPROFILE "Desktop\apps\Central_Dashboards_TVs-ppr-fix\emergency-media"
$preferredHasMedia = (Test-Path -LiteralPath $preferredEmergencyMediaRoot) -and @(
    Get-ChildItem -LiteralPath $preferredEmergencyMediaRoot -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -match '^\.(mp4|png|jpe?g|webp)$' }
).Count -gt 0
$emergencyMediaRoot = if ($preferredHasMedia) { $preferredEmergencyMediaRoot } else { Join-Path $projectRoot "emergency-media" }

$probeSource = @'
param([string]$ConfigurationJson)

$configuration = $ConfigurationJson | ConvertFrom-Json
$expectedIds = @($configuration.expectedAppIds | ForEach-Object { [string]$_ })
$expectedTitles = @($configuration.expectedTitles | ForEach-Object { [string]$_ })

foreach ($station in @($configuration.stations)) {
    $started = Get-Date
    $ip = [string]$station.ip
    $reachable = $false
    $activeId = ""
    $activeName = ""
    $launchId = ""
    $errorMessage = ""

    try {
        $activeResponse = Invoke-WebRequest -Uri "http://${ip}:8060/query/active-app" -TimeoutSec 4 -UseBasicParsing
        [xml]$activeDocument = $activeResponse.Content
        $activeNode = $activeDocument.'active-app'.app
        $reachable = $true
        if ($null -ne $activeNode) {
            $activeId = [string]$activeNode.id
            $activeName = [string]$activeNode.'#text'
        }

        try {
            $appsResponse = Invoke-WebRequest -Uri "http://${ip}:8060/query/apps" -TimeoutSec 4 -UseBasicParsing
            [xml]$appsDocument = $appsResponse.Content
            foreach ($app in @($appsDocument.apps.app)) {
                $appId = [string]$app.id
                $appName = [string]$app.'#text'
                $idMatch = $expectedIds -contains $appId
                $titleMatch = $false
                foreach ($title in $expectedTitles) {
                    if ($appName -like "*${title}*") { $titleMatch = $true; break }
                }
                if ($idMatch -or $titleMatch) { $launchId = $appId; break }
            }
        }
        catch {
            if ($expectedIds -contains "dev") { $launchId = "dev" }
        }
    }
    catch {
        $errorMessage = $_.Exception.Message
    }

    $titleIsExpected = $false
    foreach ($title in $expectedTitles) {
        if ($activeName -like "*${title}*") { $titleIsExpected = $true; break }
    }
    $playerActive = $reachable -and (($expectedIds -contains $activeId) -or $titleIsExpected)
    $state = if (-not $reachable) { "offline" } elseif ($playerActive) { "active" } else { "other" }

    [pscustomobject]@{
        Name = [string]$station.name
        Sector = [string]$station.sector
        Ip = $ip
        State = $state
        Reachable = $reachable
        PlayerActive = $playerActive
        ActiveId = $activeId
        ActiveName = $activeName
        LaunchId = $launchId
        Error = $errorMessage
        LatencyMs = [Math]::Round(((Get-Date) - $started).TotalMilliseconds)
        CheckedAt = (Get-Date).ToString("o")
    }
}
'@

if ($SelfTest) {
    $probe = [scriptblock]::Create($probeSource)
    $results = @(& $probe $configJson)
    foreach ($result in $results) {
        "{0} | {1} | {2} | app={3} ({4}) | {5}ms" -f $result.Name, $result.Ip, $result.State, $result.ActiveName, $result.ActiveId, $result.LatencyMs
    }
    exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$colors = @{
    Window = [System.Drawing.Color]::FromArgb(12, 18, 32)
    Surface = [System.Drawing.Color]::FromArgb(23, 32, 51)
    SurfaceAlt = [System.Drawing.Color]::FromArgb(29, 41, 64)
    Border = [System.Drawing.Color]::FromArgb(55, 72, 101)
    Text = [System.Drawing.Color]::FromArgb(241, 245, 249)
    Muted = [System.Drawing.Color]::FromArgb(148, 163, 184)
    Blue = [System.Drawing.Color]::FromArgb(59, 130, 246)
    Green = [System.Drawing.Color]::FromArgb(34, 197, 94)
    Yellow = [System.Drawing.Color]::FromArgb(245, 158, 11)
    Red = [System.Drawing.Color]::FromArgb(239, 68, 68)
}

function New-Label {
    param([string]$Text, [float]$Size = 10, [System.Drawing.FontStyle]$Style = [System.Drawing.FontStyle]::Regular)
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Text
    $label.Font = New-Object System.Drawing.Font("Segoe UI", $Size, $Style)
    $label.ForeColor = $colors.Text
    $label.AutoSize = $true
    return $label
}

function New-Button {
    param([string]$Text, [System.Drawing.Color]$BackColor)
    $button = New-Object System.Windows.Forms.Button
    $button.Text = $Text
    $button.Font = New-Object System.Drawing.Font("Segoe UI Semibold", 9)
    $button.ForeColor = [System.Drawing.Color]::White
    $button.BackColor = $BackColor
    $button.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $button.FlatAppearance.BorderSize = 0
    $button.Cursor = [System.Windows.Forms.Cursors]::Hand
    $button.Size = New-Object System.Drawing.Size(120, 34)
    return $button
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Monitor das TVs Roku"
$form.Size = New-Object System.Drawing.Size(1040, 760)
$form.MinimumSize = New-Object System.Drawing.Size(850, 500)
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.BackColor = $colors.Window
$form.ForeColor = $colors.Text
$form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

$header = New-Object System.Windows.Forms.Panel
$header.Dock = [System.Windows.Forms.DockStyle]::Top
$header.Height = 142
$header.BackColor = $colors.Surface
$form.Controls.Add($header)

$title = New-Label "Monitor das TVs Roku" 22 ([System.Drawing.FontStyle]::Bold)
$title.Location = New-Object System.Drawing.Point(28, 18)
$header.Controls.Add($title)

$subtitle = New-Label "Situacao real do player em cada TV da fabrica" 10
$subtitle.ForeColor = $colors.Muted
$subtitle.Location = New-Object System.Drawing.Point(31, 59)
$header.Controls.Add($subtitle)

$refreshButton = New-Button "Atualizar agora" $colors.Blue
$refreshButton.Size = New-Object System.Drawing.Size(142, 38)
$refreshButton.Anchor = [System.Windows.Forms.AnchorStyles]::Top -bor [System.Windows.Forms.AnchorStyles]::Right
$refreshButton.Location = New-Object System.Drawing.Point(870, 26)
$header.Controls.Add($refreshButton)

$emergencyButton = New-Button "Iniciar emergencia" $colors.Yellow
$emergencyButton.Size = New-Object System.Drawing.Size(160, 34)
$emergencyButton.Location = New-Object System.Drawing.Point(430, 89)
$emergencyButton.Anchor = [System.Windows.Forms.AnchorStyles]::Top -bor [System.Windows.Forms.AnchorStyles]::Left
$header.Controls.Add($emergencyButton)

$emergencyFolderButton = New-Button "Abrir pasta de mídia" $colors.SurfaceAlt
$emergencyFolderButton.Size = New-Object System.Drawing.Size(160, 34)
$emergencyFolderButton.Location = New-Object System.Drawing.Point(595, 89)
$emergencyFolderButton.Anchor = [System.Windows.Forms.AnchorStyles]::Top -bor [System.Windows.Forms.AnchorStyles]::Left
$header.Controls.Add($emergencyFolderButton)

$emergencyStatus = New-Label "Emergência local parada" 8
$emergencyStatus.ForeColor = $colors.Muted
$emergencyStatus.Location = New-Object System.Drawing.Point(765, 99)
$emergencyStatus.AutoSize = $false
$emergencyStatus.Size = New-Object System.Drawing.Size(240, 22)
$header.Controls.Add($emergencyStatus)

$lastUpdate = New-Label "Aguardando primeira leitura..." 9
$lastUpdate.ForeColor = $colors.Muted
$lastUpdate.AutoSize = $false
$lastUpdate.Size = New-Object System.Drawing.Size(350, 22)
$lastUpdate.TextAlign = [System.Drawing.ContentAlignment]::MiddleRight
$lastUpdate.Anchor = [System.Windows.Forms.AnchorStyles]::Top -bor [System.Windows.Forms.AnchorStyles]::Right
$lastUpdate.Location = New-Object System.Drawing.Point(660, 72)
$header.Controls.Add($lastUpdate)

$globalRecoveryCheck = New-Object System.Windows.Forms.CheckBox
$globalRecoveryCheck.Text = "Reabertura automatica"
$globalRecoveryCheck.Checked = [bool]$config.autoRecovery
$globalRecoveryCheck.AutoSize = $true
$globalRecoveryCheck.ForeColor = $colors.Text
$globalRecoveryCheck.BackColor = $colors.Surface
$globalRecoveryCheck.Location = New-Object System.Drawing.Point(28, 91)
$globalRecoveryCheck.Cursor = [System.Windows.Forms.Cursors]::Hand
$header.Controls.Add($globalRecoveryCheck)

$minimalCheck = New-Object System.Windows.Forms.CheckBox
$minimalCheck.Text = "Modo minimalista (ocultar historico)"
$minimalCheck.AutoSize = $true
$minimalCheck.ForeColor = $colors.Muted
$minimalCheck.BackColor = $colors.Surface
$minimalCheck.Location = New-Object System.Drawing.Point(220, 91)
$minimalCheck.Cursor = [System.Windows.Forms.Cursors]::Hand
$header.Controls.Add($minimalCheck)

$summary = New-Object System.Windows.Forms.Panel
$summary.Dock = [System.Windows.Forms.DockStyle]::Top
$summary.Height = 54
$summary.BackColor = $colors.Window
$form.Controls.Add($summary)
$summary.BringToFront()

$summaryLabels = @{}
$summaryX = 28
foreach ($item in @(
    @{ Key = "active"; Text = "PLAYER ATIVO: 0"; Color = $colors.Green },
    @{ Key = "other"; Text = "OUTRO APP: 0"; Color = $colors.Yellow },
    @{ Key = "offline"; Text = "SEM COMUNICACAO: 0"; Color = $colors.Red }
)) {
    $badge = New-Label $item.Text 9 ([System.Drawing.FontStyle]::Bold)
    $badge.ForeColor = $item.Color
    $badge.Location = New-Object System.Drawing.Point($summaryX, 17)
$summary.Controls.Add($badge)
    $summaryLabels[$item.Key] = $badge
    $summaryX += 180
}

$alertBanner = New-Object System.Windows.Forms.Panel
$alertBanner.Dock = [System.Windows.Forms.DockStyle]::Top
$alertBanner.Height = 42
$alertBanner.BackColor = [System.Drawing.Color]::FromArgb(127, 29, 29)
$alertBanner.Visible = $false
$form.Controls.Add($alertBanner)
$alertBanner.BringToFront()
$alertText = New-Label "" 10 ([System.Drawing.FontStyle]::Bold)
$alertText.Location = New-Object System.Drawing.Point(28, 11)
$alertBanner.Controls.Add($alertText)

$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$notifyIcon.Icon = [System.Drawing.SystemIcons]::Warning
$notifyIcon.Visible = $true
$notifyIcon.Text = "Monitor das TVs Roku"

$logPanel = New-Object System.Windows.Forms.Panel
$logPanel.Dock = [System.Windows.Forms.DockStyle]::Bottom
$logPanel.Height = 175
$logPanel.Padding = New-Object System.Windows.Forms.Padding(24, 8, 24, 18)
$logPanel.BackColor = $colors.Surface
$form.Controls.Add($logPanel)

$logTitle = New-Label "Historico de verificacoes" 10 ([System.Drawing.FontStyle]::Bold)
$logTitle.Dock = [System.Windows.Forms.DockStyle]::Top
$logTitle.Height = 28
$logTitle.AutoSize = $false
$logPanel.Controls.Add($logTitle)

$logBox = New-Object System.Windows.Forms.RichTextBox
$logBox.Dock = [System.Windows.Forms.DockStyle]::Fill
$logBox.ReadOnly = $true
$logBox.BorderStyle = [System.Windows.Forms.BorderStyle]::None
$logBox.BackColor = $colors.Surface
$logBox.ForeColor = $colors.Muted
$logBox.Font = New-Object System.Drawing.Font("Consolas", 9)
$logPanel.Controls.Add($logBox)
$logBox.BringToFront()

$cardsPanel = New-Object System.Windows.Forms.FlowLayoutPanel
$cardsPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
$cardsPanel.FlowDirection = [System.Windows.Forms.FlowDirection]::TopDown
$cardsPanel.WrapContents = $false
$cardsPanel.AutoScroll = $true
$cardsPanel.Padding = New-Object System.Windows.Forms.Padding(24, 10, 24, 18)
$cardsPanel.BackColor = $colors.Window
$form.Controls.Add($cardsPanel)
$cardsPanel.BringToFront()

$cards = @{}
$script:lastStates = @{}
$script:recovery = @{}
$script:launchTasks = @()
$script:emergencyProcess = $null
$autoRecovery = [bool]$config.autoRecovery
$globalRecoveryEnabled = [bool]$config.autoRecovery
$recoveryCooldown = [Math]::Max(15, [int]$config.recoveryCooldownSeconds)
$maxRecoveryAttempts = [Math]::Max(1, [int]$config.maxRecoveryAttempts)
$minimalMode = $false
if ($config.PSObject.Properties.Name -contains "ui" -and $null -ne $config.ui) {
    $minimalMode = [bool]$config.ui.minimal
}

function Ensure-Property($object, [string]$name, $value) {
    if ($object.PSObject.Properties.Name -contains $name) { $object.$name = $value }
    else { $object | Add-Member -MemberType NoteProperty -Name $name -Value $value }
}

foreach ($station in @($config.stations)) {
    if ($station.PSObject.Properties.Name -contains "autoRecovery") {
        $station.autoRecovery = [bool]$station.autoRecovery
    } else {
        Ensure-Property $station "autoRecovery" $globalRecoveryEnabled
    }
}

function Save-MonitorConfig {
    try {
        Ensure-Property $config "ui" ([pscustomobject]@{ minimal = $minimalMode })
        $config.ui.minimal = [bool]$minimalMode
        $config.autoRecovery = [bool]$globalRecoveryEnabled
        $json = $config | ConvertTo-Json -Depth 8
        Set-Content -LiteralPath $ConfigFile -Value $json -Encoding UTF8
    } catch {
        Write-MonitorLog "Nao foi possivel salvar as preferencias: $($_.Exception.Message)"
    }
}

function Test-EmergencyServer {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8787/emergency.json" -TimeoutSec 1 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch { return $false }
}

function Set-EmergencyStatus([string]$message, [System.Drawing.Color]$color = $colors.Muted) {
    $emergencyStatus.Text = $message
    $emergencyStatus.ForeColor = $color
}

function Start-EmergencyServer {
    if (-not (Test-Path -LiteralPath $emergencyServerScript)) {
        Set-EmergencyStatus "Servidor local não encontrado" $colors.Red
        [System.Windows.Forms.MessageBox]::Show("O servidor emergencial não foi encontrado em $emergencyServerScript.", "Emergência local") | Out-Null
        return
    }
    if (-not (Test-Path -LiteralPath $emergencyMediaRoot)) {
        New-Item -ItemType Directory -Path $emergencyMediaRoot -Force | Out-Null
    }
    if (Test-EmergencyServer) {
        $emergencyButton.Text = "Parar emergência"
        $emergencyButton.BackColor = $colors.Red
        Set-EmergencyStatus "Servidor local já estava ativo" $colors.Green
        return
    }
    try {
        $node = Get-Command node.exe -ErrorAction Stop
        $previousEmergencyRoot = $env:EMERGENCY_MEDIA_ROOT
        $env:EMERGENCY_MEDIA_ROOT = $emergencyMediaRoot
        try {
            $script:emergencyProcess = Start-Process -FilePath $node.Source -ArgumentList @($emergencyServerScript) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
        } finally {
            if ($null -eq $previousEmergencyRoot) { Remove-Item Env:EMERGENCY_MEDIA_ROOT -ErrorAction SilentlyContinue } else { $env:EMERGENCY_MEDIA_ROOT = $previousEmergencyRoot }
        }
        Start-Sleep -Milliseconds 350
        $emergencyButton.Text = "Parar emergência"
        $emergencyButton.BackColor = $colors.Red
        if (Test-EmergencyServer) {
            Set-EmergencyStatus "Servidor ativo • porta 8787" $colors.Green
            Write-MonitorLog "Servidor emergencial local iniciado na porta 8787."
        } else {
            Set-EmergencyStatus "Iniciando servidor local..." $colors.Yellow
        }
    } catch {
        Set-EmergencyStatus "Falha ao iniciar servidor" $colors.Red
        [System.Windows.Forms.MessageBox]::Show("Não foi possível iniciar o servidor emergencial: $($_.Exception.Message)", "Emergência local") | Out-Null
    }
}

function Stop-EmergencyServer {
    if ($null -ne $script:emergencyProcess) {
        try {
            if (-not $script:emergencyProcess.HasExited) { Stop-Process -Id $script:emergencyProcess.Id -Force }
        } catch {}
        $script:emergencyProcess = $null
    }
    $emergencyButton.Text = "Iniciar emergência"
    $emergencyButton.BackColor = $colors.Yellow
    Set-EmergencyStatus "Emergência local parada" $colors.Muted
    Write-MonitorLog "Servidor emergencial local parado."
}

$emergencyButton.Add_Click({
    if ($null -ne $script:emergencyProcess -and -not $script:emergencyProcess.HasExited) { Stop-EmergencyServer } else { Start-EmergencyServer }
})
$emergencyFolderButton.Add_Click({
    if (-not (Test-Path -LiteralPath $emergencyMediaRoot)) { New-Item -ItemType Directory -Path $emergencyMediaRoot -Force | Out-Null }
    Start-Process explorer.exe -ArgumentList "`"$emergencyMediaRoot`""
})
$launchSource = @'
param([string]$Ip, [string]$LaunchId)
try {
    Invoke-WebRequest -Method Post -Uri "http://${Ip}:8060/launch/${LaunchId}" -TimeoutSec 5 -UseBasicParsing | Out-Null
    [pscustomobject]@{ Success = $true; Ip = $Ip; Error = "" }
}
catch {
    [pscustomobject]@{ Success = $false; Ip = $Ip; Error = $_.Exception.Message }
}
'@
$launchHandler = {
    $data = $this.Tag
    if (-not $data.LaunchId) {
        [System.Windows.Forms.MessageBox]::Show("O canal do player nao foi encontrado nesta TV.", "Player nao encontrado") | Out-Null
        return
    }
    try {
        Invoke-WebRequest -Method Post -Uri "http://$($data.Ip):8060/launch/$($data.LaunchId)" -TimeoutSec 5 -UseBasicParsing | Out-Null
        $logBox.AppendText("[$((Get-Date).ToString('HH:mm:ss'))] Solicitado inicio do player em $($data.Ip).`r`n")
    }
    catch {
        [System.Windows.Forms.MessageBox]::Show("Nao foi possivel iniciar o player: $($_.Exception.Message)", "Falha de comunicacao") | Out-Null
    }
}

function Request-PlayerLaunch([string]$ip, [string]$launchId, [string]$reason) {
    if ([string]::IsNullOrWhiteSpace($launchId)) { return $false }
    if ($script:launchTasks | Where-Object { $_.Ip -eq $ip }) { return $false }
    $powerShell = [System.Management.Automation.PowerShell]::Create()
    $null = $powerShell.AddScript($launchSource).AddArgument($ip).AddArgument($launchId)
    $script:launchTasks += [pscustomobject]@{
        Ip = $ip; Reason = $reason; PowerShell = $powerShell; Handle = $powerShell.BeginInvoke()
    }
    Write-MonitorLog "Solicitando abertura automatica em $ip ($reason)."
    return $true
}

function Complete-Launches {
    foreach ($task in @($script:launchTasks)) {
        if (-not $task.Handle.IsCompleted) { continue }
        try {
            $result = @($task.PowerShell.EndInvoke($task.Handle)) | Select-Object -First 1
            if ($result.Success) {
                Write-MonitorLog "Abertura solicitada com sucesso em $($task.Ip)."
            } else {
                Write-MonitorLog "Falha ao reabrir $($task.Ip): $($result.Error)"
            }
        } catch { Write-MonitorLog "Falha no retorno da abertura em $($task.Ip): $($_.Exception.Message)" }
        finally { $task.PowerShell.Dispose(); $script:launchTasks = @($script:launchTasks | Where-Object { $_ -ne $task }) }
    }
}

$adminHandler = {
    Start-Process "http://$($this.Tag)"
}

foreach ($station in @($config.stations)) {
    $card = New-Object System.Windows.Forms.Panel
    $card.Width = 955
    $card.Height = 158
    $card.Margin = New-Object System.Windows.Forms.Padding(0, 0, 0, 12)
    $card.Padding = New-Object System.Windows.Forms.Padding(18)
    $card.BackColor = $colors.Surface

    $indicator = New-Object System.Windows.Forms.Panel
    $indicator.Location = New-Object System.Drawing.Point(0, 0)
    $indicator.Size = New-Object System.Drawing.Size(7, 158)
    $indicator.BackColor = $colors.Muted
    $card.Controls.Add($indicator)

    $name = New-Label ([string]$station.name) 14 ([System.Drawing.FontStyle]::Bold)
    $name.Location = New-Object System.Drawing.Point(25, 17)
    $card.Controls.Add($name)

    $details = New-Label ("{0}  |  {1}" -f $station.sector, $station.ip) 9
    $details.ForeColor = $colors.Muted
    $details.Location = New-Object System.Drawing.Point(27, 49)
    $card.Controls.Add($details)

    $stateLabel = New-Label "VERIFICANDO..." 11 ([System.Drawing.FontStyle]::Bold)
    $stateLabel.ForeColor = $colors.Muted
    $stateLabel.Location = New-Object System.Drawing.Point(27, 78)
    $card.Controls.Add($stateLabel)

    $appLabel = New-Label "Consultando o Roku pela rede local" 9
    $appLabel.ForeColor = $colors.Muted
    $appLabel.Location = New-Object System.Drawing.Point(190, 81)
    $card.Controls.Add($appLabel)

    $launchButton = New-Button "Abrir player" $colors.Blue
    $launchButton.Anchor = [System.Windows.Forms.AnchorStyles]::Top -bor [System.Windows.Forms.AnchorStyles]::Right
    $launchButton.Location = New-Object System.Drawing.Point(685, 48)
    $launchButton.Enabled = $false
    $launchButton.Tag = [pscustomobject]@{ Ip = [string]$station.ip; LaunchId = "" }
    $launchButton.Add_Click($launchHandler)
    $card.Controls.Add($launchButton)

    $adminButton = New-Button "Painel Roku" $colors.SurfaceAlt
    $adminButton.Anchor = [System.Windows.Forms.AnchorStyles]::Top -bor [System.Windows.Forms.AnchorStyles]::Right
    $adminButton.Location = New-Object System.Drawing.Point(815, 48)
    $adminButton.Tag = [string]$station.ip
    $adminButton.Add_Click($adminHandler)
    $card.Controls.Add($adminButton)

    $recoveryCheck = New-Object System.Windows.Forms.CheckBox
    $recoveryCheck.Text = "Reabrir automaticamente nesta TV"
    $recoveryCheck.Checked = [bool]$station.autoRecovery
    $recoveryCheck.AutoSize = $true
    $recoveryCheck.ForeColor = $colors.Muted
    $recoveryCheck.Location = New-Object System.Drawing.Point(27, 111)
    $recoveryCheck.Cursor = [System.Windows.Forms.Cursors]::Hand
    $recoveryCheck.Tag = $station
    $card.Controls.Add($recoveryCheck)
    $recoveryCheck.Add_CheckedChanged({
        $stationRef = $this.Tag
        $stationRef.autoRecovery = [bool]$this.Checked
        Save-MonitorConfig
        Write-MonitorLog ("Reabertura automatica {0} para {1}." -f ($(if ($this.Checked) { "ativada" } else { "desativada" }), $stationRef.name))
    })

    $cardsPanel.Controls.Add($card)
    $cards[[string]$station.ip] = [pscustomobject]@{
        Panel = $card
        Indicator = $indicator
        State = $stateLabel
        App = $appLabel
        Launch = $launchButton
        Recovery = $recoveryCheck
    }
}

function Write-MonitorLog([string]$message) {
    $logBox.AppendText("[$((Get-Date).ToString('HH:mm:ss'))] $message`r`n")
    $logBox.SelectionStart = $logBox.TextLength
    $logBox.ScrollToCaret()
}

function Resize-Cards {
    $targetWidth = [Math]::Max(760, $cardsPanel.ClientSize.Width - 52)
    foreach ($entry in $cards.Values) { $entry.Panel.Width = $targetWidth }
    $refreshButton.Left = $header.ClientSize.Width - $refreshButton.Width - 28
    $lastUpdate.Left = $header.ClientSize.Width - $lastUpdate.Width - 28
}
$form.Add_Resize({ Resize-Cards })

function Set-MinimalMode([bool]$enabled) {
    $minimalMode = $enabled
    $logPanel.Visible = -not $enabled
    if ($enabled) {
        # Mantem os tres cartoes padrao visiveis sem forcar a barra vertical.
        $form.Height = 760
        $logPanel.Height = 1
    } else {
        $form.Height = 760
        $logPanel.Height = 175
    }
    Save-MonitorConfig
    if ($enabled) {
        $modeMessage = "Modo minimalista ativado; historico oculto."
    } else {
        $modeMessage = "Modo completo ativado; historico visivel."
    }
    Write-MonitorLog $modeMessage
}

$globalRecoveryCheck.Add_CheckedChanged({
    $globalRecoveryEnabled = [bool]$this.Checked
    $autoRecovery = $globalRecoveryEnabled
    foreach ($station in @($config.stations)) {
        $station.autoRecovery = $globalRecoveryEnabled
    }
    foreach ($entry in $cards.Values) {
        $entry.Recovery.Checked = $globalRecoveryEnabled
    }
    Save-MonitorConfig
    Write-MonitorLog ("Reabertura automatica geral {0}." -f ($(if ($globalRecoveryEnabled) { "ativada" } else { "desativada" })))
})

$minimalCheck.Checked = $minimalMode
$minimalCheck.Add_CheckedChanged({ Set-MinimalMode ([bool]$this.Checked) })

$script:probeTask = $null
$script:nextRefresh = Get-Date
$refreshSeconds = [Math]::Max(5, [int]$config.refreshSeconds)

function Start-Probe {
    if ($null -ne $script:probeTask) { return }
    $refreshButton.Enabled = $false
    $refreshButton.Text = "Consultando..."
    $powerShell = [System.Management.Automation.PowerShell]::Create()
    $null = $powerShell.AddScript($probeSource).AddArgument($configJson)
    $script:probeTask = [pscustomobject]@{
        PowerShell = $powerShell
        Handle = $powerShell.BeginInvoke()
    }
}

function Complete-Probe {
    if ($null -eq $script:probeTask -or -not $script:probeTask.Handle.IsCompleted) { return }
    try {
        $results = @($script:probeTask.PowerShell.EndInvoke($script:probeTask.Handle))
        $counts = @{ active = 0; other = 0; offline = 0 }
        foreach ($result in $results) {
            if (-not $cards.ContainsKey([string]$result.Ip)) { continue }
            $card = $cards[[string]$result.Ip]
            $counts[[string]$result.State]++
            if ($result.State -eq "active") {
                $card.Indicator.BackColor = $colors.Green
                $card.State.ForeColor = $colors.Green
                $card.State.Text = "PLAYER ATIVO"
                $card.App.Text = "Exibindo: $($result.ActiveName)  |  resposta em $($result.LatencyMs) ms"
            }
            elseif ($result.State -eq "other") {
                $card.Indicator.BackColor = $colors.Yellow
                $card.State.ForeColor = $colors.Yellow
                $card.State.Text = "OUTRO APP ABERTO"
                $shownApp = if ($result.ActiveName) { $result.ActiveName } else { "Tela inicial do Roku" }
                $card.App.Text = "Exibindo: $shownApp  |  resposta em $($result.LatencyMs) ms"
            }
            else {
                $card.Indicator.BackColor = $colors.Red
                $card.State.ForeColor = $colors.Red
                $card.State.Text = "SEM COMUNICACAO"
                $card.App.Text = "TV desligada, fora da rede ou porta 8060 indisponivel"
            }
            $card.App.ForeColor = $colors.Muted
            $card.Launch.Tag = [pscustomobject]@{ Ip = [string]$result.Ip; LaunchId = [string]$result.LaunchId }
            $card.Launch.Enabled = $result.Reachable -and [bool]$result.LaunchId
            Write-MonitorLog ("{0}: {1}; app='{2}' id={3}" -f $result.Name, $result.State, $result.ActiveName, $result.ActiveId)

            $ip = [string]$result.Ip
            $previous = if ($script:lastStates.ContainsKey($ip)) { [string]$script:lastStates[$ip] } else { "unknown" }
            $script:lastStates[$ip] = [string]$result.State
            if ($result.State -ne "active" -and $result.LaunchId) {
                if (-not $script:recovery.ContainsKey($ip)) { $script:recovery[$ip] = [pscustomobject]@{ Attempts = 0; Last = [datetime]::MinValue } }
                $rec = $script:recovery[$ip]
                $canRetry = ((Get-Date) - $rec.Last).TotalSeconds -ge $recoveryCooldown
                $stationConfig = @($config.stations | Where-Object { [string]$_.ip -eq $ip }) | Select-Object -First 1
                $stationRecoveryEnabled = $globalRecoveryEnabled -and $autoRecovery -and $stationConfig -and [bool]$stationConfig.autoRecovery
                if ($stationRecoveryEnabled -and $canRetry -and $rec.Attempts -lt $maxRecoveryAttempts) {
                    if (Request-PlayerLaunch $ip ([string]$result.LaunchId) "estado $($result.State)") {
                        $rec.Attempts++
                        $rec.Last = Get-Date
                    }
                }
                if ($previous -eq "active" -or $previous -eq "unknown") {
                    $alertBanner.Visible = $true
                    $actionText = if ($stationRecoveryEnabled) { "Reabertura automatica solicitada." } else { "Reabertura automatica desativada para esta TV." }
                    $alertText.Text = "ATENCAO: $($result.Name) nao esta com o player ativo. $actionText"
                    $notifyIcon.ShowBalloonTip(7000, "Player Roku interrompido", "$($result.Name) sera reaberto automaticamente.", [System.Windows.Forms.ToolTipIcon]::Warning)
                }
            } elseif ($result.State -eq "active" -and $script:recovery.ContainsKey($ip)) {
                $script:recovery[$ip].Attempts = 0
                if ($alertBanner.Visible -and ($script:lastStates.Keys | Where-Object { $script:lastStates[$_] -ne "active" }).Count -eq 0) { $alertBanner.Visible = $false }
            }
        }
        $summaryLabels.active.Text = "PLAYER ATIVO: $($counts.active)"
        $summaryLabels.other.Text = "OUTRO APP: $($counts.other)"
        $summaryLabels.offline.Text = "SEM COMUNICACAO: $($counts.offline)"
        $lastUpdate.Text = "Ultima leitura: $((Get-Date).ToString('HH:mm:ss'))  |  proxima em ${refreshSeconds}s"
    }
    catch {
        Write-MonitorLog "Falha geral na verificacao: $($_.Exception.Message)"
    }
    finally {
        $script:probeTask.PowerShell.Dispose()
        $script:probeTask = $null
        $script:nextRefresh = (Get-Date).AddSeconds($refreshSeconds)
        $refreshButton.Enabled = $true
        $refreshButton.Text = "Atualizar agora"
        Resize-Cards
    }
}

$refreshButton.Add_Click({
    $script:nextRefresh = Get-Date
    Start-Probe
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 400
$timer.Add_Tick({
    Complete-Launches
    Complete-Probe
    if ($null -eq $script:probeTask -and (Get-Date) -ge $script:nextRefresh) { Start-Probe }
})

$form.Add_Shown({
    Resize-Cards
    Write-MonitorLog "Monitor iniciado. Atualizacao automatica a cada ${refreshSeconds}s."
    Start-Probe
    $timer.Start()
})

$form.Add_FormClosed({
    $timer.Stop()
    Stop-EmergencyServer
    if ($null -ne $script:probeTask) {
        try { $script:probeTask.PowerShell.Stop() } catch {}
        $script:probeTask.PowerShell.Dispose()
    }
    foreach ($task in @($script:launchTasks)) { try { $task.PowerShell.Stop() } catch {}; $task.PowerShell.Dispose() }
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
})

[void]$form.ShowDialog()
