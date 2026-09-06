# Sprint 11 · Agent 2 — Lektorats-Modus (Abschlussbericht)

Datum: 2026-09-06 · Modus: Style-Pass, rein regelbasiert (offline, zero network)

## Geliefert (nur NEUE Dateien, nichts Bestehendes geändert)

| Datei | Inhalt |
|---|---|
| `src/services/bookwriter/lektorat.ts` | 5 regelbasierte Checks + `analyzeChapter`/`analyzeBook` + `rephraseWithLlm` (injizierbares `complete`) + `createOllamaComplete()` (Lazy-Import-Muster aus `./continuity`, kein neuer Netzwerk-Code) |
| `src/components/BookWriter/LektoratPanel.tsx` | Standalone-Befundliste mit Übernehmen/Verwerfen (lokaler State) + optionaler Umformulierung; keine Änderung an BookWriterPanel/ContinuityPanel |
| `src/services/bookwriter/lektorat.test.ts` | 25 Tests (Vertrag: 12+), alle Fixtures inline, `complete` gemockt |
| `docs/sprint11-agent2-lektorat-abschlussbericht.md` | dieser Bericht |

## Check-Abdeckung (Befund: `{type, chapterId, position, suggestion, rationale}`)

1. **repeated_word** — Inhaltswort (≥4 Zeichen, Stoppwort-gefiltert) wiederholt sich im 25-Token-Fenster; Vorschlag in Original-Schreibung.
2. **sentence_variance** — Sätze ≥30 Wörter (verschachtelt) + monotone Folgen (3+ Sätze, Längen-Spread ≤3).
3. **passive_voice** — deutsche Vorgangspassiv-Heuristik (`wurde/wird … Partizip`, `ist/war … worden`); ab 3 Treffern zusätzlicher Dichte-Befund (Pos. 0).
4. **dialogue_tag** — ein Tag ≥60 % aller Redeeinleitungen (≥3 Tags gesamt) mit Alternativ-Vorschlägen; Liste: 28 deutsche Tags.
5. **filler_word** — 15 deutsche Füllwörter (`eigentlich`, `irgendwie`, `quasi`, `halt`, `sozusagen` …), Wortgrenzen-gematcht; bewusst KEINE Allerwelts-Adverbien (`sehr`, `auch`, `schon`), um False-Positive-Flut zu vermeiden.

## Verifikation

- `npx vitest run src/services/bookwriter/lektorat.test.ts` → **25/25 bestanden**.
- `npx tsc -p tsconfig.json --noEmit` → **keine Fehler** (ein toter Helper während der Arbeit entfernt).
- `continuity.ts` gelesen und wiederverwendet (Typ-/Hook-Muster: `CompleteFn`, `createOllamaComplete`), nichts dupliziert, nichts dort geändert.
- Keine Shell-Unicode-Hacks; Umlaute nur in tsx-Strings/Typo_fixed (Test-Kommentar ASCII-sicher).

## git-status Self-Check

```
M package.json
M src/i18n/de.json
M src/i18n/en.json
M src/i18n/es.json
M src/i18n/fr.json
?? src/components/BookWriter/LektoratPanel.tsx
?? src/services/bookwriter/lektorat.test.ts
?? src/services/bookwriter/lektorat.ts
```

`M`-Einträge stammen aus paralleler Agenten-Arbeit auf dem Shared-Tree (nicht von Agent 2 angerührt); eigene Arbeit = exakt die 3 `??`-Dateien (+ dieser Bericht). Kein `checkout`/`branch` ausgeführt.

## Offen / Hinweise an den Integrator

- `LektoratPanel` nutzt Klassen aus `bookwriter.css` (`ws-muted`, `ws-btn`) — visuelle Feinabstimmung optional.
- Schwellwerte (`repeatWindow`, `longSentenceWords`, `dialogueTagThreshold`, `passiveMinCount`) sind über `LektoratOptions` pro Aufruf tunebar; Defaults s. Code.
- Panel schreibt bewusst nichts in Stores — Übernehmen/Verwerfen ist reine lokale Filterung.
