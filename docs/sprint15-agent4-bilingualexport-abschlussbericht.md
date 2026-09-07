# Sprint 15 – Agent 4: Bilingual-Export (DE+EN nebeneinander) – Abschlussbericht

**Agent:** Agent 4 (Bilingual-Export) · **Datum:** 2026-09-07
**Eigentum:** `src/services/export/bilingualExport.ts` + `src/services/export/bilingualExport.test.ts`
**Getestet:** `npx vitest run src/services/export/bilingualExport.test.ts` → **15/15 bestanden**

## 1. Export-Pipeline (Read-only-Analyse)

- `src/services/export/index.ts`: `toBlocks(TipTap-JSON)` → `Block[]` → `toMd`/`toDocx`/`toPdf`/`toEpub`; `exportProject`/`exportContent` als öffentliche API.
- `src/services/export/blocks.ts`: re-exportiert nur `toBlocks`/`Block` (keine eigene Logik).
- Relevante Nachbarn: `translatorService.ts` liefert Kapitel-Inhalte als **Markdown**, der Export-Service arbeitet mit **TipTap-JSON** → der Bilingual-Export muss beides akzeptieren.

## 2. Implementierung: `src/services/export/bilingualExport.ts`

Vertrags-Interface: `exportBilingual(book, targetLang, complete): Promise<Blob>` (Markdown-Blob, `text/markdown;charset=utf-8`).

- **Typen:** `BilingualBook` (`id/title/titleDe/titleEn/author/chapters`), `BilingualChapter` (`id/titleDe/titleEn/contentDe/contentEn`, Inhalte je TipTap-JSON **oder** Markdown), `BilingualTargetLang = "de" | "en"`.
- **Wiederverwendung:** `contentToMarkdown()` erkennt TipTap-`doc`-JSON und nutzt `toBlocks → toMd`; Markdown/Rohtext wird direkt übernommen.
- **Side-by-Side:** je Kapitel eine Zwei-Spalten-Tabelle `| 🇩🇪 Deutsch (DE) | 🇬🇧 English (EN) |` (DE links, EN rechts, fix — unabhängig von `targetLang`); Absätze werden via `<br>` inline-fähig gemacht, Pipes escaped.
- **Volltext + Sprach-Marker:** unter der Tabelle je Kapitel `<!-- lang:de --> … <!-- /lang:de -->` und `<!-- lang:en --> … <!-- /lang:en -->` mit `### 🇩🇪/🇬🇧`-Überschriften.
- **Sprachumschaltbares TOC:** `buildBilingualToc()` — `## Inhaltsverzeichnis / Table of Contents` mit getrennten DE-/EN-Blöcken (je mit Markern) und Anker-Links `#<slug>-de` / `#<slug>-en`; Kapitel tragen `<a id="…-de"></a><a id="…-en"></a>`.
- **Semantik der Parameter:** `targetLang` wählt Titel-Präferenz/Metadaten-Sprache; `complete=true` = Titelseite + `<!-- bilingual: de+en -->`-Marker + TOC (Vollbuch), `false` = nur Kapitel (Vorschau/Teilexport).
- **Helpers (exportiert, testbar):** `slugifyChapterId`, `contentToMarkdown`, `buildBilingualToc`, `buildBilingualChapterMd`, `buildBilingualMarkdown`.

## 3. Tests (TDD, alle gemockt, keine Provider-Calls)

`src/services/export/bilingualExport.test.ts` — **15 Tests**, alle grün:
slugify (2), contentToMarkdown (3: TipTap-Pipeline / Markdown-passthrough / leer),
TOC (2: Sprach-Marker + DE/EN-Verlinkung aller Kapitel), Kapitel (3: DE-links-vor-EN-rechts /
Marker+Anker / Nummerierung), Dokument (3: Titel+Autor+Marker / EN-Titel / complete=false),
exportBilingual (2: Blob-Typ + Zweisprachigkeit / Tabellenanzahl = Kapitelanzahl).

## 4. Status Self-Check

- [x] `src/services/export/` gelesen (index.ts vollständig, blocks.ts), nichts dort verändert
- [x] `bilingualExport.ts` neu, einzige Production-Datei im Eigentum
- [x] Vertrags-Signatur `exportBilingual(book, targetLang, complete): Promise<Blob>` eingehalten
- [x] 15 Tests (≥ 10 gefordert), alle gemockt, `vitest run` grün
- [x] `tsc --noEmit`: **keine** Fehler in eigenen Dateien (verbleibende Fehler nur in fremden Dateien: `BilingualSettings.test.tsx`, `bookwriter/bilingual.test.ts` → Eigentum anderer Agenten)
- [x] Kein `git checkout`/`branch` ausgeführt (Shared-Tree-Regel)
- [ ] Offen / an andere Agenten: DOCX/PDF/EPUB-Varianten des Bilingual-Layouts (falls gewünscht, Agent 4-Follow-up); UI-Einbindung (BilingualSettings, fremdes Eigentum)
