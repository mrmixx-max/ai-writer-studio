# Sprint 17 — Agent 3: Style-Guide-Engine — Abschlussbericht

**Datum:** 2026-09-07 · **Modul:** `src/services/bookwriter/styleGuide.ts`

## Geliefert
- **Neues Modul `styleGuide.ts`** (regelbasiert, deterministisch, kein LLM-Call):
  - Regeltypen: `forbiddenWords` (mit optionalem Ersatz), `preferredTerms` (wrong → preferred),
    `characterNames` (canonical + variants), `tense` (`past`/`present`), `pov` (`first`/`third`).
  - Interface: `createStyleGuide(rules, projectId?)`, `checkAgainstGuide(text, guide): StyleFinding[]`
    ( Befunde mit `kind`, `offset`, `length`, `found`, `expected`, `suggestion`, `message`, sortiert nach Offset),
    `applyFix(text, finding): string` (Offset-verifiziertes Splicing; Tense/POV-Befunde ohne Vorschlag
    lassen den Text unverändert; inkl. `matchCapitalization`-Export für Großschreibungserhalt).
  - Persistenz in den Projekt-Settings: `saveStyleGuide` / `loadStyleGuide` über die generische
    `settings`-Tabelle (Key `styleguide:<projectId>`, JSON), analog zum Settings-Service; `load` validiert
    und normalisiert fremde/korrupte Daten (null bei fehlendem Eintrag).
- **Tests:** `styleGuide.test.ts` — 18 Tests, alle grün (vitest, In-Memory-DB via Migrationen):
  Regel-Erstellung/Normalisierung/Dedup, alle fünf Prüfungsarten, kanonische Namen nicht beanstandet,
  Offset-Sortierung, Fix-Anwendung inkl. Großschreibung und Mismatch-Schutz, Persistenz-Roundtrip,
  Überschreiben und Null-Fall.
- **Typprüfung:** `tsc --noEmit` meldet keine Fehler in `styleGuide*`; Gesamtprojekt ohne neue Fehler.

## Design-Entscheidungen
- **Heuristik statt LLM** für Tense/POV (Markerwortlisten mit Wortgrenzen, case-insensitiv, Unicode-aware):
  Befunde sind als „Bitte prüfen" formuliert und tragen keinen Auto-Fix (`suggestion: null`).
- **Perfekt ausgenommen:** „hat/haben"-Formen zählen nicht als Präsens-Marker (Perfekt erzählt Vergangenheit).
- **Mehrdeutige Pronomen ausgenommen:** „sie/es/ihr" (Plural/Höflichkeit/Neutrum) lösen keine POV-Befunde aus;
  nur eindeutige Marker („er/ihn/ihm/sein-…" vs. Ich-/Wir-Formen).
- **`index.ts` bewusst nicht angefasst** (Shared Tree, 6 Agenten auf main — kein Merge-Konflikt-Risiko);
  Export kann der Integrator in einer Zeile nachziehen.

## Status-Selbstcheck
- [x] `src/services/bookwriter/` gelesen (nur lesend, keine Fremdänderung)
- [x] `styleGuide.ts` erstellt mit gefordertem Interface
- [x] 10+-Tests-Vorgabe erfüllt (18 Tests, alle grün)
- [x] Persistenz-Roundtrip verifiziert
- [x] Abschlussbericht geschrieben
- [ ] Bekannte Lücke: kein Export in `bookwriter/index.ts` (bewusst, siehe oben)
