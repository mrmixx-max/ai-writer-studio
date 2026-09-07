# Sprint 18 · Agent 2 — Sidebar-Modernisierung (Bloomberg-Terminal) · Abschlussbericht

- **Scope:** `src/components/Sidebar/Sidebar.tsx` + `src/components/Sidebar/sidebar.css` (eigene Dateien, keine Fremdeingriffe)
- **Tests:** `src/components/Sidebar/sidebarBloomberg.test.tsx` (7 neue Tests)
- **Status:** ✅ abgeschlossen, alle Nachweise grün

## Was geändert wurde (minimaler Diff, kein Verhaltensbruch)

1. **`sidebar.css` (Rewrite im Bestand):** Bloomberg-Ästhetik über `--sb-*`-Variablen
   (`--sb-bg #0b0f14`, `--sb-amber #ffb000`, `--sb-mono`-Stack). Aktive Items
   (Modus-Buttons, Projekt-/Kapitelzeilen) mit Amber-Rahmen + Amber-Text auf
   dunklem Amber-Tint; dichtere Paddings (12 px, kompakte 26-px-Modus-Buttons);
   neu: `.sb-section-toggle`, `.sb-kbd` (Shortcut-Chips). Alle historischen
   Selektoren erhalten (`.sidebar.wide` = 460 px, `.mode-switcher`, `.node`,
   `.node-actions`, Responsive-Queries) — `navigation.test.ts`-Assertions gelten weiter.
2. **`Sidebar.tsx` (4 kleine Eingriffe):**
   - `import "./sidebar.css"` (zuvor nur global über `App.tsx` geladen; Komponente jetzt eigenständig gestylt).
   - `MODES` um eindeutiges `shortcut`-Feld erweitert (Ctrl+1…0, Alt+1…0, Ctrl+Alt+1…0, Ctrl+Shift+C).
     Keine harten Farben im TSX — es gab keine (Styling war bereits klassenbasiert); Vars leben im CSS.
   - Switcher in kollabierbare `<section class="sb-modes">` mit `MODES`-Toggle (`aria-expanded`,
     Standard aufgeklappt) eingebettet; `aria-label` bleibt auf `nav.mode-switcher` (A11y-Test-Vertrag).
   - Modus-Buttons zeigen `<kbd class="sb-kbd" aria-hidden>` + `data-shortcut`; `title`/`aria-label` unverändert.

## Verifikation

- `npx vitest run src/components/Sidebar/` → **6 Dateien, 52 Tests, alle grün**
  (davon 7 neue Bloomberg-Tests: `.active`-Hook, Amber-CSS-Verankerung, aktive Projektzeile,
  Toggle kollabieren/expandieren + Moduswechsel danach, Projekt-Collapse, Shortcut-Chips, Mono/Dichte-Vars).
- `npx tsc --noEmit` → **keine Fehler** in Sidebar-Dateien. Einziger Repo-Fehler
  (`src/services/bookwriter/rewrite.ts`, Arg-Anzahl) liegt in einer fremden Datei und ist präexistent.
- Bestehende Verträge gehalten: `const switcher =` ×1, `{switcher}` ×3, `id: "<modus>"` je ×1,
  `knowledge` vor Kapitel-Guard, `.sidebar.wide`-Breite, A11y-Labels (`aria-label` = `title`, `aria-pressed`).

## Status-Selbstcheck

| Kriterium | Erfüllt |
|---|---|
| `Sidebar.tsx` vollständig gelesen | ✅ (455 Zeilen) |
| Dark-BG, Amber-Active, Monospace, dichtes Layout | ✅ via `--sb-*`-Vars |
| Kollabierbare Sektionen (Modi-Toggle; Projekt-Baum unverändert kollabierend) | ✅ |
| Shortcut-Anzeige | ✅ (`sb-kbd` + `data-shortcut`, 31 eindeutige Kürzel) |
| `sidebar.css` vorhanden/gepflegt | ✅ |
| Minimaler Diff, kein Verhaltensbruch | ✅ (alle 45 Bestandstests weiter grün) |
| TDD: ≥ 4 Tests | ✅ (7 neue) |
| Nur eigene Dateien angefasst | ✅ (`git status` bestätigt) |
