Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$captureScript = Join-Path $PSScriptRoot 'capture-local-upload.ps1'
$environmentPath = Join-Path $repositoryRoot '.env'
$outputDirectory = Join-Path $repositoryRoot 'renderer\output'
$script:process = $null
$script:completed = 0
$script:total = 0
$script:closing = $false

[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Central de Captura para TVs'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = New-Object System.Drawing.Size(760, 590)
$form.MinimumSize = New-Object System.Drawing.Size(776, 629)
$form.BackColor = [System.Drawing.Color]::FromArgb(245, 248, 253)
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$header = New-Object System.Windows.Forms.Panel
$header.Dock = 'Top'
$header.Height = 112
$header.BackColor = [System.Drawing.Color]::FromArgb(20, 46, 92)
$form.Controls.Add($header)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'Captura local para as TVs'
$title.ForeColor = [System.Drawing.Color]::White
$title.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 22)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(28, 20)
$header.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'Gere as imagens no computador e envie diretamente para o Supabase.'
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(198, 214, 240)
$subtitle.AutoSize = $true
$subtitle.Location = New-Object System.Drawing.Point(31, 68)
$header.Controls.Add($subtitle)

$statusCard = New-Object System.Windows.Forms.Panel
$statusCard.Location = New-Object System.Drawing.Point(24, 132)
$statusCard.Size = New-Object System.Drawing.Size(712, 112)
$statusCard.BackColor = [System.Drawing.Color]::White
$statusCard.BorderStyle = 'FixedSingle'
$statusCard.Anchor = 'Top,Left,Right'
$form.Controls.Add($statusCard)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Text = 'Pronto para iniciar'
$statusLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 14)
$statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(22, 38, 67)
$statusLabel.AutoSize = $true
$statusLabel.Location = New-Object System.Drawing.Point(20, 16)
$statusCard.Controls.Add($statusLabel)

$detailLabel = New-Object System.Windows.Forms.Label
$detailLabel.Text = 'O navegador pode permanecer oculto durante todo o processo.'
$detailLabel.ForeColor = [System.Drawing.Color]::FromArgb(91, 111, 145)
$detailLabel.AutoSize = $true
$detailLabel.Location = New-Object System.Drawing.Point(22, 48)
$statusCard.Controls.Add($detailLabel)

$progress = New-Object System.Windows.Forms.ProgressBar
$progress.Location = New-Object System.Drawing.Point(23, 78)
$progress.Size = New-Object System.Drawing.Size(664, 14)
$progress.Anchor = 'Top,Left,Right'
$progress.Style = 'Continuous'
$statusCard.Controls.Add($progress)

$visibleCheck = New-Object System.Windows.Forms.CheckBox
$visibleCheck.Text = 'Mostrar o Chromium durante a captura'
$visibleCheck.AutoSize = $true
$visibleCheck.Location = New-Object System.Drawing.Point(27, 262)
$visibleCheck.ForeColor = [System.Drawing.Color]::FromArgb(54, 72, 103)
$form.Controls.Add($visibleCheck)

function New-ActionButton([string]$text, [int]$x, [int]$width, [System.Drawing.Color]$color) {
    $button = New-Object System.Windows.Forms.Button
    $button.Text = $text
    $button.Location = New-Object System.Drawing.Point($x, 298)
    $button.Size = New-Object System.Drawing.Size($width, 42)
    $button.FlatStyle = 'Flat'
    $button.FlatAppearance.BorderSize = 0
    $button.BackColor = $color
    $button.ForeColor = [System.Drawing.Color]::White
    $button.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10)
    $form.Controls.Add($button)
    return $button
}

$startButton = New-ActionButton 'Iniciar captura' 24 166 ([System.Drawing.Color]::FromArgb(42, 111, 235))
$cancelButton = New-ActionButton 'Cancelar' 202 118 ([System.Drawing.Color]::FromArgb(218, 67, 75))
$cancelButton.Enabled = $false
$openButton = New-ActionButton 'Abrir imagens' 332 142 ([System.Drawing.Color]::FromArgb(42, 157, 116))
$configButton = New-ActionButton 'Configurar acesso' 486 162 ([System.Drawing.Color]::FromArgb(91, 105, 130))

