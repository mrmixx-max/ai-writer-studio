# AI Writer Studio — PowerShell Setup (Windows 11)
# Ausführen in PowerShell als normaler User (kein Admin nötig, außer für Winget-Installe).
# Startet im Ordner dieses Skripts.

$ErrorActionPreference = "Stop"

Write-Host "=== AI Writer Studio Setup ===" -ForegroundColor Cyan

# 1. Node.js 20+ prüfen / installieren
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "[1/5] Node.js nicht gefunden – installiere via Winget..." -ForegroundColor Yellow
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
} else {
    $nodeVer = (node -v).TrimStart("v").Split(".")[0]
    Write-Host "[1/5] Node.js v$(node -v) gefunden." -ForegroundColor Green
    if ([int]$nodeVer -lt 20) {
        Write-Host "Node 20+ benötigt. Bitte manuell aktualisieren: https://nodejs.org" -ForegroundColor Red
        exit 1
    }
}

# 2. Rust (für Tauri) prüfen / installieren
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "[2/5] Rust nicht gefunden – installiere via rustup-init..." -ForegroundColor Yellow
    winget install Rustlang.Rust.MSVC --accept-package-agreements --accept-source-agreements
    # Umgebung neu laden für diese Session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine")
} else {
    Write-Host "[2/5] Rust $(rustc --version) gefunden." -ForegroundColor Green
}

# 3. Tauri-Prerequisites (Microsoft Visual C++ Build Tools + WebView2)
Write-Host "[3/5] Tauri-Prerequisites: stelle sicher, dass 'vswhere' + MSVC vorhanden sind." -ForegroundColor Yellow
winget install Microsoft.VisualStudio.2022.BuildTools --accept-package-agreements --accept-source-agreements
# WebView2 Runtime (meist schon unter Win11 vorhanden)
Write-Host "WebView2 wird vorausgesetzt (Win11 Standard)."

# 4. .env aus Beispiel erzeugen, falls fehlend
if (-not (Test-Path .env)) {
    Write-Host "[4/5] .env aus .env.example erzeugen..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host ".env erstellt. OpenAI-Key bei Bedarf eintragen." -ForegroundColor Green
} else {
    Write-Host "[4/5] .env existiert bereits." -ForegroundColor Green
}

# 5. npm install + Tauri CLI
Write-Host "[5/5] npm install ausführen..." -ForegroundColor Yellow
npm install

Write-Host "=== Setup abgeschlossen ===" -ForegroundColor Cyan
Write-Host "Tests:     npm run test" -ForegroundColor White
Write-Host "Dev-Start:  npm run tauri dev" -ForegroundColor White
Write-Host "Build:      npm run tauri build" -ForegroundColor White
