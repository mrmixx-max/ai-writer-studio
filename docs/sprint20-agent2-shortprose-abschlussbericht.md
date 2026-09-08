# Sprint 20, Agent 2 — Kurzprosa-Generator: Abschlussbericht

Datum: 2026-09-08 · Modus: `shortprose` · Kein Commit, kein Build

## Ergebnis

Kurzprosa-Generator (Flash Fiction, Micro-Story, Kurzgeschichte, Snapshot,
Fabel) ist implementiert, als Sidebar-Modus verdrahtet und getestet:
**25 neue Tests, alle grün; `tsc --noEmit` sauber; bestehende Tests grün**
(1 vorbestehende Ausnahme, s. u.).

## Geänderte / neue Dateien

| Datei | Art |
|---|---|
| `src/services/bookwriter/shortprose.ts` | neu — Engine |
| `src/services/bookwriter/shortprose.test.ts` | neu — 19 Tests |
| `src/components/BookWriter/ShortprosePanel.tsx` | neu — UI-Panel |
| `src/components/BookWriter/ShortprosePanel.test.tsx` | neu — 6 Tests |
| `src/types/mode.ts` | `EditorMode` += `"shortprose"` |
| `src/components/Sidebar/Sidebar.tsx` | MODES-Eintrag (✍️), Lazy-Import, `ModePanel`-Case, `WIDE_EXTRA_MODES` |
| `src/i18n/locales/de.ts` | `sidebar.mode.shortprose`: „Kurzprosa“ |
| `src/i18n/locales/en.ts` | `sidebar.mode.shortprose`: „Short Prose“ |
| `src/i18n/locales/es.ts` / `fr.ts` | je 1 Key (`TranslationDict`-Pflicht, sonst tsc-Fehler + Paritäts-Tests rot) |

## Engine (`shortprose.ts`)

- Typen wie spezifiziert: `ShortproseRequest` (prompt/genre/style/length/
  perspective/language/temperature/model), `ShortproseResult`
  (text/genre/style/wordCount/characterCount/estimatedReadingTime).
- `generateShortprose(request, { complete?, signal? }?)` — LLM via
  injizierbare `CompleteFn` (Muster aus `rewrite.ts`); Default-Verdrahtung
  `createShortproseComplete()` nutzt `completeOnce` + Settings per
  Lazy-Import, `model`/`temperature` überschreiben die Settings, `signal`
  trägt Abbrüche durch. Kein neuer Netzwerk-Code. Leerer Seed und leere
  LLM-Antwort werfen; LLM-Fehler werden mit Kontext weitergereicht.
- `buildShortprosePrompt()` — Genre-Templates wie spezifiziert
  (flash-fiction mit Twist-, kurzgeschichte mit deutschem Template inkl.
  Perspektive), plus Stil-/Perspektiv-Zeilen, Längen-Limit und DE/EN-Zeile.
- `countWords()` (Whitespace-Split, DE+EN), `estimateReadingTime()`
  (200 W/Min, aufgerundet). Längen-Mapping: very-short 500 / short 1500 /
  medium 3000.

## Panel (`ShortprosePanel.tsx`)

Props `projectId?`, `chapterId?`, injizierbares `generate?` (Default: echte
Engine). Textarea, 5 Dropdowns, Amber-Generieren-Button (disabled bei busy
und leerem Seed), gescrollte Ergebnis-Anzeige, Meta (Wörter/Zeichen/
Lesezeit), „Im Editor öffnen“ (`useEditorStore.insertAtEnd`),
„Als Projekt speichern“ (`createProject` + `createChapter` + `refresh`),
Abbrechen-Button (AbortController + Late-Result-Guard), Elapsed-Timer
(250-ms-Intervall während busy). Bloomberg-Stil inline
(#000/#ffa028/#333, IBM Plex Mono). Standalone — keine bestehenden Panels
angefasst.

## Verifikation

- Neu: `shortprose.test.ts` (19) + `ShortprosePanel.test.tsx` (6) — 25/25 grün.
- Regression: `navigation.test.ts`, `rewrite.test.ts`, `RewritePanel.test.tsx`,
  alle `src/i18n/`-Tests — grün; `tsc -p tsconfig.json --noEmit` ohne Fehler.
- **Vorbestehend, nicht von mir verursacht:**
  `src/components/Sidebar/sidebar.bilingual.test.tsx` (2 Tests) scheitert mit
  `TypeError: projects.map is not a function` — der Test mockt
  `useProjectStore` ohne Zustand-Selektor-Semantik (gibt für jeden Selektor
  das Gesamt-Objekt zurück). Weder `projectStore` noch der Test wurden von
  mir angefasst (`git status` belegt); der Fehlerpfad (Projektbaum-Render)
  ist von meiner Änderung unberührt.

## Offene Punkte / Hinweise

- `fr.ts`/`es.ts` mussten je 1 Key erhalten (Typ- + Paritäts-Pflicht);
  Übersetzungen „Prose courte“ / „Prosa breve“ ggf. gegenlesen.
- Das Panel nutzt `createProject`/`createChapter` direkt aus
  `@/services/project` (statt `newProject`+`newChapter` aus dem Store), weil
  `newProject` die `activeProjectId` erst asynchron setzt — so ist
  „Als Projekt speichern“ in einem Schritt atomar.
- `sidebar.bilingual.test.tsx`-Mock reparieren (Selektor weiterreichen) —
  separater Fix, nicht Teil dieses Auftrags.
