# Sprint 19 · Agent 2 · UI-Labels ohne Tastenkürzel — Abschlussbericht

**Datum:** 2026-09-07 · **Projekt:** ai-writer-studio (Tauri 2 + React + TS)
**Auftrag:** Alle UI-Texte mit Tastenkürzel-Notation (Ctrl+1, Alt+2, …) durch
ausgeschriebene deutsche Labels ersetzen. Keine Verhaltensänderung, nur Texte.

## Was geändert wurde

| Datei | Änderung |
|---|---|
| `src/components/Sidebar/Sidebar.tsx` | `MODES`-Array: `shortcut`-Feld (`"Ctrl+1"` … `"Ctrl+Shift+C"`) entfernt, durch deutsches `description`-Feld ersetzt (z. B. „Text schreiben und bearbeiten“). Buttons rendern statt `<kbd>{shortcut}</kbd>` jetzt sichtbar `<span class="sb-label">{label}</span>` (Icon + voller deutscher Name). `title` bleibt der reine Modusname (stabile Test-IDs), `aria-label` = „Name – Beschreibung“, `data-shortcut` → `data-mode`. |
| `src/components/Sidebar/sidebar.css` | Neue `.sb-label`-Klasse für den sichtbaren Modusnamen; alte `.sb-kbd`-Regel unangetastet (kein CSS-Bruch). |
| `src/components/Editor/Editor.tsx` | Vier Tooltips von Kürzel-Notation befreit: „Zeilenumbruch (Shift+Enter)“ → „Zeilenumbruch“, „Rückgängig (Ctrl+Z)“ → „Rückgängig“, „Wiederholen (Ctrl+Y)“ → „Wiederholen“, „Markierten Text kopieren (Ctrl+C)“ → „Markierten Text kopieren“; plus passende `aria-label`s. |
| `src/components/Empty/EmptyEditor.tsx` | `<kbd>Strg</kbd> + <kbd>S</kbd> … <kbd>F11</kbd> … <kbd>F1</kbd>` ersetzt durch ausgeschriebenen Satz: „Strg+S speichert von Hand. F11 schaltet den Fokusmodus um. F1 öffnet die Hilfe zu dieser Anwendung.“ |
| `src/components/KIPanel/KIPanel.tsx` | Placeholder „(Shift+Enter = neue Zeile)“ → „(Umschalt+Eingabe = neue Zeile)“. |
| `src/components/Sidebar/sidebarBloomberg.test.tsx` | Alter kbd-Chip-Test (`data-shortcut="Ctrl+1"`) ersetzt durch Label-Test (`data-mode`, sichtbarer Name, kein `kbd`, keine `Ctrl+/Alt+`-Notation). |
| `src/components/KIPanel/KIPanel.test.tsx` | Zwei Placeholder-Erwartungen auf den neuen deutschen Wortlaut aktualisiert. |
| `src/components/Sidebar/sidebarLabels.test.tsx` | **Neu (5 Tests):** keine sichtbare Kürzel-Notation in Sidebar-Buttons; deutsche Namen sichtbar im Button-Text; keine Kürzel in Editor-`title`s (Quellscan); EmptyEditor-Hinweis enthält „Strg+S speichert“; kein `shortcut:`/`data-shortcut` mehr in Sidebar-Quelle. |
| `src/components/Sidebar/sidebar.css` | siehe oben. |

## Geprüft, bewusst unverändert

- **Settings, BookWriter (Dashboard/QualityDashboard/RewritePanel):** Volltextsuche nach `kbd|Ctrl|Alt|Shift|Strg` — keine Kürzel in sichtbaren Labels, nur reine deutsche `title`-Tooltips (regelkonform, Tooltips dürfen bleiben).
- **Globale Shortcuts (`src/i18n/shortcuts.ts`, `ShortcutsHelp.tsx`, App-Handler):** echte Tastaturbindung + Hilfe-Dialog, kein sichtbares Button-Label — funktional unverändert gelassen.
- **Preflight-Regeltexte** („Absätze mit Enter trennen statt mit Shift+Enter“) und **VBA-Makro-Kommentare** (Alt+F11-Anleitung): redaktionelle Hilfetexte, keine UI-Labels — unverändert.

## Verifikation (echte Tool-Ausgaben)

- `vitest run Sidebar(Sidebar+Labels+Bloomberg) + KIPanel`: **4 Dateien, 41 Tests — alle bestanden.**
- `vitest run Editor + Empty`: **3 Dateien, 24 Tests — alle bestanden.**
- `npm run typecheck` (`tsc --noEmit`): **fehlerfrei.**
- Nach allen Edits liegt **kein `Ctrl+`, `Alt+<Ziffer>` oder `shortcut:` mehr in sichtbaren Labels** unter `src/components/` (nur noch globale Shortcut-Logik und Hilfetexte).

## Offene Punkte / Hinweise

- `title`-Tooltips enthalten vereinbarungsgemäß keine Kürzel mehr im Editor; falls Tooltips künftig Tastaturhinweise zeigen sollen, bitte als „Name (Taste)“ über i18n nachpflegen.
- Die `.sb-kbd`-CSS-Regel ist ungenutzt, aber absichtlich erhalten (verhindert CSS-Testbruch, kein totes JS).
