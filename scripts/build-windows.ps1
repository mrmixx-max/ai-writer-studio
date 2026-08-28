<#
.SYNOPSIS
    Erstellt den Windows-Release-Build von AI Writer Studio.

.DESCRIPTION
    Fuehrt aus: Werkzeugpruefung, Versionsabgleich, Qualitaetstore
    (typecheck/lint/tests), Icon-Erzeugung, Frontend-Build, Tauri-Release
    und optional den Inno-Setup-Installer.
    Bricht bei jedem Fehler ab - es wird nie ein halbfertiges Artefakt
    als Erfolg gemeldet.

.PARAMETER SkipTests
    Ueberspringt typecheck, lint und Tests. Nur fuer Zwischenbuilds.

.PARAMETER SkipIcons
    Ueberspringt die Icon-Erzeugung.

.PARAMETER CreateInstaller
    Ruft nach dem Build create-installer.ps1 auf.

.PARAMETER Version
    Ueberschreibt die Version aus release.config.psd1.

.PARAMETER Sign
    Signiert EXE und Installer mit Authenticode (Code-Signing, siehe
    sign-binary.ps1). Ohne konfiguriertes Zertifikat wird mit Warnung
    ungesignat weitergearbeitet.

.PARAMETER Portable
    Erstellt zusaetzlich die portable ZIP-Version (create-portable.ps1).

.PARAMETER UpdateArtifacts
    Baut zusaetzlich die signierten Updater-Artefakte (.nsis.zip + .sig)
    und erzeugt daraus den Update-Feed latest.json. Erfordert den
    Tauri-Signaturschluessel unter "$HOME\<TauriSigningKey aus der Config>".

.EXAMPLE
    .\scripts\build-windows.ps1 -CreateInstaller
    .\scripts\build-windows.ps1 -CreateInstaller -Sign -Portable -UpdateArtifacts
#>

