# Changelog

Alle nennenswerten Änderungen dieses Projekts werden in dieser Datei dokumentiert.

## [1.1.0] - 2026-09-07

### Neu: Textformatierung & Bildgenerierung (Sprint 14)
- Textformatierung: Smart Quotes, Auto-Paragraph, Dash-Korrektur, Kapitel-Überschriften-Erkennung
- Bildgenerierung: Lokale Bilder über Ollama Vision oder SD WebUI

### Neu: Bilingual DE/EN (Sprint 15)
- Bilingual-Buch-Engine: Kapitel DE→EN übersetzen (LLM-basiert)
- Bilingual-Panel: Side-by-Side Vorschau
- Bilingual-Export: DE+EN nebeneinander
- Einstellungen: Standard-Zielsprache, Auto-Übersetzung

### Neu: Illustrierter Zeitungsgenerator (Sprint 16)
- Websearch: Nachrichten-Suche (DuckDuckGo, DE/EN)
- Artikel-Generator: LLM-generierte Artikel (3 Stile)
- News-Bilder: Artikel-Illustrationen + Social-Media-Cards
- Zeitungs-Layout: Automatisches Layout mit Seiten, TOC, Bild-Slots
- Zeitungs-Vorschau: Seiten-Navigation, Drucken, DE/EN

### Technik & Zuverlässigkeit (Sprints 12–16)
- Whisper-Härtung, TTS-Queue, Prompt-Template-Library (23 Genres)
- Backup/Restore mit Schema-Version, Settings-Persistenz-Audit
- Ollama-Resilienz, LLM-Router, Error-Boundaries
- Kapitel-Liste Memoize, KDP-Cover-Validierung
- Tests: 2627 grün, Typecheck/Lint sauber

## [1.0.0] - 2026-09-06

### Features

- Sprint 8 — Security, Monitoring, Performance, E2E
- 23 Genres, 8 Stil-Presets (ohne Jerry-Cotton)
- Sprint 7 — KDP-Upload, Performance, Stil-Presets, Analytics
- Stil/Ton-Input fuer Buchgenerierung (GUI + Prompts)
- Sprint 6 — Telemetrie, Prompt Library, Multilingual, Dockerization, GUI
- Sprint 5 — HITL, Bulk, KDP-Metadaten
- Sprint 4 — Orchestrierung, VBA, Asset-Bündelung, Grand Finale E2E
- Cover-Prompts, Marketing-Assets & Translator-Service
- Advanced Publishing — Scrivener OPML, Jutoh EPUB, VBA-Cleanup
- Redaktion & Revisions-Loop — Stilprofile, Lesbarkeit, Review-UI
- KDP Book-Export — Markdown/DOCX/EPUB, Export-Gate & Panel-UI (Agent 3, Sprint 2)
- Persistenz, Resume & UI — Jobs, Store, Panel
- AutoBookWriter Qualitaet & Kohaerenz — Rolling Context, Glossar, Wortzahl-Steuerung, Outline-Gate
- Kapitelplaner UI + ChapterEngine-Integration
- KapitelEngine mit chunkweiser Generierung + Wortzahl-Steuerung
- Kapitel-Datenmodell + Wortzählung + Store-Erweiterung
- BookWriter Kapitel-Content Integration
- BookWriter Kapitel mit Content anlegen (TipTap JSON)
- 4 neue Plugins (WordStats, Ideas, Consistency, Markdown)
- Markdown-Viewer/Editor (Split-Preview, Edit, Speichern)
- Markdown→HTML Konvertierung + erweiterte Toolbar (Undo/Redo/Linie)
- BookWriter mit Live-Vorschau (ohne DB-Persistenz)
- vollautomatischer BookWriter (Outline + Kapitel via Ollama)
- ModelPicker im App-Header (rechts oben)
- Auswahl-Modus Toggle (Maus-Selection + Rechtsklick-Kopieren)
- Speichern (HTML) + Drucken Buttons in Editor-Toolbar
- Whisper STT + TTS + Wasserzeichen + Investigativ-Journalismus zurückgebaut
- TTS-Panel via Web Speech API (kein Download, kein Modell)
- lokales Whisper (whisper.cpp) für Speech-to-Text
- add statistical watermark remover (port of claude-text-washer)
- ModelStatusBar — Offline-Edit + Starten-CTA statt roter Warnung
- LLM-Einstellungen komplett überarbeitet
- add scientific writing mode
- add blurb generator for book marketing
- add cover generator prompt optimizer
- 5 neue Panels (Style, Sprint, Audio, Characters, Timeline)
- optionale Bildgenerierung (DALL-E, Flux, lokale SD)
- RAG-Dokumente fuer Bookwriter
- KDP-Export-Preflight + Export-Gate + Apache-2.0 Lizenz

