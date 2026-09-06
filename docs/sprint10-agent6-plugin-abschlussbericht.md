# Sprint 10 Agent 6 (Retry) — Plugin-SDK Abschlussbericht

## Auftrag

1. Ein bestehendes Builtin-Plugin + `src/plugins/registry.ts` lesen
   (read-only, außer fehlende Registrierung).
2. `writing-goal-tracker` verifizieren (Persistenzmuster, 10+ Tests grün).
3. `docs/plugins.md` schreiben (Anatomie, Registrierung, Lifecycle,
   Settings-Schema, Minimalbeispiel — jede Aussage gegen Code verifiziert).
4. Dieser Bericht.

Vorgabe: neue Dateien nur unter `src/plugins/builtin/` + `docs/plugins.md`
(+ minimaler Registry-Eintrag). Kein `.github/`, kein `export/`, keine
sonstigen Core-Änderungen. Ausgangslage: erster Versuch hatte
`src/plugins/builtin/writing-goal-tracker.tsx` + Test hinterlassen
(28 Tests laut Log, tatsächlich 17 im File), aber kein `docs/plugins.md`
und keinen Bericht; Out-of-Scope-Änderungen wurden revertiert.

## Geändert (eigene Änderungen dieses Laufs)

- `src/plugins/registry.ts` — **minimaler Eintrag**: `writingGoalTrackerPlugin`
  importiert und in `LOCAL_REGISTRY` aufgenommen. War nötig: die Registry
  enthielt nur `wordCountBadgePlugin`, das Plugin erschien daher weder im
  Store noch beim Startup (`PluginProvider.activateInstalled(LOCAL_REGISTRY)`).
- `src/plugins/builtin/writing-goal-tracker.test.ts` — **ein Test ergänzt**
  (Registry-Eintrag: `LOCAL_REGISTRY` enthält `"writing-goal-tracker"`,
  `findInRegistry` findet die Definition). Sonst unverändert übernommen.
- `docs/plugins.md` — **neu**: Anatomie, Registrierung, Lifecycle,
  Persistenz/Settings, Minimalbeispiel, Plugin-Tabelle.
- `docs/sprint10-agent6-plugin-abschlussbericht.md` — **neu**: dieser Bericht.

Nicht angefasst: `.github/`, `export/`, Core-Dateien. Die übrigen
`git status`-Einträge (Continuity, Export, e2e, CI) stammen von anderen
Agenten und wurden nicht berührt.

## Verifikation

- Gelesen: `src/plugins/builtin/word-count-badge.tsx` (Template),
  `src/plugins/types.ts` (vollständig), `src/plugins/PluginManager.ts`
  (vollständig), `src/plugins/api/lifecycle.ts`, `src/plugins/api/hooks.ts`,
  `src/plugins/api/events.ts`, `src/plugins/index.ts`,
  Verwendungsstellen in `PluginStore.tsx` / `PluginProvider.tsx` (per grep).
- `npx vitest run src/plugins/builtin/writing-goal-tracker.test.ts
  src/plugins/plugins.test.tsx` → **2 Files, 29 Tests, alle grün**
  (davon 18 im Tracker-File: 17 bestehende + 1 neuer Registry-Test).
- Persistenzmuster konsistent: Tracker nutzt namespaced localStorage-Key
  (`plugins.writing-goal-tracker`), JSON, best-effort `try/catch`,
  injizierbaren Storage — dasselbe Muster wie
  `PluginManager.readEnabledIds`/`writeEnabledIds` (`plugins.enabled`).
- Wichtiger Befund für die Doku: **es gibt keine Settings-Schema-API** in
  `src/plugins/` (grep nach „settings" ohne Treffer). `docs/plugins.md`
  erfindet deshalb keine, sondern dokumentiert ehrlich, dass das Manifest
  das einzige deklarative Config-Format ist und plugin-eigene Persistenz
  dem Tracker-Muster folgt.

## Offene Punkte / Hinweise

- Keine funktionalen Lücken: beide Builtin-Plugins sind registriert,
  getestet und dokumentiert.
- Falls später eine echte Settings-Schema-API ins Plugin-System kommt,
  muss der Abschnitt „Persistenz / Settings" in `docs/plugins.md`
  nachgezogen werden (dort als Hinweis vermerkt: derzeit Manifest-only).
