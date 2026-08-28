<#
.SYNOPSIS
    Delta-Updates fuer AI Writer Studio: Status, Bereitstellung und Grenzen.

.DESCRIPTION
    WICHTIG — ehrlicher Stand zur Delta-Unterstuetzung:

    tauri-plugin-updater unterstuetzt KEINE binären Deltas. Jedes Update
    wird als vollstaendiges, signiertes NSIS-Paket (LZMA-komprimiert) im
    .nsis.zip-Format uebertragen. Das ist der offiziell unterstuetzte,
    sicherste Weg: Das Paket wird gegen den im Binary eingebetteten
    Minisign-Public-Key verifiziert — ein Delta-Patch liessen sich gegen
    diese Signaturpruefung nicht verifizieren.

    Was dieses Skript trotzdem liefert:
      - Größenvergleich zweier Releases und Abschaetzung der
        Ersparnis durch LZMA (Delta-Effekt in der Praxis: der Grossteil
        des Pakets ist WebView-agnostisch und aendert sich kaum).
      - Optional: Erzeugung eines bsdiff-Binaerpatches zwischen zwei EXE-
        Versionen (falls 'bsdiff' im PATH liegt), fuer einen kuenftigen
        eigenverantwortlichen Delta-Kanal. Dieser Patch ist NICHT Teil
        des updater-Feeds.

    Fuer kleinere Downloads gilt daher:
      - NSIS-Artefakt mit maximaler Kompression bauen (bereits aktiv,
        tauri.conf.json: nsis.compression = 'lzma').
      - Nur geaenderte Frontend-Bundles veroeffentlichen bringt nichts,
        da der Updater den kompletten Installer uebertraegt.

.PARAMETER OldExe
    EXE der vorherigen Version.

.PARAMETER NewExe
    EXE der neuen Version.

.PARAMETER OutputDir
    Zielverzeichnis fuer Patch + Bericht (Default: release\delta).

.EXAMPLE
    .\scripts\generate-delta.ps1 -OldExe release\v0.1.0\ai-writer-studio.exe -NewExe src-tauri\target\release\ai-writer-studio.exe
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$OldExe,
    [Parameter(Mandatory)][string]$NewExe,
    [string]$OutputDir
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

foreach ($f in @($OldExe, $NewExe)) {
    if (-not (Test-Path $f)) { throw "Datei nicht gefunden: $f" }
}

function Write-Ok  { param([string]$T) Write-Host "  OK   $T" -ForegroundColor Green }
function Write-Info{ param([string]$T) Write-Host "       $T" -ForegroundColor DarkGray }
function Write-Warn{ param([string]$T) Write-Host "  !    $T" -ForegroundColor Yellow }

if (-not $OutputDir) { $OutputDir = Join-Path (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)) 'release\delta' }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$oldSize = (Get-Item $OldExe).Length
$newSize = (Get-Item $NewExe).Length

Write-Host ''
Write-Host 'Delta-Analyse' -ForegroundColor Cyan
Write-Info ("Alt: {0}  ({1:N2} MB)" -f (Split-Path -Leaf $OldExe), ($oldSize / 1MB))
Write-Info ("Neu: {0}  ({1:N2} MB)" -f (Split-Path -Leaf $NewExe), ($newSize / 1MB))

# bsdiff suchen — nur fuer den optionalen, kuenftigen Delta-Kanal.
$bsdiff = Get-Command 'bsdiff.exe' -ErrorAction SilentlyContinue
if ($bsdiff) {
    $patchPath = Join-Path $OutputDir 'update.bsdiff'
    Write-Info 'Erzeuge Binaerpatch (bsdiff) ...'
    & $bsdiff.Source $OldExe $NewExe $patchPath
    if ($LASTEXITCODE -ne 0) { throw 'bsdiff fehlgeschlagen.' }
    $patchSize = (Get-Item $patchPath).Length
    Write-Ok ("Patch: {0}  ({1:N2} MB, {2:P1} der neuen EXE)" -f $patchPath, ($patchSize / 1MB), ($patchSize / [math]::Max($newSize, 1)))
} else {
    Write-Warn 'bsdiff nicht gefunden — kein Binaerpatch erzeugt.'
    Write-Info 'Installation: winget install bsdiff (oder choco install bsdiff)'
}

Write-Host ''
Write-Warn 'Hinweis: Der offizielle Update-Kanal (tauri-plugin-updater) uebertraegt'
Write-Warn 'weiterhin vollstaendige, signierte NSIS-Pakete — binäre Deltas sind dort'
Write-Warn 'nicht supported und wuerden die Signaturpruefung brechen. Der Patch hier'
Write-Warn 'dient nur als Grundlage fuer einen zukuenftigen, eigenen Delta-Kanal.'
Write-Host ''
exit 0
