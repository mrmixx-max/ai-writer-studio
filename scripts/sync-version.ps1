<#
.SYNOPSIS
    Setzt die Versionsnummer in allen Projektdateien.

.DESCRIPTION
    Die Version wird ausschliesslich in scripts\release.config.psd1 gepflegt.
    Dieses Skript schreibt sie nach:
      - package.json         ("version")
      - src-tauri\tauri.conf.json  ("version")
      - src-tauri\Cargo.toml       ([package] version)
      - src\version.ts             (fuer den About-Dialog)

    Ohne -Version wird der Wert aus release.config.psd1 verwendet.
    Mit -Check wird nur geprueft, ob alle Dateien uebereinstimmen (Exitcode 1
    bei Abweichung) - geeignet fuer CI.

.EXAMPLE
    .\scripts\sync-version.ps1
    .\scripts\sync-version.ps1 -Version 0.2.0
    .\scripts\sync-version.ps1 -Check
#>

[CmdletBinding()]
param(
    [string]$Version,
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir
$ConfigPath = Join-Path $ScriptDir 'release.config.psd1'

$Cfg = Import-PowerShellDataFile -Path $ConfigPath
if (-not $Version) { $Version = $Cfg.AppVersion }

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Ungueltige Version '$Version'. Erwartet wird SemVer, z. B. 1.2.3."
}

$results = @()

function Set-FileVersion {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Replacement,
        [string]$Label
    )
    $full = Join-Path $RepoRoot $Path
    if (-not (Test-Path $full)) {
        throw "Datei nicht gefunden: $Path"
    }
    $content = Get-Content $full -Raw -Encoding UTF8
    $m = [regex]::Match($content, $Pattern)
    if (-not $m.Success) {
        throw "Versionsfeld in $Path nicht gefunden (Muster: $Pattern)."
    }
    # Gruppe 2 ist die Versionsnummer; Gruppe 1 ist das Praefix (z. B. '"version": "').
    $current = $m.Groups[2].Value
    $script:results += [pscustomobject]@{
        Datei   = $Label
        Vorher  = $current
        Nachher = $Version
        Aktuell = ($current -eq $Version)
    }
    if ($Check) { return }
    if ($current -ne $Version) {
        $new = [regex]::Replace($content, $Pattern, $Replacement)
        # UTF8 ohne BOM schreiben - Cargo und Node stolpern sonst.
        [System.IO.File]::WriteAllText($full, $new, (New-Object System.Text.UTF8Encoding($false)))
    }
}

# package.json - nur das oberste "version"-Feld, nicht die Abhaengigkeiten
Set-FileVersion -Path 'package.json' -Label 'package.json' `
    -Pattern '("version"\s*:\s*")([0-9]+\.[0-9]+\.[0-9]+)(")' `
    -Replacement ('${1}' + $Version + '${3}')

# tauri.conf.json
Set-FileVersion -Path 'src-tauri\tauri.conf.json' -Label 'tauri.conf.json' `
    -Pattern '("version"\s*:\s*")([0-9]+\.[0-9]+\.[0-9]+)(")' `
    -Replacement ('${1}' + $Version + '${3}')

# Cargo.toml - Zeile direkt unter [package]
Set-FileVersion -Path 'src-tauri\Cargo.toml' -Label 'Cargo.toml' `
    -Pattern '(?m)^(version\s*=\s*")([0-9]+\.[0-9]+\.[0-9]+)(")' `
    -Replacement ('${1}' + $Version + '${3}')

# ---------------------------------------------------------------------------
#  src\version.ts - vom About-Dialog gelesen, damit die UI die Version auch
#  im Browser-Dev-Modus kennt (wo kein Tauri-Backend erreichbar ist).
# ---------------------------------------------------------------------------
$versionTs = Join-Path $RepoRoot 'src\version.ts'
$tsContent = @"
// AUTOMATISCH ERZEUGT von scripts/sync-version.ps1 - nicht manuell bearbeiten.
// Quelle: scripts/release.config.psd1

export const APP_VERSION = "$Version";
export const APP_NAME = "$($Cfg.AppName)";
export const APP_PUBLISHER = "$($Cfg.AppPublisher)";
export const APP_CLAIM = "$($Cfg.AppClaim)";
export const APP_URL = "$($Cfg.AppUrl)";
export const APP_COPYRIGHT = "$($Cfg.AppCopyright)";
"@

if (-not $Check) {
    [System.IO.File]::WriteAllText($versionTs, $tsContent, (New-Object System.Text.UTF8Encoding($false)))
}

# ---------------------------------------------------------------------------
#  Ausgabe
# ---------------------------------------------------------------------------
$results | Format-Table -AutoSize | Out-String | Write-Host

if ($Check) {
    $bad = $results | Where-Object { -not $_.Aktuell }
    if ($bad) {
        Write-Host "Versionen weichen ab. Erwartet: $Version" -ForegroundColor Red
        exit 1
    }
    Write-Host "Alle Versionen stimmen ueberein ($Version)." -ForegroundColor Green
    exit 0
}

Write-Host "Version $Version gesetzt (inkl. src/version.ts)." -ForegroundColor Green
exit 0
