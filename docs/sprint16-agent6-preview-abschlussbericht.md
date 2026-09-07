# Sprint 16 Agent 6 — Zeitungs-Vorschau + Drucken: Abschlussbericht

## Auftrag
Standalone-Zeitungsvorschau (Headline, Artikel, Bilder), Seitennavigation,
Print-Button (`window.print()`), DE/EN-Toggle. Strukturvorbild:
`src/components/Images/ImageGenPanel.tsx` (Sprint 14, read-only kopiert).

## Geliefert (nur NEW files unter `src/components/News/`)
- `src/components/News/NewspaperPreview.tsx` — standalone Komponente, keine
  Store-/Backend-Imports. Props: `title/titleEn`, `articles`,
  `initialLanguage`, `initialPage`, `articlesPerPage`, `onPrint`.
  Features: Masthead, Artikel-Render (Headline/Body/Bild), Prev/Next-Navigation
  mit Seitenindikator, Print-Button (ohne `onPrint` → `window.print()`),
  DE/EN-Toggle + Direktbuttons, `@media print`-CSS blendet Toolbar/Pagination aus.
- `src/components/News/newspaper-preview.css` — Layout + Print-Regeln.
- `src/components/News/NewspaperPreview.test.tsx` — 9 Tests.
- `docs/sprint16-agent6-preview-abschlussbericht.md` — dieser Bericht.

## Verifikation
- `npx vitest run src/components/News/NewspaperPreview.test.tsx` → **9/9 passed**
  (Render, Empty-State, Navigation vor/zurück, Button-Disabled,
  `window.print()`, `onPrint`-Override, Toggle DE↔EN, Direktbuttons, Bild+Alt).
- `npx tsc --noEmit` → **keine Fehler in eigenen Dateien**; 3 Fehler in
  `src/services/news/*` stammen von anderen Agenten (ungenutzte `MARKERS`/
  `stripHtml`, Response-Cast) — nicht angefasst (fremdes Eigentum).
- Status-Self-Check: keine `git checkout/branch`-Befehle ausgeführt, nur NEW
  files im eigenen Verzeichnis, keine bestehenden Dateien modifiziert.

## Offene Punkte / Hinweise
- `src/services/news`-Typeerrors (Agent 1–3-Bereich) sollten deren Owner fixen.
- Optionale Folgearbeit: Vorschau in ExportBar/Generator-UI einbetten
  (bewusst offengelassen — Eigentum anderer Agenten).
