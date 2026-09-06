# Plugin-System

Quelle: `src/plugins/`. Zentrale Typen in `src/plugins/types.ts`,
Verwaltung in `src/plugins/PluginManager.ts`, lokale Liste in
`src/plugins/registry.ts`. Ein Template-Plugin liegt unter
`src/plugins/builtin/word-count-badge.tsx`.

## Anatomie eines Plugins

Ein Plugin ist eine `PluginDefinition` (`src/plugins/types.ts`):

```ts
interface PluginDefinition {
  manifest: PluginManifest;
  activate(context: PluginContext): void | Promise<void>;
  deactivate?(): void;
}
```

Das `PluginManifest` hat genau diese Felder — `id`, `name` und `version`
sind Pflicht, der Rest ist optional:

```ts
interface PluginManifest {
  id: string;          // eindeutig, z. B. "word-count-badge"
  name: string;
  version: string;     // semver, z. B. "0.1.0"
  description?: string;
  author?: string;
  apiVersion?: string; // erwartete Plugin-API-Version, z. B. "0.1.0"
}
```

Der `PluginContext`, den `activate` erhält, ist bewusst schmal gehalten —
keine direkten Store-Zugriffe (`src/plugins/types.ts`):

```ts
interface PluginContext {
  readonly manifest: PluginManifest;
  onHook(name: HookName, handler: HookHandler): () => void;
  onEvent(name: EventName, handler: EventHandler): () => void;
  emitEvent(name: EventName, payload?: unknown): void;
  registerBadge(id: string, component: BadgeComponent): () => void;
  readonly log: PluginLogger; // info / warn / error
}
```

Jede Registrierungsmethode liefert eine Abmeldefunktion zurück.
Badge-Komponenten erhalten `{ wordCount, charCount }` und liefern
`ReactNode` (`BadgeComponent` in `src/plugins/types.ts`).

Anschlusspunkte (`src/plugins/types.ts`):

- Hooks (`HookName`): `"editor:content-change"`, `"app:ready"`,
  `"statusbar:wordcount"`. Handler haben die Form
  `(value: V) => V` — sie erhalten einen Wert und geben einen (ggf.
  transformierten) Wert zurück.
- Events (`EventName`): `"wordcount:changed"`, `"project:opened"`,
  `"plugin:changed"`, `"plugin:error"`. Handler haben die Form
  `(payload: P) => void` — sie beobachten nur.

## Registrierung

Builtin-Plugins werden in `src/plugins/registry.ts` in `LOCAL_REGISTRY`
eingetragen:

```ts
import { wordCountBadgePlugin } from "./builtin/word-count-badge";
import { writingGoalTrackerPlugin } from "./builtin/writing-goal-tracker";

export const LOCAL_REGISTRY: PluginDefinition[] = [wordCountBadgePlugin, writingGoalTrackerPlugin];
```

`findInRegistry(id)` sucht eine Definition anhand ihrer Manifest-ID.

So wird die Registry verwendet (verifiziert in `PluginStore.tsx` und
`PluginProvider.tsx`):

- `PluginProvider` fährt beim App-Start alle gemerkt aktivierten Plugins
  hoch: `pluginManager.activateInstalled(LOCAL_REGISTRY)`, danach
  `pluginManager.runHook("app:ready", null)`.
- `PluginStore` rendert `LOCAL_REGISTRY` als Liste und ruft pro Eintrag
  `pluginManager.install(def)`, `update(def)`, `enable(id)`,
  `disable(id)` bzw. `uninstall(id)` auf.
- Ein Plugin, das nicht in `LOCAL_REGISTRY` steht, erscheint nicht im
  Store und wird beim Start nicht automatisch hochgefahren.

## Lifecycle

Implementiert in `src/plugins/PluginManager.ts`,
Fehlerisolierung in `src/plugins/api/lifecycle.ts`
(`safeActivate` / `safeDeactivate`).

- `install(plugin, activateNow = true)`: trägt das Plugin als `inactive`
  ein, merkt die ID in der Aktivierungsliste und aktiviert es sofort
  (außer `activateNow` ist `false`). Existiert die ID bereits, läuft
  stattdessen `update`.
- `update(plugin)`: ersetzt die Definition nur, wenn
  `versionGt(neu, alt)` gilt (grober semver-Vergleich in
  `src/plugins/api/lifecycle.ts`); ein zuvor aktiver Zustand bleibt
  erhalten (deaktivieren → ersetzen → reaktivieren). Sonst Rückgabe
  `false`, keine Änderung.
- `enable(id)` / `disable(id)`: tragen die ID in die Aktivierungsliste
  ein bzw. entfernen sie und (de-)aktivieren das Plugin. `disable` an
  einer unbekannten ID tut nichts.
- `uninstall(id)`: deaktiviert, löscht den Eintrag und entfernt die ID
  aus der Aktivierungsliste.
- `activateInstalled(available)`: installiert beim Start fehlende
  Definitionen aus `available` nach und aktiviert alle gemerkten IDs.
- Status (`PluginStatus`): `"inactive" | "active" | "error"`,
  abfragbar über `list()` / `get(id)`.

Fehlerverhalten:

- `activate` läuft über `safeActivate`: wirft `activate()`, erhält das
  Plugin den Status `"error"` mit Fehlermeldung (`entry.error`); bereits
  halb registrierte Hooks/Events/Badges werden über die gesammelten
  Disposer wieder abgeräumt. Ein fehlerhaftes Plugin reißt nie die App
  mit.
- `deactivate(id)` ruft `plugin.deactivate?.()` über `safeDeactivate`
  auf (Fehler werden nur protokolliert, nicht geworfen) und führt danach
  alle gespeicherten Disposer aus — Hooks, Events und Badges des Plugins
  werden dadurch automatisch abgemeldet. Ein eigenes `deactivate()` muss
  sich deshalb nur um plugin-eigene Ressourcen kümmern (Timer,
  Subscriptions außerhalb des Kontexts); beides Beispiel-Plugins haben
  keine und loggen nur.
- Hook-Kette (`src/plugins/api/hooks.ts`, `HookRegistry.run`): Handler
  laufen in Registrierungsreihenfolge, jeder erhält das Ergebnis des
  vorherigen. Wirft ein Handler, wird der Fehler protokolliert und die
  Kette mit dem letzten gültigen Wert fortgesetzt — kein Abbruch.
- Event-Versand (`src/plugins/api/events.ts`, `EventBus.emit`):
  Fehler einzelner Handler werden isoliert und protokolliert.
- Badge-IDs werden namespaced: `registerBadge("reading-time")` im Plugin
  `"word-count-badge"` landet im Manager als `"word-count-badge:reading-time"`
  (`PluginManager.ts`, `registerBadge`). Gelesen wird die Badge-Liste vom
  Statusleisten-Host über `getBadges()` (gerendert in `PluginBadges.tsx`).

## Persistenz / Settings

Es gibt **keine Settings-Schema-API** im Plugin-System — `src/plugins/`
enthält keinen `settings`-Mechanismus; das einzige deklarative Config-Format
ist das `PluginManifest`. Wer Plugin-Zustand speichern muss, folgt dem
etablierten Muster aus `PluginManager.readEnabledIds` / `writeEnabledIds`
(`src/plugins/PluginManager.ts`):

- Aktivierungsliste unter dem Schlüssel `"plugins.enabled"` in
  `localStorage` (Konstante `STORAGE_KEY`).
- Lesen: `JSON.parse` in `try/catch`, bei fehlendem/kaputtem Inhalt
  Fallback auf `[]`; nur Strings werden übernommen.
- Schreiben: `localStorage.setItem` in `try/catch`, Fehler werden
  geschluckt („Speichern ist best-effort").

Dasselbe Muster — namespaced Schlüssel, JSON, best-effort `try/catch`,
injizierbarer Storage für Testbarkeit — verwendet das
Writing-Goal-Tracker-Plugin (`src/plugins/builtin/writing-goal-tracker.tsx`):

```ts
export const GOAL_STORAGE_KEY = "plugins.writing-goal-tracker";
```

`loadGoalState(storage?)` fällt bei fehlendem/kaputtem Inhalt auf
`defaultGoalState()` (Ziel 500 Wörter, Streak 0) zurück und wirft nie;
`saveGoalState(state, storage?)` schluckt Storage-Fehler. Ohne übergebenen
Storage wird `globalThis.localStorage` verwendet, falls verfügbar.

## Minimalbeispiel

Vollständig in `src/plugins/builtin/word-count-badge.tsx` — ein neues
Plugin kopiert diese Datei und passt Manifest, Badge-ID und Handler an:

```tsx
import type { PluginDefinition } from "../types";

export const myPlugin: PluginDefinition = {
  manifest: {
    id: "my-plugin",
    name: "My Plugin",
    version: "0.1.0",
    description: "Was das Plugin tut.",
    author: "AI Writer Studio",
    apiVersion: "0.1.0",
  },
  activate(ctx) {
    ctx.log.info("My Plugin aktiv");
    ctx.registerBadge("my-badge", ({ wordCount }) => (
      <span className="plugin-badge">{wordCount} Wörter</span>
    ));
    ctx.onHook("editor:content-change", (value) => {
      ctx.emitEvent("wordcount:changed", { words: 0 });
      return value; // Hook-Ketten-Vertrag: Wert immer durchreichen
    });
  },
  deactivate() {
    console.info("[my-plugin] deaktiviert");
  },
};
```

Danach in `src/plugins/registry.ts` zu `LOCAL_REGISTRY` hinzufügen und
mit `findInRegistry("my-plugin")` sowie `install` über den `PluginManager`
testen (Vorbild: `src/plugins/builtin/writing-goal-tracker.test.ts`).

## Mitgelieferte Plugins

| ID | Datei | Badge-ID (voll) | Persistenz |
|----|-------|-----------------|------------|
| `word-count-badge` | `src/plugins/builtin/word-count-badge.tsx` | `word-count-badge:reading-time` | keine (nur Hooks/Events/Badge) |
| `writing-goal-tracker` | `src/plugins/builtin/writing-goal-tracker.tsx` | `writing-goal-tracker:daily-goal` | `localStorage["plugins.writing-goal-tracker"]` (Ziel, Wörter pro Tag, Streak) |
