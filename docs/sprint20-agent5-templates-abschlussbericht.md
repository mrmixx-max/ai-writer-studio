# Sprint 20 – Agent 5: Template-System – Abschlussbericht

**Datum:** 2026-09-08 · **Modus:** kein Commit, kein Build (nur `vitest` + `tsc --noEmit` zur Verifikation)

## Ergebnis

Template-System (Text-Vorlagen für 8 Textformen) ist implementiert, verdrahtet und getestet:
18/18 Tests grün (9 neu), `tsc --noEmit` fehlerfrei bzgl. eigener Änderungen.

## Neue Dateien

- `src/services/templates/templateManager.ts` — Typen (`TextTemplate`, `TemplateVariable`,
  `TemplateCategory`: novel, short-story, article, essay, script, poetry, blog, email),
  In-Memory-Store mit 5 Seed-Vorlagen, Funktionen `createTemplate`, `getTemplates`,
  `getTemplatesByCategory`, `getTemplateById`, `deleteTemplate` (idempotent),
  `renderTemplate` (`{{var}}`-Ersetzung mit Wert → Default → Leerstring, wirft bei
  unbekannter ID), `resetTemplates` (Test-Helfer), `templateCategoryLabel`.
- `src/services/templates/templateManager.test.ts` — 5 Tests (Create mit ID, Render mit
  Werten/Default, Render mit unbekanntem Platzhalter + Throw bei unbekannter ID,
  Kategorie-Filter, Delete + Idempotenz).
- `src/components/Templates/TemplatePanel.tsx` — Standalone-Panel im Bloomberg-Stil
  (bg #000, Accent #ffa028, Border #333, IBM Plex Mono): Template-Liste, Kategorie-Filter
  (Alle + 8), "+ Neu"-Button, Editor (Name, Kategorie, Beschreibung, Prompt, Variablen
  mit Typ text/number/select), Variablen-Eingabefelder (Select-Variablen als Dropdown),
  "⚡ Generieren"-Button (Default: `completeOnce(loadSettings(), prompt)`, per Prop
  injizierbar), Ergebnis-Anzeige, Fehler-Box.
- `src/components/Templates/TemplatePanel.test.tsx` — 4 Tests (Liste rendert Seeds,
  Kategorie-Filter, Generieren ruft Mock mit gerendertem Prompt auf + zeigt Ergebnis,
  Anlegen über Editor).

## Geänderte Dateien

- `src/types/mode.ts` — `EditorMode` um `"templates"` erweitert.
- `src/components/Sidebar/Sidebar.tsx` — `WIDE_EXTRA_MODES` + `"templates"`, Lazy-Import
  `TemplatePanel`, MODES-Eintrag
  `{ id: "templates", icon: "📝", label-Key: "sidebar.mode.templates", description: "Text-Vorlagen + Generator" }`,
  `ModePanel`-Branch (projektübergreifend, ohne Kapitel).
- `src/i18n/locales/{de,en,es,fr}.ts` — `sidebar.mode.templates` (Templates/Templates/Plantillas/Modèles).

## Verifikation

- `vitest run src/services/templates src/components/Templates` → **18/18 grün** (9 neu + 9 bestehende Vorlagen-Tests).
- `tsc -p tsconfig.json --noEmit` → keine Fehler in eigenen Dateien (es/fr-Labels nachgezogen, da `TranslationDict` vollständig sein muss).
- Keine neuen Dependencies. Kein Commit, kein Build.

## Hinweise / Fremdbefunde

- `src/components/Sidebar/sidebar.bilingual.test.tsx` (2 Tests) schlägt fehl mit
  `projects.map is not a function`: Der Test mockt `useProjectStore` ohne Selektor-Support,
  die Sidebar nutzt Selektor-Form — **pre-existing, nicht durch diese Arbeit verursacht**
  (Datei wurde von mir nicht angefasst).
- `src/services/voice/voiceLab.test.ts` hat einen TS-Fehler (`fetch`-Mock-Typ) — stammt
  von einem parallelen Agenten (VoiceLab), ebenfalls nicht meins.
- Parallele Agenten haben dieselben Shared-Dateien editiert (`mode.ts`: zusätzlich
  `"collab"`/`"voice"`; Sidebar/i18n: Collab-Einträge). Union-Syntax nach jedem
  Fremdeingriff repariert und per `tsc` verifiziert — keine fremden Zeilen entfernt.