### Fixes

- E2E — KI-Chat Selektor input->textarea (echte UI); Smoke toleriert Ollama-Offline in CI
- CI Typecheck — resetOllamaPools statt nichtexistentem connectionPool; windows_subsystem als Crate-Attribut (Konsolen-Fenster Fix)
- Security Tests — validatePrompt/validateFilename Assertions korrigiert (toThrow statt .valid)
- Lint — ESLint Errors behoben (no-control-expr, unused imports)
- CI Coverage-Thresholds an echte Werte angepasst (Tests: 1763/1763 grün)
- CI — revise.test.ts Timestamp-Race-Condition behoben
- Ollama CORS-Check — Pre-Flight für lokale Instanzen
- FMEA-R-14 Zero-Width-Dedup + Red-Team R21-R25 + Local-Model-Profiles
- Robustheit & Retry — JSON-Extraktion + Abort + Timeout
- URL-Logging Trait-Fehler behoben
- nachhaltige Windows-Release-Absicherung
- Zombie-Kill vor Build (WebView2-Blockade verhindern)
- main.rs bereinigt — sauberer Einstiegspunkt, visible: true, .show() im setup
- Fenster-Sichtbarkeit definitiv gelöst
- windows_subsystem nur im Debug (Konsolenfenster unterdrücken)
- Fenster-Sichtbarkeit — set_always_on_top + 20x Retry-Thread
- Fenster-Sichtbarkeit — reveal_window Command + Retry-Thread
- Fenster verzögert anzeigen (100ms delay im setup hook)
- Fenster-Sichtbarkeit - --disable-gpu entfernt, Window-Positionierung erweitert
- JSZip statisch importieren (dynamic import hat Tests gebrochen)
- Release-Build Fenster Sichtbarkeit — .show() entfernt, Fenster bleibt via tauri.conf.json sichtbar
- H1/H2/H3 Buttons wirken nur auf aktuelle Zeile/Selection
- Absätze im BookWriter Prompt + Markdown-Parser
- BookWriter Export (In Editor einfügen + Markdown anzeigen)
- Fenster Position x=100 y=100 (war unsichtbar)
- robustes JSON-Parsing für BookWriter (extractJson)
- openai-compatible listModels timeout
- BookWriter timeout 120s/180s
- timeoutMs in ChatOptions (180s für BookWriter)
- setLiveText Arrow Function
- BookWriter Files entfernt (verursacht Crash)
- BookWriter Import-Pfad + ungenutzte Variable
- ModelPicker zeigt verkürzten Modellnamen (ohne hf.co/...)
- ModelPicker wieder in StatusBar (mit verkürztem Text)
- ModelPicker aus ModelStatusBar entfernt
- useActiveModel Import aus Editor entfernt
- ModelPicker + selectModel aus KIPanel entfernt
- editor.setOptions statt setEditable (TipTap API)
- Kopieren-Button + contextmenu handler entfernt
- Textauswahl + Kontextmenü im Editor (user-select: text + contextmenu fix)
- handleDOMEvents statt handleContextMenu (TipTap API)
- natives Kontextmenü (Copy/Paste) im Editor erlauben
- setSlotId entfernt, slotId als Konstante
- watermark formatReport cap + navigation test regex radius
- watermark aiScore cap + investigate test assertions
- Web Speech API Typdefinitionen + whisper.cpp Config entfernt
- dialog plugin config (null statt map für Tauri 2.2+)
- tao 0.37.0 (Event-Loop-Crash Fix) + Single-Instance entfernt
- Single-Instance komplett entfernt (blockiert Fenster)
- Software-Rendering erzwingen (tao-0.35.x Crash)
- KIPanel test assertion - insertContent IS called with AI_TEXT
- Rollback auf stabilen Stand + dialog ACL + visible=true
- Fenster visible=true (war unsichtbar)
- Single-Instance-Plugin entfernt (verursacht Hangs)
- dialog ACL freigeben (confirm, message, ask)
- declare const statt var für SpeechRecognition
- unused var in whisper service
- WhisperButton wieder in KIPanel eingebunden
- WhisperButton komplett aus KIPanel entfernt
- whisper-cli.exe Support (stdout statt Datei, -of entfernt)
- removeFile → remove (plugin-fs API)
- Modell-Dropdown + Slot-Health-Check aus KIPanel entfernt
- WhisperButton - echter Stop-Button, Mikrofon wird jetzt gestoppt
- KIPanel test assertion - insertContent IS called with AI_TEXT
- KIPanel test - pendingInserts is consumed by Editor useEffect
- test assertion for claims array + bracket matching
- investigate claims + kernfakten matching
- watermark formatReport caps at 100, investigate single-source test
- buildTimeline import added
- unused issues variable
- Test - Trigger-Pruefung nach Insert-Klick
- insertAtEnd - Fallback bei korruptem JSON (User-Verlust vermeiden)
- Test-Assertions an Queue-Leerung und Empty-Guard angepasst
- Tests an Bug-Fixes angepasst (Queue, Empty-Guard, Retry)
- Tests auf pendingInserts Queue aktualisiert
- 5 Bugs in insertIntoDoc/Editor-Integration
- insertAtEnd aktualisiert auch content für Test-Kompatibilität
- insertIntoDoc + Senden-Button
- PositionalParameterNotFound bei Installer-Splatting verhindern
- Mock LLM-Provider in quality und chapter-gen Tests
- vitest testTimeout auf 30s (sql.js WASM-Loading)
- Unicode-Support in Stil-Analyse Regex
- bookwriter quality test + migration 005