[CmdletBinding()]
param(
    [switch]$SkipTests,
    [switch]$SkipIcons,
    [switch]$CreateInstaller,
    [string]$Version,
    [switch]$Sign,
    [switch]$Portable,
    [switch]$UpdateArtifacts
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot   = Split-Path -Parent $ScriptDir
$ConfigPath = Join-Path $ScriptDir 'release.config.psd1'

# Gemeinsame Hilfsfunktionen (Test-Tool, Find-Iscc, Get-IsccHelpText).
. (Join-Path $ScriptDir 'common.ps1')

if (-not (Test-Path $ConfigPath)) { throw "Konfiguration nicht gefunden: $ConfigPath" }
$Cfg = Import-PowerShellDataFile -Path $ConfigPath
if ($Version) { $Cfg.AppVersion = $Version }

$TauriRelease = Join-Path $RepoRoot $Cfg.Paths.TauriRelease
$OutputDir    = Join-Path $RepoRoot $Cfg.Paths.OutputDir
$DistDir      = Join-Path $RepoRoot $Cfg.Paths.DistDir
$ExePath      = Join-Path $TauriRelease $Cfg.ExeName

$script:StepNo = 0
$script:TotalSteps = 7

function Write-Step {
    param([string]$Text)
    $script:StepNo++
    Write-Host ''
    Write-Host ("[{0}/{1}] {2}" -f $script:StepNo, $script:TotalSteps, $Text) -ForegroundColor Cyan
}
function Write-Ok    { param([string]$T) Write-Host "      OK   $T" -ForegroundColor Green }
function Write-Info  { param([string]$T) Write-Host "           $T" -ForegroundColor DarkGray }
function Write-Warn2 { param([string]$T) Write-Host "      !    $T" -ForegroundColor Yellow }

function Invoke-Checked {
    param(
        [Parameter(Mandatory)][string]$Exe,
        [string[]]$Arguments = @(),
        [string]$WorkDir = $RepoRoot,
        [Parameter(Mandatory)][string]$What
    )
    Push-Location $WorkDir
    try {
        & $Exe @Arguments
        if ($LASTEXITCODE -ne 0) { throw "$What fehlgeschlagen (Exitcode $LASTEXITCODE)." }
    } finally {
        Pop-Location
    }
}

Write-Host ''
Write-Host '===========================================================' -ForegroundColor White
Write-Host (" {0}  {1}" -f $Cfg.AppName, $Cfg.AppVersion) -ForegroundColor White
Write-Host ' Windows-Release-Build' -ForegroundColor DarkGray
Write-Host '===========================================================' -ForegroundColor White

# ---------------------------------------------------------------------------
#  1. Werkzeuge pruefen
# ---------------------------------------------------------------------------
Write-Step 'Werkzeuge pruefen'

if (-not (Test-Tool 'node')) {
    throw "Node.js wurde nicht gefunden. Installiere Node $($Cfg.MinNodeVersion) oder neuer: https://nodejs.org"
}
$nodeMajor = [int](((node --version) -replace '^v','') -split '\.')[0]
if ($nodeMajor -lt $Cfg.MinNodeVersion) {
    throw "Node $nodeMajor ist zu alt. Erforderlich: $($Cfg.MinNodeVersion) oder neuer."
}
Write-Ok "Node $(node --version)"

if (-not (Test-Tool 'npm')) { throw 'npm wurde nicht gefunden.' }
Write-Ok "npm $(npm --version)"

if (-not (Test-Tool 'cargo')) {
    throw @"
Rust/Cargo wurde nicht gefunden - der Tauri-Build ist ohne Rust nicht moeglich.

Installation:
  winget install Rustlang.Rustup
  rustup default stable-x86_64-pc-windows-msvc

Ausserdem noetig: Visual Studio Build Tools mit 'Desktopentwicklung mit C++':
  winget install Microsoft.VisualStudio.2022.BuildTools

Danach eine NEUE Konsole oeffnen, damit der PATH aktualisiert ist.
"@
}
Write-Ok "cargo $((cargo --version) -split ' ' | Select-Object -Index 1)"

if (-not (Test-Path (Join-Path $RepoRoot 'node_modules'))) {
    Write-Warn2 'node_modules fehlt - npm ci wird ausgefuehrt.'
    Invoke-Checked -Exe 'npm' -Arguments @('ci') -What 'npm ci'
}

$IsccPath = Find-Iscc

if ($IsccPath) {
    Write-Ok 'Inno Setup gefunden'
} elseif ($CreateInstaller) {
    throw (Get-IsccHelpText)
} else {
    Write-Info 'Inno Setup nicht gefunden (nur fuer den Installer noetig).'
}

# ---------------------------------------------------------------------------
#  2. Version abgleichen
# ---------------------------------------------------------------------------
Write-Step 'Version abgleichen'
& (Join-Path $ScriptDir 'sync-version.ps1') -Version $Cfg.AppVersion
if ($LASTEXITCODE -ne 0) { throw 'Versionsabgleich fehlgeschlagen.' }
Write-Ok "Version $($Cfg.AppVersion) in allen Dateien gesetzt"

# ---------------------------------------------------------------------------
#  3. Qualitaetstore
# ---------------------------------------------------------------------------
Write-Step 'Typecheck, Lint und Tests'
if ($SkipTests) {
    Write-Warn2 'Uebersprungen (-SkipTests). Nicht fuer Releases verwenden.'
} else {
    Invoke-Checked -Exe 'npm' -Arguments @('run','typecheck') -What 'Typecheck'
    Write-Ok 'Typecheck ohne Fehler'
    Invoke-Checked -Exe 'npm' -Arguments @('run','lint') -What 'Lint'
    Write-Ok 'Lint ohne Fehler'
    Invoke-Checked -Exe 'npm' -Arguments @('run','test') -What 'Tests'
    Write-Ok 'Tests bestanden'
}

# ---------------------------------------------------------------------------
#  4. Icons
# ---------------------------------------------------------------------------
Write-Step 'Icons erzeugen'
if ($SkipIcons) {
    Write-Info 'Uebersprungen (-SkipIcons).'
} elseif (Test-Tool 'python') {
    Invoke-Checked -Exe 'python' -Arguments @('scripts/generate_icons.py') -What 'Icon-Erzeugung'
    Write-Ok 'Icon-Set erzeugt'
} else {
    Write-Warn2 'Python nicht gefunden - vorhandene Icons werden verwendet.'
    if (-not (Test-Path (Join-Path $RepoRoot 'src-tauri\icons\icon.ico'))) {
        throw 'src-tauri\icons\icon.ico fehlt und kann ohne Python nicht erzeugt werden.'
    }
}

# ---------------------------------------------------------------------------
#  5. Frontend
# ---------------------------------------------------------------------------
Write-Step 'Frontend bauen (Vite)'
if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force }
Invoke-Checked -Exe 'npm' -Arguments @('run','build') -What 'Frontend-Build'

