# Sprint 16, Agent 3 — Bildgenerierung fuer Artikel: Abschlussbericht

- **Datum:** 2026-09-07
- **Agent:** Agent 3 (Bildgenerierung)
- **Scope:** NUR neue Dateien unter `src/services/news/` — `imageGen.ts` (Sprint 14) read-only wiederverwendet, nicht geaendert.
- **Status:** DONE — 12/12 Tests gruen, `tsc --noEmit` meldet keine Fehler in eigenen Dateien.

## Geliefert

| Datei | Inhalt |
|---|---|
| `src/services/news/newsImages.ts` (neu) | `generateArticleImage(articlePrompt, style?, options?)` → `{ dataUrl, prompt }`; `generateHeadlineImage(headline, options?)` → `{ dataUrl }`; exportierte Prompt-Bauer `buildArticleImagePrompt` / `buildHeadlineImagePrompt`; Typen `NewsImageStyle` (`editorial`/`foto`/`illustration`/`minimal`), `NewsImageOptions`, `ArticleImageResult`, `HeadlineImageResult`; Konstanten `DEFAULT_NEWS_IMAGE_STYLE`, `HEADLINE_CARD_WIDTH/HEIGHT` (1200x630) |
| `src/services/news/newsImages.test.ts` (neu) | 12 Tests (TDD, `generateImage` per `vi.mock` gemockt, `ImageGenError` original) |
| `docs/sprint16-agent3-newsimages-abschlussbericht.md` | dieser Bericht |

## Design (wiederverwendet statt kopiert)

- Einziger Backend-Zugriff via `generateImage(prompt, { backend, fetchFn, model, width, height, timeoutMs })` aus `../images/imageGen.ts` — keine Duplikate von Timeout-/Offline-/SVG-Logik.
- `ImageGenError` (u.a. `kind="offline"`) wird durchgereicht, nicht geschluckt; leere Eingaben werfen `kind="bad-request"` **ohne** Backend-Call.
- Stil-Anreicherung: deutscher Prompt-Kopf (`Redaktionell`/`Pressefoto`/…) + englisches Stil-Suffix (robust fuer SD-/Ollama-Modelle) + Negativ-Hinweis (`no text in image, no watermark, no logo`).
- Headline-Karten defaulten auf 1200x630 (nur sd-webui-relevant), per Optionen ueberschreibbar.
- ASCII-only, shell-safe (Konvention aus `imageGen.ts`).

## Verifikation

- `npx vitest run src/services/news/newsImages.test.ts` → **1 File, 12 Tests, alle gruen** (Anforderung: 8+; abgedeckt: Erfolg, Default-Stil, Stil-Suffix, Options-Passthrough, Bad-Request ohne Call, Offline-Durchreichung, Fallback bei unbekanntem Stil, Headline-Format/Defaults, Prompt-Bau ohne Netz).
- `npx tsc --noEmit` → **keine Fehler** in `newsImages.ts` / `newsImages.test.ts`. (Hinweis: `articleGen.ts`, `websearch.ts` + Tests anderer Agenten melden aktuell Fehler — fremder Scope, nicht angefasst.)

## Self-Check

- [x] `imageGen.ts` gelesen, Interface wiederverwendet, Datei unveraendert
- [x] `generateArticleImage(articlePrompt, style?)` → `{ dataUrl, prompt }`
- [x] `generateHeadlineImage(headline)` → `{ dataUrl }`
- [x] 8+ Tests mit gemocktem imageGen (12 umgesetzt: Erfolg, Offline, Prompt-Bau)
- [x] Nur neue Dateien unter `src/services/news/` angelegt; kein `git checkout`/`branch`
- [x] Tests gruen, Typecheck der eigenen Dateien sauber

## Offene Punkte / Naechste Schritte

- Keine. Optionaler Follow-up (andere Agents/Sprints): E2E mit echtem Ollama (`backend: "ollama"`) bzw. SD WebUI (`backend: "sd-webui"`) gegen lokale Instanz; eigene Fehlerklasse nur noetig, falls News-Kontext (Artikel-ID) in Fehlern mitgefuehrt werden soll.
