# Sprint 14 Agent 6 — Prompt-Builder (Bild-Prompt-Kette): Abschlussbericht

## Auftrag
Bild-Prompt-Kette als neue, additive Schicht: strukturierte Prompts für die
Bildgenerierung aus Kapitel-Kontext. Eigentum: nur
`src/services/llm/promptBuilder.ts` + Tests. Gelesen (read-only):
`src/services/llm/router.ts`, `requestLog.ts`,
`src/services/prompts/templates.ts`, `router.quality.test.ts`.

## Geliefert (NEU, additiv — keine bestehende Datei angefasst)
- `src/services/llm/promptBuilder.ts`
  - `extractKeyScene(chapterText): string` — heuristische Schlüssel-Szene
    (visuelle Ankerwörter DE+EN als Score, Satzlänge als Tiebreaker,
    Kürzung an Wortgrenze auf 300 Zeichen, Fallback bei Leer-Input).
  - `buildImagePrompt(chapterText, style?): string` — Format
    `"<Szene>, <Stil-Phrase>, detailed, high quality, no text, no watermark"`.
    Stil: Preset-Key (`cinematic`/`watercolor`/`noir`/`fantasy`/`scifi`,
    case-insensitiv) oder freier String wörtlich; leer → `cinematic`.
  - `buildCaptionPrompt(imageDescription): string` — Caption-Anfrage-Prompt
    mit Constraints (ein Satz, max. 140 Zeichen, keine Spoiler).
  - `refineImagePrompt(prompt, complete)` — LLM-Verfeinerung mit
    injizierbarer `ImageCompleteFn` (kein Provider-Import, analog zum
    `CompleteFn`-Muster aus `templates.ts`); leere LLM-Antwort → Original.
  - Alles pure/deterministisch, wirft nie bei Leer-Input (Fallbacks).
- `src/services/llm/promptBuilder.test.ts` — **14 Tests**, alle gemockt
  (kein Netzwerk/Disk/LLM): 4× Extraktion, 5× `buildImagePrompt`
  (Struktur/Default/Preset/frei/leer), 1× Stil-Auflösung, 2× Caption,
  2× `refineImagePrompt` (Aufruf+Trim, Leer-Fallback).

## Verifiziert
- `npx vitest run src/services/llm/promptBuilder.test.ts` → **14/14 bestanden**
  (Prozess-Vitest v4.1.11).
- `npx tsc --noEmit` → **keine Fehler** in `promptBuilder.ts`/`.test.ts`.
  (Zwei Fehler in fremden Sprint-14-Dateien — `ImageGenPanel.test.tsx`,
  `backup-images.ts` — stammen von parallelen Agenten, nicht von mir.)
- `git status` → nur meine zwei Dateien als neu; kein Checkout/Branch,
  keine fremden Dateien modifiziert.

## Offen / Übergabe
- Anbindung an `image.ts`-Provider (`ImagePrompt`-Bau aus
  `buildImagePrompt`) ist bewusst offen — nächster Schritt für den
  Bild-Workflow-Agenten.
- Kein Commit durchgeführt (Shared-Tree auf `main`, Sprint-Regel).