$logTitle = New-Object System.Windows.Forms.Label
$logTitle.Text = 'Acompanhamento'
$logTitle.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
$logTitle.AutoSize = $true
$logTitle.Location = New-Object System.Drawing.Point(24, 360)
$logTitle.ForeColor = [System.Drawing.Color]::FromArgb(22, 38, 67)
$form.Controls.Add($logTitle)

$logBox = New-Object System.Windows.Forms.RichTextBox
$logBox.Location = New-Object System.Drawing.Point(24, 390)
$logBox.Size = New-Object System.Drawing.Size(712, 170)
$logBox.Anchor = 'Top,Bottom,Left,Right'
$logBox.ReadOnly = $true
$logBox.BackColor = [System.Drawing.Color]::White
$logBox.ForeColor = [System.Drawing.Color]::FromArgb(45, 59, 82)
$logBox.BorderStyle = 'FixedSingle'
$logBox.Font = New-Object System.Drawing.Font('Consolas', 9)
$form.Controls.Add($logBox)

function Invoke-OnUi([scriptblock]$action) {
    if ($form.IsDisposed) { return }
    $callback = [System.Windows.Forms.MethodInvoker]$action.GetNewClosure()
    if ($form.InvokeRequired) {
        # PowerShell não resolve de forma consistente a sobrecarga de um
        # argumento de Control.BeginInvoke. Informe explicitamente o delegado
        # e o array de argumentos vazio para funcionar no Windows PowerShell 5.
        [void]$form.BeginInvoke($callback, [object[]]@())
    }
    else {
        $callback.Invoke()
    }
}

function Add-LogLine([string]$line, [bool]$isError = $false) {
    if ([string]::IsNullOrWhiteSpace($line)) { return }
    $clean = $line.Trim()
    Invoke-OnUi {
        $logBox.SelectionStart = $logBox.TextLength
        $logBox.SelectionColor = if ($isError) {
            [System.Drawing.Color]::FromArgb(190, 45, 55)
        } else {
            [System.Drawing.Color]::FromArgb(45, 59, 82)
        }
        $logBox.AppendText($clean + [Environment]::NewLine)
        $logBox.ScrollToCaret()

        if ($clean -match 'Iniciando\s+(\d+)\s+dashboard') {
            $script:total = [int]$matches[1]
            $progress.Style = 'Continuous'
            $progress.Minimum = 0
            $progress.Maximum = [Math]::Max(1, $script:total)
            $progress.Value = 0
            $detailLabel.Text = "0 de $($script:total) painéis concluídos"
        }
        elseif ($clean -match '\[captura\]\s+Abrindo:\s*(.+)$') {
            $statusLabel.Text = 'Capturando painel'
            $detailLabel.Text = $matches[1]
        }
        elseif ($clean -match '\[captura\]\s+(OK|ERRO):') {
            $script:completed++
            if ($script:total -gt 0) {
                $progress.Value = [Math]::Min($script:completed, $progress.Maximum)
                $detailLabel.Text = "$($script:completed) de $($script:total) painéis concluídos"
            }
        }
        elseif ($clean -match '\[ppr\]\s+Gerando imagens') {
            $statusLabel.Text = 'Gerando imagens do PPR'
            $detailLabel.Text = 'Montando as telas configuradas na Central em 1920x1080...'
        }
        elseif ($clean -match '\[ppr\].*confirmado') {
            $statusLabel.Text = 'Publicando o PPR'
            $detailLabel.Text = 'Arquivos confirmados. Atualizando os links consumidos pelas TVs...'
        }
    }
}

function Set-IdleState([bool]$success, [string]$message) {
    Invoke-OnUi {
        $startButton.Enabled = $true
        $cancelButton.Enabled = $false
        $visibleCheck.Enabled = $true
        $statusLabel.Text = if ($success) { 'Captura concluída' } else { 'Captura interrompida' }
        $statusLabel.ForeColor = if ($success) {
            [System.Drawing.Color]::FromArgb(25, 145, 92)
        } else {
            [System.Drawing.Color]::FromArgb(190, 45, 55)
        }
        $detailLabel.Text = $message
        if ($success -and $script:total -gt 0) {
            $progress.Value = $progress.Maximum
        }
        $script:process = $null
    }
}

