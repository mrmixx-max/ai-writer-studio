# Sprint 17 — Agent 1: Textqualitäts-Engine — Abschlussbericht

**Datum:** 2026-09-07 · **Agent:** Agent 1 (Textqualitäts-Engine)
**Eigentum:** `src/services/bookwriter/quality.ts` (additiv) + `src/services/bookwriter/quality.metrics.test.ts`

## 1. Befund: `quality.ts` existierte bereits

`src/services/bookwriter/quality.ts` war **kein** Greenfield: es enthält den LLM-basierten
Qualitätsloop (`checkChapterQuality`, `runQualityLoop`, Dim. kohaerenz/stilgleichheit/…).
Ein Überschreiben hätte fremde Exporte + `quality.test.ts` zerstört.
**Entscheidung:** Engine **additiv angehängt** (keine Zeile Bestand geändert, nur Wortlisten
ergänzt), Muster aus `lektorat.ts` (Sprint 11) übernommen: reine Funktionen, offline,
deterministisch, injizierbare Helfer.

## 2. Geliefert: 8 Metriken, ein Report

Jede Metrik → `{ score: 0–100, level: 'good'|'warn'|'bad', suggestions: string[] }`.
Level-Schwellen einheitlich: ≥70 good, 40–69 warn, <40 bad (`toLevel`).

| # | Funktion | Verfahren |
|---|----------|-----------|
| 1 | `analyzeReadability` | Flesch/Amstad deutsch: `180 − ASL − 58,5 × ASW`, Silben via Vokalgruppen (`countGermanSyllables`, injizierbar) |
| 2 | `analyzeSentenceVariety` | Variationskoeffizient der Satzlängen; `score = CV × 160` |
| 3 | `analyzeDialogueRatio` (+ `dialogueRatioOf`) | Dialog-Zeichen ( „…“ "…" «…» / Gedankenstrich-Zeilen) ÷ Gesamtzeichen; gut bei 10–50 % |
| 4 | `analyzeAdverbDensity` | Treffer/100 Wörter (Liste + `-lich`-Heuristik); `score = 100 − 9 × Dichte` |
| 5 | `analyzeCliches` (+ `detectCliches`, `GERMAN_CLICHES`, `ENGLISH_CLICHES`) | je ~20 Phrasen DE+EN, −18 Punkte/Fund |
| 6 | `analyzeTenseConsistency` | Präsens- vs. Präteritum-Signale (erweiterte Listen: wartete, öffnete, legte, …) |
| 7 | `analyzePovConsistency` | 1.- vs. 3.-Person-Pronomen; neutral-tolerant (<3 Signale → good) |
| 8 | `analyzePacing` | Action-Verben vs. Beschreibungswörter; gut bei 35–65 % Action |
| Σ | `analyzeTextQuality` | alle 8 + `overallScore` (Mittelwert) + `overallLevel` |

Optionen: `TextQualityOptions` (`splitSentences`, `tokenize`, `countSyllables`, `adverbList`, `clicheList`).
Exportierte Helfer: `splitQualitySentences`, `tokenizeQualityWords`, `countGermanSyllables`, `DEFAULT_ADVERBS`.

## 3. Tests (TDD): 32 Tests, alle grün

`src/services/bookwriter/quality.metrics.test.ts` — je Metrik Positiv-/Negativfall,
dazu: Leertext (alle 8 → `bad` mit Hinweis), Einzelsatz, gemischtsprachiger Text (DE+EN),
injizierbarer Silbenzähler, Signalarmut-Toleranz (Tempus/Perspektive), Gesamt-Report-Shape.
4 Kalibrierungsfehler während TDD gefunden & gefixt (2 Wortlisten-Lücken: `wartete`,
`dufteten`; 1 falsche Silbenerwartung — `Lesbarkeit`=3, `eue`=1 Gruppe; 1 zu dialogarme Fixture).

## 4. Verifikation (Tool-Output, 2026-09-07)

- `npx vitest run src/services/bookwriter/quality.metrics.test.ts` → **32/32 passed**
- Regression: `quality.test.ts` + `lektorat.test.ts` → **31/31 passed**
- `npx tsc --noEmit` → 1 Fehler in `RewritePanel.test.tsx:132` (fremde, ungetrackte Datei
  eines anderen Agenten — nicht von mir angefasst, nicht von mir verursacht)

## 5. Offene Punkte / Hinweise an Orchestrator

- `DEFAULT_ADVERBS` enthält Duplikate (`plötzlich` 4×, `geht`, `macht`) — harmlos (Set-Nutzung),
  könnte bereinigt werden.
- Die einzige `tsc`-Meldung im Repo liegt in Agenten-2/3-Code (`RewritePanel`); mein Code ist typfehlerfrei.
- Namensraum-Kollision bewusst vermieden: kein eigenes `splitSentences` (Name in `lektorat.ts`
  vergeben) → `splitQualitySentences`.