# Source-Maps duerfen nicht ins Release gelangen
$maps = @(Get-ChildItem -Path $DistDir -Filter '*.map' -Recurse -ErrorAction SilentlyContinue)
if ($maps.Count -gt 0) {
    Write-Warn2 "$($maps.Count) Source-Map(s) gefunden - werden entfernt."
    $maps | Remove-Item -Force
}
$distSize = [math]::Round((Get-ChildItem $DistDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB, 2)
Write-Ok "Frontend gebaut ($distSize MB)"

# ---------------------------------------------------------------------------
#  6. Tauri-Release
# ---------------------------------------------------------------------------
Write-Step 'Tauri-Release bauen (beim ersten Mal mehrere Minuten)'
Invoke-Checked -Exe 'npm' -Arguments @('run','tauri','--','build','--no-bundle') -What 'Tauri-Build'

if (-not (Test-Path $ExePath)) {
    throw "Erwartete Datei nicht gefunden: $ExePath"
}
$exeInfo = Get-Item $ExePath
Write-Ok ("{0} gebaut ({1:N2} MB)" -f $Cfg.ExeName, ($exeInfo.Length / 1MB))

$vi = $exeInfo.VersionInfo
if ($vi.FileVersion) {
    Write-Info "Dateiversion:  $($vi.FileVersion)"
    Write-Info "Produktname:   $($vi.ProductName)"
    Write-Info "Firma:         $($vi.CompanyName)"
    if ($vi.FileVersion -ne $Cfg.AppVersion) {
        Write-Warn2 "Versionsabweichung: EXE meldet $($vi.FileVersion), erwartet $($Cfg.AppVersion)."
    }
} else {
    Write-Warn2 'Keine Versionsinfo in der EXE - build.rs pruefen.'
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
Copy-Item $ExePath -Destination $OutputDir -Force
Write-Ok 'EXE nach release\ kopiert'

# ---------------------------------------------------------------------------
#  7. Installer
# ---------------------------------------------------------------------------
Write-Step 'Installer erstellen'
if ($CreateInstaller) {
    $installerArgs = @('-Version', $Cfg.AppVersion)
    if ($Sign) { $installerArgs += '-Sign' }
    & (Join-Path $ScriptDir 'create-installer.ps1') @installerArgs
    if ($LASTEXITCODE -ne 0) { throw 'Installer-Erstellung fehlgeschlagen.' }
} else {
    Write-Info 'Uebersprungen. Mit -CreateInstaller aktivieren.'
}

# ---------------------------------------------------------------------------
#  8. EXE signieren
# ---------------------------------------------------------------------------
if ($Sign) {
    Write-Step 'EXE signieren (Authenticode)'
    & (Join-Path $ScriptDir 'sign-binary.ps1') -Path $ExePath
    if ($LASTEXITCODE -ne 0) { throw 'Code-Signierung fehlgeschlagen.' }
}

# ---------------------------------------------------------------------------
#  9. Portable Version
# ---------------------------------------------------------------------------
if ($Portable) {
    Write-Step 'Portable Version erstellen'
    $portableArgs = @('-Version', $Cfg.AppVersion)
    if ($Sign) { $portableArgs += '-Sign' }
    & (Join-Path $ScriptDir 'create-portable.ps1') @portableArgs
    if ($LASTEXITCODE -ne 0) { throw 'Portable-Version-Erstellung fehlgeschlagen.' }
}

# ---------------------------------------------------------------------------
# 10. Update-Artefakte (Auto-Update-Feed)
# ---------------------------------------------------------------------------
if ($UpdateArtifacts) {
    Write-Step 'Updater-Artefakte und Update-Feed (latest.json)'

    # Signaturschluessel fuer Tauri bereitstellen.
    $keyPath = Join-Path $env:USERPROFILE $Cfg.TauriSigningKey
    if (-not (Test-Path $keyPath)) {
        throw "Tauri-Signaturschluessel nicht gefunden: $keyPath`nErzeugen mit:  npx tauri signer generate -w `"$keyPath`""
    }
    $env:TAURI_SIGNING_PRIVATE_KEY_PATH = $keyPath
    if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
        $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ''
    }
    Write-Ok "Signaturschluessel: $keyPath"

    # NSIS-Bundle erzeugt das signierte .nsis.zip fuer den Updater
    # (--no-build: Frontend/Rust wurden bereits in Schritt 6 gebaut).
    Invoke-Checked -Exe 'npm' -Arguments @('run','tauri','--','build','--bundles','nsis','--no-build') -What 'Tauri-NSIS-Bundle'

    & (Join-Path $ScriptDir 'generate-update-manifest.ps1') -Version $Cfg.AppVersion
    if ($LASTEXITCODE -ne 0) { throw 'Update-Feed-Erzeugung fehlgeschlagen.' }
}

# ---------------------------------------------------------------------------
#  Zusammenfassung
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '===========================================================' -ForegroundColor Green
Write-Host ' Build erfolgreich' -ForegroundColor Green
Write-Host '===========================================================' -ForegroundColor Green
Write-Host ''
Get-ChildItem $OutputDir -File | Sort-Object Name | ForEach-Object {
    Write-Host ("  {0,-50} {1,8:N2} MB" -f $_.Name, ($_.Length / 1MB))
}
Write-Host ''
exit 0
