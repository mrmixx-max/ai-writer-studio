# AI Writer Studio v1.0.0

## Features

### Sprint 1-3: BookWriter Fundament
- **Automatische Buchgenerierung** mit JSON-Extraktion, Retry mit Backoff
- **Rolling Context** für kohärente Kapitel
- **KDP-Export** (Markdown/DOCX/EPUB) mit Scrivener/Jutoh-Support
- **Red-Team-Suite**: 25 Injections gegen Prompt-Leakage und Context-Poisoning

### Sprint 4-5: Produktion & Scale
- **CLI-Dashboard** mit Live-Fortschritt und Modell-Routing
- **Human-in-the-Loop** mit Approval-Gates
- **Bulk-Processing** mit CSV-Queue und Cooldown
- **KDP-Metadaten-Export** mit Preis-ISBN-Strategien

### Sprint 6-7: Performance & UX
- **Ollama Connection Pool** + Prompt-Caching (-60% Token-Overhead)
- **5 Stil/Ton-Presets** (Wissenschaftlich, Blog, Jerry-Cotton, Sachbuch, Thriller)
- **Token-Analytics** mit ASCII-Trend-Charts und CSV-Export
- **KDP-Upload-Pipeline** mit AES-256-GCM-Verschlüsselung
- **Docker-Compose-Stack** für produktiven Betrieb

## Technische Daten
- **Tests:** 1760/1760 grün
- **Sprache:** TypeScript + React + Tauri 2 + Rust
- **LLMs:** Ollama (lokal) + OpenRouter (Cloud)
- **Lizenz:** Apache-2.0

## Installation
1. `AI-Writer-Studio-Setup-1.0.0-x64.exe` herunterladen
2. Installer ausführen
3. Ollama installieren (optional, für lokale Modelle)
4. App starten und Genre auswählen
