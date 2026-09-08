# Sprint 23, Agent 4 — Timeline: Abschlussbericht

**Modus:** `timeline` (📅) — Zeitleiste für Handlung (Plot-Events mit CRUD, Auto-Detect, Export)
**Status:** ✅ umgesetzt, kein Commit, kein Build (gemäß Auftrag)
**Tests:** 13/13 grün im Timeline-Scope (10 neu: 6 Engine + 4 Panel)

## 1. IST-Befund (wichtig: Spec-Annahme war veraltet)

Der Auftrag ging von „keine Timeline-Funktion" aus. Tatsächlich existiert bereits eine
DB-basierte Story-Timeline aus früheren Sprints (committed, Main-Branch):

- `src/services/timeline/timeline.ts` — DB-Events (`listEvents`/`saveEvent`/`deleteEvent`, Typ `TimelineEvent`)
- `src/services/timeline/plotStructure.ts` + `timelineExport.ts` — 3-Akte/Heldenreise, JSON/CSV/MD-Export
- `src/components/Timeline/TimelinePanel.tsx` + `TimelineCanvas.tsx` — SVG-Plot-Ansicht
- `src/types/mode.ts` (`"timeline"`), Sidebar-MODES-Eintrag (📅), `de.ts`/`en.ts`-Labels — **bereits vorhanden**

Statt Bestehendes zu ersetzen, wurde die Spec-Engine **daneben** implementiert. Nichts Altes wurde entfernt.

## 2. Was gebaut wurde

### Aufgabe 1 — Timeline Engine (`src/services/timeline/timeline.ts`, +230 Zeilen)
In-Memory-Engine, alle Spec-Funktionsnamen exakt: `createTimeline`, `addEvent`, `removeEvent`,
`getTimeline`, `getTimelines`, `autoDetectEvents`, `exportToJSON` (+ `Timeline`-Interface exakt,
`TIMELINE_TYPE_COLORS`, zusätzlich `updateEvent` für die Panel-Bearbeitung).

- **Namensabweichung (begründet):** Der Spec-Typ `TimelineEvent` war bereits durch den DB-Typ
  belegt (Import in `plotStructure.test.ts`, `timelineExport.ts`). Umbenennen hätte Dateien
  außerhalb des Schreib-Scope erfordert. Der Spec-Typ heißt daher **`PlotTimelineEvent`**
  (identische Felder), dokumentiert im Codekopf.
- **`autoDetectEvents`:** 1 Event pro Kapitel, Typ-Inferenz per DE/EN-Keyword-Signalen
  (Priorität climax > conflict > revelation > decision > resolution > action-Fallback),
  Timestamp `Kapitel N`, Beschreibung = 160-Zeichen-Snippet, Farbe aus Typ.
- **Bugfix während der Arbeit:** Mutationen ersetzten keine Objektreferenzen → React-`useMemo`
  im Panel lieferte stale `[]` („Kein Event passt zum Filter" trotz vorhandenem Event).
  Alle Mutatoren schreiben jetzt per `store()`-Helper frische Objekt-/Array-Referenzen zurück.

### Aufgabe 2 — TimelinePanel (`src/components/Timeline/TimelinePanel.tsx`, Rewrite)
Neue `PlotEngineUI` (Bloomberg-Terminal, Inline-Stile, keine neuen Dependencies) + alte
Plot-Ansicht als `<details>` erhalten (nur wenn `projectId` übergeben — Prop bleibt
abwärtskompatibel zu `Sidebar.tsx`):

- Timeline-Liste (Select + Anlage), vertikale Zeitleiste mit **farbigen Event-Markern je Typ**
  (Glow), „+ Event hinzufügen"-Button
- Event-Formular: Titel, Beschreibung, Zeit, Typ, Kapitel, Charaktere (kommagetrennt), Ort;
  Bearbeiten/Löschen pro Event
- Filter nach Typ (Select) + Charakter (Text), JSON-Export (Datei-Download + kopierbare
  `<pre>`-Vorschau mit `data-testid="timeline-json"`)

### Aufgabe 3 — Sidebar-Mode
Bereits vorhanden gewesen; einzig angeglichen: MODES-Description
`"Zeitstrahl verwalten"` → **`"Zeitleiste für Handlung"`** (Spec-Wortlaut).
`mode.ts`-Union, 📅-Icon, `de.ts`/`en.ts`-Labels waren schon korrekt — keine Änderung nötig.

## 3. Tests (10 neu)

- `src/services/timeline/timeline.test.ts` (6): leere Timeline, add/remove, getTimelines +
  unbekannte ID, Auto-Detect-Typen (revelation/climax), JSON-Validität.
- `src/components/Timeline/TimelinePanel.test.tsx` (4, jsdom): Rendern, Anlegen + Marker
  (`data-event-type`, Typ-Badge), Typ-Filter + JSON-Vorschau-Parse, Bearbeiten.
- Lauf: `npx vitest run src/services/timeline/ src/components/Timeline/` → **3 Files, 13 Tests, alle grün**
  (inkl. bestehender `plotStructure.test.ts` — keine Regression).

## 4. Fremdbefunde (nicht von diesem Agenten, nicht angefasst)

- `sidebar.bilingual.test.tsx` (2 Tests): scheitert mit `projects.map is not a function`
  (`Sidebar.tsx:370`, Projektbaum) — stammt aus paralleler Sidebar-Arbeit eines
  Sibling-Agenten (ungestagte Änderungen an `Sidebar.tsx`, `mode.ts`, `i18n/*` im selben Baum).
- `tsc --noEmit`: 2 Fehler, beide außerhalb des Scopes (`sidebar.mode.advanced-export` ohne
  i18n-Key — Sibling-Modus; ungenutzte Variable in `citation.ts` — fremd).

## 5. Offen / Hinweise für Review

- `PlotTimelineEvent` vs. Spec-Name `TimelineEvent`: bei Bedarf in Folgesprint den DB-Typ
  migrieren (betrifft `timelineExport.ts`, `plotStructure.ts`, Tests) und Namen zusammenführen.
- Engine ist bewusst In-Memory (kein Persistenz-Auftrag); Persistenz via bestehender
  DB-Schicht oder Projekt-Snapshot wäre der nächste Schritt.
- Kein Commit, kein Build ausgeführt (Auftrag).
