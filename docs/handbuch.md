# AI Writer Studio — Benutzerhandbuch

> Stand: Sprint 10 · Deutsch. Alle UI-Bezeichnungen in Anführungszeichen sind
> gegen die tatsächlichen Komponenten verifiziert (grep über `src/components`).
> Erfundene Menünamen wurden bewusst vermieden.

## Inhalt

1. [Installation](#1-installation)
2. [Ollama einrichten (inkl. CORS / OLLAMA_ORIGINS)](#2-ollama-einrichten-inkl-cors--ollama_origins)
3. [Schreib-Workflows (Editor, Sidebar, Modi)](#3-schreib-workflows-editor-sidebar-modi)
4. [BookWriter (automatische Buchgenerierung)](#4-bookwriter-automatische-buchgenerierung)
5. [KDP-Export (Checkliste, Paket, Pre-Upload)](#5-kdp-export-checkliste-paket-pre-upload)
6. [Allgemeiner Export (Export ▾)](#6-allgemeiner-export-export-)
7. [Modell-Manager (Modelle (lokal))](#7-modell-manager-modelle-lokal)
8. [Updater (App-Updates)](#8-updater-app-updates)
9. [Einstellungen im Überblick](#9-einstellungen-im-überblick)
10. [Troubleshooting](#10-troubleshooting)
11. [In-App-Hilfe (HelpPanel)](#11-in-app-hilfe-helppanel)

---

## 1. Installation

**Voraussetzungen:** Windows 10/11 (64-bit). Für lokale KI-Modelle zusätzlich
[Ollama](https://ollama.com) (siehe Kapitel 2).

**Schritte:**

1. Installer aus dem Release herunterladen und ausführen
   (`npm run release:windows` erzeugt ihn; Skripte unter `scripts/`).
2. App starten. Beim ersten Start wird die lokale SQLite-Datenbank angelegt —
   Projekte und Kapitel werden dort automatisch gespeichert.
3. Optional: Dev-Modus für Entwickler mit `npm run dev:vite`
   (Browser unter `http://localhost:5173`) — siehe CORS-Hinweis in Kapitel 2.
4. Gesundheit prüfen: `npm run verify`
   (`typecheck` + `lint` + `test`).

**Datenablage:** Projekte/Kapitel in SQLite, Einstellungen lokal im Browser-
Storage (`localStorage`, u. a. Theme). API-Keys („API-Key“-Felder der
Anbieter-Karten) werden nur lokal gespeichert und nie versendet außer an den
konfigurierten Anbieter.

---

## 2. Ollama einrichten (inkl. CORS / OLLAMA_ORIGINS)

Verifizierte UI: Panel **„Einstellungen"**, Abschnitt **„Anbieter"** mit
Anbieter-Karten (`src/components/Settings/SettingsPanel.tsx`).

**Ollama verbinden:**

1. Ollama installieren und starten. Standard-Adresse: `http://localhost:11434`.
2. In der App **„Einstellungen"** öffnen → Abschnitt **„Anbieter"**.
3. Ollama-Karte über **„Felder"** (`<summary>Felder</summary>`) aufklappen.
4. **„Ollama-Base-URL"** eintragen (Hilfetext unter dem Feld:
   *„Adresse des lokalen Ollama-Servers, z. B. http://localhost:11434"*).
5. **„Verbindung testen"** klicken. Währenddessen steht dort **„Teste…"**.
   Erfolg: Status-Ampel + Text **„erreichbar · … ms"** plus **„… Modelle"**.
6. Im Feld **„Modell"** ein erkanntes Modell wählen
   (Hinweis *„… Modelle gefunden."*) oder den Namen frei eintippen
   (Platzhalter *„z.B. llama3.2"*).
7. **„Speichern"** klicken (zeigt **„Speichern •"** bei Änderungen).
   Der gelbe Punkt (`Ungespeicherte Änderungen`) markiert Dirty-State;
   **„Änderungen verwerfen"** setzt alle Felder zurück.

**Weitere Anbieter** (gleiche Karten-Logik): LM Studio
(*„OpenAI-kompatible Adresse des LM Studio-Servers, z. B.
http://localhost:1234/v1"*), OpenAI / OpenRouter / Nous
(**„API-Key"** mit Präfix-Prüfung, z. B. *„OpenAI-Schlüssel beginnen mit
„sk-…"."*), gpt2api (**„API-Key (optional)"** + Gateway-URL).

**CORS / `OLLAMA_ORIGINS` (nur Browser/Dev-Modus relevant):**

- Die Desktop-App (Tauri) schickt LLM-Requests über den Tauri-Kern — **kein
  Browser-CORS-Problem** (`src/services/llm/localModelProfiles.ts`).
- Im **Dev-Modus im Browser** (`http://localhost:5173`) prüft Ollama selbst
  den `Origin`-Header und antwortet mit **403**, wenn der Origin fehlt
  (`src/services/llm/ollamaCors.ts`, Meldung: *„Ollama blockiert
  CORS-Requests von … Starten Sie Ollama mit: OLLAMA_ORIGINS="…" ollama
  serve"*).
- **Lösung:** Ollama mit allen App-Origins starten:

  ```sh
  OLLAMA_ORIGINS="tauri://localhost,http://tauri.localhost,http://localhost:5173" ollama serve
  ```

  (Exakte Liste: `OLLAMA_CORS_ORIGINS` in
  `src/services/llm/localModelProfiles.ts`. Docker-Beispiel mit
  `OLLAMA_ORIGINS=http://localhost:8080,http://localhost,app://.` in
  `docker-compose.yml`.)
- Gelb/Rot-Ampel des CLI-Health-Monitors (`src/services/cli/healthMonitor.ts`):
  🟡 gelb = 403 → **„OLLAMA_ORIGINS setzen"**, 🔴 rot = nicht erreichbar.

---

## 3. Schreib-Workflows (Editor, Sidebar, Modi)

Verifiziert: `src/components/Sidebar/Sidebar.tsx`
(`mode-switcher`, Tabs, Projekt-Baum).

- **Sidebar links:** Projekt-Baum (Projekt anlegen/öffnen/umbenennen/löschen,
  Kapitel anlegen/öffnen/umbenennen/löschen). Unten die Tabs **„Projekte"**
  und **„Prompts"**.
- **Modus-Switcher** (`<nav className="mode-switcher">`): Icon-Buttons pro
  Modus. **„editor"** und **„prompts"** sind gleichzeitig Tabs;
  Spezial-Modi öffnen eigene Panels, u. a.:
  Wissen, Diagnose, Preflight, Snapshots, **KDP-Checkliste**,
  BookWriter, Fragmente, Stimmen/VoiceLab, Dialog, Versionen, Zeitstrahl,
  Worldbuilding, Cover-Generator, Bildgenerierung, Blurb-Generator.
- **Editor in der Mitte:** schreibt ins aktive Kapitel, speichert automatisch
  (SQLite). Leerer Zustand: Panel-Titel **„Noch kein Manuskript"**
  (`EmptyEditor.tsx`).
- **KI-Assistent (KIPanel):** u. a. Buttons **„Senden"** (Dialog),
  **„In Editor übernehmen"** (AIWritingAssistant), **„Suchen"** /
  **„Merken"** / **„Verlauf löschen"** / **„Export JSON"** /
  **„Export Markdown"** / **„Alles löschen"** (Memory-Bereich).
- **Schreibhilfen:** PromptGenerator (**„In Editor einfügen"**,
  **„Neues Kapitel"**, **„★ Favorit"**, **„Kopieren"**, **„Neu würfeln"**,
  **„⏱ 10-Min-Timer"**), FragmentPanel (**„+ Fragment"**,
  **„Zusammensetzen"**), CharactersPanel (**„Hinzufügen"**,
  **„Verknüpfen"**, Export **„JSON"** / **„CSV"** / **„Markdown"**),
  GitPanel (**„Pull"** / **„Push"**, **„Meine Fassung"**,
  **„Beide behalten"**, **„Merge abbrechen"**, **„Diff schließen"**).

---

## 4. BookWriter (automatische Buchgenerierung)

Verifiziert: `src/components/BookWriter/BookWriterDashboard.tsx`
(**„📖 BookWriter"**, **„▶ Fortsetzen"**, **„Später"**),
`src/components/Writing/BookWriterPanel.tsx` (Status-Labels).

**Ablauf (klassischer BookWriterPanel):**

1. Sidebar-Modus **„📖 BookWriter"** öffnen.
2. **Thema**, **Genre** (Default *„Sachbuch"*), **Zielgruppe**
   (Default *„Erwachsene"*), **Kapitelanzahl** (Default 8) und
   **Stil-Preset** (Dropdown aus der Stil-Bibliothek) wählen — die
   Preset-Beschreibung wird als Transparenz-Hinweis angezeigt.
3. Gliederung erzeugen (**Outline**), dann Kapitel generieren lassen.
   Ansicht umschaltbar: **„classic"** / **„planner"**
   (`viewMode`, `ChapterPlanner`).
4. **Kapitel-Status** (Badges, gleiche Quelle wie ChapterPlanner):
   **„Geplant"**, **„Generierung läuft"**, **„Entwurf"**,
   **„Überarbeitung nötig"**, **„Abgeschlossen"**.
5. Jedes fertige Kapitel wird **sofort** in SQLite geschrieben
   (Status **„Entwurf"**) — crash-sicher, überlebt App-Neustart.

**Dashboard + Recovery (BookWriterDashboardPanel / BookWriterRecoveryDialog):**

- Das Dashboard listet alle BookWriter-Läufe mit Live-Fortschritt und
  Steuerung — braucht kein offenes Kapitel.
- Nach einem Abbruch/Neustart fragt der Recovery-Dialog:
  **„▶ Fortsetzen"** (Projekt öffnen, ab Kapitel N weiter) oder
  **„Später"** (verwerfen). Technisch: Job-Status in `bookwriter_jobs`,
  Fortsetzung ab `resumeAtChapter`.

---

## 5. KDP-Export (Checkliste, Paket, Pre-Upload)

Verifiziert: `src/components/KDP/KdpChecklistPanel.tsx`
(**„KDP-Checkliste"**, **„↻"**, **„KDP-Paket exportieren"** /
**„Export läuft…"**, Hinweis *„Enthält DOCX, PDF, EPUB, Cover und
kdp-metadata.json in einem Ordner."*) und
`src/components/KDP/KdpPreUploadChecklist.tsx` (6 Checklisten-Labels).

**KDP-Checkliste (Modus „KDP-Checkliste"):**

1. Sidebar-Modus mit der **„KDP-Checkliste"** öffnen
   (braucht ein Projekt: sonst *„Wähle links ein Projekt, um die
   KDP-Checkliste zu sehen."*).
2. Kopfzeile **„KDP-Checkliste"** + **„↻"** (**„Neu laden"**).
3. Fortschritt: **„X/Y Punkte erfüllt"** mit Balken.
4. Ampel pro Punkt: **✔** ok / **⚠** Warnung / **✘** Fehler.
   Ohne Metadaten: *„Noch keine KDP-Metadaten — bitte zuerst die
   Metadaten-Phase ausführen."*; ohne Kapitel: *„Keine Kapitel vorhanden —
   bitte zuerst die Manuskript-Phase ausführen."*
5. Button **„KDP-Paket exportieren"** (währenddessen **„Export läuft…"**).
   Ergebnis-Hinweis z. B. *„KDP-Paket exportiert: N Dateien (… KB) in
   „…“."* Das Paket enthält **DOCX, PDF, EPUB, Cover und
   kdp-metadata.json in einem Ordner**.

**Pre-Upload-Checkliste (Pflicht vor dem KDP-Upload, blockiert den
Upload-Button bis alle Pflichtpunkte grün):**

| # | Label (exakt) | Pflicht? |
|---|---|---|
| 1 | **„Dateiformat DOCX/EPUB"** | ja |
| 2 | **„Dateigröße im Limit"** | ja |
| 3 | **„Metadaten vollständig (Titel, Klappentext, Keywords)"** | ja |
| 4 | **„Preis gesetzt (0,99–200 USD)"** | nein |
| 5 | **„Cover vorhanden"** | ja |
| 6 | **„ISBN (optional — KDP vergibt eigene)"** / **„ISBN gültig"** | nein |

---

## 6. Allgemeiner Export (Export ▾)

Verifiziert: `src/components/Export/ExportBar.tsx`
(**„Export ▾"**, **„Format"**, **„Bereich"**).

1. Oben in der App **„Export ▾"** klicken.
2. **„Format"** wählen: **DOCX**, **MD**, **TXT**, **PDF**, **EPUB**
   (im Menü in Großbuchstaben).
3. **„Bereich"** wählen: **„Ganzes Projekt"** oder
   **„Aktuelles Kapitel"**.
4. Export starten. Bei **DOCX/PDF/EPUB** läuft automatisch ein
   **Preflight-Check**; blockierende Befunde erfordern eine Bestätigung —
   der Export wird nie verhindert, aber transparent gemacht.
   (Bei Markdown/Text kein Preflight.)

---

## 7. Modell-Manager (Modelle (lokal))

Verifiziert: `src/components/Settings/ModelManager.tsx`
(**„Modelle (lokal)"**, **„Aktualisieren"**, **„Modell laden"**,
**„Laden"**, **„Abbrechen"**, **„Löschen"**).

- Kopf: **„Modelle (lokal)"** + Infozeile
  *„Ollama: … · Verzeichnis: …"* (Default-Verzeichnis-Hinweis
  `D:\ollama\models`, Adresse `http://127.0.0.1:11434`).
- **„Aktualisieren"** (währenddessen **„lädt…"**) lädt die installierte
  Liste neu. Leerzustände: *„Modelle werden geladen…"* /
  *„Keine Modelle installiert."* Mit Modellen: Name, Größe
  (`formatModelSize`), ggf. Parameter/Quantisierung, sowie
  *„Gesamt: …"*.
- **„Modell laden"**: Namen ins Feld **„Modellname zum Laden"**
  eintragen (Platzhalter *„z. B. llama3.2, qwen2.5:7b"*), Enter oder
  **„Laden"** (währenddessen **„lädt…"**). Fortschritt als
  Fortschrittsbalken (`role="progressbar"`, Prozent + Status);
  **„Abbrechen"** bricht ab (*„abgebrochen"*).
- Pro Modell: **„Löschen"** (währenddessen **„wird gelöscht…"**)
  mit Bestätigungsdialog (*„Modell „…“ wirklich löschen?"*).
- Warnung bei wenig Platz: *„⚠ Wenig freier Plattenplatz (…) — vor dem
  Laden eines Modells Speicher freigeben."*

---

## 8. Updater (App-Updates)

Verifiziert: `src/components/Settings/UpdateCheck.tsx`
(**„App-Updates"**, **„Nach Updates suchen"**,
**„Update installieren"**, **„Erneut prüfen"**,
**„Jetzt neu starten"**, Status-Texte).

Der Abschnitt **„App-Updates"** (in den Einstellungen, Backend-Commands
`check_for_updates` / `download_and_install_update` / `relaunch_app`,
Events `update://progress` + `update://installed`) zeigt:

- Status (`role="status"`): **„Noch nicht geprüft."** /
  **„Suche nach Updates …"** / **„Update verfügbar."** /
  **„Update wird heruntergeladen …"** / **„Update bereit."** /
  **„Die App ist aktuell."** / **„Fehler bei der Update-Prüfung."**
- Version: *„Installiert: …"* (ggf. *„→ …"* bei Verfügbarkeit),
  aufklappbar **„Release-Notes (…)"**.
- Aktionen: **„Nach Updates suchen"** →
  bei Verfügbarkeit **„Update installieren"** (+ **„Erneut prüfen"**).
  Fortschritt: **„Download-Fortschritt"** (Prozent oder *„… KB geladen"*).
- Fertig: *„Update … ist installiert. Bitte die App neu starten, um es zu
  verwenden."* + **„Jetzt neu starten"** (währenddessen
  **„Starte neu …"**).

---

## 9. Einstellungen im Überblick

Verifiziert: `src/components/Settings/SettingsPanel.tsx`
(**„Einstellungen"**, **„Anbieter"**, **„Modell"**, **„Temperatur"**,
**„Max Tokens"**, **„System-Prompt"**, **„Speichern"**,
**„Änderungen verwerfen"**).

| Feld (exaktes Label) | Bedeutung |
|---|---|
| **„Anbieter"** (Abschnitt) | Karten je Anbieter (ollama, lmstudio, openai, openrouter, gpt2api, nous) mit Status-Ampel, Latenz, Modell-Anzahl, aufklappbaren **„Felder"**, **„Verbindung testen"** / **„Teste…"** und **„aktiv"**-Badge |
| **„Modell"** | Aktive Modelle des Anbieters (*„… Modelle gefunden."* / *„Suche nach verfügbaren Modellen…"*), sonst freie Eingabe |
| **„Temperatur: …"** | Schieberegler 0–1 (*„Steuert die Kreativität der Antworten: 0 = exakt, 1 = einfallsreich."*) |
| **„Max Tokens"** | Zahl 256–8192 (*„Maximale Länge einer Antwort in Tokens (256–8192)."*) |
| **„System-Prompt"** | Textarea (*„Grundanweisung an das Modell, z. B. Ton und Rolle festlegen."*) |
| Theme / Sprache / Kontrast | `settings.theme` (dunkel/hell), `settings.language` (de/en/es/fr), Checkbox `settings.highContrast` mit Hinweis |
| **„Speichern"** / **„Änderungen verwerfen"** | Speichern (`Speichern •` bei Dirty) bzw. Reset (*„Alle ungespeicherten Änderungen zurücksetzen"*); Dirty-Punkt `Ungespeicherte Änderungen` |

---

## 10. Troubleshooting

| Symptom | Ursache / Lösung |
|---|---|
| Status *„unbekannt"* / *„nicht erreichbar"* in der Anbieter-Karte | Server läuft nicht oder falsche Base-URL. URL prüfen (*„Bitte eine gültige URL angeben (beginnend mit http:// oder https://)."*) |
| CORS/403 im Dev-Modus | Siehe Kapitel 2: Ollama mit `OLLAMA_ORIGINS` starten, dann erneut **„Verbindung testen"** |
| API-Key wird bemängelt | Präfix-Hinweis beachten (z. B. *„OpenAI-Schlüssel beginnen mit „sk-…"."*), Key neu einfügen, **„Speichern"** |
| Modell-Liste leer (*„Keine Modelle installiert."*) | Im Panel **„Modelle (lokal)"** per **„Modell laden"** + **„Laden"** ein Modell ziehen (z. B. `llama3.2`) |
| Kapitel/Projekt scheint weg | Projekt-Baum neu laden (Sidebar-`refresh`); Kapitel liegen in SQLite; BookWriter-Recovery (**„▶ Fortsetzen"**) beachten |
| Export schlägt fehl | Kleineren **„Bereich"** (**„Aktuelles Kapitel"**) testen; bei DOCX/PDF/EPUB die Preflight-Befunde lesen (Bestätigung möglich) |
| KDP-Export blockiert | **„KDP-Checkliste"**: *„Metadaten haben … Fehler — Export blockiert."* → Metadaten-Phase erneut ausführen; **„↻"** (**„Neu laden"**) |
| Update-Fehler (*„Fehler bei der Update-Prüfung."*) | Erneut **„Nach Updates suchen"** / **„Erneut prüfen"**; bei hartnäckigem Fehler Installer manuell ausführen |
| Wenig Plattenplatz | Warnung *„⚠ Wenig freier Plattenplatz …"* beachten: Speicher freigeben oder per **„Löschen"** ungenutzte Modelle entfernen |

---

## 11. In-App-Hilfe (HelpPanel)

Die Komponente `src/components/Help/HelpPanel.tsx` (Daten:
`src/components/Help/helpIndex.ts`) ist ein **standalone,
durchsuchbares Kurzhilfe-Overlay**:

- Suchfeld (**„Hilfe durchsuchen…"** / EN *„Search help…"*),
  Trefferzähler (`N/M`), aufklappbare Einträge
  (`aria-expanded`), Schließen-Button (**„✕"**, *„Hilfe schließen"*).
- **Deutsche Einträge + englischer Fallback** (`titleEn`/`bodyEn`);
  `helpTitle()`/`helpBody()` wählen anhand `lang` (`"en…"` → EN).
- Suche (`searchHelp()`): case-insensitiv über Titel, Body (DE+EN) und
  Keywords; leere Query → alle Einträge.
- Ändert **keine** bestehenden Panels; Einbindung bei Bedarf z. B. als
  Overlay-Button in der App-Shell.
