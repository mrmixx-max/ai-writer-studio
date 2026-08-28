<#
.SYNOPSIS
    Signiert EXE-/MSI-/Installer-Dateien mit Authenticode (signtool).

.DESCRIPTION
    Unterstuetzt zwei Zertifikatsquellen (Konfiguration in release.config.psd1,
    Abschnitt 'Signing'):
      1. CertThumbprint — Zertifikat aus dem Windows-Zertifikatspeicher
         (Cert:\CurrentUser\My oder Cert:\LocalMachine\My).
      2. PfxPath — PFX-Datei; das Passwort kommt ausschliesslich aus der
         Umgebungsvariable SIGNTOOL_PFX_PASSWORD (niemals in Dateien ablegen!).

    Alle Signaturen werden mit RFC 3161-Zeitstempel versehen, damit sie auch
    nach Ablauf des Zertifikats gueltig bleiben.

.PARAMETER Path
    Eine oder mehrere zu signierende Dateien (exe, msi, dll).

.PARAMETER Version
    Nur zum Ermitteln der Konfiguration (optional, konsistent mit den anderen
    Skripten gehalten).

.EXAMPLE
    .\scripts\sign-binary.ps1 -Path release\AI-Writer-Studio-Setup-0.1.0-x64.exe
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string[]]$Path,
    [string]$Version
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir
$ConfigPath = Join-Path $ScriptDir 'release.config.psd1'

. (Join-Path $ScriptDir 'common.ps1')

if (-not (Test-Path $ConfigPath)) { throw "Konfiguration nicht gefunden: $ConfigPath" }
$Cfg    = Import-PowerShellDataFile -Path $ConfigPath
$Sign   = $Cfg.Signing
$Target = $Cfg.AppName
if (-not $Sign) { throw "Abschnitt 'Signing' fehlt in release.config.psd1." }

function Write-Ok  { param([string]$T) Write-Host "  OK   $T" -ForegroundColor Green }
function Write-Info{ param([string]$T) Write-Host "       $T" -ForegroundColor DarkGray }
function Write-Warn{ param([string]$T) Write-Host "  !    $T" -ForegroundColor Yellow }

# ---------------------------------------------------------------------------
#  signtool finden (Windows SDK / ClickOnce Tools)
# ---------------------------------------------------------------------------
function Find-Signtool {
    $candidates = @(
        (Get-Command 'signtool.exe' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
        (Join-Path $env:ProgramFiles 'Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools\x64\signtool.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin\10.0.19041.0\x64\signtool.exe')
    ) | Where-Object { $_ -and (Test-Path $_) }

    if ($candidates) {
        # Neueste Version zuerst (Versionierte SDK-Pfaende sortieren).
        return ($candidates | Sort-Object -Descending | Select-Object -First 1)
    }

    # Globale Suche im neuesten Windows-Kit-Verzeichnis.
    $kitRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
    if (Test-Path $kitRoot) {
        $signtool = Get-ChildItem $kitRoot -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending |
            ForEach-Object { Join-Path $_.FullName 'x64\signtool.exe' } |
            Where-Object { Test-Path $_ } |
            Select-Object -First 1
        if ($signtool) { return $signtool }
    }
    return $null
}

$Signtool = Find-Signtool
if (-not $Signtool) {
    throw @"
signtool.exe wurde nicht gefunden.
Installiere Windows SDK oder Visual Studio Build Tools:
  winget install Microsoft.WindowsSDK.10.0.22621
"@
}
Write-Ok "signtool: $Signtool"

# ---------------------------------------------------------------------------
#  Zertifikatsquelle ermitteln
# ---------------------------------------------------------------------------
$certArgs = @()
if ($Sign.CertThumbprint) {
    $certArgs = @('/sha1', $Sign.CertThumbprint)
    Write-Ok "Zertifikat (Speicher): $($Sign.CertThumbprint)"
} elseif ($Sign.PfxPath) {
    $pfx = Join-Path $RepoRoot $Sign.PfxPath
    if (-not (Test-Path $pfx)) { $pfx = $Sign.PfxPath }
    if (-not (Test-Path $pfx)) { throw "PFX-Datei nicht gefunden: $pfx" }
    if (-not $env:SIGNTOOL_PFX_PASSWORD) {
        throw 'Umgebungsvariable SIGNTOOL_PFX_PASSWORD ist nicht gesetzt - PFX-Passwort niemals in Dateien oder Befehlszeilen ablegen.'
    }
    $certArgs = @('/f', $pfx, '/p', $env:SIGNTOOL_PFX_PASSWORD)
    Write-Ok "Zertifikat (PFX): $pfx"
} else {
    Write-Warn 'Kein Signaturzertifikat konfiguriert (Signing.CertThumbprint / Signing.PfxPath).'
    Write-Warn 'Dateien werden NICHT signiert. Fuer offizielle Releases ist Code-Signing Pflicht.'
    return
}

$timestamp = $Sign.TimestampServer
$descArgs  = @('/d', $Sign.Description, '/du', $Sign.Url)
$failed    = @()

foreach ($file in $Path) {
    if (-not (Test-Path $file)) { throw "Datei nicht gefunden: $file" }

    Write-Info "Signiere $(Split-Path -Leaf $file) ..."
    & $Signtool sign @certArgs @descArgs '/fd', 'SHA256', '/td', 'SHA256', '/tr', $timestamp $file *>&1 |
        ForEach-Object { Write-Info $_ }

    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Signierung fehlgeschlagen: $file"
        $failed += $file
        continue
    }

    # Signatur ruecklesen und bestaetigen — Vertrauen ist gut, Pruefen ist besser.
    $verify = & $Signtool verify '/pa', '/all' $file *>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "Signiert & verifiziert: $(Split-Path -Leaf $file)"
    } else {
        Write-Warn "Verifikation fehlgeschlagen: $file"
        $verify | ForEach-Object { Write-Info $_ }
        $failed += $file
    }
}

if ($failed.Count -gt 0) {
    throw "Signierung/Verifikation fehlgeschlagen fuer: $($failed -join ', ')"
}

exit 0
