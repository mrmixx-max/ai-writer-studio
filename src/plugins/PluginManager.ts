// PluginManager: zentrale Verwaltung aller Plugins.
//
// Zuständig für:
//   - installieren / aktualisieren / deinstallieren
//   - aktivieren / deaktivieren (lifecycle + Fehlerisolierung)
//   - Persistenz der Aktivierungsliste (localStorage)
//   - Verteilung von Kontexten (Hooks, Events, Badges)

import { HookRegistry } from "./api/hooks";
import { EventBus } from "./api/events";
import { safeActivate, safeDeactivate, versionGt } from "./api/lifecycle";
import type {
  BadgeComponent,
  EventName,
  EventHandler,
  HookHandler,
  HookName,
  PluginContext,
  PluginDefinition,
  PluginLogger,
  PluginStatus,
} from "./types";

const STORAGE_KEY = "plugins.enabled";

interface PluginEntry {
  plugin: PluginDefinition;
  status: PluginStatus;
  error?: string;
  /** Abmeldefunktionen des aktuell aktiven Zustands. */
  disposers: Array<() => void>;
}

/** Ereignis, das der Manager selbst bei jeder Änderung auslöst. */
export type ChangeListener = () => void;

export class PluginManager {
  private entries = new Map<string, PluginEntry>();
  private hooks = new HookRegistry();
  private events = new EventBus();
  private badges = new Map<string, BadgeComponent>();
  private changeListeners = new Set<ChangeListener>();

  constructor() {
    // Fehler von Plugins zentral sichtbar machen.
    this.events.on("plugin:error", (payload) => {
      console.error("[plugins]", payload);
    });
  }

  // --- Änderungsbenachrichtigung (für React) ------------------------------

  onChange(listener: ChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notify(): void {
    this.events.emit("plugin:changed");
    for (const listener of [...this.changeListeners]) listener();
  }

  // --- Statusabfragen -----------------------------------------------------

  list(): Array<{ id: string; manifest: PluginDefinition["manifest"]; status: PluginStatus; error?: string }> {
    return [...this.entries.values()].map((e) => ({
      id: e.plugin.manifest.id,
      manifest: e.plugin.manifest,
      status: e.status,
      error: e.error,
    }));
  }

  get(id: string): PluginEntry | undefined {
    return this.entries.get(id);
  }

  isEnabled(id: string): boolean {
    return this.readEnabledIds().includes(id);
  }

  /** Hook-Kette ausführen (vom Host aufgerufen). */
  runHook<V>(name: HookName, value: V): V {
    return this.hooks.run(name, value);
  }

  /** Event an alle Plugins senden (vom Host aufgerufen). */
  emit(name: EventName, payload?: unknown): void {
    this.events.emit(name, payload);
  }

  /** Registrierte Badges (vom Statusleisten-Host gelesen). */
  getBadges(): Array<{ id: string; component: BadgeComponent }> {
    return [...this.badges.entries()].map(([id, component]) => ({ id, component }));
  }

  // --- Installation / Update / Deinstallation ------------------------------

  /** Plugin installieren (aus lokaler Registry) und automatisch aktivieren. */
  async install(plugin: PluginDefinition, activateNow = true): Promise<void> {
    const id = plugin.manifest.id;
    if (this.entries.has(id)) {
      await this.update(plugin);
      return;
    }
    this.entries.set(id, { plugin, status: "inactive", disposers: [] });
    const enabled = this.readEnabledIds();
    if (activateNow && !enabled.includes(id)) {
      enabled.push(id);
      this.writeEnabledIds(enabled);
    }
    if (activateNow) await this.activate(id);
    this.notify();
  }

  /** Plugin auf eine neuere Version bringen (aktivierter Zustand bleibt). */
  async update(plugin: PluginDefinition): Promise<boolean> {
    const id = plugin.manifest.id;
    const entry = this.entries.get(id);
    if (!entry) {
      await this.install(plugin);
      return true;
    }
    if (!versionGt(plugin.manifest.version, entry.plugin.manifest.version)) {
      return false; // nichts zu tun
    }
    const wasActive = entry.status === "active";
    if (wasActive) this.deactivate(id);
    entry.plugin = plugin;
    entry.error = undefined;
    if (wasActive) await this.activate(id);
    this.notify();
    return true;
  }

  /** Plugin vollständig entfernen, inkl. Persistenzeintrag. */
  uninstall(id: string): void {
    this.deactivate(id);
    this.entries.delete(id);
    const enabled = this.readEnabledIds().filter((x) => x !== id);
    this.writeEnabledIds(enabled);
    this.notify();
  }

  // --- Aktivierung / Deaktivierung ----------------------------------------

  async enable(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry || entry.status === "active") return;
    const enabled = this.readEnabledIds();
    if (!enabled.includes(id)) {
      enabled.push(id);
      this.writeEnabledIds(enabled);
    }
    await this.activate(id);
    this.notify();
  }

