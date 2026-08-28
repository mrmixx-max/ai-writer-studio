<#
.SYNOPSIS
    Fuehrt einen vollstaendigen Release von AI Writer Studio durch.

.DESCRIPTION
    Zentrale Release-Pipeline. Schritte:

      1. Version pruefen/synchronisieren (sync-version.ps1 -Check)
      2. Qualitaet: typecheck, lint, Tests (ueberspringbar mit -SkipTests)
      3. CHANGELOG.md: bewegt [Unreleased] zu <Version> und erzeugt einen
         leeren [Unreleased]-Block (mit -ChangelogMessage wird der Block
         vorab gefuellt)
      4. Version auf den Zielwert setzen (sync-version.ps1 -Version)
      5. Build via build-windows.ps1 (Installer, optional Sign/Portable/Updates)

    Die Versionsnummer kommt aus scripts/release.config.psd1 oder dem
    -Version-Parameter (mit -SetConfig wird sie dauerhaft in die psd1
    zurueckgeschrieben).

.EXAMPLE
    .\scripts\release.ps1 -Version 1.1.0
    .\scripts\release.ps1 -Version 1.1.0 -SetConfig -CreateInstaller -Sign -Portable -UpdateArtifacts
    .\scripts\release.ps1 -Check                              # nur pruefen, nicht bauen
#>

[CmdletBinding()]
param(
    # Zielversion. Ohne Angabe wird AppVersion aus release.config.psd1 verwendet.
    [string]$Version,

    # Version auch dauerhaft in release.config.psd1 eintragen.
    [switch]$SetConfig,

    # Nur pruefen (Version-Sync) - kein Build, keine Schreibaktionen.
    [switch]$Check,

    # Qualitaetsschritte ueberspringen (nur fuer Zwischenbuilds).
    [switch]$SkipTests,

    # Ein-Zeilen-Beschreibung, die in den neuen [Unreleased]-Block kommt.
    [string]$ChangelogMessage,

    # An build-windows.ps1 durchgereichte Schalter.
    [switch]$CreateInstaller,
    [switch]$Sign,
    [switch]$Portable,
    [switch]$UpdateArtifacts
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
$ConfigPath = Join-Path $ScriptDir 'release.config.psd1'

function Step { param([string]$n) Write-Host "`n=== $n ===" -ForegroundColor Cyan }

# ---------------------------------------------------------------------------
#  Konfiguration laden
# ---------------------------------------------------------------------------
$Cfg = Import-PowerShellDataFile -Path $ConfigPath
if (-not $Version) { $Version = $Cfg.AppVersion }
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Ungueltige Version '$Version'. Erwartet wird SemVer, z. B. 1.2.3."
}

# ---------------------------------------------------------------------------
#  Schritt 1: Versionsabgleich pruefen
# ---------------------------------------------------------------------------
Step 'Schritt 1/5: Versionsabgleich pruefen'
& (Join-Path $ScriptDir 'sync-version.ps1') -Version $Version -Check
if ($LASTEXITCODE -ne 0) {
    if ($Check) { exit 1 }
    # Im echten Lauf setzt Schritt 4 alle Dateien ohnehin auf $Version.
}
if ($Check) { Write-Host "Check-Modus: OK (ohne Build)." -ForegroundColor Green; exit 0 }

