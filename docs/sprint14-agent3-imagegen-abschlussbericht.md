# Sprint 14 Agent 3 — Abschlussbericht: Bildgenerierung-Service (lokal)

**Datum:** 2026-09-07 | **Agent:** Agent 3 (Bildgenerierung-Service) | **Status:** DONE

## Auftrag
Neuer Service `src/services/images/imageGen.ts` (Ollama Vision + SD-WebUI-Platzhalter),
TDD mit 10+ Tests (gemockter fetch), Abschlussbericht + Status-Selbstcheck.
Ausschliesslich NEUE Dateien unter `src/services/images/` — bestehender Baum unangetastet,
kein `git checkout/branch`.

## Geliefert

| Datei | Inhalt |
|---|---|
| `src/services/images/imageGen.ts` (~380 Zeilen) | Service: `generateImage`, `checkAvailability`/`listAvailableModels`, `describeImage`, `renderTextAsSvgDataUrl`, `ImageGenError` |
| `src/services/images/imageGen.test.ts` (20 Tests) | TDD-Suite, voll gemockter fetch |
| `docs/sprint14-agent3-imagegen-abschlussbericht.md` | dieser Bericht |

## Design (Pattern aus `src/services/ollama/` wiederverwendet)
- **Injizierbarer `fetchFn`** (Konvention aus `resilience.ts requestWithTimeout`): kein Netz/GPU in Tests.
- **`ImageGenError(kind, message, cause)`** mit `kind`: `bad-request | offline | timeout | aborted | server | no-backend`
  (analog `OllamaResilienceError`); deutsche, ASCII-shell-safe Nachrichten.
- **Timeout-Guard via AbortController** (Pattern aus `resilience.ts`), Default 120 s (SD auf CPU ist langsam),
  Probe-Timeout 3 s; externes Signal wird durchgereicht (`aborted`).
- **Basis-URLs** analog `DEFAULT_OLLAMA_BASE_URL`: Ollama `http://127.0.0.1:11434`,
  SD WebUI `http://127.0.0.1:7860`.

## Interface (Sprint-Vorgabe)
- `generateImage(prompt, options): Promise<{ dataUrl, model, backend, mimeType }>`
  - `backend: "ollama"` (Default): `POST {ollama}/api/generate` (Vision-Modell, Default `llava`) →
    Antworttext wird deterministisch als **SVG-Data-URL** gerendert (Platzhalter-Darstellung ohne GPU).
  - `backend: "sd-webui"`: `POST {sd}/sdapi/v1/txt2img` (`prompt, width, height, steps`, opt. Checkpoint) →
    `images[0]`-Base64 als **PNG-Data-URL**.
  - Unbekanntes Backend / leerer Prompt → `kind=bad-request` (ohne Fetch).
- `listAvailableModels(options?): Promise<{ ollama: boolean, sdWebui: boolean }>`
  (Alias auf `checkAvailability()`; parallele GET-Probes `/api/tags` + `/sdapi/v1/sd-models`, wirft nie).
- Bonus: `describeImage(dataUrl|base64, frage)` — Ollama Vision (`/api/generate` mit `images[]`).

## Verifikation (real ausgefuehrt)
- `npx vitest run src/services/images/imageGen.test.ts` → **20/20 gruen** (Testgruppen: Validierung 2,
  Ollama 6, SD-WebUI 4, Availability 4, describeImage 3, SVG-Render 1).
- `npx tsc --noEmit` → **keine Fehler in `src/services/images/`**; 3 Vorbestehende/Parallele Fehler
  anderswo (u. a. `src/components/Images/ImageGenPanel.test.tsx` — gehoert anderem Agenten, nicht angefasst).
- TDD-Anlauf: 17/20 gruen, 3 rote waren ein Test-Bug (`.body` falsch ausgelesen) — gefixt, danach 20/20.

## Offene Punkte / Naechste Schritte
- Echte Pixelbilder brauchen SD WebUI mit `--api` (dann `backend: "sd-webui"` nutzen).
- Ollama-Pfad bleibt Text→SVG-Platzhalter, bis ein lokales Text-zu-Bild-Modell via Ollama verfuegbar ist.
- UI-Anbindung (`src/components/Images/`) liegt bei anderem Agenten — Service ist aufrufbereit.

## Selbstcheck
- [x] Nur NEUE Dateien unter `src/services/images/` angelegt (keine bestehenden geaendert)
- [x] Kein `git checkout` / `git branch` ausgefuehrt
- [x] Interface gemaess Vorgabe (`generateImage`, `listAvailableModels`)
- [x] 20 Tests (>= 10), alle gruen, gemockter fetch (Offline/Timeout/Modelliste abgedeckt)
- [x] Typecheck ohne neue Fehler
