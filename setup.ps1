# AI Writer Studio - PowerShell Systemvoraussetzungs-Check (v1.3.0-RC1)
#
# Prüft die Systemvoraussetzungen für Entwicklung und Betrieb:
#   [1] Windows-Version + WSL2 (optional, für Linux-Tooling)
#   [2] Node.js (>= 20)
#   [3] Rust/Cargo (für den Tauri-Build)
#   [4] Ollama (CLI + Server auf :11434) - optional
#   [5] KI-Modelle: DeepSeek / Qwen via Ollama - optional
#   [6] Hermes-Agent-Gateway (:8080/health) - optional
#
# Aufruf:  powershell -ExecutionPolicy Bypass -File scripts\check-system.ps1
#          oder:  npm run check:system
# Exit 1, wenn eine PFLICHT-Anforderung fehlt; optionale Komponenten warnen nur.

$ErrorActionPreference = "Continue"
$script:failed = $false

function Write-Ok($msg)   { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) {
    Write-Host "  [FEHL] $msg" -ForegroundColor Red
    $script:failed = $true
}

Write-Host "=== AI Writer Studio v1.3.0-RC1 - System-Check ===" -ForegroundColor Cyan
Write-Host ""

# --- 1. Betriebssystem / WSL2 ------------------------------------------------
Write-Host "[1/6] Betriebssystem / WSL2" -ForegroundColor White

$osCaption = (Get-CimInstance Win32_OperatingSystem).Caption
Write-Host "  erkannt: $osCaption"
if ($osCaption -notmatch "Windows") {
    Write-Fail "Windows erforderlich (Tauri/MSVC-Build)."
} elseif ($osCaption -match "Windows 11|Windows 10") {
    Write-Ok "Windows 10/11 erkannt"
} else {
    Write-Warn2 "Ungetestete Windows-Version: $osCaption"
}

# WSL2 ist optional - die App ist ein natives Windows-(Tauri)-Produkt.
$wslOk = $false
try {
    $wslStatus = wsl.exe --status 2>$null | Out-String
    if ($LASTEXITCODE -eq 0 -and $wslStatus -match "Standardversion|Default Version") {
        if ($wslStatus -match "2") { Write-Ok "WSL2 installiert (optional, für Linux-Tooling)"; $wslOk = $true }
        else { Write-Warn2 "WSL1 statt WSL2 - für Entwicklung nicht erforderlich" }
    }
} catch {
    Write-Warn2 "WSL nicht installiert (optional - nur nötig für Linux-spezifisches Tooling)"
}
if (-not $wslOk) {
    Write-Host "         (optional; nachinstallierbar mit: wsl --install -d Ubuntu)" -ForegroundColor DarkGray
}
Write-Host ""

# --- 2. Node.js --------------------------------------------------------------
Write-Host "[2/6] Node.js (>= 20)" -ForegroundColor White
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = (node -v).TrimStart("v")
    $nodeMajor = [int]$nodeVer.Split(".")[0]
    if ($nodeMajor -ge 20) {
        Write-Ok "Node.js v$nodeVer (npm $(npm -v))"
    } else {
        Write-Fail "Node.js v$nodeVer zu alt - Version 20+ benötigt: https://nodejs.org"
    }
} else {
    Write-Fail "Node.js nicht gefunden - installieren mit: winget install OpenJS.NodeJS.LTS"
}
Write-Host ""

# --- 3. Rust (Tauri-Backend) --------------------------------------------------
Write-Host "[3/6] Rust / Cargo (Tauri-Backend)" -ForegroundColor White
if (Get-Command rustc -ErrorAction SilentlyContinue) {
    Write-Ok "$(rustc --version)"
    $rustVer = (rustc --version) -replace "rustc ", "" -replace " \(.*\)", ""
    $rustMajor = [int]($rustVer.Split(".")[0]); $rustMinor = [int]($rustVer.Split(".")[1])
    if (($rustMajor -lt 1) -or (($rustMajor -eq 1) -and ($rustMinor -lt 77))) {
        # MinRustVersion aus scripts/release.config.psd1 = 1.77
        Write-Warn2 "Rust $rustVer unter dem Release-Minimum 1.77 - rustup update empfohlen"
    }
} else {
    Write-Fail "Rust nicht gefunden - installieren mit: winget install Rustlang.Rustup && rustup default stable-msvc"
}
Write-Host ""

