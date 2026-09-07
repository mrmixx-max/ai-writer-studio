# Sprint 16, Agent 2: Artikel-Generator — Abschlussbericht

**Dateien (alle NEU, nur `src/services/news/` + `docs/` angefasst):**
- `src/services/news/articleGen.ts` — Implementierung (~230 Zeilen)
- `src/services/news/articleGen.test.ts` — 16 Tests (vitest, `complete` gemockt)
- `docs/sprint16-agent2-articlegen-abschlussbericht.md` — dieser Bericht

**Vorgaben-Abgleich:**
- `src/services/ollama/` gelesen (compactPrompts: kompakte System-Prompts,
  Complete-Pattern; resilience: injizierbares fetch, deutsche ASCII-Fehlermeldungen).
- `src/services/prompts/templates.ts` gelesen und Muster uebernommen:
  `CompleteFn = (prompt: string) => Promise<string>`, reine
  Bau-/Parse-Funktionen + eine `async`-Huelfe mit Aussenwirkung
  (`runTemplateTask` → hier `generateArticle`).
- Interface wie gefordert:
  `generateArticle(searchResults, style?): Promise<{title, body, summary, imagePrompt}>`
  (`complete` als 3. Parameter injizierbar, Default-Stil `"neutral"`).

**Design:**
- `buildArticlePrompt(results, style)` (pure): nummerierte Quellen
  (Titel + snippet/text + source/url), Stil-Satz je Variante
  (neutral / Boulevard / analytisch), Format-Hinweis mit vier Markern.
- `parseArticleResponse(raw, fallbackTitle)` (pure): 1) JSON (engl./dt. Keys),
  2) Marker-Format (`TITEL:/TITLE:/HEADLINE:`, `ARTIKEL:/TEXT:/BODY:`,
  `ZUSAMMENFASSUNG:/SUMMARY:`, `BILDPROMPT:/IMAGE PROMPT:`),
  3) Fliesstext ab 50 Zeichen als Body. Fallbacks: Titel ← erste Quelle /
  `"Ohne Titel"`, Summary ← Body-Ausschnitt (200 Z.), Bildprompt ←
  `"News illustration: <Titel>"`.
- Fehler-Taxonomie `ArticleGenError` mit `kind`:
  `empty` (keine Quellen / Leerantwort), `malformed` (kein Body ableitbar),
  `complete` (injizierte Funktion wirft), `args` (kein `complete` / falscher Stil).

**Verifikation:**
- `npx vitest run src/services/news/articleGen.test.ts`: **16/16 bestanden**
  (Erfolg, Quellen im Prompt, Default-Stil, JSON, leere Liste, Leerantwort,
  Kurzantwort, fehlendes `complete`, Complete-Fehler, falscher Stil,
  3 Stil-Tests, 3 Fallback-Tests).
- `npx tsc --noEmit`: **keine Fehler** in `news/articleGen*`
  (die zwei `news/websearch*`-Fehler stammen von einem Sibling-Agenten,
  nicht angefasst).

**Status-Selbstcheck:**
- [x] Nur NEUE Dateien unter `src/services/news/` (+ Bericht unter `docs/`)
- [x] Kein `git checkout` / `git branch` ausgefuehrt (Shared-Tree auf main)
- [x] Kein Provider-Import (reine Dependency Injection, kein Netzwerk im Modul)
- [x] 10+-Tests-Vorgabe erfuellt (16 Tests, gemockt)
- [x] Verifiziert durch echten Testlauf + Typecheck, nicht nur geschrieben

**Offen / Hinweise an Integration:**
- `complete`-Verdrahtung an echten Ollama-Call liegt beim Integrator
  (Signatur passt zu `(prompt: string) => Promise<string>`).
- `src/services/news/websearch.ts` (Sibling) hat 2 tsc-Fehler — separat zu fixen.
