<#
.SYNOPSIS
    Erstellt den Inno-Setup-Installer fuer AI Writer Studio.

.DESCRIPTION
    Setzt voraus, dass der Tauri-Release-Build vorliegt
    (src-tauri\target\release\ai-writer-studio.exe).
    Uebergibt alle Werte aus release.config.psd1 per /D-Parameter an ISCC,
    damit die Version nur an einer Stelle gepflegt wird.

.PARAMETER Version
    Ueberschreibt die Version aus release.config.psd1.

.PARAMETER KeepIntermediate
    Behaelt die ISCC-Logdatei nach erfolgreichem Lauf.

.PARAMETER Sign
    Signiert den fertigen Installer mit Authenticode (Code-Signing).

.EXAMPLE
    .\scripts\create-installer.ps1
    npm run installer
#>

[CmdletBinding()]
param(
    [string]$Version,
    [switch]$KeepIntermediate,
    [switch]$Sign
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir
$ConfigPath = Join-Path $ScriptDir 'release.config.psd1'

# Gemeinsame Hilfsfunktionen (Test-Tool, Find-Iscc, Get-IsccHelpText).
. (Join-Path $ScriptDir 'common.ps1')

$Cfg = Import-PowerShellDataFile -Path $ConfigPath
if ($Version) { $Cfg.AppVersion = $Version }

$IssFile   = Join-Path $RepoRoot 'installer\ai-writer-studio.iss'
$ExePath   = Join-Path $RepoRoot ($Cfg.Paths.TauriRelease + '\' + $Cfg.ExeName)
$OutputDir = Join-Path $RepoRoot $Cfg.Paths.OutputDir
$IconDir   = Join-Path $RepoRoot $Cfg.Paths.IconDir

function Write-Ok   { param([string]$T) Write-Host "  OK   $T" -ForegroundColor Green }
function Write-Info { param([string]$T) Write-Host "       $T" -ForegroundColor DarkGray }

Write-Host ''
Write-Host ("Installer erstellen: {0} {1}" -f $Cfg.AppName, $Cfg.AppVersion) -ForegroundColor Cyan
Write-Host ''

# ---------------------------------------------------------------------------
#  Voraussetzungen
# ---------------------------------------------------------------------------
$Iscc = Find-Iscc
if (-not $Iscc) {
    throw (Get-IsccHelpText)
}
Write-Ok "ISCC: $Iscc"

if (-not (Test-Path $IssFile)) { throw "Inno-Skript nicht gefunden: $IssFile" }
Write-Ok 'Inno-Skript gefunden'

if (-not (Test-Path $ExePath)) {
    throw @"
Die Anwendung wurde noch nicht gebaut:
  $ExePath

Zuerst ausfuehren:
  npm run build:windows
"@
}
$exeSize = [math]::Round((Get-Item $ExePath).Length / 1MB, 2)
Write-Ok "$($Cfg.ExeName) vorhanden ($exeSize MB)"

# Pflicht-Assets pruefen, damit ISCC nicht mitten im Lauf abbricht
foreach ($asset in @('setup-icon.ico','icon.ico','file-project.ico','file-chapter.ico','wizard-image.bmp','wizard-small.bmp')) {
    $p = Join-Path $IconDir $asset
    if (-not (Test-Path $p)) {
        throw "Asset fehlt: $p`nErzeuge die Icons mit:  python scripts\generate_icons.py"
    }
}
Write-Ok 'Branding-Assets vollstaendig'

foreach ($doc in @('LICENSE.txt','installer\README-Installer.txt','installer\README-App.txt')) {
    if (-not (Test-Path (Join-Path $RepoRoot $doc))) { throw "Dokument fehlt: $doc" }
}
Write-Ok 'Lizenz- und Readme-Dateien vorhanden'

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# ---------------------------------------------------------------------------
#  ISCC aufrufen
# ---------------------------------------------------------------------------
$defines = @(
    "/DMyAppName=$($Cfg.AppName)"
    "/DMyAppVersion=$($Cfg.AppVersion)"
    "/DMyAppPublisher=$($Cfg.AppPublisher)"
    "/DMyAppURL=$($Cfg.AppUrl)"
    "/DMyAppSupportURL=$($Cfg.AppSupportUrl)"
    "/DMyAppUpdatesURL=$($Cfg.AppUpdatesUrl)"
    "/DMyAppExeName=$($Cfg.ExeName)"
    "/DMyAppId=$($Cfg.AppId)"
    "/DMyOutputBaseFilename=$($Cfg.InstallerName)"
)

$logFile = Join-Path $OutputDir 'iscc.log'
Write-Info 'ISCC laeuft...'

# Ausgabe umleiten statt /LOG= zu verwenden: Inno Setup 7 kennt den Schalter
# nicht mehr und bricht mit "Unknown option" ab.
& $Iscc @defines "/Q" "/O$OutputDir" $IssFile *>&1 | Tee-Object -FilePath $logFile
$isccExit = $LASTEXITCODE

if ($isccExit -ne 0) {
    Write-Host ''
    Write-Host "ISCC ist mit Exitcode $isccExit fehlgeschlagen." -ForegroundColor Red
    if (Test-Path $logFile) {
        Write-Host 'Letzte Zeilen der Logdatei:' -ForegroundColor Yellow
        Get-Content $logFile -Tail 25 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        Write-Host "Vollstaendiges Log: $logFile" -ForegroundColor DarkGray
    }
    exit $isccExit
}

# ---------------------------------------------------------------------------
#  Ergebnis pruefen
# ---------------------------------------------------------------------------
$expected = Join-Path $OutputDir ("{0}-{1}-x64.exe" -f $Cfg.InstallerName, $Cfg.AppVersion)
if (-not (Test-Path $expected)) {
    throw "ISCC meldete Erfolg, aber die Datei fehlt: $expected"
}

$installer = Get-Item $expected
$sizeMb = [math]::Round($installer.Length / 1MB, 2)
Write-Ok "Installer erstellt ($sizeMb MB)"

# SHA256 fuer die Release-Notes
$hash = (Get-FileHash $installer.FullName -Algorithm SHA256).Hash
$hashFile = "$($installer.FullName).sha256"
"$hash  $($installer.Name)" | Set-Content -Path $hashFile -Encoding ASCII
Write-Ok 'SHA256-Pruefsumme geschrieben'

# Optional: Installer signieren (Authenticode).
if ($Sign) {
    & (Join-Path $ScriptDir 'sign-binary.ps1') -Path $installer.FullName
    if ($LASTEXITCODE -ne 0) { throw 'Signierung des Installers fehlgeschlagen.' }
}

if (-not $KeepIntermediate -and (Test-Path $logFile)) {
    Remove-Item $logFile -Force
}

Write-Host ''
Write-Host 'Fertig.' -ForegroundColor Green
Write-Host "  Datei:  $($installer.FullName)"
Write-Host "  Groesse: $sizeMb MB"
Write-Host "  SHA256: $hash"
Write-Host ''
Write-Host 'Stille Installation:' -ForegroundColor DarkGray
Write-Host "  $($installer.Name) /SILENT /NORESTART" -ForegroundColor DarkGray
Write-Host "  $($installer.Name) /VERYSILENT /SUPPRESSMSGBOXES /NORESTART" -ForegroundColor DarkGray
Write-Host ''
exit 0
