# Sprint 16 — Agent 4: Zeitungs-Layout + Export (Abschlussbericht)

## Auftrag
`src/services/news/newspaperLayout.ts` neu bauen: Zeitung aus Artikeln
assemblieren (`buildNewspaper`), Markdown-Export mit Bild-Platzhaltern,
8+ TDD-Tests, Export-Pipeline nur lesend studiert.

## Geliefert (neue Dateien, keine bestehenden angefasst)
- `src/services/news/newspaperLayout.ts`
  - `buildNewspaper(articles, options): { pages, toc }`
  - `newspaperToMarkdown(paper, articles, options)` (+ Alias `exportNewspaperMarkdown`)
  - Typen: `NewsArticle`, `Page`, `PageColumn`, `PlacedArticle`,
    `ImageSlot`, `TocEntry`, `Newspaper`, `NewspaperLayoutOptions`
- `src/services/news/newspaperLayout.test.ts` — 11 Tests, alle grün
- dieser Bericht

## Design
- **Headline-Platzierung:** pro Seite ist Artikel 0 die Lead-Story
  (`role: "lead"`, `headlineSize: "xl"`); danach secondary (`lg`/`md`) / brief.
  `priority: "lead"` sortiert vor (stabil), Lead spannt alle Spalten (`columnSpan`).
- **Bild-Slots:** nur Artikel mit `imageUrl`; Lead zuerst, dann Rest;
  Limit `maxImagesPerPage` (Default 2). Lead-Slot `position: "top"`, Rest `inline`.
  Platzhalter: `![Bild: <caption|headline>](url)` bzw. `[Bild-Platzhalter: …]`
  ohne URL — analog zur `[Bild: src]`-Konvention aus `services/export/index.ts`.
- **Spalten:** round-robin über `columnsPerPage` (Default 2); Lead in Spalte 0.
- **Paginierung:** `articlesPerPage` (Default 4), `maxPages` (Default ∞).
- **Leerfall:** `{ pages: [], toc: [] }`; Markdown-Export mit Hinweis
  „Keine Artikel vorhanden."

## Verifikation
- `npx vitest run src/services/news/newspaperLayout.test.ts` → **11/11 passed**
- `npx tsc --noEmit` → **keine Fehler** in `newspaperLayout.ts` /
  `newspaperLayout.test.ts` (Fehler in `articleGen.*` / `websearch.*`
  stammen von anderen Agenten, nicht angefasst)
- `services/export/` nur gelesen, keine Datei dort geändert

## Status-Self-Check
- [x] Export-Pipeline lesend studiert (index.ts, blocks.ts, publishing.ts)
- [x] `buildNewspaper` mit pages/toc, Headline-, Bild-, Spalten-Logik
- [x] Markdown-Export mit Bild-Platzhaltern
- [x] 11 Tests (≥ 8 gefordert): Struktur, leer, Multi-Page, TOC, Lead-Sort,
      Spalten, Slot-Vergabe, Slot-Limit, maxPages, Export, Export-leer
- [x] Nur neue Dateien unter `src/services/news/` + Bericht in `docs/`
- [x] Kein `git checkout`/`branch`; Baum auf main unverändert außer Own-Files
