<#
.SYNOPSIS
    End-to-End Build-Pipeline für AI Writer Studio.

.DESCRIPTION
    Fuehrt den vollständigen Qualitätscheck und Build in Reihenfolge aus:
    Typecheck → Lint → Tests (inkl. E2E) → Build.
    Bricht bei jedem Fehler ab — es wird nie ein halbfertiges Artefakt
    als Erfolg gemeldet.

.PARAMETER SkipTests
    Ueberspringt Typecheck, Lint und Tests. Nur für Zwischenbuilds.

.PARAMETER SkipBuild
    Fuehrt nur Qualitätscheck aus, ohne den Vite-Build zu starten.

.EXAMPLE
    .\scripts\e2e-bookwriter.ps1
    .\scripts\e2e-bookwriter.ps1 -SkipBuild
#>

[CmdletBinding()]
param(
    [switch]$SkipTests,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir

$script:StepNo = 0
$script:TotalSteps = if ($SkipTests) { 1 } elseif ($SkipBuild) { 3 } else { 4 }

function Write-Step {
    param([string]$Text)
    $script:StepNo++
    Write-Host ''
    Write-Host ("[{0}/{1}] {2}" -f $script:StepNo, $script:TotalSteps, $Text) -ForegroundColor Cyan
}
function Write-Ok   { param([string]$T) Write-Host "      OK   $T" -ForegroundColor Green }
function Write-Warn { param([string]$T) Write-Host "      !    $T" -ForegroundColor Yellow }

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
Write-Host ' AI Writer Studio — E2E Bookwriter Pipeline' -ForegroundColor White
Write-Host '===========================================================' -ForegroundColor White

# ---------------------------------------------------------------------------
#  1. Typecheck
# ---------------------------------------------------------------------------
Write-Step 'Typecheck (tsc --noEmit)'
if ($SkipTests) {
    Write-Warn 'Uebersprungen (-SkipTests).'
} else {
    Invoke-Checked -Exe 'npm' -Arguments @('run', 'typecheck') -What 'Typecheck'
    Write-Ok 'Typecheck ohne Fehler'
}

# ---------------------------------------------------------------------------
#  2. Lint
# ---------------------------------------------------------------------------
Write-Step 'Lint (ESLint)'
if ($SkipTests) {
    Write-Warn 'Uebersprungen (-SkipTests).'
} else {
    Invoke-Checked -Exe 'npm' -Arguments @('run', 'lint') -What 'Lint'
    Write-Ok 'Lint ohne Fehler'
}

# ---------------------------------------------------------------------------
#  3. Tests (inkl. E2E)
# ---------------------------------------------------------------------------
Write-Step 'Tests (vitest run)'
if ($SkipTests) {
    Write-Warn 'Uebersprungen (-SkipTests).'
} else {
    Invoke-Checked -Exe 'npm' -Arguments @('run', 'test') -What 'Tests'
    Write-Ok 'Alle Tests bestanden (inkl. Bookwriter-E2E)'
}

# ---------------------------------------------------------------------------
#  4. Build
# ---------------------------------------------------------------------------
Write-Step 'Build (vite build)'
if ($SkipBuild) {
    Write-Warn 'Uebersprungen (-SkipBuild).'
} else {
    Invoke-Checked -Exe 'npm' -Arguments @('run', 'build') -What 'Build'
    $distSize = [math]::Round(
        (Get-ChildItem (Join-Path $RepoRoot 'dist') -Recurse -File -ErrorAction SilentlyContinue |
         Measure-Object -Property Length -Sum).Sum / 1MB, 2)
    Write-Ok "Build fertig ($distSize MB)"
}

# ---------------------------------------------------------------------------
#  Zusammenfassung
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '===========================================================' -ForegroundColor Green
Write-Host ' Pipeline erfolgreich' -ForegroundColor Green
Write-Host '===========================================================' -ForegroundColor Green
Write-Host ''
exit 0
