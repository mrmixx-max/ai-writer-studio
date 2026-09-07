# Sprint 15 — Agent 1: Bilingual-Book-Engine (DE→EN) — Abschlussbericht

**Datum:** 2026-09-07 · **Agent:** Agent 1 (Bilingual-Book-Engine) · **Status:** ✅ abgeschlossen

## Geliefert

| Datei | Beschreibung |
|---|---|
| `src/services/bookwriter/bilingual.ts` (neu, ~200 Zeilen) | Engine: `detectLanguage`, `translateChapter`, `translateOutline`, `buildBilingualPrompt`, Typen `CompleteFn` / `BilingualTargetLang` / `DetectedLang` |
| `src/services/bookwriter/bilingual.test.ts` (neu) | **22 Tests**, alle grün, 0 echte API-Calls (gemockte `CompleteFn`) |
| `docs/sprint15-agent1-bilingual-abschlussbericht.md` | dieser Bericht |

## Design-Entscheidungen

- **Wiederverwendung statt Duplikat:** Markup-Schutz über `markupGuard.ts` (`maskMarkup`/`restoreMarkup`, ⟦M##⟧-Platzhalter), Kapitel-Typ `TranslationChapter` aus `translatorService.ts`, `BookOutline`/`OutlineChapter` aus `@/types/bookwriter`. Keine neue Markup-Logik.
- **Injizierbare `CompleteFn = (prompt: string) => Promise<string>`** (Ollama-Pattern): ein Prompt rein, ein String raus; Produktion verdrahtet `OllamaProvider.chat` (Beispiel im Datei-Header), Tests nutzen Fakes.
- **`detectLanguage`-Heuristik:** leer → `other`; < 3 Wörter → nur ß/ä/ö/ü/Ä/Ö/Ü zählt (kein Raten); ß/ä/ö/ü-Dichte ≥ 0,5 % → `de`; sonst DE/EN-Stoppwort-Vergleich mit strikter Mehrheit, Gleichstand → `other`.
- **Sparsame Calls:** leerer Content / leere Gliederungs-Felder lösen keinen Provider-Call aus; bereits zielsprachiger Inhalt ist ein No-op; `translateOutline` mutiert nicht, `estimatedWords`/`totalWords`/`research` bleiben unverändert (Suchbegriffe werden nicht übersetzt).
- **Kein `index.ts`-Re-Export:** `bookwriter/index.ts` exportiert bereits ein `translateChapter` (andere Signatur, aus `translatorService.ts`) — ein `export *` würde kollidieren. Import per Direktpfad `@/services/bookwriter/bilingual`.

## Verifikation (Self-Check)

- `npx vitest run src/services/bookwriter/bilingual.test.ts` → **22/22 bestanden**.
- Nachbar-Suiten `translatorService.test.ts` + `multilingualPipeline.test.ts` → 26/26 bestanden (keine Regression).
- `npx tsc --noEmit` → **keine Fehler** in `bilingual.ts` / `bilingual.test.ts`. (Hinweis: `BilingualSettings.test.tsx` u. a. zeigen tsc-Fehler — das sind Dateien der parallel arbeitenden Agenten 2–5, nicht angefasst.)
- Testabdeckung (22 Tests): 8× `detectLanguage` (Umlaute, ß, stopwortbasiert, Englisch, leer, kurz-mehrdeutig, kurz-deutsch, Gleichstand), 1× Prompt-Bau, 8× `translateChapter` (Delegation, Prompt-Inhalt, Markdown-/HTML-Erhalt, leer, kurz, No-op, Fehlerweitergabe), 5× `translateOutline` (Felder/Struktur, Immutabilität, leere Outline, leere Felder, Markup).

## Offene Punkte / Übergabe

- Echte Provider-Verdrahtung (Ollama) und UI-Anbindung liegen bei den Folge-Agenten; die `CompleteFn`-Schnittstelle ist dafür bereit.
- Keine Breaking Changes an bestehenden Modulen (nur 2 neue Dateien, `index.ts` unberührt).
