# Features — AI Writer Studio

Vollständige Feature-Liste, gegliedert nach Bereich. Screenshot-Beschreibungen
sind als Platzhalter für die angedachte Bildposition notiert (`[Screenshot: …]`).

---

## Schreiben & Editor

- **Rich-Text-Editor** auf TipTap 2: Überschriften (H1–H3, wirken nur auf die
  aktuelle Zeile/Selection), Listen, Zitate, horizontale Linie, Undo/Redo,
  Platzhalter
- **Markdown-Unterstützung**: Markdown→HTML-Konvertierung, Absatz-erhaltende
  Verarbeitung
- **Fokusmodus** (F11) blendet alles außer dem Text aus
- **Automatisches Speichern** ohne Zutun
- **Wort- und Zeichenzähler** mit Speicherstatus
- **Versionsgeschichte** je Kapitel
- **Fragmente** für Textstellen ohne festen Platz

> [Screenshot: Editor mit Text, Toolbar oben, Wortzähler in der Statusleiste]

## Markdown-Viewer/Editor

- **Split-Preview**: Markdown-Quelle links, gerenderte Vorschau rechts
- Direktes **Editieren** und **Speichern** im Viewer
- Erweiterte Toolbar: Undo/Redo, Überschriften, Trennlinien

> [Screenshot: Markdown-Split-Ansicht, links Quelle, rechts gerendert]

## BookWriter (KI-Romanpipeline)

- Vollautomatischer Workflow: Inventar → Outline → Kapitelgenerierung über
  Ollama oder OpenAI-kompatible Endpunkte
- **Live-Vorschau** während der Generierung (Streaming)
- Kapitel pausieren, regenerieren, Qualitätsprüfung der generierten Kapitel
- **Kapitel-Integration**: generierte Kapitel werden mit einem Klick als echtes
  Kapitel (TipTap JSON) im Editor angelegt
- Robustes JSON-Parsing (`extractJson`), lange Timeouts (120–180 s) für
  langsame lokale Modelle
- Optionale **Bildgenerierung** für Bookwriter-Dokumente
  (DALL-E, Flux, lokale Stable Diffusion)

> [Screenshot: BookWriter-Ansicht mit Outline links, generierendem Kapitel rechts]

## Projektstruktur

- Projekte mit beliebig vielen Kapiteln
- **Figurenprofile**: Name, Alias, Alter, Beruf, Äußeres, Eigenschaften,
  Beziehungen (graphenartig, gerichtet, typisiert)
- **Ortsprofile** und freie **Notizen** mit Schlagworten
- **Timeline/Zeitstrahl** mit Ereignissen
- **Worldbuilding**: Orte, Welten, Kulturen
- **Recherche-Ablage**

## Projektwissen (RAG)

- Suchindex über Kapitel, Fragmente, Figuren, Orte, Notizen (Buch-Symbol 📚)
- **Strukturorientiertes Chunking**: schnittet an Überschriften und
  Satzgrenzen, kennt deutsche Abkürzungen (`z. B.`, `d. h.`) und
  Ordinalzahlen (`3. Kapitel`)
- **Drei Suchmodi**: semantisch (Embeddings), exakt (Wortlaut), hybrid
  (Rangfusion); lexikalischer BM25-Fallback ohne Einbettungsmodell
- **Frage an das Projekt** mit Kontextvorschau und Quellenangaben

> [Screenshot: RAG-Panel mit Frage, Ergebnissen und Quellenangaben]

## KI-Funktionen

- Weiterschreiben, Umschreiben, Zusammenfassen, Korrektur, Brainstorming,
  freier Chat — jeweils mit oder ohne Projektkontext
- **Stimmen-Labor** (Voice Lab) für Autorenstimmen
- Autocomplete, Dialoggen, Stiltransfer, Schreibimpulse
- Abweichungs-Detektor, Dialog mit dem Text, Traumlogik-Modi
- Wissenschaftlicher Schreibmodus
- **ModelPicker** in der Statusleiste (Modellnamen ohne `hf.co/`-Präfix)

## Plugins

Integrierter Plugin-Manager mit vier Bord-Plugins:

| Plugin | Zweck |
|---|---|
| **WordStats** | Stil-Kennwerte: Satzlänge, Vielfalt, Frequenzen |
| **Ideas** | Schreibimpulse und Brainstorming-Stütze |
| **Consistency** | Konsistenz-Befunde direkt am Text |
| **Markdown** | Markdown-Werkzeuge im Editor-Kontext |

> [Screenshot: Plugin-Store/Manager mit den vier Plugins]

## Manuskriptprüfung (Lupen-Symbol 🔍) — ohne KI, komplett lokal

- **Konsistenz**: Figurenalter, Ortsnamen (Editierdistanz), Perspektivsprünge,
  Zeitlinie, Begriffsdrift
- **Stil**: Füllwörter, Wortwiederholungen, Passivhäufung, Nominalstil,
  Klischees, überlange Sätze, gleichförmiger Rhythmus
- Kennwerte: Satzlänge/Streuung, Dialoganteil, lexikalische Vielfalt
- Einordnungen **Fehler / möglich / bewusst**; Entscheidungen überleben
  Prüfläufe (positionsloser Fingerabdruck)

## KDP-/Export-Preflight (Häkchen-Symbol ✅) — ohne KI, komplett lokal

- Struktur-, Frontmatter/Backmatter-, Format- und Zeichen-Regelwerk
  (Details siehe README)
- Befunde ignorieren / als bewusst markieren / mit Vorschlag versehen
- Ampelstatus rot/gelb/grün
- **KI-Offenlegungshinweis** für Amazon KDP

## KDP-Integration & Marketing

- KDP-Service mit Metriken und Exportvorbereitung
- **Blurb-Generator** für Buchmarketing
- **Cover-Generator-Prompt-Optimierer**
- Marketing-Service

## Investigative Journalism & Wasserzeichen

- **Investigative-Journalism-Module** für Recherche-lastige Sachtexte
- **Text-Wasserzeichen-Erkennung** in manuskriptnahen Texten

## Audio & Sprache

- **Whisper-Transkription** — Diktieren statt tippen
- **TTS** — Text vorlesen lassen
- **Stimmen-Labor**
- Audio-/Sprint-Panels

## Sprints & Analytics

- **Schreibsprints** mit Zielen
- **Analytics-Service** (Schreibstatistiken)

## Export

- DOCX, EPUB, PDF, Markdown, reiner Text
- Exportprüfung (Preflight) für DOCX/PDF/EPUB vor dem Export
- KDP-Exportvorbereitung inklusive Metriken

## Snapshots, Sicherheit & Cloud (optional)

- Snapshot-Versionierung: Service, Vergleich, Wiederherstellung
- AES-256-GCM-Verschlüsselung, PIN-Auth, Privacy-Gate, Backup-Container
- Git-Service: Entwurf → Endversion-Workflow
- Cloud-Sync (Dropbox, WebDAV) mit Offline-Queue und Konfliktauflösung
- Kollaborations-Datenmodell, Diff-Engine, Sharing

## Infrastruktur

- SQLite (sql.js) mit idempotentem Migrationssystem (001–015)
- i18n: Deutsch, Englisch (de/en/fr/es-Schlüsselparität getestet)
- Windows-Release-Kette: Inno-Setup-Installer, Portable-ZIP, Signierung,
  Delta-Updates, Tauri-Updater
- CI: Vitest-Coverage-Gates, Playwright-E2E, Pre-commit-Hooks
