<#
.SYNOPSIS
    Erzeugt die Update-Feed-Datei (latest.json) fuer tauri-plugin-updater.

.DESCRIPTION
    Sammelt die von Tauri erzeugten Updater-Artefakte
    (AI-Writer-Studio_<version>_x64-setup.nsis.zip + .sig, entstehen bei
    'tauri build' wenn bundle.createUpdaterArtifacts = true) und schreibt
    daraus die signierte Feed-Datei latest.json im Format:

      {
        "version": "0.1.0",
        "pub_date": "2026-08-28T12:00:00Z",
        "platforms": {
          "windows-x86_64": {
            "signature": "<Inhalt der .sig-Datei>",
            "url": "https://.../AI-Writer-Studio_0.1.0_x64-setup.nsis.zip"
          }
        }
      }

    Die URL wird aus dem Update-Basisverzeichnis (Parameter oder
    AppUrl + releases/download/v<Version>) gebaut. Die latest.json wird
    zusammen mit den Artefakten auf GitHub Releases hochgeladen; der
    stabile Feed-Link .../releases/latest/download/latest.json zeigt dann
    immer auf die neueste Version.

.PARAMETER Version
    Version, fuer die der Feed erzeugt wird (Default: release.config.psd1).

.PARAMETER BaseUrl
    Basis-URL, unter der die Artefakte abrufbar sein werden.
    Default: <AppUrl>/releases/download/v<Version>

.EXAMPLE
    .\scripts\generate-update-manifest.ps1
#>

[CmdletBinding()]
param(
    [string]$Version,
    [string]$BaseUrl
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir
$ConfigPath = Join-Path $ScriptDir 'release.config.psd1'

if (-not (Test-Path $ConfigPath)) { throw "Konfiguration nicht gefunden: $ConfigPath" }
$Cfg = Import-PowerShellDataFile -Path $ConfigPath
if ($Version)  { $Cfg.AppVersion = $Version }
if ($BaseUrl)  { $Url = $BaseUrl.TrimEnd('/') }
else           { $Url = "$($Cfg.AppUrl.TrimEnd('/'))/releases/download/v$($Cfg.AppVersion)" }

function Write-Ok  { param([string]$T) Write-Host "  OK   $T" -ForegroundColor Green }
function Write-Warn{ param([string]$T) Write-Host "  !    $T" -ForegroundColor Yellow }

$OutputDir  = Join-Path $RepoRoot $Cfg.Paths.OutputDir

# Tauri-NSIS-Updater-Artefakt suchen (benannt: <Name>_<Version>_x64-setup.nsis.zip).
$pattern = '*_x64-setup.nsis.zip'
$artifacts = @(Get-ChildItem -Path (Join-Path $RepoRoot 'src-tauri\target\release\bundle\nsis') -Filter $pattern -ErrorAction SilentlyContinue) +
             @(Get-ChildItem -Path $OutputDir -Filter $pattern -ErrorAction SilentlyContinue)

if (-not $artifacts -or $artifacts.Count -eq 0) {
    throw @"
Kein Updater-Artefakt ($pattern) gefunden.
Es entsteht bei:  npm run tauri -- build --bundles nsis
(erfordert TAURI_SIGNING_PRIVATE_KEY bzw. TAURI_SIGNING_PRIVATE_KEY_PATH)
oder:             npm run build:windows -UpdateArtifacts
"@
}

$zip = $artifacts | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$sigPath = "$($zip.FullName).sig"
if (-not (Test-Path $sigPath)) {
    throw @"
Signaturdatei fehlt: $sigPath
Der Build muss mit dem Tauri-Signaturschluessel laufen:
  `$env:TAURI_SIGNING_PRIVATE_KEY_PATH = "$HOME\$($Cfg.TauriSigningKey)"
  `$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
"@
}
Write-Ok ("Updater-Artefakt: {0} ({1:N2} MB)" -f $zip.Name, ($zip.Length / 1MB))

# Artefakt + Signatur ins Release-Verzeichnis spiegeln.
Copy-Item $zip.FullName -Destination $OutputDir -Force
Copy-Item $sigPath -Destination $OutputDir -Force
$zip     = Get-Item (Join-Path $OutputDir $zip.Name)
$sigPath = Join-Path $OutputDir "$($zip.Name).sig"

$signature = (Get-Content $sigPath -Raw).Trim()
$pubDate   = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')

$manifest = [ordered]@{
    version  = $Cfg.AppVersion
    notes    = "AI Writer Studio $($Cfg.AppVersion)"
    pub_date = $pubDate
    platforms = [ordered]@{
        'windows-x86_64' = [ordered]@{
            signature = $signature
            url       = "$Url/$($zip.Name)"
        }
    }
}

$feedPath = Join-Path $OutputDir $Cfg.UpdateFeedFile
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path $feedPath -Encoding UTF8
Write-Ok "Update-Feed geschrieben: $feedPath"

# SHA256 fuer Release-Notes.
$zipHash = (Get-FileHash $zip.FullName -Algorithm SHA256).Hash
"$zipHash  $($zip.Name)" | Set-Content -Path "$($zip.FullName).sha256" -Encoding ASCII

Write-Host ''
Write-Host 'Release-Hochladen (GitHub):' -ForegroundColor DarkGray
Write-Host "  gh release create v$($Cfg.AppVersion) `"$($zip.FullName)`" `"$sigPath`" `"$feedPath`" --title `"v$($Cfg.AppVersion)`" --generate-notes" -ForegroundColor DarkGray
Write-Host ''
exit 0
