# AI Writer Studio

**Ein lokales Manuskriptstudio für Romane, Sachbücher, Essays und KDP-Projekte.**

Schreiben, Projektwissen aufbauen, Konsistenz prüfen und exportieren — mit optionaler KI-Unterstützung durch Ollama, LM Studio oder OpenAI.

**Lokal-first.** Deine Manuskripte liegen als SQLite-Datei auf deinem Rechner. Kein Konto, kein Abo, keine Übertragung, solange du keinen Cloud-Anbieter einrichtest.

---

## Inhalt

- [Schnellstart](#schnellstart)
- [Funktionen](#funktionen)
- [KI-Anbieter einrichten](#ki-anbieter-einrichten)
- [Windows-Build](#windows-build)
- [Tests](#tests)
- [Projektstruktur](#projektstruktur)
- [Lizenz](#lizenz)

---

## Schnellstart

### Für Anwender

1. `AI-Writer-Studio-Setup-<version>-x64.exe` herunterladen und ausführen.
2. Die Installation läuft **ohne Administratorrechte** nach `%LOCALAPPDATA%\Programs\AI Writer Studio\`.
3. Beim ersten Start führt ein Assistent durch die Einrichtung. Er ist überspringbar — die App funktioniert ohne KI-Anbindung vollständig.

### Für Entwickler

```bash
git clone https://github.com/mrmixx-max/ai-writer-studio
cd ai-writer-studio
npm install

# Desktop-App im Entwicklungsmodus (benötigt Rust)
npm run dev

# Nur das Frontend im Browser (ohne Persistenz)
npm run dev:vite
```

**Voraussetzungen**

| Werkzeug | Version | Wofür |
|---|---|---|
| Node.js | 18 oder neuer | Frontend-Build |
| Rust | stable, MSVC-Toolchain | Tauri-Backend |
| Visual Studio Build Tools | 2019 oder neuer, mit „Desktopentwicklung mit C++" | Linker |
| Python | 3.9 oder neuer | Icon-Erzeugung, WASM-Kopie |
| Inno Setup | 6 oder 7 | Installer (optional) |

---

## Funktionen

### Schreiben

- **Rich-Text-Editor** auf TipTap 2 mit Überschriften, Listen, Zitaten
- **Fokusmodus** (F11) blendet alles außer dem Text aus
- **Automatisches Speichern** ohne Zutun
- **Wortzähler** mit Zeichen- und Speicherstatus
- **Versionsgeschichte** je Kapitel
- **Custom Extensions**: Character-Tags, Scene-Markers, Kapitel-Übersicht

### Projektstruktur

- Projekte mit beliebig vielen Kapiteln
- **Figurenprofile**: Name, Alias, Alter, Beruf, Äußeres, Eigenschaften, Beziehungen
- **Ortsprofile** und freie **Notizen** mit Schlagworten
- **Fragmente** für Textstellen ohne festen Platz
- **Timeline-Visualisierung** mit Canvas/SVG
- **Charakter-Beziehungsgraph** mit Kraftlinien-Simulation

### Worldbuilding

- **World-Bible**: Zentrale Welt-Info-Seite mit Orten, Regeln, Geschichte
- **Orte-Manager**: Locations mit Koordinaten, Beschreibung, Karten-Export
- **Lore/Glossenar-Editor**: Artefakte, Begriffe, Mythen, Organisationen
- **Konsistenz-Checker**: Prüft ob Charaktere/Orte konsistent verwendet werden

### Projektwissen (RAG)

Baut einen Suchindex über das gesamte Projekt auf — Kapitel, Fragmente, Figuren, Orte, Notizen.

- **Strukturorientiertes Chunking**: Schneidet an Überschriften und Satzgrenzen, nie mitten im Satz
- **Drei Suchmodi**: Semantisch (Einbettungen), exakt (Wortlaut), hybrid (Rangfusion)
- **Frage an das Projekt**: „Was weiß das Projekt über Figur X?"
- **Kontextvorschau** vor dem Senden an die KI
- **Quellenangaben** bei jeder Antwort

### KI-Funktionen

- **Grundfunktionen**: Weiterschreiben, Umschreiben, Zusammenfassen, Korrektur, Brainstorming, freier Chat
- **KI-Schreibassistent**: Auto-Complete, Style Transfer (Jünger, Hemingway, Kerouac…), Dialog-Generator, Writing-Prompts
- **Multi-Modell-Unterstützung**: Verschiedene Provider gleichzeitig
- **Prompt-Templates**: 12 kuratierte Genre-Vorlagen
- **KI-Chatverlauf**: Session-Persistenz mit Verlauf
- **KI-Analysen**: Sentiment, Stil, Lesbarkeit

### VoiceLab

- **Audio-Player** mit Waveform-Visualisierung (Web Audio API)
- **Batch-TTS**: Ganzes Buch vorlesen
- **Whisper-Transkript-Editor**: Korrigierbare Transkription
- **Audio-Notizen**: Sprachmemos zu Kapiteln

### Collaboration

- **Inline-Kommentare** zu Textpassagen
- **Änderungsverfolgung** (Track Changes)
- **Vorschläge** annehmen/ablehnen
- **Sharing**: Projekt teilen, Export mit Kommentaren

### Research

- **Research-Manager**: Web-Notizen, Screenshots, Links
- **Zitate & Quellen**: Zitierstile APA/MLA/Chicago
- **Literaturverwaltung**: Bücher, Artikel, Websites
- **Export von Quellen**

### Export

- **Formate**: DOCX, EPUB, PDF, Markdown, reiner Text
- **Import**: Scrivener (.scrivx), DOCX, Markdown
- **Multi-Platform-Publishing**: Smashwords, Draft2Digital, Kobo
- **Exportprüfung** (Preflight) vor DOCX/PDF/EPUB

### KDP-Integration

- **KDP-Checklist-Panel**: Fortschrittsbalken, Statusliste, Cover-Vorschau
- **KDP-Metadaten-Validierung**: Title, Beschreibung, Keywords, Kategorien
- **KDP-Export-Packaging**: Alles in einen Ordner
- **KDP-Preflight**: Struktur, Frontmatter, Formate, Zeichen

### Print & Layout

- **Print-Vorschau**: Seitenansatz, Umbrüche
- **PDF-Layout-Editor**: Seitenränder, Kopf-/Fußzeilen
- **Typography**: Schriften, Zeilenabstand, Absatzausrichtung
- **Book-Layout**: Hardcover/Softcover-Vorschau

### Writing-Analytics

- **Fortschritts-Tracking**: Wörter pro Tag/Session, 7-Tage-Balkendiagramm
- **Ziele**: Tägliches Wortziel + Deadline-Ziel
- **Sitzungs-Statistiken**: Schreibzeit, Pausen, Wörter/h
- **Streaks**: Aktueller und längster Schreib-Streak

### Plugin-System

- **Plugin-API**: Hooks, Events, Lifecycle
- **Plugin-Manager**: Installieren, aktualisieren, deaktivieren
- **Plugin-Store**: Lokale Registry
- **Beispiel-Plugin**: Word-Count-Badge

### Build & Distribution

- **Auto-Update**: Tauri-plugin-updater mit Progress-Events
- **Portable-Version**: `scripts/create-portable.ps1`
- **Code-Signing**: `scripts/sign-binary.ps1`
- **Delta-Updates**: `scripts/generate-delta.ps1`

---

## KI-Anbieter einrichten

Alle Anbieter sind **optional**. Ohne jeden Anbieter bleiben Editor, Projektverwaltung, Konsistenzprüfung, Export und die lexikalische Projektsuche vollständig nutzbar.

### Ollama (lokal, empfohlen)

```bash
ollama serve
ollama pull llama3.2            # Textmodell
ollama pull nomic-embed-text    # Für die semantische Projektsuche
```

Erwartet unter `http://localhost:11434`.

### LM Studio (lokal)

LM Studio installieren, ein Modell laden, den lokalen Server aktivieren.
Erwartet unter `http://localhost:1234`.

### OpenAI (Cloud)

API-Schlüssel in den Einstellungen eintragen. Der Schlüssel wird ausschließlich lokal gespeichert.

### OpenRouter (Cloud)

API-Schlüssel in den Einstellungen eintragen. Unterstützt hunderte Modelle.

### GPT2API (lokal)

Lokaler ChatGPT-Web-API-Gateway. Erwartet unter `http://localhost:8080`.

---

## Windows-Build

```powershell
.\scripts\build-windows.ps1 -CreateInstaller
```

Sieben Schritte, bricht bei jedem Fehler ab:

| # | Schritt | Was geprüft wird |
|---|---|---|
| 1 | Werkzeuge | Node ≥ 18, Rust/Cargo, optional Inno Setup |
| 2 | Version | Abgleich über alle vier Dateien |
| 3 | Qualität | `tsc`, ESLint, Tests |
| 4 | Icons | 30 Dateien aus `assets/icons/icon.svg` |
| 5 | Frontend | Vite-Build, Source-Maps werden entfernt |
| 6 | Tauri | Release-Binary, Versionsinfo wird verifiziert |
| 7 | Installer | Inno Setup (nur mit `-CreateInstaller`) |

---

## Tests

```bash
npm run test              # Alle Tests
npm run test:watch
npx vitest run src/services/knowledge     # Ein Bereich
```

**Stand: 574 Tests in 43 Dateien.**

---

## Projektstruktur

```
ai-writer-studio/
├── assets/icons/              Branding — SVG-Quelle und alle Ableitungen
├── docs/                      Dokumentation (DE/EN)
├── installer/                 Inno Setup
├── scripts/                   Build, Installer, Sync, Icons
├── src/                       Frontend (React + TypeScript)
│   ├── components/            UI-Komponenten
│   ├── services/              Business-Logik
│   ├── store/                 Zustand-Stores
│   ├── plugins/               Plugin-System
│   └── types/                 TypeScript-Typen
├── src-tauri/                 Rust-Backend (Tauri 2)
│   └── src/
│       ├── main.rs            Entry-Point
│       └── updater.rs         Auto-Update-Logic
├── package.json
├── tauri.conf.json
├── Cargo.toml
└── README.md
```

---

## Lizenz

Apache-2.0 License. Siehe [LICENSE.txt](../LICENSE.txt) für Details.

---

## Kontakt

- **Autor**: Erik Gieske
- **GitHub**: [mrmixx-max/ai-writer-studio](https://github.com/mrmixx-max/ai-writer-studio)
- **E-Mail**: erikgieske@gmail.com
