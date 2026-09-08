# Sprint 19f Agent 1 — Bilingual UI-Integration: Abschlussbericht

## Ergebnis
Bilingual ist als Sidebar-Mode und als Tab im BookWriter-Dashboard verfügbar.
5 neue Tests, alle grün. 29 Nachbar-Tests grün. Kein Commit, kein Build.

## Vorgefunden (bereits im Tree, von parallelem Agenten)
- `src/types/mode.ts`: `"bilingual"` in `EditorMode` ✅ (nicht von mir)
- `src/components/Sidebar/Sidebar.tsx`: MODES-Eintrag
  `{ id: "bilingual", icon: "🌐", description: "Deutsch↔Englisch Übersetzung" }`,
  Lazy-Import und `ModePanel`-Case ✅ (nicht von mir)
- `src/i18n/locales/de.ts` / `en.ts`: `sidebar.mode.bilingual` ✅ (nicht von mir)
- `src/components/Sidebar/sidebar.bilingual.test.tsx` (untracked, fremd, s. u.)

## Eigene Änderungen
1. **`src/components/Sidebar/Sidebar.tsx`** — `"bilingual"` zu `WIDE_EXTRA_MODES`
   hinzugefügt (1 Zeile). Vorher fiel der Mode aus der `wide`-Klasse, alle
   Nachbar-Modi sind wide. Aria-Labels unverändert.
2. **`src/components/BookWriter/BookWriterDashboard.tsx`**
   - `BilingualPanelLazy` per `lazy()` (erst beim Öffnen geladen).
   - Neue `BilingualSection`: Button `🌐 Bilingual (DE↔EN)`
     (`data-testid="bw-dash-bilingual-toggle"`, `aria-expanded`), Muster wie
     `ClassicBookWriterSection`. Geöffnet wird das echte `BilingualPanel` mit
     dem aktiven Store-Kapitel (Store-`Chapter` erfüllt `TranslationChapter`:
     `id/title/content`). Ohne aktives Kapitel: Hinweis
     (`data-testid="bw-dash-bilingual-no-chapter"`).
   - Hinweis zur Aufgabenbeschreibung: Die dort genannten Props
     (`projectId`, `chapterId`, `sourceText`) existieren am realen
     `BilingualPanel` nicht — es nimmt `chapter` (+ optional `chat`,
     `sourceLanguage`, `onApply`). Verdrahtet wurde die reale API.
3. **`src/components/BookWriter/BookWriterDashboard.bilingual.test.tsx`** (neu, 5 Tests):
   - Sidebar listet bilingual mit 🌐-Icon und `data-mode="bilingual"`.
   - Sidebar im bilingual-Mode rendert `#app-sidebar.wide`.
   - Dashboard zeigt den 🌐-Bilingual-Toggle (`aria-expanded="false"`).
   - Klick öffnet das `BilingualPanel` mit dem aktiven Kapitel.
   - Ohne aktives Kapitel erscheint der Hinweis, kein Panel.

## Verifikation (vitest, realer Store)
- Neue Datei: **5/5 grün**.
- Nachbar-Suiten `sidebarA11y`, `sidebarLabels`, `navigation`,
  `BookWriterDashboard`: **29/29 grün**.
- Keine neuen Dependencies. Kein Commit, kein Build (vorgabegemäß).

## Fremd-Fehler (nicht von mir, nicht angefasst)
- `src/components/Sidebar/sidebar.bilingual.test.tsx` (untracked, paralleler
  Agent) fällt 2/2: dessen `projectStore`-Mock ignoriert Selektoren
  (`useProjectStore: () => ({...})`), daher `projects.map is not a function`
  im Editor-Pfad. Liegt nicht an dieser Aufgabe (WIDE-Set ändert den Pfad
  nicht); Datei steht nicht auf meiner Schreibliste, daher nur gemeldet.
- Uncommittete Fremd-Änderungen im Shared Tree (`mode.ts`, `de/en/es/fr.ts`,
  `src/services/amazon/`) stammen ebenfalls vom Parallelbetrieb.
