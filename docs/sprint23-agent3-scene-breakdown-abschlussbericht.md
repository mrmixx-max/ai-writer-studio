# Sprint 23 – Agent 3: Scene Breakdown – Abschlussbericht

**Datum:** 2026-09-08 · **Modus:** `scene-breakdown` (🎬 „Szenen Analyse")

## Ergebnis

Scene-Breakdown-Engine (Parsing + Analyse + Export), `SceneBreakdownPanel`
(Szenen-Liste + Statistiken, Bloomberg-Terminal-Stil) und Sidebar-Modus
`scene-breakdown` sind implementiert. **19 neue Tests, alle grün.**
Bestehende Tests (Sidebar-Navigation, i18n-Parität) bleiben grün.
Kein Commit, kein Build, keine neuen Dependencies.

## Neue Dateien

- `src/services/scene/sceneBreakdown.ts` — Engine:
  - `parseScenes(text)` — erkennt `INT.`/`EXT.`/`INT./EXT.`-Headings, extrahiert
    Location und Tageszeit (`day`/`night`/`dawn`/`dusk` aus TAG/NACHT/MORGEN/ABEND …),
    Figuren (GROSSSCHRIFT-Cues), Dialog-/Action-/Beschreibungsanteile (Summe = 100 %),
    Konflikt pro Szene, Wortzahl (`wordCount?` als optionales Zusatzfeld).
  - `analyzeBreakdown(scenes)` — Gesamt-Szenen, Location-/Figuren-Rankings,
    Zeitverteilung, Ø-Szenenlänge (Wörter), Pacing (`fast` < 150 < `medium` < 400 < `slow`).
  - `extractCharacters`, `detectConflict` (Signalwort-Suche, erster Treffersatz), `suggestImprovements`
    (Nacht-Überhang, Location-Dominanz, Figurenmangel, Pacing-Hinweise), `exportToCSV`
    (Semikolon-separiert, RFC-4180-Quoting).
- `src/services/scene/sceneBreakdown.test.ts` — 14 Tests.
- `src/components/SceneBreakdown/SceneBreakdownPanel.tsx` — Standalone-Panel
  (freier Text + „Aktuellen Text analysieren“ via `editorText`): Textarea,
  Analysieren-Button, Szenen-Liste mit Headings, 5 Statistik-Karten,
  Zeitverteilung, Location-/Figuren-Listen, Konflikt-Anzeige (⚠),
  Verbesserungsvorschläge, CSV-Export (Download + `onExport`-Hook).
- `src/components/SceneBreakdown/SceneBreakdownPanel.test.tsx` — 5 Tests.
- `docs/sprint23-agent3-scene-breakdown-abschlussbericht.md` — dieser Bericht.

## Geänderte Dateien

- `src/types/mode.ts` — `EditorMode` um `"scene-breakdown"` erweitert.
- `src/components/Sidebar/Sidebar.tsx` — MODES-Eintrag
  (`🎬`, Key `sidebar.mode.scene-breakdown`, „Drehbuch/Roman Szenen-Analyse“),
  Lazy-Import, Standalone-Branch in `ModePanel` (kein Kapitel nötig),
  `"scene-breakdown"` in `WIDE_EXTRA_MODES`.
- `src/i18n/locales/de.ts`, `en.ts` — `sidebar.mode.scene-breakdown` + 22 `scene.*`-Keys.
- `src/i18n/locales/fr.ts`, `es.ts` — dieselben Keys ergänzt (Pflicht wegen
  `parity.test.ts`: alle Locales müssen exakt die de-Keys abdecken; sonst brechen
  bestehende Tests). Abweichung von der erlaubten Dateiliste, begründet durch
  „Bestehende Tests nicht brechen“.

## Verifikation

| Prüfung | Resultat |
|---|---|
| `sceneBreakdown.test.ts` + `SceneBreakdownPanel.test.tsx` | 19/19 ✅ |
| `navigation.test.ts`, `sidebarLabels.test.ts`, `Sidebar.test.tsx` | 30/30 ✅ |
| `parity.test.ts`, `i18n.test.ts` | 26/26 ✅ |
| `npm run typecheck` | 3 Fehler, alle in fremdem/concurrentem Code (`FeedbackPanel` unused, `sidebar.mode.advanced-export` ohne Locale-Key, `citation.ts` unused `url`) — keiner aus Scene-Breakdown-Dateien |

## Hinweise / Offenes

- `Scene.wordCount` ist ein optionales Zusatzfeld über die Vorgabe hinaus;
  nötig, da `analyzeBreakdown` sonst keine Wortbasis für `averageSceneLength` hätte.
- Typecheck-Fehler stammen von parallel arbeitenden Agenten im Shared Tree
  (u. a. fehlender Locale-Key für deren `advanced-export`-Modus); nicht von mir
  verursacht, aber vor einem Merge zu klären.
- Kein E2E-Test, kein Build/Commit laut Vorgabe.
