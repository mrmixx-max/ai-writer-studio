# Sprint 11 — Agent 6: Keyboard-A11y für Overlays (Abschlussbericht)

**Datum:** 2026-09-06 · **Scope:** Fokus/Keys in Overlays ONLY · **Constraint:** max 2 Overlays + 1 Hook + Tests

## 1. Befund (gelesen)

- `src/components/Help/HelpPanel.tsx` — Section ohne `role="dialog"`/`aria-modal`,
  ohne ESC, ohne Fokus-Falle, ohne Fokus-Restore. Wird bislang nirgends als
  Overlay gerendert, trägt aber `onClose` (✕-Button) als Overlay-Signal.
- `src/components/Welcome/AboutDialog.tsx` (meistgenutztes Dialog-Pattern im
  Projekt: Backdrop + Sheet + `role="dialog"`) — eigener ESC-Listener auf
  `window`, aber **kein** `aria-modal`, **keine** Fokus-Falle, **kein**
  Fokus-Restore.
- Referenz: `src/i18n/ShortcutsHelp.tsx` nutzt bereits `useModalA11y`
  (Falle + ESC + Restore). Dieser Hook filtert Sichtbarkeit via `offsetParent`,
  das in jsdom immer `null` ist — daher als neuer, testbarer Hook umgesetzt,
  statt den bestehenden zu ändern (kein Regressionsrisiko für ShortcutsHelp).

## 2. Geändert (4 Dateien, minimal)

| Datei | Änderung |
|---|---|
| **NEU** `src/hooks/useFocusTrap.ts` | Shared Hook: Autofokus aufs erste Element, Tab-Falle (Shift+Tab rückwärts, Capture-Phase auf `document`), ESC → `onClose`, Fokus-Restore per Cleanup. Optionen `{ enabled, autoFocus }`. `onClose` per Ref entkoppelt (kein Re-Registrieren pro Render). Nur `disabled`-Filter — bewusst kein `offsetParent`, damit jsdom-testbar. |
| `src/components/Welcome/AboutDialog.tsx` | `useFocusTrap(sheetRef, onClose)`; alter ESC-`useEffect` ersatzlos gestrichen (Doppellogik); `aria-modal="true"` + `ref` aufs Sheet. `role="dialog"`/`aria-label` unverändert. |
| `src/components/Help/HelpPanel.tsx` | Overlay-Modus = `onClose` gesetzt: dann `role="dialog"` + `aria-modal` + `useFocusTrap` (Falle/ESC/Restore). Eingebettet (ohne `onClose`) bleibt es eine passive Section — kein Verhaltenswechsel. |
| **NEU** `src/hooks/useFocusTrap.test.tsx` | 12 Tests (s. u.) |

Nicht angefasst: `ShortcutsHelp.tsx`, `useModalA11y`, Styles, Verhalten jenseits
Fokus/Tasten. Keine Redesigns.

## 3. Tests — 12/12 grün

`npx vitest run src/hooks/useFocusTrap.test.tsx` → **12 passed**
(jsdom-Fokus-Assertions via `@testing-library/react` + `fireEvent.keyDown`):

1. Autofokus aufs erste Element · 2. Tab-Wrap vorwärts (letztes→erstes) ·
3. Shift+Tab-Wrap rückwärts · 4. Tab in der Mitte ohne Eingriff ·
5. ESC ruft `onClose` · 6. ESC ohne `onClose` wirft nicht ·
7. Fokus-Restore zum Trigger bei Unmount · 8. `enabled:false` = No-op
(kein Autofokus/ESC/Wrap) · 9. `autoFocus:false` (Falle+ESC aktiv, kein Sprung) ·
10. Fremdtasten ignoriert · 11. `disabled`-Elemente übersprungen ·
12. Listener-Cleanup bei Unmount (kein `onClose` nach Close).

Regression: `vitest run src/components/Help src/components/Welcome src/i18n` →
**44/44 grün**. `tsc --noEmit`: einziger Fehler in
`src/services/bookwriter/lektorat.ts` (TS6133) ist **präexistent**
(Sibling-Agent-Datei, per `git stash`-Check ohne meine Änderungen identisch).

## 4. Git-Status Self-Check

Eigene Dateien (Rest = Sibling-Agenten, nicht von mir):
- `M src/components/Help/HelpPanel.tsx`
- `M src/components/Welcome/AboutDialog.tsx`
- `?? src/hooks/` (`useFocusTrap.ts` + `useFocusTrap.test.tsx`)
- `?? docs/sprint11-agent6-keyboard-abschlussbericht.md` (diese Datei)

Kein `git checkout`/`branch` ausgeführt (Shared-Tree-Regel eingehalten).

## 5. Offen / Empfehlung

- Langfristig `useModalA11y` auf `useFocusTrap` umstellen (ein Hook statt zwei)
  — bewusst **nicht** in diesem Sprint gemacht (Risiko für ShortcutsHelp,
  Limit „max 2 Overlays").
- Echte Screenreader-Verifikation (NVDA) steht aus — rein Tastatur/jsdom-geprüft.
