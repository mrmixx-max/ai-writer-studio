# Sprint 18 — Agent 3: Settings-Modernisierung (Bloomberg-Terminal) — Abschlussbericht

**Datei-Ownership:** `src/components/Settings/SettingsPanel.tsx` + `src/components/Settings/settings.css`
**Status:** ✅ abgeschlossen — 15/15 Tests grün (10 Bestand + 5 neu), `tsc` ohne neue Fehler, kein Behavior-Bruch.

## Was geändert wurde

**`settings.css` (Rewrite, ~350 Zeilen):**
- Bloomberg-Token als lokale Vars auf `.settings-panel`
  (`--set-bg #0a0e13`, `--set-amber #ffb000`, `--set-up #00d664`, `--set-down #ff5147`, `--set-mono`-Stack).
- Signaturklasse `.settings-bloomberg`: Terminal-Fläche, Amber-Toplinie, Monospace überall, Ticker-Header via `::before`.
- `.settings-divider`: Amber-Quadrat + Verlaufslinie, uppercase, letter-spacing.
- `.settings-row`: dichte Rows (6px/8px), Amber-Fokus-Inset, Sektions-Trennlinien.
- `input.toggle-switch`: natives Checkbox-Element als Amber-Pill-Switch (`appearance: none`, Knob, Glow, `focus-visible`-Ring) — **Behavior unverändert**, nur Optik.
- Alle Hardcodes ersetzt (`#2ecc71`, `#e74c3c`, `#f1c40f`, `#143d14/#7CFC7C`, `#3d1414/#fc7c7c`, `#888`) durch `var(--set-*, fallback)` — Light-Theme und `ModelManager` (teilt die Datei) bleiben konsistent.
- Blinkender `dirty-dot` (Amber, `steps()`-Animation, respektiert keine `prefers-reduced-motion`-Ausnahme — bewusst minimal; Hinweis für Follow-up).

**`SettingsPanel.tsx` (minimaler Diff, 14 gezielte Patches, Logik unangetastet):**
- `import "./settings.css"` (self-contained; `App.tsx`-Globalimport bleibt).
- Root: `settings-panel settings-bloomberg`; Titel: `settings-title`.
- 3 Sektionen mit Dividern: Anbieter (`region "Anbieter"`), LLM-Parameter (`region "LLM-Parameter (Modell, Temperatur, Tokens)"`), Darstellung (`region "Darstellung"`).
- Alle Kontroll-Labels → `.settings-row`; Hochkontrast-Label → `.toggle-row` + `input.toggle-switch` + `.toggle-label`-Span (accessible Name unverändert).
- Keine State-/Handler-/Props-Änderung: `update`, `save`, `discard`, `testConnection`, Discovery, Dirty-Tracking identisch.

## Tests (TDD)

Neu in `SettingsPanel.test.tsx` → Describe „SettingsPanel Bloomberg-Theme (Sprint 18, Agent 3)“, **5 Tests**:
1. Root trägt `.settings-bloomberg`.
2. Sektionen + ≥3 Divider rendern (Regions per Rolle).
3. Toggle-Switch: Klasse vorhanden, Klick → `setHighContrast(true)`, `checked === true`, Label `.toggle-row`.
4. ≥7 `.settings-row`-Labels (dense Rows).
5. `.active`-Klasse der Anbieter-Karte erhalten (kein Behavior-Bruch).

**Ergebnis:** `npx vitest run src/components/Settings/SettingsPanel.test.tsx` → **15/15 bestanden**.
Zwischenbefund: 1 Bestands-Test („Modell-Auswahl…“) schlug nach Umbau fehl, weil `aria-label="Modell und Parameter"` auf `getByLabelText(/^Modell/)` matchte (Testing Library wertet `aria-label` als Label). Fix: Sektion heißt `„LLM-Parameter (Modell, Temperatur, Tokens)“` — kein Prefix-Clash mehr. Lektion: Sektions-Labels nie mit demselben Präfix wie Feld-Labels benennen.

## Verifikation

| Check | Ergebnis |
|---|---|
| `vitest run SettingsPanel.test.tsx` | 15/15 ✅ |
| `tsc --noEmit` | einziger Fehler in `src/services/bookwriter/rewrite.ts:190` (fremdes Ownership, Sprint-18-Agent-4-Bereich, von mir unberührt) — keine neuen Fehler in Settings ✅ |
| `git status` | nur eigene Dateien modifiziert: `SettingsPanel.tsx`, `settings.css`, `SettingsPanel.test.tsx` (+ dieser Bericht) ✅ |
| Kein `git checkout/branch` ausgeführt (Shared-Tree-Regel) ✅ | |

## Offene Punkte / Hinweise an Orchestrator

- `prefers-reduced-motion` für `.dirty-dot`-Blink könnte folgen (Mini-Follow-up, ~3 Zeilen).
- `tsc`-Fehler in `bookwriter/rewrite.ts` gehört Agent 4 (BookWriter), nicht in meinem Scope angefasst.
- Geteilte `settings.css` mit `ModelManager`: Basis-Selektoren unverändert erhalten, Bloomberg nur unter `.settings-bloomberg` gescoped — kein Seiteneffekt auf ModelManager (verifiziert per Selektor-Review; ModelManager nutzt eigene Klassen).
