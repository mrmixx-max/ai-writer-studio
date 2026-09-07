# Sprint 14 — Agent 4: Bildgenerierung-UI — Abschlussbericht

**Agent:** Agent 4 (Bildgenerierung-UI) · **Datum:** 2026-09-07 · **Branch:** main (shared tree, keine eigenen Branches)

## Auftrag
1. Ein bestehendes Modal-/Dialog-Pattern lesen und Struktur übernehmen.
2. NEU `src/components/Images/ImageGenPanel.tsx`: standalone Panel — Prompt-Input,
   Modell-Selector (Ollama Vision / SD WebUI), Generate-Button mit Loading-State,
   Bild-Vorschau, Fehleranzeige, „Ins Kapitel einfügen"-Button (injizierbarer Callback).
3. NEU `src/components/Images/ImageGenPanel.test.tsx`: 8+ Tests.
4. Dieser Bericht + Status-Selbstcheck.

## Gelesenes Pattern
`src/components/ImageGen/ImageGenPanel.tsx` (bestehendes Panel: Sections mit
Label + Feld, Provider-Select, Generate-Button mit `busy`-State, `.image-gen-error`,
`.image-gen-results`) sowie `src/components/Export/ExportBar.test.tsx` als
Test-Strukturvorlage (jsdom-Docblock, `render` + `user-event`, `vi.fn`-Mocks).

**Bewusst abgewichen:** Kein Settings-Store- und kein Provider-Direktimport —
das neue Panel ist standalone und bekommt die Bilderzeugung (`generateImage`)
und das Kapitel-Einfügen (`onInsertIntoChapter`) injiziert. Dadurch ohne Backend
testbar und in beliebigen Kapitel-Kontexten wiederverwendbar. Styles
(`image-gen-*`-Klassen aus `../ImageGen/image-gen.css`) werden wiederverwendet,
damit die Optik konsistent bleibt.

## Neue Dateien (Scope: nur `src/components/Images/`)
- `src/components/Images/ImageGenPanel.tsx` (~190 Zeilen)
  - Props: `generateImage?(prompt, model)`, `onInsertIntoChapter?(image)`,
    `initialModel?` (Default `"ollama-vision"`), `initialPrompt?`
  - Typen: `ImageGenModel = "ollama-vision" | "sd-webui"`,
    `GeneratedChapterImage { dataUrl, prompt, model }`,
    `IMAGE_GEN_MODELS` / `IMAGE_GEN_MODEL_LABELS`
  - Verhalten: Leer-Prompt → Fehler „Bitte einen Prompt eingeben.";
    Generate → `busy` („Generiert …", Button disabled), Fehler → `role="alert"`-Box,
    Erfolg → Vorschau (`img` + Prompt-Meta + Insert-Button);
    Insert ruft Callback mit dem Bild auf, Button bestätigt mit „eingefügt ✓".
  - Fallback-`generateImage` ohne Injektion: `sd-webui` läuft über den echten
    `createImageProvider("sd-webui", …)` mit App-Settings (Lazy-Import);
    `ollama-vision` wirft ehrlichen Konfigurationsfehler (kein Fake-Bild).
    Hinweis: `src/services/llm/image.ts` kennt nur `openai-dalle |
    openrouter-flux | sd-webui` — ein Ollama-Bildprovider existiert dort nicht.
- `src/components/Images/ImageGenPanel.test.tsx` — **10 Tests**, alle grün.

## Verifikation (echte Tool-Outputs, 2026-09-07)
- `node_modules/.bin/vitest run src/components/Images/ImageGenPanel.test.tsx`:
  **1 passed File, 10 passed Tests** (zuvor 9/10 — ein `vi.fn`-Typisierungsfehler
  im Retry-Test, gefixt via call-count-Implementation statt `mockRejectedOnce`-Kette).
- `node_modules/.bin/tsc --noEmit` gefiltert auf `Images/`: **keine Fehler**.
- Hinweis: `npx vitest` (statt lokalem Binary) zog fälschlich ein Remote-Vitest
  ohne jsdom — mit `node_modules/.bin/vitest` aus dem Projektroots läuft es.
- `git status`: eigene Änderungen = nur `src/components/Images/` (+ dieser Bericht);
  keine bestehenden Dateien angefasst, keine Kollision mit Agent 1/3 (eigene Verzeichnisse).

## Testliste (10)
1. Rendert Prompt-Feld, Modell-Selector, Generate-Button
2. Prompt-Änderung aktualisiert das Feld
3. Selector-Default `ollama-vision`, Wechsel zu `sd-webui`
4. Leer-Prompt → Fehler, kein `generateImage`-Aufruf
5. Generate → Loading („Generiert …", disabled) → Vorschau mit `img[src]`
6. Aufruf mit getrimmtem Prompt + gewähltem Modell
7. Rejection → Fehlerzustand statt Vorschau, Button wieder aktiv
8. Retry löscht vorherigen Fehler, zeigt Vorschau
9. Insert-Button erst nach Generierung; Callback mit Bild; „eingefügt"-Bestätigung
10. `initialModel`/`initialPrompt`-Props als Startwerte

## Status-Selbstcheck
- [x] `src/components/Images/ImageGenPanel.tsx` erstellt (alle geforderten Elemente)
- [x] `src/components/Images/ImageGenPanel.test.tsx` erstellt (10 ≥ 8 Tests, alle grün)
- [x] `tsc --noEmit`: keine Fehler in eigenen Dateien
- [x] Kein `git checkout`/`branch` ausgeführt; nur eigene neue Dateien angefasst
- [x] Bericht geschrieben

## Offen / Folgearbeit (nicht in meinem Scope)
- Verdrahtung im Kapitel-Editor (Agent 3 / Image-Backend): `onInsertIntoChapter`
  an Kapitel-Store koppeln; `generateImage` ggf. an echten Ollama-Vision-Endpoint,
  sobald ein Bildprovider dafür in `services/llm/image.ts` existiert.
- Eigene CSS-Datei statt Re-Use von `ImageGen/image-gen.css`, falls das Panel
  optisch eigenständig werden soll.
