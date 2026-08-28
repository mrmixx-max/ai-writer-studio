<#
.SYNOPSIS
    Erstellt die portable Version von AI Writer Studio (ZIP-Archiv ohne Installer).

.DESCRIPTION
    Kopiert die gebaute EXE in ein sauberes Verzeichnis, legt eine
    README mit Start- und Datenverzeichnis-Hinweisen bei und packt alles
    als ZIP nach release\AI-Writer-Studio-<Version>-portable.zip.

    Die portable Version nutzt dasselbe %APPDATA%-Datenverzeichnis wie die
    installierte Version — Projekte bleiben dadurch austauschbar.

.PARAMETER Version
    Ueberschreibt die Version aus release.config.psd1.

.PARAMETER Sign
    Signiert die EXE vor dem Packen (Code-Signing, siehe sign-binary.ps1).

.EXAMPLE
    .\scripts\create-portable.ps1
#>

[CmdletBinding()]
param(
    [string]$Version,
    [switch]$Sign
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir
$ConfigPath = Join-Path $ScriptDir 'release.config.psd1'

. (Join-Path $ScriptDir 'common.ps1')

if (-not (Test-Path $ConfigPath)) { throw "Konfiguration nicht gefunden: $ConfigPath" }
$Cfg = Import-PowerShellDataFile -Path $ConfigPath
if ($Version) { $Cfg.AppVersion = $Version }

$ExePath    = Join-Path $RepoRoot ($Cfg.Paths.TauriRelease + '\' + $Cfg.ExeName)
$OutputDir  = Join-Path $RepoRoot $Cfg.Paths.OutputDir
$StagingDir = Join-Path $env:TEMP ("{0}-portable-{1}" -f ($Cfg.AppName -replace '\s',''), $Cfg.AppVersion)
$ZipPath    = Join-Path $OutputDir ("{0}-{1}-portable.zip" -f ($Cfg.AppName -replace '\s',''), $Cfg.AppVersion)

function Write-Ok  { param([string]$T) Write-Host "  OK   $T" -ForegroundColor Green }
function Write-Info{ param([string]$T) Write-Host "       $T" -ForegroundColor DarkGray }

Write-Host ''
Write-Host ("Portable Version erstellen: {0} {1}" -f $Cfg.AppName, $Cfg.AppVersion) -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path $ExePath)) {
    throw @"
Die Anwendung wurde noch nicht gebaut:
  $ExePath

Zuerst ausfuehren:
  npm run build:windows
"@
}
Write-Ok "EXE gefunden ($([math]::Round((Get-Item $ExePath).Length / 1MB, 2)) MB)"

# Optional signieren, bevor die EXE eingepackt wird.
if ($Sign) {
    & (Join-Path $ScriptDir 'sign-binary.ps1') -Path $ExePath
    if ($LASTEXITCODE -ne 0) { throw 'Signierung der EXE fehlgeschlagen.' }
}

# Staging-Verzeichnis sauber aufsetzen.
if (Test-Path $StagingDir) { Remove-Item $StagingDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $StagingDir | Out-Null

Copy-Item $ExePath -Destination (Join-Path $StagingDir $Cfg.ExeName) -Force
Copy-Item (Join-Path $RepoRoot 'LICENSE.txt') -Destination $StagingDir -Force
Copy-Item (Join-Path $RepoRoot 'installer\README-App.txt') -Destination $StagingDir -Force

# Hinweis-Datei fuer Portabelnutzer.
$readme = @"
{0} {1} — Portable Version
=============================================

Start:
  Doppelklick auf {2}

Datenverzeichnis (Projekte, Einstellungen, Logs):
  %APPDATA%\{0}\

  Die portable Version nutzt dasselbe Datenverzeichnis wie die
  installierte Version. Zum Mitnehmen auf einen USB-Stick den Ordner
  %APPDATA%\{0}\ daneben kopieren.

Updates:
  Auto-Update ist in der portablen Version deaktiviert (kein Installer).
  Neue Versionen manuell von der Projektseite laden:
  {3}

Lizenz:
  Siehe LICENSE.txt
"@ -f $Cfg.AppName, $Cfg.AppVersion, $Cfg.ExeName, $Cfg.AppUrl
$readme | Set-Content -Path (Join-Path $StagingDir 'PORTABLE-README.txt') -Encoding UTF8

# ZIP erstellen (Compress-Archive ueberschreibt nicht zuverlaessig -> vorher loeschen).
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path (Join-Path $StagingDir '*') -DestinationPath $ZipPath -CompressionLevel Optimal

$zip = Get-Item $ZipPath
$zipSize = [math]::Round($zip.Length / 1MB, 2)
Write-Ok ("Portables Archiv erstellt: {0} ({1} MB)" -f $zip.Name, $zipSize)

# SHA256-Pruefsumme wie beim Installer.
$hash = (Get-FileHash $zip.FullName -Algorithm SHA256).Hash
"$hash  $($zip.Name)" | Set-Content -Path "$($zip.FullName).sha256" -Encoding ASCII
Write-Ok 'SHA256-Pruefsumme geschrieben'

Remove-Item $StagingDir -Recurse -Force

Write-Host ''
Write-Host 'Fertig.'
Write-Host ("  Datei:  " + $zip.FullName)
exit 0
