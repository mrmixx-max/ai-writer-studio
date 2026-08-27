# AI Writer Studio

Ein lokales Manuskriptstudio für Romane, Sachbücher, Essays und KDP-Projekte.
Schreiben, Projektwissen aufbauen, Konsistenz prüfen und exportieren — mit
optionaler KI-Unterstützung durch Ollama, LM Studio oder OpenAI.

**Lokal-first.** Deine Manuskripte liegen als SQLite-Datei auf deinem Rechner.
Kein Konto, kein Abo, keine Übertragung, solange du keinen Cloud-Anbieter
einrichtest.

---

## Inhalt

- [Schnellstart](#schnellstart)
- [Funktionen](#funktionen)
- [Wo deine Daten liegen](#wo-deine-daten-liegen)
- [KI-Anbieter einrichten](#ki-anbieter-einrichten)
- [Windows-Build](#windows-build)
- [Installer erstellen](#installer-erstellen)
- [Stille Installation](#stille-installation)
- [Tests](#tests)
- [Projektstruktur](#projektstruktur)
- [winget-Vorbereitung](#winget-vorbereitung)
- [Code-Signing](#code-signing)
- [Bekannte Grenzen](#bekannte-grenzen)
- [Lizenz](#lizenz)

---

## Schnellstart

### Für Anwender

1. `AI-Writer-Studio-Setup-<version>-x64.exe` herunterladen und ausführen.
2. Die Installation läuft **ohne Administratorrechte** nach
   `%LOCALAPPDATA%\Programs\AI Writer Studio\`.
3. Beim ersten Start führt ein Assistent durch die Einrichtung. Er ist
   überspringbar — die App funktioniert ohne KI-Anbindung vollständig.

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

```powershell
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools
winget install JRSoftware.InnoSetup
rustup default stable-x86_64-pc-windows-msvc
```

Nach der Rust-Installation eine **neue** Konsole öffnen, damit der PATH steht.

---

## Funktionen

### Schreiben

- **Rich-Text-Editor** auf TipTap 2 mit Überschriften, Listen, Zitaten
- **Fokusmodus** (F11) blendet alles außer dem Text aus
- **Automatisches Speichern** ohne Zutun
- **Wortzähler** mit Zeichen- und Speicherstatus
- **Versionsgeschichte** je Kapitel

### Projektstruktur

- Projekte mit beliebig vielen Kapiteln
- **Figurenprofile**: Name, Alias, Alter, Beruf, Äußeres, Eigenschaften, Beziehungen
- **Ortsprofile** und freie **Notizen** mit Schlagworten
- **Fragmente** für Textstellen ohne festen Platz

### Projektwissen (RAG)

Baut einen Suchindex über das gesamte Projekt auf — Kapitel, Fragmente,
Figuren, Orte, Notizen. Erreichbar über das Buch-Symbol 📚 im Modus-Umschalter
oben in der Seitenleiste.

- **Strukturorientiertes Chunking**: schneidet an Überschriften und
  Satzgrenzen, nie mitten im Satz. Kennt deutsche Abkürzungen (`z. B.`,
  `d. h.`) und Ordinalzahlen (`3. Kapitel`).
- **Drei Suchmodi**: semantisch (Einbettungen), exakt (Wortlaut), hybrid
  (Rangfusion beider Signale)
- **Frage an das Projekt**: „Was weiß das Projekt über Figur X?",
  „Wo wurde Ort Y erwähnt?"
- **Kontextvorschau** vor dem Senden an die KI
- **Quellenangaben** bei jeder Antwort

Ohne Einbettungsmodell arbeitet die Suche rein lexikalisch (BM25) weiter — sie
findet dann nur wörtliche Übereinstimmungen, funktioniert aber vollständig.
Jedes Ergebnis sagt ausdrücklich, ob es vollwertig oder eingeschränkt ist.

### KI-Funktionen

Weiterschreiben, Umschreiben, Zusammenfassen, Korrektur, Brainstorming, freier
Chat — jeweils mit oder ohne Projektkontext. Dazu Stimmen-Labor,
Abweichungs-Detektor, Dialog mit dem Text und Traumlogik-Modi.

### Export

DOCX, EPUB, PDF, Markdown und reiner Text.

Vor dem Export in DOCX, PDF oder EPUB kann eine **Exportprüfung** (Preflight) laufen. Sie prüft auf kritische Befunde — leere Kapitel, fehlende Struktur — und verlangt bei Bedarf eine Bestätigung. Der Export wird nie verhindert, aber transparent gemacht. Markdown und TXT exportieren ohne Prüfung.

### KDP-/Export-Preflight

Erreichbar über das Häkchen-Symbol ✅. Prüft das Manuskript vor dem Export in DOCX, PDF und EPUB — **vollständig auf deinem Rechner, ohne KI**.

**Struktur**
- Leere oder fehlende Kapitel, doppelte Überschriften, übersprungene Überschriftenebenen
- Sehr kurze oder sehr lange Kapitel, mehrfache Leerzeilen, uneinheitliche Szenentrenner
- Harte Umbrüche (Shift+Enter) statt echter Absätze

**Frontmatter / Backmatter**
- Fehlender Titel, fehlendes Impressum, fehlendes Inhaltsverzeichnis
- Fehlende Autorenseite, fehlende Hinweise auf weitere Bücher, fehlender Kontakt

**Formate**
- DOCX: Fehlende Überschriften-Struktur, übermäßige manuelle Formatierung
- PDF: Sehr lange Absätze, Sonderzeichen die im PDF fehlen können
- EPUB: Einzelkapitel für ganze Bücher, Bilder ohne Alternativtext
- Markdown: Rohe Markdown-Zeichen im Text, Auszeichnung die Markdown nicht kennt
- TXT: Informationsverlust (Formatierung, Bilder)

**Zeichen**
- Unsichtbare Zeichen aus Webseiten oder PDFs (Haarspatium, Nullbreiten-Leerzeichen, …)
- Mögliche Arbeitsnotizen (TODO, FIXME, Platzhalter)
- Uneinheitliche Einrückung

Jeder Befund lässt sich **ignorieren**, als **bewusst so** markieren oder mit einem **Verbesserungsvorschlag** versehen. Entscheidungen überleben einen erneuten Prüflauf — Befunde werden über einen Fingerabdruck wiedererkannt. Regeln lassen sich für ein Projekt dauerhaft abschalten.

**Ampel** zeigt den Status: rot (kritische Befunde), gelb (Warnungen oder noch nicht geprüft), grün (bereit).

**KI-Offenlegung bei KDP** — Amazon verlangt die Angabe KI-generierter Inhalte. Der Hinweis steht im Preflight-Bereich; die Angabe erfolgt beim Upload im KDP-Konto. Diese App überträgt nichts.

### Manuskriptprüfung

Erreichbar über das Lupen-Symbol 🔍. Prüft Konsistenz und Stil — **vollständig
auf deinem Rechner, ohne KI**.

**Konsistenz**
- Figurenalter: Widersprüche im Text und Abweichungen vom Profil
- Ortsnamen: abweichende Schreibweisen per Editierdistanz
- Perspektive: Sprünge zwischen Ich- und Er/Sie-Form je Absatz
- Zeitlinie: rückwärts laufende Jahre, mehrfache Monatsangaben
- Begriffsdrift: wechselnde Begriffe, uneinheitliche Bindestriche

**Stil**
- Füllwörter, Wortwiederholungen auf engem Raum, Passivhäufung, Nominalstil
- Klischees, überlange Sätze, gleichförmiger Satzrhythmus
- Kennwerte: Satzlänge und Streuung, Dialoganteil, lexikalische Vielfalt

**Drei Einordnungen** — unabhängig vom Schweregrad, weil eine bewusste
Abweichung durchaus kritisch aussehen kann:

| Einordnung | Bedeutung |
|---|---|
| Fehler | harter Widerspruch, etwa zwei Altersangaben zur selben Figur |
| möglich | Auffälligkeit, die Absicht sein kann |
| bewusst | von dir als literarische Entscheidung markiert |

Jeder Befund lässt sich ignorieren, als bewusst markieren oder mit einem
Verbesserungsvorschlag versehen. **Diese Entscheidungen überleben einen
erneuten Prüflauf** — Befunde werden über einen Fingerabdruck wiedererkannt,
der ohne Positionsangabe arbeitet, damit ein eingefügter Absatz nichts
verwirft.

Zwei bewusste Zurückhaltungen gegen Fehlalarme: Wörtliche Rede ist von der
Perspektivprüfung ausgenommen (sonst wäre jeder Dialog mit „ich" ein Alarm),
und rückwärts laufende Jahre werden nur ohne Rückblick-Signalwort gemeldet
(Literatur springt ständig in der Zeit).

### In Arbeit

Für diese Bereiche stehen Datenmodell und Typen, aber noch keine Prüflogik und
keine Oberfläche. Sie sind in Version 0.1.0 **nicht benutzbar**:

| Bereich | Stand |
|---|---|
| Snapshot-Versionierung | Datenmodell und Typen |

Ebenfalls offen: die **semantischen** Konsistenzprüfungen. Perspektivsprünge
über Kapitelgrenzen und Widersprüche zwischen weit entfernten Stellen brauchen
ein Sprachmodell. Die Befunde tragen bereits ein Feld für die Herkunft, damit
regelbasiert und modellgestützt unterscheidbar bleiben.

Die Datenbank ist vorbereitet: alle Tabellen existieren ab Schema-Version 2,
eine spätere Aktualisierung braucht keine Datenmigration.

---

## Wo deine Daten liegen

```
%APPDATA%\com.aiwriterstudio.app\
├── user_data\app.db     alle Projekte, Kapitel, Profile, Index
├── logs\app.log         Diagnose
├── exports\             erzeugte Dateien
└── backups\             Sicherungen
```

**Niemals im Installationsordner.** Eine Deinstallation lässt diese Daten
unangetastet, sofern du nicht ausdrücklich zustimmst, sie zu löschen.

**Sicherung:** Den Ordner `user_data` kopieren. Zum Wiederherstellen
zurücklegen — mehr ist nicht nötig.

---

## KI-Anbieter einrichten

Alle Anbieter sind **optional**. Ohne jeden Anbieter bleiben Editor,
Projektverwaltung, Konsistenzprüfung, Export und die lexikalische Projektsuche
vollständig nutzbar.

### Ollama (lokal, empfohlen)

```bash
# von https://ollama.com installieren, dann:
ollama serve
ollama pull llama3.2            # Textmodell
ollama pull nomic-embed-text    # für die semantische Projektsuche
```

Erwartet unter `http://localhost:11434`.

### LM Studio (lokal)

LM Studio installieren, ein Modell laden, den lokalen Server aktivieren.
Erwartet unter `http://localhost:1234`.

### OpenAI (Cloud)

API-Schlüssel in den Einstellungen eintragen. **Hinweis:** Dabei werden
Textausschnitte an OpenAI übertragen. Der Schlüssel wird ausschließlich lokal
gespeichert und nur auf ausdrücklichen Knopfdruck geprüft.

---

## Windows-Build

Die Versionsnummer wird an **einer** Stelle gepflegt:
`scripts\release.config.psd1`. Von dort verteilt `sync-version.ps1` sie nach
`package.json`, `tauri.conf.json`, `Cargo.toml` und `src\version.ts`.

### Vollständiger Release-Build

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
| 5 | Frontend | Vite-Build, **Source-Maps werden entfernt** |
| 6 | Tauri | Release-Binary, Versionsinfo wird verifiziert |
| 7 | Installer | Inno Setup (nur mit `-CreateInstaller`) |

### Nützliche Schalter

```powershell
.\scripts\build-windows.ps1 -SkipTests        # nur für Zwischenbuilds
.\scripts\build-windows.ps1 -SkipIcons
.\scripts\build-windows.ps1 -Version 0.2.0 -CreateInstaller
```

### Version ändern

```powershell
.\scripts\sync-version.ps1 -Version 0.2.0     # setzen
.\scripts\sync-version.ps1 -Check             # prüfen, Exitcode 1 bei Abweichung
```

`-Check` eignet sich als CI-Schritt: Er schlägt fehl, wenn die Dateien
auseinandergelaufen sind.

### Einzelschritte

```powershell
npm run typecheck        # tsc --noEmit
npm run lint
npm run test
npm run verify           # alle drei
npm run icons            # Icon-Set neu erzeugen
npm run build            # Frontend (ruft prebuild: WASM-Kopie)
npm run build:windows    # Build ohne Installer
npm run installer        # nur Installer, setzt Build voraus
```

---

## Installer erstellen

```powershell
.\scripts\create-installer.ps1
```

Ergebnis in `release\`:

```
AI-Writer-Studio-Setup-0.1.0-x64.exe          rund 4 MB
AI-Writer-Studio-Setup-0.1.0-x64.exe.sha256
```

Das Skript prüft **vor** dem Aufruf von ISCC, ob alle Branding-Assets, die
Lizenz und die Readme-Dateien vorhanden sind — statt mitten im Lauf
abzubrechen. ISCC wird über die Registry gefunden, also auch bei
benutzerdefinierten Installationspfaden und bei Inno Setup 7.

### Was der Installer mitbringt

- Installation nach `%LOCALAPPDATA%\Programs\` — **keine Administratorrechte**
- Startmenü-Eintrag und Uninstaller
- Desktop-Verknüpfung (abwählbar)
- Dateizuordnungen für `.aiwsproj` und `.aiwschapter` (abwählbar)
- WebView2 wird bei Bedarf automatisch nachgeladen
- **Nur Release-Artefakte**: EXE, Lizenz, Readme, Icons — keine
  Entwicklungsdateien, keine Source-Maps, keine `node_modules`

### Was die Deinstallation entfernt

Programmordner, Verknüpfungen und **alle** Registry-Einträge inklusive der
Dateizuordnungen. Der Standardwert einer Zuordnung wird nur entfernt, wenn er
auf diese Anwendung zeigt — fremde Zuordnungen bleiben unangetastet.

**Nutzerdaten bleiben erhalten.** Nur bei ausdrücklicher Zustimmung im Dialog
werden sie gelöscht; bei stiller Deinstallation wird nie gefragt und nie
gelöscht.

---

## Stille Installation

```powershell
# ohne Oberfläche, mit Standardaufgaben
AI-Writer-Studio-Setup-0.1.0-x64.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART

# mit Fortschrittsanzeige
AI-Writer-Studio-Setup-0.1.0-x64.exe /SILENT /NORESTART

# gezielte Aufgabenauswahl
AI-Writer-Studio-Setup-0.1.0-x64.exe /VERYSILENT /TASKS="desktopicon,assocproj"

# ohne jede Zusatzaufgabe
AI-Writer-Studio-Setup-0.1.0-x64.exe /VERYSILENT /TASKS=""

# eigenes Ziel, mit Protokoll
AI-Writer-Studio-Setup-0.1.0-x64.exe /VERYSILENT /DIR="D:\Programme\AIWS" /LOG=install.log

# systemweit (erfordert Administratorrechte)
AI-Writer-Studio-Setup-0.1.0-x64.exe /VERYSILENT /ALLUSERS

# stille Deinstallation
"%LOCALAPPDATA%\Programs\AI Writer Studio\unins000.exe" /VERYSILENT /NORESTART
```

Verfügbare Aufgaben: `desktopicon`, `assocproj`, `assocchap`.

> **Hinweis zur Wiederholbarkeit:** Der Installer nutzt
> `PrivilegesRequiredOverridesAllowed=commandline`, nicht `dialog`. Sonst würde
> er bei `/VERYSILENT` in einer erhöhten Konsole stillschweigend systemweit
> installieren — das Ergebnis wäre davon abhängig, wie die Konsole gestartet
> wurde.

---

## Tests

```bash
npm run test              # alle Tests
npm run test:watch
npx vitest run src/services/knowledge     # ein Bereich
```

**Stand: 130 Tests in 11 Dateien.**

| Datei | Prüft |
|---|---|
| `db/migrations/migrations.test.ts` | 27 Tabellen, Idempotenz, Schema-Version |
| `knowledge/chunking.test.ts` | Chunking, Satzgrenzen, Abkürzungen, kein Inhaltsverlust |
| `knowledge/lexical.test.ts` | BM25, exakte Suche, Rangfusion |
| `knowledge/integration.test.ts` | Indexierung und Suche **ohne Modell** |
| `Knowledge/knowledge-flow.test.ts` | Kette Einlesen → Indexieren → Suchen → Fragen |
| `Sidebar/navigation.test.ts` | Erreichbarkeit aller Modi (Regressionsschutz) |
| `setup/probe.test.ts` | Anbieterprüfung gegen echte HTTP-Server |
| `setup/setup.test.ts` | Assistentenstatus, Beispielprojekt, Dublettenschutz |

### Prüfung gegen die echte Desktop-Datenbank

Die Unit-Tests laufen gegen eine In-Memory-Datenbank. Ob Schema und Abfragen
auch im echten Betrieb tragen, prüft ein eigenes Skript:

```bash
python scripts/verify_knowledge_db.py
```

Es prüft die Datei unter `%APPDATA%`: alle Tabellen, die Schema-Version, jede
Spalte, auf die die Oberfläche zugreift, alle zehn Suchindizes namentlich und
die Fremdschlüssel. Exitcode 1 bei jedem Problem — geeignet als CI-Schritt nach
einem Smoke-Test.

Zum Ausprobieren mit echten Daten:

```bash
python scripts/seed_demo_db.py    # Demoprojekt in die echte DB schreiben
```

Danach die App starten, das Projekt öffnen, 📚 wählen und „Quellen einlesen"
gefolgt von „Projektwissen aktualisieren" drücken.

Drei Tests verdienen Erwähnung, weil sie Produktversprechen prüfen statt
Implementierung:

- `integration.test.ts` und `knowledge-flow.test.ts` zeigen auf
  `http://127.0.0.1:9` — einen garantiert geschlossenen Port. Sie beweisen, dass
  Indexierung, Suche und Fragen **ohne jedes Modell** durchlaufen und die
  Einschränkung korrekt melden.
- `chunking.test.ts` enthält einen Regressionstest gegen Inhaltsverlust: Ein
  früherer Fehler verwarf kurze Absätze stillschweigend.
- `navigation.test.ts` stellt sicher, dass jeder Modus aus dem Typ auch im
  Umschalter erscheint. Ohne diesen Test waren acht Bereiche unerreichbar,
  während Typprüfung und alle anderen Tests grün blieben.

### Manueller Test der Desktop-App

```powershell
npm run build
npx tauri build --no-bundle
.\src-tauri\target\release\ai-writer-studio.exe
```

Prüfpunkte:

1. **Persistenz** — `%APPDATA%\com.aiwriterstudio.app\logs\app.log` muss
   `persistent=true` melden. Steht dort `persistent=false`, werden Änderungen
   **nicht** gespeichert; die App zeigt das auch als Warnstreifen an.
2. **Neustart** — Projekt anlegen, App schließen, neu starten: Das Projekt muss
   noch da sein. Im Log erscheint `Bestehende DB geladen (… Bytes)`.
3. **Dateizuordnung** — Doppelklick auf eine `.aiwsproj`-Datei startet die App.
4. **Zweite Instanz** — Erneutes Starten fokussiert das bestehende Fenster
   statt eine zweite Instanz zu öffnen. Wichtig, weil beide sonst dieselbe
   SQLite-Datei schreiben würden.
5. **Erststart-Assistent** — Datenverzeichnis löschen, App starten: Der
   Assistent muss erscheinen und überspringbar sein.

---

## Projektstruktur

```
ai-writer-studio/
├── assets/icons/              Branding — SVG-Quelle und alle Ableitungen
│   ├── icon.svg               editierbare Quelldatei
│   ├── icon.ico               App-Icon, 7 Auflösungen
│   ├── setup-icon.ico         Installer
│   ├── uninstall-icon.ico     Uninstaller
│   ├── file-project.ico       .aiwsproj
│   ├── file-chapter.ico       .aiwschapter
│   ├── wizard-image.bmp       Inno-Wizard, 497×314
│   ├── wizard-small.bmp       Inno-Kopfbild, 55×58
│   └── png/                   16 bis 512 Pixel
│
├── installer/
│   ├── ai-writer-studio.iss   Inno Setup
│   ├── README-Installer.txt   vor der Installation
│   └── README-App.txt         landet im Programmordner
│
├── scripts/
│   ├── release.config.psd1    ZENTRALE Version und Pfade
│   ├── build-windows.ps1      Release-Build, 7 Schritte
│   ├── create-installer.ps1   Installer mit Vorprüfung
│   ├── sync-version.ps1       Versionsabgleich, -Check für CI
│   ├── generate_icons.py      erzeugt das gesamte Icon-Set
│   └── copy_wasm.py           sql.js-WASM nach public/
│
├── src/
│   ├── components/
│   │   ├── Welcome/           Assistent, Splash, About
│   │   ├── Empty/             leere Zustände, Fehleranzeige
│   │   ├── Editor/  Sidebar/  KIPanel/  Export/  Settings/
│   │   ├── Fragment/  VoiceLab/  Avantgarde/
│   ├── services/
│   │   ├── db/                SQLite, Migrationen
│   │   ├── knowledge/         RAG: Chunking, Einbettungen, BM25, Retrieval
│   │   ├── setup/             Anbieterprüfung, Beispielprojekt, Status
│   │   ├── llm/               Provider-Abstraktion, 5 Anbieter
│   │   └── project/  prompt/  export/  settings/  …
│   ├── types/                 knowledge, diagnostics, preflight, snapshot, …
│   ├── theme.css              Farb-Token für Hell und Dunkel
│   └── version.ts             ERZEUGT von sync-version.ps1
│
├── src-tauri/
│   ├── src/main.rs            Single-Instance, AppData, Logging, Dateiöffnen
│   ├── build.rs               bettet Icon und EXE-Metadaten ein
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/          Berechtigungen
│   └── icons/                 von generate_icons.py erzeugt
│
├── release/                   Build-Ergebnis (nicht im Git)
├── LICENSE.txt
└── README.md
```

### Release-Ordner nach dem Build

```
release/
├── ai-writer-studio.exe                       rund 5,4 MB
├── AI-Writer-Studio-Setup-0.1.0-x64.exe       rund 4,1 MB
└── AI-Writer-Studio-Setup-0.1.0-x64.exe.sha256
```

---

## winget-Vorbereitung

Noch nicht veröffentlicht. Was dafür fehlt und was schon vorbereitet ist:

**Vorbereitet**

- Stille Installation mit `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART`
- Reproduzierbarer per-user-Installationspfad
- SHA256 wird bei jedem Installer-Build mitgeschrieben
- `AppId` als feste GUID, damit Aktualisierungen erkannt werden
- Saubere Deinstallation samt Registry

**Noch offen**

1. **Code-Signing** — winget akzeptiert unsignierte Pakete, aber SmartScreen
   warnt. Siehe nächster Abschnitt.
2. **Öffentliche Release-URL** mit unveränderlichem Download-Link
3. **Manifest** nach dem Schema `1.6.0`, drei Dateien in
   `manifests/m/mrmixx-max/AIWriterStudio/<version>/`:
   `*.yaml` (version), `*.installer.yaml`, `*.locale.en-US.yaml`
4. **Pull Request** an `microsoft/winget-pkgs`

Manifest-Gerüst erzeugen und prüfen:

```powershell
winget install wingetcreate
wingetcreate new https://github.com/mrmixx-max/ai-writer-studio/releases/download/v0.1.0/AI-Writer-Studio-Setup-0.1.0-x64.exe

# lokal validieren, bevor der PR aufgeht
winget validate --manifest .\manifests\...
winget install --manifest .\manifests\...
```

Wichtige Feldwerte für das Installer-Manifest:

| Feld | Wert |
|---|---|
| `InstallerType` | `inno` |
| `Scope` | `user` |
| `Architecture` | `x64` |
| `InstallerSwitches.Silent` | `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART` |
| `InstallerSwitches.SilentWithProgress` | `/SILENT /NORESTART` |
| `UpgradeBehavior` | `install` |
| `ProductCode` | die `AppId` aus `release.config.psd1` inklusive Klammern |

---

## Code-Signing

**Derzeit nicht signiert.** Windows SmartScreen zeigt beim ersten Ausführen
eine Warnung. Das ist bei neuen, unsignierten Anwendungen normal — über
„Weitere Informationen" lässt sich die Installation fortsetzen.

### Was Signieren bringt

| | unsigniert | Standard-Zertifikat | EV-Zertifikat |
|---|---|---|---|
| SmartScreen-Warnung | immer | anfangs, verschwindet mit Verbreitung | sofort keine |
| Kosten pro Jahr | 0 € | 200–400 € | 400–700 € |
| Aufbewahrung | — | Datei oder Token | **Hardware-Token vorgeschrieben** |

Seit Juni 2023 verlangen die CA/Browser-Regeln für alle neuen
Code-Signing-Zertifikate Hardware-Schlüsselspeicher (HSM oder Token). Ein
reiner PFX-Import ist nicht mehr möglich.

### Vorbereitung im Projekt

`tauri.conf.json` unterstützt Signieren über zwei Felder:

```jsonc
"bundle": {
  "windows": {
    "certificateThumbprint": "DEIN_THUMBPRINT",
    "timestampUrl": "http://timestamp.digicert.com"
  }
}
```

Das Inno-Skript signiert über eine `SignTool`-Definition:

```powershell
# einmalig in Inno Setup unter Werkzeuge > Konfiguration > Signieren:
signtool=$p sign /fd sha256 /tr http://timestamp.digicert.com /td sha256 /a $f
```

Danach im `[Setup]`-Abschnitt ergänzen:

```ini
SignTool=signtool
SignedUninstaller=yes
```

**Reihenfolge beachten:** Zuerst die Anwendungs-EXE signieren, dann den
Installer bauen, dann den Installer signieren. Ein signierter Installer mit
unsignierter EXE darin löst weiterhin Warnungen aus.

Zeitstempel sind Pflicht — ohne ihn werden Signaturen mit Ablauf des
Zertifikats ungültig.

---

## Bekannte Grenzen

**Persistenz hängt an drei Bedingungen.** SQLite läuft über sql.js im
WebView, nicht als natives Modul. Damit Änderungen auf Platte landen, müssen
zusammenkommen: die WASM-Datei im Bundle (`prebuild`-Hook), `'wasm-unsafe-eval'`
in der CSP und die dynamisch geladenen Tauri-Plugin-Module. Fehlt eines,
läuft die App im Arbeitsspeicher weiter — sichtbar als Warnstreifen und im Log.
Genau dieser Fall hat während der Entwicklung dreimal zugeschlagen.

**`withGlobalTauri` exponiert nur den Kern.** `window.__TAURI__.fs` existiert
nicht, auch wenn das Flag gesetzt ist. Plugins müssen über ihre npm-Pakete
geladen werden. Ein Zugriff über das globale Objekt schlägt still fehl.

**Die semantische Suche braucht ein Einbettungsmodell.** Ohne
`nomic-embed-text` (oder gleichwertig) arbeitet die Projektsuche lexikalisch:
Sie findet Wörter, keine Bedeutungen. „Wo ist von Einsamkeit die Rede?" findet
dann nur Stellen mit genau diesem Wort.

**Konsistenzprüfung ist zweistufig.** Regelbasierte Prüfungen laufen immer und
offline. Semantische Prüfungen (Perspektivsprünge, Widersprüche zwischen
Kapiteln) brauchen ein Sprachmodell. Jeder Befund ist als regelbasiert oder
modellgestützt gekennzeichnet.

**Der Editor ist auf Kapitellänge ausgelegt.** TipTap hält Dokumente
vollständig im Speicher. Bei Kapiteln über etwa 50.000 Wörtern wird die
Eingabe träge — Kapitel sollten ohnehin kürzer sein.

**Nur x64.** ARM64-Windows ist nicht getestet und nicht gebaut.

**Kein automatisches Aktualisieren.** Neue Versionen werden von Hand
installiert. Der Installer erkennt eine vorhandene Installation und aktualisiert
sie unter Erhalt der Nutzerdaten.

**Kein Cloud-Abgleich.** Beabsichtigt. Für mehrere Geräte den Ordner
`user_data` selbst synchronisieren — aber nie bei gleichzeitig laufender App,
sonst droht eine beschädigte SQLite-Datei.

---

## Lizenz

MIT. Siehe [LICENSE.txt](LICENSE.txt).

© 2026 Erik Gieske