### Docs

- Sprint 7 Abschlussbericht
- Abschlussbericht Sprint 5
- Abschlussbericht Sprint 4
- Abschlussbericht Sprint 3
- Production-Ready Documentation

### Sonstiges

- merge: Sprint 8 Production-Readiness
- test: Resilienz & Routing — FMEA, Red-Team, E2E, Router, Telemetrie
- debug: DevTools + WebView2 URL logging hinzugefügt
- debug: Konsolen-Subsystem für Fenster-Diagnose
- perf: Production Performance Optimizations
- revert: zurück zu stabilem Stand (Crash-Debug)
- revert: zurück zu stabilem Stand d64512e (vor ModelPicker-Änderungen)
- revert: ModelPicker aus App.tsx (verursacht Crash)
- v1.0.0: Production-ready release
- perf: React.memo fuer Befundkarten + zentraler Logger
- Bookwriter: Kapitelgenerierung mit Streaming, Pause, Regenerierung
- Bookwriter: Datenmodell, Statemachine, Prompts, Workflow
- Preflight-Oberflaeche und Snapshot-Ansicht
- Snapshot-Versionierung: Service, Vergleich, Wiederherstellung
- Preflight: Service-Schicht mit Filter, Persistenz und Export-Gate
- KDP-Preflight: Datenmodell, Migration und Regelwerk
- Manuskriptpruefung: Oberflaeche mit vier Untertabs
- Konsistenz- und Stil-Checker: regelbasierter Kern
- Projektwissen-Oberflaeche und Fix: alle Spezialbereiche waren unerreichbar
- README: Stand der unfertigen Bereiche klarstellen

Alle nennenswerten Änderungen dieses Projekts werden in dieser Datei dokumentiert.

