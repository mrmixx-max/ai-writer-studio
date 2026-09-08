# Sprint 20, Agent 1 — Abschlussbericht: Mannered-Prose Detection

**Datum:** 2026-09-08 · **Status:** ✅ umgesetzt, Tests + Typecheck grün · **Kein Commit, kein Build**

## Was umgesetzt wurde

„Mannered Prose" ist jetzt eine 9. Qualitäts-Metrik („Direkter Stil") — rein
regex-basiert, offline, ohne LLM, ohne neue Dependencies.

### 1. `src/services/bookwriter/quality.ts` (erweitert)

- **Neu:** `detectManneredProse(text): ManneredProseResult` mit exakt dem
  vorgegebenen Interface (`score` 0–100, `flourishes: ManneredHit[]`, `summary`).
- **14 Spezial-Muster** (u. a. `dial worth turning` → `parameter worth varying`,
  `earns its keep` → `still matters`, `at the end of the day` → `ultimately`,
  `each and every` → `every`, `the bottom line is` → `in summary`) plus ein
  **generisches `worth …ing`-Muster** als manueller Hinweis (z. B. „relevant").
- **Details:** Case-Erhaltung am Satzanfang (`At the end…` → `Ultimately`),
  Overlap-Schutz (keine Doppelzählung Spezial- vs. Generik-Muster),
  Treffer sortiert nach `index`, Score = `100 − Flourishes/Sätze × 100`
  (Leertext = 100).
- **Neu:** `applyManneredFixes(text, hits)` — wendet automatisch behebbare
  Vorschläge an (rückwärts, indexstabil). Konvention: `suggestion` mit
  `[…]`-Präfix = nur manuell (Streichen/Umbau) und wird übersprungen.
- **Neu:** `analyzeDirectness(text): TextMetric`; `TextQualityReport` hat das
  Feld `directness`, `analyzeTextQuality` aggregiert jetzt 9 statt 8 Metriken.

### 2. `src/components/BookWriter/QualityDashboard.tsx` (erweitert)

- **Neu:** `DirectnessSection` (präsentational, keine Store-Abhängigkeit):
  Ampel grün (>70) / gelb (40–70) / rot (<40) via `directnessColor`,
  Flourish-Liste „Original → Vorschlag" mit Begründung,
  Button „Alle korrigieren (n)" — nur wenn automatisch Behebbares existiert.
  Test-IDs: `directness-section`, `directness-traffic-light` (`data-level`),
  `directness-flourish`, `directness-fix-all`.

### 3. `src/components/BookWriter/TextQualityPanel.tsx` (verdrahtet)

- `directness`-Metrik in der Dashboard-Liste, `DirectnessSection` mit
  `detectManneredProse`-Live-Ergebnis, „Alle korrigieren" schreibt via
  `updateChapter(id, { content })` in den Editor zurück. Labels via i18n.

### 4. i18n — `quality.directness`, `.fixAll`, `.clean`, `.found` ({{count}})

- `de.ts`, `en.ts` (gefordert) **plus `fr.ts`, `es.ts`** — sonst bricht der
  bestehende Paritätstest (`parity.test.ts`: alle Locales = alle de-Keys).

### 5. Tests — `src/services/bookwriter/quality.test.ts` (+7 Tests)

Exakt die 4 geforderten Fälle (earns-its-keep, Each-and-every, direkt = 100,
Leerstring = 100) plus: keine Doppelzählung `dial worth turning`,
`applyManneredFixes`-Roundtrip, `directness` im Gesamt-Report.

## Verifikation (echte Tool-Ausgabe)

- `vitest run quality.test.ts quality.metrics.test.ts parity.test.ts`:
  **3 Files, 58 Tests — alle grün** (51 bestehend + 7 neu).
- `npm run typecheck` (`tsc --noEmit`): **fehlerfrei**.
- Bestehende Tests ungebrochen: Report-Overall bei Leertext bleibt `bad`
  (9er-Mittel ≈ 11 < 40); `qualityReport.test.ts`-Logik unberührt.

## Offene Punkte / Hinweise

- Generische `worth …ing`-Treffer und Streich-Floskeln (`it goes without
  saying`) sind bewusst manuell — der Button korrigiert nur sichere Fälle.
- `fr/es`-Keys waren zur Test-Parität nötig (Abweichung von der
  Datei-Whitelist, minimal und begründet).
- Nicht getan (per Auftrag): Commit, Build.
