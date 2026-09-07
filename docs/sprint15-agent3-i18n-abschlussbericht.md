# Sprint 15 Agent 3 — Abschlussbericht: i18n Bilingual-Features

**Datum:** 2026-09-07 · **Agent:** Agent 3 von 6 · **Scope:** exakt
`src/i18n/` (locales `de`/`en`/`es`/`fr` + `parity.test.ts`)

## Was getan wurde

1. **`src/i18n/parity.test.ts` + Sidebar-`t()`-Pattern gelesen.**
   Pattern (Sidebar Zeile 6/148): `import { useI18n } from "@/i18n";` →
   `const { t, lang } = useI18n();` → `t("sidebar.projectsTab")`, mit
   Interpolation `t("key", { name })` und de-Fallback in `t()` selbst.
   Keine Komponentenänderung nötig (BookWriter-Komponenten gehören dem
   Sibling-Agenten) — nur Schlüssel bereitstellen.
2. **8 neue Schlüssel `bilingual.*` in allen 4 Locales angelegt**
   (`src/i18n/locales/{de,en,es,fr}.ts`, jeweils append-only am Dateiende):
   `bilingual.title`, `bilingual.detectLanguage`, `bilingual.translateTo`,
   `bilingual.original`, `bilingual.translated`, `bilingual.apply`,
   `bilingual.detected` (mit `{{lang}}`-Platzhalter), `bilingual.thinking`.
   Bestehende deutsche Wortlaute unverändert (nur angehängt, nichts editiert).
   Neue de-Werte: „Zweisprachig“, „Sprache erkennen“, „Übersetzen nach“,
   „Original“, „Übersetzt“, „Übernehmen“, „Erkannt: {{lang}}“, „Denke nach…“.
3. **Parität erweitert:** neuer `describe`-Block „bilingual.*-Namensraum“
   mit 3 Tests (alle 8 Keys in `de` definiert; alle 8 in en/fr/es vorhanden
   und nicht leer; `bilingual.detected` behält `{{lang}}` in allen Locales).
   Bewusst kein Untranslated-Check wie bei `kdp.*` — `bilingual.original`
   heisst in allen vier Sprachen genuin „Original“.

## Verifikation

| Check | Ergebnis |
|---|---|
| `vitest run src/i18n/parity.test.ts` | ✅ 1 File, **13/13 Tests** (10 bestehende + 3 neue) |
| `vitest run src/i18n` | ✅ 2 Files, **26/26 Tests** (`parity.test.ts` + `i18n.test.ts`) |
| `tsc -p tsconfig.json --noEmit` | Fehler nur in `src/components/Settings/BilingualSettings.test.tsx` — **fremde Datei** (untracked, Sibling-Scope), keine `bilingual.*`-/`TranslationKey`-Referenz in den Fehlern; eigene 5 Dateien fehlerfrei |
| `git status --porcelain` | nur eigene 5 Dateien modifiziert (`locales/{de,en,es,fr}.ts`, `parity.test.ts`); kein `git checkout/branch` angefasst |

## Status-Selbstcheck

- [x] 8 `bilingual.*`-Keys × 4 Locales = 32 Einträge, deutsche Bestandstexte unverändert (append-only)
- [x] `{{lang}}`-Platzhalter in `bilingual.detected` über alle Locales konsistent
- [x] Parität grün + um bilingual-Namensraum-Tests erweitert (keine Orphans möglich: `TranslationDict`-Typ + Test)
- [x] Bestehende Tests unverändert grün (kein Snapshot-/Default-Bruch)
- [x] Keine fremden Dateien modifiziert, kein `git checkout/branch`
- [x](offen, nicht in meiner Hand) `BilingualSettings.test.tsx`-tsc-Fehler + Komponentennutzung der Keys gehören dem Sibling-Agenten

## Tests hinzugefügt: 3 (Parität-Block `bilingual.*-Namensraum`)
