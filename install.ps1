# Installs Claudia on Windows.
#
#   irm https://raw.githubusercontent.com/claude-settings-xyz/claudia/main/install.ps1 | iex
#
# Options, as environment variables:
#   $env:CLAUDIA_VERSION = 'v1.2.0'   Install this release instead of the latest one.
#   $env:CLAUDIA_NO_AUTOSTART = '1'   Do not start Claudia when you sign in.
#
# To uninstall:
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/claude-settings-xyz/claudia/main/install.ps1))) -Uninstall
#
# From a downloaded copy: .\install.ps1 -Uninstall

# Everything runs in this block, so that its settings stay out of your session
# and a partial download does nothing.
& {
    param([switch]$Uninstall)

    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'
    # Windows PowerShell 5.1 does not use TLS 1.2 by default.
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

    $repo = 'claude-settings-xyz/claudia'
    $releases = if ($env:CLAUDIA_DOWNLOAD_URL) { $env:CLAUDIA_DOWNLOAD_URL } else { "https://github.com/$repo/releases" }
    $version = if ($env:CLAUDIA_VERSION) { $env:CLAUDIA_VERSION } else { 'latest' }
    $installDir = Join-Path $env:LOCALAPPDATA 'Programs\Claudia'
    $exe = Join-Path $installDir 'claudia.exe'
    $shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'Claudia.lnk'
    $runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    $port = 7377

    function Stop-Claudia {
        $running = @(Get-Process -Name claudia -ErrorAction SilentlyContinue)
        if ($running.Count -gt 0) {
            Write-Host 'Stopping the running Claudia...'
            $running | Stop-Process -Force
            $running | Wait-Process -Timeout 10 -ErrorAction SilentlyContinue
        }
    }

    # The API only answers requests that send the X-Claudia header.
    function Test-Running {
        try {
            Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Headers @{ 'X-Claudia' = '1' } -Uri "http://127.0.0.1:$port/api/health" | Out-Null
            return $true
        } catch {
            return $false
        }
    }

    if ($Uninstall) {
        Stop-Claudia
        Remove-ItemProperty -Path $runKey -Name 'Claudia' -ErrorAction SilentlyContinue
        foreach ($path in @($installDir, $shortcut, (Join-Path $env:APPDATA 'claudia'), (Join-Path $env:LOCALAPPDATA 'claudia'))) {
            Remove-Item -Recurse -Force -Path $path -ErrorAction SilentlyContinue
        }
        Write-Host 'Claudia is uninstalled. Your Claude Code files did not change.'
        return
    }

    # 32-bit PowerShell on 64-bit Windows reports the real CPU in PROCESSOR_ARCHITEW6432.
    $cpu = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    $arch = switch ($cpu) {
        'AMD64' { 'amd64' }
        'ARM64' { 'arm64' }
        default { throw "There is no Claudia build for $cpu." }
    }

    $asset = "claudia-windows-$arch.exe"
    $base = if ($version -eq 'latest') { "$releases/latest/download" } else { "$releases/download/$version" }
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ('claudia-' + [Guid]::NewGuid())
    New-Item -ItemType Directory -Path $tmp | Out-Null

    try {
        Write-Host "Downloading $asset ($version)..."
        $download = Join-Path $tmp $asset
        $checksums = Join-Path $tmp 'checksums.txt'
        Invoke-WebRequest -UseBasicParsing -Uri "$base/$asset" -OutFile $download
        Invoke-WebRequest -UseBasicParsing -Uri "$base/checksums.txt" -OutFile $checksums

        $expected = Get-Content $checksums | ForEach-Object {
            $fields = $_ -split '\s+'
            if ($fields.Count -ge 2 -and $fields[1].TrimStart('*') -eq $asset) { $fields[0] }
        } | Select-Object -First 1
        if (-not $expected) { throw "checksums.txt has no entry for $asset." }
        if ((Get-FileHash -Algorithm SHA256 -Path $download).Hash -ne $expected) {
            throw "The download of $asset is damaged. Try again."
        }

        Stop-Claudia
        New-Item -ItemType Directory -Force -Path $installDir | Out-Null
        Move-Item -Force -Path $download -Destination $exe
    } finally {
        Remove-Item -Recurse -Force -Path $tmp -ErrorAction SilentlyContinue
    }
    Write-Host "Installed $exe"

    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($shortcut)
    $link.TargetPath = $exe
    $link.WorkingDirectory = $installDir
    $link.Description = 'Manage your Claude Code settings'
    $link.Save()

    if ($env:CLAUDIA_NO_AUTOSTART) {
        Remove-ItemProperty -Path $runKey -Name 'Claudia' -ErrorAction SilentlyContinue
    } else {
        New-ItemProperty -Path $runKey -Name 'Claudia' -Value "`"$exe`" -no-open" -PropertyType String -Force | Out-Null
    }

    # Claudia opens the browser itself when it starts without -no-open.
    Start-Process -FilePath $exe
    $started = $false
    foreach ($attempt in 1..15) {
        if (Test-Running) { $started = $true; break }
        Start-Sleep -Seconds 1
    }

    Write-Host ''
    if ($started) {
        Write-Host 'Claudia is running in the notification area.'
    } else {
        Write-Host "Claudia did not start. Run $exe to see why."
    }
    if (-not $env:CLAUDIA_NO_AUTOSTART) {
        Write-Host 'It starts when you sign in. Find it in the Start menu as Claudia.'
    } else {
        Write-Host 'Find it in the Start menu as Claudia.'
    }
} @args
