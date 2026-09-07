# Sprint 13 Agent 4 — Kapitel-Listen-Perf: Abschlussbericht

## Komponente (FIND)
Die Kapitel-Liste ist der Projekt-Baum in
`src/components/Sidebar/Sidebar.tsx`: `ProjectRow` mappt alle Kapitel eines
aktiven Projekts auf `ChapterRow` (`ul.chapter-tree`). Keine andere
Kapitel-Liste im `src`-Baum (`ChapterOutlinePanel` ist eine
Editor-Überschriften-Gliederung, kein Kapitel-Baum).

## Befund / Messung (200-Kapitel-Fixture, jsdom)
- `ChapterRow`/`ProjectRow` waren bereits `memo`-wrapped, `rowActions` per
  `useMemo` stabilisiert — der Vorgänger hat die Basis gelegt.
- Lücke (verifiziert per Code-Lesart + Fix-Prämisse): `Sidebar` hatte
  `useCallback`-Deps auf `t` aus `useI18n()`. Ohne `I18nProvider` (u. a. alle
  Component-Tests) liefert der Fallback **pro Render eine neue `t`-Identität**,
  d. h. `rowActions` wurde bei jedem Sidebar-Render neu gebaut und das
  Row-Memo vollständig ausgehebelt (jede Zeile rendert bei jedem Rerender neu).
- Messmethode: memoisierte Zähl-Hülle um die reale `ChapterRow` (exakte
  Render-Zählung; Pro-Row-`<Profiler>` wurde verworfen — er misst sich selbst,
  weil sich seine eigenen Props bei jedem Eltern-Render ändern).

## Optimierung (keine neuen Dependencies)
- `src/components/Sidebar/Sidebar.tsx`:
  - `tRef`-Pattern: Handler lesen `tRef.current(...)` zum Event-Zeitpunkt,
    Deps `[refresh|openProject, lang]` statt `[…, t]`. Labels bleiben korrekt
    (Sprachwechsel → neue Callback-Identität → Rows rendern neu), irrelevante
    Rerenders invalidieren `rowActions` nicht mehr.
  - `ChapterRow`, `ProjectRow`, `RowActions` exportiert (Testbarkeit, kein
    Verhaltens-Change).

## Render-Ceiling (N = 200, alle gemessen)
| Szenario | Ergebnis |
|---|---|
| Mount | 200 Zeilen × exakt 1 Render |
| Eltern-Rerender, stabile Props | 0 Zusatz-Renders |
| Selektionswechsel | exakt 2 Zeilen (alt + neu) |
| 1 ersetztes Chapter-Objekt (Store-`updateChapter`-Semantik) | exakt 1 Zeile |
| Neue Actions-Identität (Negativ-Vertrag) | 200 Zusatz-Renders |
| `ProjectRow`, stabile Props | 0 Zusatz-Renders |
| Sidebar-Integration: 200 Zeilen im DOM, Selektion, Fremd-Rerender | 200 Knoten, 1 aktive Zeile, keine Remounts |

## Tests (TDD, 10 Tests — Vorgabe: 8+)
`src/components/Sidebar/ChapterList.perf.test.tsx` — 10/10 grün:
5× `ChapterRow`-Ceiling, 2× `ProjectRow`, 3× Sidebar-Integration.
Regression: bestehende Sidebar-Suiten (35 Tests) grün, `tsc --noEmit` sauber,
`eslint --max-warnings 0` sauber.

## Status-Self-Check
- [x] Komponente gefunden (`Sidebar.tsx` chapter-tree)
- [x] 200er-Fixture gemessen (Render-Counts, jsdom)
- [x] Optimiert ohne neue Deps (tRef + lang-Deps, Memo-Rows, stabile Callbacks)
- [x] 10 Tests (≥ 8), alle grün
- [x] Keine Partial-Files; kein `git checkout`/`branch` (Baum unberührt außer
      eigenen Dateien); geänderte Dateien: `Sidebar.tsx`,
      `ChapterList.perf.test.tsx`, dieser Bericht
