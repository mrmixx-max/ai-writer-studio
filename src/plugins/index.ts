// Öffentliche Schnittstelle des Plugin-Systems.
// Die App importiert PluginProvider/PluginStore/PluginBadges von hier.

export { PluginProvider, usePlugins } from "./PluginProvider";
export { PluginStore } from "./PluginStore";
export { PluginBadges } from "./PluginBadges";
export { pluginManager, PluginManager } from "./PluginManager";
export { runHookSafe, emitPluginEvent } from "./hostBridge";
export { LOCAL_REGISTRY, findInRegistry } from "./registry";
export type {
  BadgeComponent,
  EventName,
  EventHandler,
  HookHandler,
  HookName,
  PluginContext,
  PluginDefinition,
  PluginLogger,
  PluginManifest,
  PluginStatus,
} from "./types";
