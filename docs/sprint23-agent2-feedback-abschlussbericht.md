# Sprint 23 — Agent 2: KI-gestützter Text-Review (Feedback Engine + Panel) — Abschlussbericht

Datum: 2026-09-08 · Modus: `feedback` (🔍 KI-Review) · Kein Commit, kein Build

## Ergebnis
- **Feedback Engine** (`src/services/feedback/feedback.ts`, neu): `reviewText()` (LLM-Review mit JSON-Parsing + lokale Heuristik als Offline-Fallback), `getAvailableFocusAreas()` (8 Bereiche), `applySuggestion()` / `applyAllSuggestions()` (rein, synchron).
- **FeedbackPanel** (`src/components/Feedback/FeedbackPanel.tsx`, neu): Text-Eingabe, Fokus-Multi-Select (8 Checkboxen), Ton-Auswahl (Professionell/Locker/Akademisch/Kreativ), amberfarbener Review-Start mit Timer + Abbrechen (AbortController), Ergebnis mit Score + Zusammenfassung + Stärken/Schwächen, Vorschlagsliste (Original → Vorschlag + Grund + Prioritäts-Badge) mit „Übernehmen" pro Vorschlag und „Alle übernehmen". Bloomberg-Terminal-Stil (Inline-Styles, kein neues CSS-Asset).
- **Sidebar-Mode `feedback`**: `EditorMode` erweitert, MODES-Eintrag (`🔍`, „LLM-gestützte Verbesserungsvorschläge"), Lazy-Panel + standalone `ModePanel`-Branch (kein Kapitel nötig), `WIDE_EXTRA_MODES`, Labels de (`KI-Review`) / en (`AI Review`) / es (`Revisión IA`) / fr (`Révision IA` — es/fr nötig für den i18n-Paritätstest).
- **Tests: 12 neu, alle grün** (7 Engine + 5 Panel). Nachbarn verifiziert: i18n, navigation, sidebarLabels — 38/38 grün.

## Verifikation
- `npx vitest run src/services/feedback src/components/Feedback` → 12 passed.
- `… + src/i18n/i18n.test.ts + navigation + sidebarLabels` → 38 passed.
- Keine neuen Dependencies. Kein Commit, kein Build (Vorgabe).

## Bekannte Fremdbefunde (nicht von diesem Agenten, nicht angefasst)
- `sidebar.bilingual.test.tsx` (2 Tests) schlägt fehl — defekter Store-Mock (`useProjectStore` ohne Selector-Support → `projects.map is not a function`); unabhängig vom `feedback`-Mode (eigene Diffs rein additiv, per `git diff` belegt).
- Paralleler Agent 3 editierte gleichzeitig `mode.ts`/`Sidebar.tsx`/`de.ts`/`en.ts` (u. a. kaputte Union-Stelle `| "feedback";` mitten im Union-Typ) — repariert: `feedback` ans Union-Ende gesetzt, Datei wieder valides TS.
- `mode.ts`-Union enthält zusätzlich `advanced-export` ohne Sidebar-Eintrag (Agent-3-Baustelle) — bewusst nicht angefasst.

## Offen / Empfehlungen
- Echte LLM-Verdrahtung im Panel läuft über `reviewText()`-Default (Provider aus Settings); Panel-Prop `review` erlaubt Mocks/Tests.
- Optional: „Aktuellen Kapiteltext übernehmen"-Button (liest aktives Kapitel aus dem ProjectStore) — derzeit Deckung via Text-Eingabe + `initialText`-Prop.
