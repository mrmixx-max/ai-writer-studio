# Changelog

Alle nennenswerten Änderungen an AI Writer Studio werden in dieser Datei
dokumentiert. Das Format folgt [Keep a Changelog](https://keepachangelog.com/de/1.1.0/)
und [Semantic Versioning](https://semver.org/).

## [Unreleased] — Änderungen seit [1.0.0]

### Added — Redaktion & Revisions-Loop (Sprint 2, Agent 4)
- Revisions-Pipeline `reviseChapter(chapterId, mode)`: straffen (−10 %, Füllwörter), vertiefen (+15 %, Beispiele), stil (Stilprofil) — mit withRetry, Abort/4xx-Durchreichung und lokalem Straffungs-Fallback
- Status-Loop: needs_revision/completed → draft nach jeder Revision, Revisionshistorie in neuer Tabelle `chapter_revisions` (Migration 019)
- Stilprofile { id, name, systemHint, rules[] } pro Projekt: 3 Presets (Sachbuch klar, Ratgeber warm, Thriller temporeich) + Markdown-Import mit YAML-Frontmatter (ohne yaml-Dependency)
- Lesbarkeits-Metriken ohne LLM: Flesch Reading Ease (deutsch), Ø-Satzlänge, Füllwort-Quote, Passiv-Schätzung; Schwellenwerte konfigurierbar
- Review-UI `ChapterReview.tsx`: Kapitel-Liste mit Status- + Metrik-Badges, Aktionen Straffen/Vertiefen/Stil/completed, aufklappbare Revisionshistorie, Budget-Warnung aus der Telemetrie sperrt LLM-Aktionen

### Added — BookWriter
- Kapitel-Content-Integration: generierte Kapitel werden als echtes Kapitel (TipTap JSON) im Editor angelegt (30415ea, 29bfe89)
- Vollautomatischer BookWriter: Outline + Kapitel via Ollama (4b23d14)
- Live-Vorschau während der Generierung (93c542a)
- Robustes JSON-Parsing für BookWriter-Antworten (extractJson) (b352347)

### Added — Markdown & Plugins
- Markdown-Viewer/Editor mit Split-Preview, Editieren und Speichern (cd27460)
- Markdown→HTML-Konvertierung + erweiterte Toolbar (Undo/Redo, Überschriften, Linie) (a6f579b)
- Vier neue Plugins: WordStats, Ideas, Consistency, Markdown (ceba95e)

### Fixed
- H1/H2/H3-Buttons wirken nur auf die aktuelle Zeile/Selection statt auf den ganzen Text (5c6a728)
- Release-Build: Fenster bleibt sichtbar — `.show()` entfernt, Sichtbarkeit via tauri.conf.json (acf1770)
- Fenster-Startposition x=100/y=100 (Fenster war unsichtbar) (e4d5265)
- Absätze im BookWriter-Prompt + Markdown-Parser (7b0e69a)
- BookWriter-Export: in Editor einfügen + Markdown anzeigen (ad397ee)
- BookWriter-Timeouts: 120 s/180 s, timeoutMs in ChatOptions (5f8ad82, 0ef7314)
- openai-compatible listModels-Timeout (b336f28)
- setLiveText als Arrow Function (554e968)
- BookWriter-Import-Pfad + ungenutzte Variable (fecdd07)
- ModelPicker: verkürzter Modellname ohne `hf.co/`-Präfix (5c09afc, 3e4c5ea)

### Changed
- ModelPicker vom App-Header in die Statusleiste verschoben (nach Crash-Reverts, 00d070a)

## [1.0.0] — 2026-08-28

Erster produktionsreifer Release. Enthält alle Features seit dem initialen
v0.1.0-Stand.

### Added — Schreiben & Editor
- Rich-Text-Editor auf TipTap 2 mit Überschriften, Listen, Zitaten, Platzhalter, Undo/History
- Fokusmodus (F11), automatisches Speichern, Wort-/Zeichenzähler
- Versionsgeschichte je Kapitel; Fragmente für Textstellen ohne festen Platz

### Added — Projektstruktur
- Projekte mit beliebig vielen Kapiteln (`.aiwsproj` / `.aiwschapter` Dateizuordnungen)
- Figurenprofile (Name, Alias, Alter, Beruf, Äußeres, Eigenschaften) — Migration 007
- Figurenbeziehungen (graphenartig, gerichtet, typisiert) — Migration 011
- Timeline/Zeitstrahl mit Ereignissen — Migration 008
- Worldbuilding (Orte, Welten, Kulturen) — Migration 013
- Recherche-Ablage — Migration 015

### Added — Projektwissen (RAG)
- Suchindex über Kapitel, Fragmente, Figuren, Orte, Notizen — Migration 002
- Strukturorientiertes Chunking mit deutschen Abkürzungen und Ordinalzahlen
- Drei Suchmodi: semantisch (Embeddings), exakt, hybrid (Rangfusion)
- Lexikalischer BM25-Fallback ohne Einbettungsmodell, mit Einschränkungs-Hinweis
- Frage-an-das-Projekt mit Kontextvorschau und Quellenangaben
- RAG-Dokumente für den Bookwriter (fbda99e)

### Added — KI-Funktionen
- Weiterschreiben, Umschreiben, Zusammenfassen, Korrektur, Brainstorming, freier Chat — jeweils mit/ohne Projektkontext
- KI-Features-Datenmodell (Prompts, Läufe, Ergebnisse) — Migration 012
- Autocomplete, Dialoggen, Stiltransfer, Schreibimpulse (`services/aiwriting`)
- Stimmen-Labor (Voice Lab) — Migration 010
- Wissenschaftlicher Schreibmodus (9aaa0c7)

### Added — Bookwriter (KI-Romanpipeline)
- Datenmodell, State-Machine, Prompts, Workflow (3777349) — Migrationen 004–006
- Kapitelgenerierung mit Streaming, Pause, Regenerierung (c2b42bb/c2bae97)
- Qualitätsprüfung der generierten Kapitel
- Optionale Bildgenerierung für Bookwriter-Dokumente (DALL-E, Flux, lokale SD) — 2ed3a08

### Added — Manuskriptprüfung & Preflight
- Konsistenz- und Stil-Checker (regelbasiert, ohne KI): Füllwörter, Passiv,
  Klischees, Figurenalter, Ortsnamen, Perspektive, Zeitlinie, Begriffsdrift (752401f)
- KDP-/Export-Preflight mit Regelwerk, Filter, Persistenz, Export-Gate (9fe614c, 2ef2833)
- Befund-Entscheidungen (ignorieren / bewusst so / Vorschlag) überleben Prüfläufe
  dank positionslosem Fingerabdruck
- Ampelstatus: rot/gelb/grün
- KI-Offenlegungshinweis für Amazon KDP

### Added — Snapshots & Diagnostik
- Snapshot-Versionierung: Service, Vergleich, Wiederherstellung (d48aac7)
- Diagnostik-Runner mit persistenter Protokollierung

### Added — Marketing & KDP
- KDP-Service mit Metriken und Exportvorbereitung (`services/kdp`)
- Blurb-Generator für Buchmarketing (1335cbf)
- Cover-Generator-Prompt-Optimierer (1712fd5)
- Marketing-Service (`services/marketing`)

### Added — Kollaboration & Cloud (optional)
- Kollaborations-Datenmodell, Diff-Engine, Sharing — Migration 014
- Cloud-Sync: Dropbox, WebDAV, Offline-Queue, Konfliktauflösung (`services/cloud`)

### Added — Audio & Sprache
- TTS-Service, Whisper-Transkription, Voice-Service (`services/tts`, `whisper`, `voice`)
- Audio-/Sprint-Panels (7d37727)

### Added — Sprints & Analytics
- Schreibsprints mit Zielen (`services/sprint`)
- Analytics-Service (`services/analytics`)

### Added — Infrastruktur & Qualität
- SQL.js-Schema auf Migrationssystem umgestellt (001–015), idempotent, protokolliert in `schema_migrations`
- Performance-Indizes — Migration 009
- Zentraler Logger + React.memo für Befundkarten (ea839ec)
- E2E-Workflow-Test für Bookwriter; Vitest-Suite über Services und Migrationen
- Windows-Release-Kette: Installer (Inno Setup), Portable-ZIP, Signierung,
  Delta-Updates, Update-Manifest, Tauri-Updater mit Public Key (61ea3af)
- Erststart-Assistent, i18n (DE/EN), Plugin-Ordnerstruktur
- Git-Service mit Tauri-Backend (`services/git`, `src-tauri/src/git.rs`)

### Fixed
- Unicode-Support in der Stil-Analyse-Regex (060ea4e)
- Bookwriter-Qualitätstest + Migration 005 (c6b42bb)
- Alle Spezialbereiche waren unerreichbar (2620aed)

### Changed
- Lizenz auf Apache-2.0 gestellt (9a2d893)
- Source-Maps werden im Release-Build entfernt

## [0.1.0] — 2026-08-26

- Initiale Version: Editor, Projektverwaltung, Projektwissen, Export,
  KI-Anbindung (Ollama/LM Studio/OpenAI), Windows-Build-Pipeline

[1.0.0]: https://github.com/mrmixx-max/ai-writer-studio/releases/tag/v1.0.0
[0.1.0]: https://github.com/mrmixx-max/ai-writer-studio/releases/tag/v0.1.0
