import type { ReactNode } from "react";

// Plugin-API: Typen für Manifest, Lifecycle und Kontext.
//
// Ein Plugin ist eine "PluginDefinition": statisches Manifest plus
// activate()/deactivate(). Über den PluginContext erhält es begrenzte
// Rechte: Hooks anhängen, Events senden/empfangen, Badges registrieren.

/** Namen der Hook-Punkte, an denen sich Plugins einklinken können. */
export type HookName =
  /** Editorinhalt hat sich geändert; Handler kann den Wortzähler erweitern. */
  | "editor:content-change"
  /** App ist vollständig hochgefahren. */
  | "app:ready"
  /** Wortzähler wird angezeigt; Handler kann zusätzliche Statistik liefern. */
  | "statusbar:wordcount";

/** Namen der Applikations-Events, die Plugins hören/senden dürfen. */
export type EventName =
  | "wordcount:changed"
  | "project:opened"
  | "plugin:changed"
  | "plugin:error";

/** Handler für Hooks: erhält einen Wert und kann ihn transformieren. */
export type HookHandler<V = unknown> = (value: V) => V;

/** Handler für Events: nur beobachten, kein Rückgabewert. */
export type EventHandler<P = unknown> = (payload: P) => void;

/** Metadaten eines Plugins (auch im Plugin-Store sichtbar). */
export interface PluginManifest {
  /** Eindeutige ID, z. B. "word-count-badge". */
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  /** Mindestversion der Plugin-API, die das Plugin erwartet. */
  apiVersion?: string;
}

/** Status eines installierten Plugins. */
export type PluginStatus = "inactive" | "active" | "error";

/** Kleiner Logger, den der PluginManager jedem Plugin mitgibt. */
export interface PluginLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** React-Komponente, die als Badge in der Statusleiste erscheint. */
export type BadgeComponent = (props: { wordCount: number; charCount: number }) => ReactNode;

/**
 * Alles, was ein Plugin von der Host-Anwendung nutzen darf.
 * Bewusst schmal gehalten: keine direkten Store-Zugriffe.
 */
export interface PluginContext {
  readonly manifest: PluginManifest;
  /** Hook registrieren; liefert eine Abmeldefunktion. */
  onHook(name: HookName, handler: HookHandler): () => void;
  /** Event abonnieren; liefert eine Abmeldefunktion. */
  onEvent(name: EventName, handler: EventHandler): () => void;
  /** Event an alle Abonnenten senden. */
  emitEvent(name: EventName, payload?: unknown): void;
  /** Badge-Komponente in der Statusleiste registrieren. */
  registerBadge(id: string, component: BadgeComponent): () => void;
  readonly log: PluginLogger;
}

/** Ein Plugin so, wie es die API konsumiert. */
export interface PluginDefinition {
  manifest: PluginManifest;
  activate(context: PluginContext): void | Promise<void>;
  deactivate?(): void;
}
