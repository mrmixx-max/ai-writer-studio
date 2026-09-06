# Sprint 11 — Agent 5: i18n-Abschlussbericht (ModelManager + UpdateCheck)

## Auftrag
Alle hardcoded UI-Strings aus exakt `src/components/Settings/ModelManager.tsx` und
`src/components/Settings/UpdateCheck.tsx` in `src/i18n/locales/{de,en,es,fr}.ts`
extrahieren (additiv, bestehender Stil) und Literale durch `t()`-Aufrufe ersetzen —
nach dem Vorbild von `Sidebar/Sidebar.tsx` (`import { useI18n } from "@/i18n"`,
`const { t } = useI18n()`).

## Geänderte Dateien
- `src/i18n/locales/de.ts` — 44 neue Keys (Referenz, deutsche Wortlaute unverändert)
- `src/i18n/locales/en.ts` — 44 neue Keys
- `src/i18n/locales/fr.ts` — 44 neue Keys
- `src/i18n/locales/es.ts` — 44 neue Keys
- `src/components/Settings/ModelManager.tsx` — alle UI-Strings → `t()`
- `src/components/Settings/UpdateCheck.tsx` — alle UI-Strings → `t()`
- `docs/sprint11-agent5-i18n-abschlussbericht.md` — dieser Bericht

## Neue Keys (je Locale identisch)
- `modelmanager.*` (21): `title`, `ariaLabel`, `hint` ({{baseUrl}}, {{dir}}),
  `lowDisk` ({{size}}), `refresh`, `loading`, `loadingModels`, `empty`,
  `delete`, `deleting`, `deleteConfirm` ({{name}}), `total` ({{size}}),
  `pullTitle`, `pullPlaceholder`, `pullAriaLabel`, `pull`, `cancel`,
  `pullStarting`, `pullSuccess`, `pullAborted`, `progress` ({{status}}, {{percent}})
- `updatecheck.*` (23): `title`, `status.idle|checking|available|downloading|ready|upToDate|error`,
  `installed` ({{current}}), `releaseNotes` ({{version}}), `check`/`checkTitle`,
  `install`/`installTitle`, `recheck`/`recheckTitle`, `progressLabel`,
  `percent` ({{percent}}), `downloadedKb` ({{kb}}), `readyWithVersion` ({{version}}),
  `readyWithoutVersion`, `restarting`, `restart`

## Entwurfsentscheidungen
- `STATUS_TEXT` in `UpdateCheck.tsx` wanderte von Modul- in Komponentenscope,
  da `t()` erst nach Sprachwechsel korrekt auflöst.
- `ready`-Text: ein Key mit optionalem Versions-Suffix wäre im Deutschen
  ungrammatisch geworden → zwei Keys (`readyWithVersion` / `readyWithoutVersion`).
- `modelmanager.pullSuccess` (de: `"success"`, en: `"done"`, fr: `"terminé"`,
  es: `"listo"`): Der vorherige interne Status-String `"success"` wurde als
  Key extrahiert, damit der deutsche UI-Text byte-identisch bleibt.
- Nicht extrahiert (keine UI-Literale): Backend-Fehlermeldungen (`{error}`),
  Modell-Metadaten (Namen, Größen, Quantisierung), typografische Trenner
  (`·`, `→`) sowie Hilfetexte in `helpIndex.ts` und das `aria-label` in
  `SettingsPanel.tsx` (außerhalb des Auftrags — nur die 2 Komponenten).
- `useI18n()` fällt ohne Provider auf Deutsch zurück — `UpdateCheck.test.tsx`
  (rendert ohne Provider) läuft daher unverändert.

## Verifikation (real ausgeführt)
- `npx vitest run src/i18n` — **2 Dateien, 21 Tests, alle grün**
  (Parität de/en/es/fr inkl. {{Platzhalter}}-Check)
- `npx vitest run src/components/Settings/UpdateCheck.test.tsx` —
  **14 Tests, alle grün** (deutsche Fallback-Texte unverändert)
- `npx tsc --noEmit -p tsconfig.json` — **Exit 0, keine Fehler**
- Manueller Literal-Scan beider Komponenten: keine hardcoded UI-Strings mehr.

## Offen / Hinweise
- Keine neuen Tests hinzugefügt (`tests_added: 0`): Paritätssuite deckt die
  44 Keys pro Locale bereits ab; Komponententests bestanden unverändert.
- `SettingsPanel.tsx:359` (`aria-label="App-Updates"`) und die deutschen
  Hilfetexte in `helpIndex.ts` sind bewusst unangetastet (fremder Scope).