  disable(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.writeEnabledIds(this.readEnabledIds().filter((x) => x !== id));
    this.deactivate(id);
    this.notify();
  }

  /** Beim App-Start alle gemerkt aktivierten Plugins hochfahren. */
  async activateInstalled(available: PluginDefinition[]): Promise<void> {
    // Zuerst fehlende Definitionen aus der Registry nachinstallieren.
    for (const id of this.readEnabledIds()) {
      const known = available.find((p) => p.manifest.id === id);
      if (known && !this.entries.has(id)) {
        this.entries.set(id, { plugin: known, status: "inactive", disposers: [] });
      }
    }
    for (const id of this.readEnabledIds()) {
      await this.activate(id);
    }
    this.notify();
  }

  private async activate(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) return;
    // Reste eines früheren Zustands aufräumen (z. B. nach Fehler).
    this.deactivate(id);

    const disposers: Array<() => void> = [];
    const log: PluginLogger = {
      info: (m) => console.info(`[${id}] ${m}`),
      warn: (m) => console.warn(`[${id}] ${m}`),
      error: (m) => {
        console.error(`[${id}] ${m}`);
        this.events.emit("plugin:error", { plugin: id, message: m });
      },
    };

    const context: PluginContext = {
      manifest: entry.plugin.manifest,
      log,
      onHook: (name: HookName, handler: HookHandler) => {
        const off = this.hooks.register(name, handler);
        disposers.push(off);
        return off;
      },
      onEvent: (name: EventName, handler: EventHandler) => {
        const off = this.events.on(name, handler);
        disposers.push(off);
        return off;
      },
      emitEvent: (name: EventName, payload?: unknown) => this.events.emit(name, payload),
      registerBadge: (badgeId: string, component: BadgeComponent) => {
        const fullId = `${id}:${badgeId}`;
        this.badges.set(fullId, component);
        disposers.push(() => this.badges.delete(fullId));
        return () => this.badges.delete(fullId);
      },
    };

    const result = await safeActivate(entry.plugin, context, log);
    if (result.ok) {
      entry.status = "active";
      entry.error = undefined;
      entry.disposers = disposers;
    } else {
      entry.status = "error";
      entry.error = result.error;
      // Halb registrierte Reste aufräumen.
      for (const off of disposers) off();
      entry.disposers = [];
    }
  }

  private deactivate(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    safeDeactivate(entry.plugin, {
      info: (m) => console.info(`[${id}] ${m}`),
      warn: (m) => console.warn(`[${id}] ${m}`),
      error: (m) => console.error(`[${id}] ${m}`),
    });
    for (const off of entry.disposers) {
      try {
        off();
      } catch {
        /* Abmeldefehler ignorieren */
      }
    }
    entry.disposers = [];
    entry.status = "inactive";
    entry.error = undefined;
  }

  // --- Persistenz -----------------------------------------------------------

  private readEnabledIds(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }

  private writeEnabledIds(ids: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      /* Speichern ist best-effort */
    }
  }
}

/** Singleton-Instanz für die App. */
export const pluginManager = new PluginManager();