# ---------------------------------------------------------------------------
#  Schritt 2: Qualitaet
# ---------------------------------------------------------------------------
if (-not $SkipTests) {
    Step 'Schritt 2/5: Qualitaet (tsc, eslint, vitest)'
    Push-Location $RepoRoot
    try {
        npm run verify
        if ($LASTEXITCODE -ne 0) { throw "Qualitaetspruefung fehlgeschlagen (npm run verify)." }
    } finally { Pop-Location }
} else {
    Write-Host "Schritt 2/5 uebersprungen (-SkipTests)." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
#  Schritt 3: CHANGELOG.md aktualisieren ([Unreleased] -> Version)
# ---------------------------------------------------------------------------
Step 'Schritt 3/5: CHANGELOG.md'

$ChangelogPath = Join-Path $RepoRoot 'CHANGELOG.md'
$today = (Get-Date).ToString('yyyy-MM-dd')
$nl = [Environment]::NewLine

if (Test-Path $ChangelogPath) {
    $cl = Get-Content $ChangelogPath -Raw -Encoding UTF8
    $unreleased = '## [Unreleased]'
    $idx = $cl.IndexOf($unreleased, [System.StringComparison]::Ordinal)
    if ($idx -ge 0) {
        # Inhalt des Unreleased-Blocks extrahieren (bis zur naechsten ##-Sektion)
        $rest = $cl.Substring($idx + $unreleased.Length)
        $nextSection = [regex]::Match($rest, '(?m)^## \[')
        $body = if ($nextSection.Success) { $rest.Substring(0, $nextSection.Index) } else { $rest }
        $body = $body.TrimEnd() + $nl

        $newRelease = "## [$Version] - $today$nl$nl$body$nl"
        $newUnreleased = "## [Unreleased]$nl"
        if ($ChangelogMessage) { $newUnreleased += "$nl- $ChangelogMessage$nl" }

        $cl2 = $cl.Remove($idx, $unreleased.Length + $body.Length)
        $cl2 = $cl2.Insert($idx, $newUnreleased + $nl + $newRelease)
        [System.IO.File]::WriteAllText($ChangelogPath, $cl2, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "[Unreleased] als [$Version] ($today) veroeffentlicht." -ForegroundColor Green
    } else {
        Write-Host "Kein [Unreleased]-Block gefunden - Changelog unveraendert." -ForegroundColor Yellow
    }
} else {
    Write-Host "CHANGELOG.md nicht gefunden - wird mit Grundgeruest angelegt." -ForegroundColor Yellow
    $header = "# Changelog$nl$nlAlle nennenswerten Aenderungen. Format: keepachangelog.com, SemVer.$nl$nl"
    $unrel  = "## [Unreleased]$nl"
    if ($ChangelogMessage) { $unrel += "$nl- $ChangelogMessage$nl" }
    $rel    = "$nl## [$Version] - $today$nl$nl- Erster dokumentierter Release.$nl"
    [System.IO.File]::WriteAllText($ChangelogPath, $header + $unrel + $rel, (New-Object System.Text.UTF8Encoding($false)))
}

# ---------------------------------------------------------------------------
#  Schritt 4: Version setzen (package.json, tauri.conf, Cargo.toml, version.ts)
# ---------------------------------------------------------------------------
Step 'Schritt 4/5: Version setzen'

if ($SetConfig -and $Version -ne $Cfg.AppVersion) {
    $cfgText = Get-Content $ConfigPath -Raw -Encoding UTF8
    $cfgText = [regex]::Replace($cfgText, "(AppVersion\s*=\s*')([0-9]+\.[0-9]+\.[0-9]+)(')", ('$1' + $Version + '$3'))
    [System.IO.File]::WriteAllText($ConfigPath, $cfgText, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "release.config.psd1: AppVersion -> $Version" -ForegroundColor Green
}

& (Join-Path $ScriptDir 'sync-version.ps1') -Version $Version
if ($LASTEXITCODE -ne 0) { throw "sync-version.ps1 fehlgeschlagen." }

# ---------------------------------------------------------------------------
#  Schritt 5: Build
# ---------------------------------------------------------------------------
Step 'Schritt 5/5: Build'

$buildArgs = @()
if ($Version)         { $buildArgs += @('-Version', $Version) }
if ($CreateInstaller) { $buildArgs += '-CreateInstaller' }
if ($Sign)            { $buildArgs += '-Sign' }
if ($Portable)        { $buildArgs += '-Portable' }
if ($UpdateArtifacts) { $buildArgs += '-UpdateArtifacts' }

& (Join-Path $ScriptDir 'build-windows.ps1') @buildArgs
if ($LASTEXITCODE -ne 0) { throw "Build fehlgeschlagen." }

Write-Host "${nl}Release $Version abgeschlossen. Artefakte in release\" -ForegroundColor Green
exit 0
