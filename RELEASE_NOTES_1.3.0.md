# AI Writer Studio 1.3.0 — Release Notes

**Veröffentlicht:** 2. Oktober 2026  
**Teststand:** 3.953 grüne Tests (0 Fehler)  
**Installer:** `AI Writer Studio_1.3.0_x64-setup.exe`

---

## Was ist neu?

### Meilenstein 2.0 — Narrative Intelligenz

| Feature | Beschreibung |
|---|---|
| **Beat-Sheet-Vorlagen** | Save the Cat (15 Beats), Heldenreise (12 Stationen), Drei-Akt-Struktur — mit Abdeckungsprüfung |
| **Korkwand** | Szenen-Karten mit Drag-and-Drop-Reordering, synchron zur SQLite-Kapitelstruktur |
| **Pacing-Kurve** | SVG-Visualisierung von Spannung und Rhythmus über alle Kapitel — Klick springt zum Kapitel |
| **Beziehungs-Graph** | Force-Directed-Layout für Figuren, Fraktionen und Orte — mit Kantenfarben nach Beziehungstyp |
| **Voice Profiling** | Dialog-Analyse pro Figur: Satzlänge, Füllwort-Quote, Formalität, Dialekt — mit Abweichungshinweisen |
| **Writer's Room** | Vier Agenten-Personas (Dramaturg, Psychologe, Worldbuilder, Teufelsadvokat) mit Synthese-Protokoll |
| **Print-Preflight** | Typografie-Prüfung (Anführungszeichen, Gedankenstrich, Schusterjungen/Hurenkinder) + Impressum-Generator |

### Meilenstein 3.0 — Audiovisuelles Studio

| Feature | Beschreibung |
|---|---|
| **Multi-Voice Table-Read** | Vorlesen des Kapitels mit getrennten Stimmen für Erzähler und Figuren — mit Karaoke-Synchronisation im Editor |
| **Whisper Live-Diktat** | Lokales Diktieren mit Typografie-Autokorrektur („Punkt" → `.`, „Komma" → `,`) |
| **EPUB3 Print-Master** | Valider EPUB3-Export (W3C-konform) mit eingebetteter CSS-Typografie |
| **PDF Druck-PDF** | KDP-fähiges PDF mit Bundsteg, Kolumnentiteln und Paginierung |
| **Cover-Studio** | Spine-Calculator (Buchrückenbreite nach Papiervolumen) + SVG-Cover-Vorschau mit Bleed |
| **Time-Machine** | Micro-Snapshots pro Kapitel mit Visual-Diff und 1-Klick-Wiederherstellung |

---

## Kurzanleitung: Table-Read

1. **Kapitel öffnen** — im Editor das gewünschte Kapitel laden
2. **Table-Read starten** — Button in der Toolbar oder TTS-Panel
3. **Stimmen zuweisen** — Figuren erhalten automatisch unterschiedliche Pitch/Rate-Werte
4. **Karaoke-Modus** — der aktive Satz wird während des Vorlesens hervorgehoben
5. **Steuerung** — Pause, Stop, Geschwindigkeit, Stimmenauswahl

## Kurzanleitung: Time-Machine

1. **Snapshot erstellen** — Button im Snapshot-Panel oder automatischem Intervall
2. **Versionen vergleichen** — zwei Snapshots auswählen → farblicher Diff (Grün = hinzugefügt, Rot = gelöscht)
3. **Wiederherstellen** — 1-Klick-Revert mit vorherigem Sicherheits-Backup
4. **Kapitel-Snapshots** — pro Kapitel getrennte Historie

---

## Nächste Meilensteine

- **4.000er-Testmarke** — 47 Tests fehlen noch
- **Meilenstein 4.0** — KI-gestützte Lektoratsschleife v2, Multi-User-Kollaboration, Cloud-Sync

---

## Installation

1. `AI Writer Studio_1.3.0_x64-setup.exe` herunterladen
2. Doppelklick — Installation startet automatisch
3. Bestehende Projekte werden migriert

**Systemvoraussetzungen:** Windows 10/11 (64-bit), 4 GB RAM, 500 MB freier Speicher