# --- 4. Ollama (optional) -----------------------------------------------------
Write-Host "[4/6] Ollama (optional, lokale KI)" -ForegroundColor White
$ollamaCli = Get-Command ollama -ErrorAction SilentlyContinue
if ($ollamaCli) { }
if ($ollamaCli) {
    Write-Ok "Ollama CLI: $(ollama --version 2>$null)"
} else {
    Write-Warn2 "Ollama-CLI nicht im PATH (optional - App läuft auch ohne KI)"
}
try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 3 -UseBasicParsing
    Write-Ok "Ollama-Server erreichbar unter http://localhost:11434"
    $models = ($resp.Content | ConvertFrom-Json).models | ForEach-Object { $_.name }
    if ($models) {
        Write-Host "         installierte Modelle: $($models -join ', ')" -ForegroundColor DarkGray
        $hasText = $models | Where-Object { $_ -match "deepseek|qwen|llama|mistral|gemma" }
        if ($hasText) { Write-Ok "Textmodell(e) vorhanden: $($hasText -join ', ')" }
        else { Write-Warn2 "kein bekanntes Textmodell - empfohlen: ollama pull deepseek-r1 / qwen2.5 / llama3.2" }
进出口    }
} catch {
    Write-Warn2 "Ollama-Server nicht erreichbar (http://localhost:11434) - starten mit: ollama serve"
}
Write-Host ""

# --- 5. DeepSeek / Qwen Modelle (optional) ------------------------------------
Write-Host "[5/6] DeepSeek / Qwen Modell-Profile (optional)" -ForegroundColor White
try {
    $resp2 = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 3
    $deepseek = $resp2.models | Where-Object { $_.name -match "deepseek" }
    $qwen     = $resp2.models | Where-Object { $_.name -match "qwen" }
    if ($deepseek) { Write-Ok "DeepSeek erkannt: $(($deepseek | ForEach-Object name) -join ', ')" }
    else { Write-Warn2 "kein DeepSeek-Modell - optional: ollama pull deepseek-r1:14b" }
    if ($qwen) { Write-Ok "Qwen erkannt: $(($qwen | ForEach-Object name) -join ', ')" }
    else { Write-Warn2 "kein Qwen-Modell - optional: ollama pull qwen2.5:7b" }
    Write-Host "         (Tuning-Profile in src/services/llm/localModelProfiles.ts werden automatisch angewendet)" -ForegroundColor DarkGray
} catch {
    Write-Host "         (übersprungen - Ollama-Server offline)" -ForegroundColor DarkGray
}
Write-Host ""

# --- 6. Hermes-Agent-Gateway (optional) ---------------------------------------
Write-Host "[6/6] Hermes-Agent-Gateway (optional, http://127.0.0.1:8080/health)" -ForegroundColor White
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:8080/health" -TimeoutSec 3 | Out-Null
    Write-Ok "Hermes-Agent-Gateway erreichbar unter http://127.0.0.1:8080"
} catch {
    Write-Warn2 "Hermes-Agent-Gateway nicht erreichbar (optional - CLI-Health-Ampel zeigt dann Gelb/Rot)"
}
Write-Host ""

# --- Fazit --------------------------------------------------------------------
if ($script:failed) {
    Write-Host "=== Check FEHLGESCHLAGEN: mindestens eine Pflicht-Anforderung fehlt ===" -ForegroundColor Red
    exit 1
}
Write-Host "=== System-Check bestanden - bereit für AI Writer Studio v1.3.0-RC1 ===" -ForegroundColor Cyan
exit 0