$startButton.Add_Click({
    if ($script:process -and -not $script:process.HasExited) { return }
    if (-not (Test-Path -LiteralPath $environmentPath)) {
        [System.Windows.Forms.MessageBox]::Show(
            'O arquivo .env não foi encontrado. Clique em Configurar acesso.',
            'Configuração necessária', 'OK', 'Warning'
        ) | Out-Null
        return
    }

    $script:completed = 0
    $script:total = 0
    $logBox.Clear()
    $progress.Style = 'Marquee'
    $progress.MarqueeAnimationSpeed = 25
    $statusLabel.Text = 'Preparando a captura'
    $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(22, 38, 67)
    $detailLabel.Text = 'Conectando à base central e lendo os painéis...'
    $startButton.Enabled = $false
    $cancelButton.Enabled = $true
    $visibleCheck.Enabled = $false

    $arguments = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', ('"' + $captureScript + '"')
    )
    if ($visibleCheck.Checked) { $arguments += '-Visible' }

    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = 'powershell.exe'
    $startInfo.Arguments = $arguments -join ' '
    $startInfo.WorkingDirectory = $repositoryRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $startInfo.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    $script:process = New-Object System.Diagnostics.Process
    $script:process.StartInfo = $startInfo
    $script:process.EnableRaisingEvents = $true
    $script:process.add_OutputDataReceived({
        param($sender, $eventArgs)
        if ($null -ne $eventArgs.Data) { Add-LogLine $eventArgs.Data $false }
    })
    $script:process.add_ErrorDataReceived({
        param($sender, $eventArgs)
        if ($null -ne $eventArgs.Data) { Add-LogLine $eventArgs.Data $true }
    })
    $script:process.add_Exited({
        $exitCode = $sender.ExitCode
        if ($script:closing) { return }
        if ($exitCode -eq 0) {
            Set-IdleState $true 'As imagens foram enviadas e já estão disponíveis para as TVs.'
        } else {
            Set-IdleState $false 'Consulte o acompanhamento abaixo para identificar o painel com erro.'
        }
    })

    try {
        [void]$script:process.Start()
        $script:process.BeginOutputReadLine()
        $script:process.BeginErrorReadLine()
        Add-LogLine 'Captura iniciada. O Chromium está trabalhando em segundo plano.' $false
    } catch {
        Set-IdleState $false $_.Exception.Message
    }
})

$cancelButton.Add_Click({
    if (-not $script:process -or $script:process.HasExited) { return }
    $answer = [System.Windows.Forms.MessageBox]::Show(
        'Deseja interromper a captura atual?',
        'Cancelar captura', 'YesNo', 'Question'
    )
    if ($answer -ne 'Yes') { return }
    $pidToStop = $script:process.Id
    Start-Process -FilePath 'taskkill.exe' -ArgumentList "/PID $pidToStop /T /F" -WindowStyle Hidden -Wait
    Add-LogLine 'Captura cancelada pelo usuário.' $true
    Set-IdleState $false 'A captura foi cancelada. As imagens concluídas anteriormente foram preservadas.'
})

$openButton.Add_Click({
    if (-not (Test-Path -LiteralPath $outputDirectory)) {
        New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
    }
    Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + $outputDirectory + '"')
})

$configButton.Add_Click({
    if (-not (Test-Path -LiteralPath $environmentPath)) {
        $examplePath = Join-Path $repositoryRoot '.env.capture.example'
        Copy-Item -LiteralPath $examplePath -Destination $environmentPath
    }
    Start-Process -FilePath 'notepad.exe' -ArgumentList ('"' + $environmentPath + '"')
})

$form.Add_FormClosing({
    if ($script:process -and -not $script:process.HasExited) {
        $answer = [System.Windows.Forms.MessageBox]::Show(
            'Existe uma captura em andamento. Deseja encerrá-la e fechar?',
            'Captura em andamento', 'YesNo', 'Warning'
        )
        if ($answer -ne 'Yes') {
            $_.Cancel = $true
            return
        }
        $script:closing = $true
        $pidToStop = $script:process.Id
        Start-Process -FilePath 'taskkill.exe' -ArgumentList "/PID $pidToStop /T /F" -WindowStyle Hidden -Wait
    }
})

[void]$form.ShowDialog()
