// Einfacher typisierter Event-Bus für die Plugin-API.
// Plugins und Host kommunizieren darüber lose gekoppelt.

import type { EventName, EventHandler } from "../types";
import { getLogger } from "@/services/logger";

const log = getLogger("plugins/events");

type ListenerMap = Map<EventName, Set<EventHandler>>;

export class EventBus {
  private listeners: ListenerMap = new Map();

  /** Event abonnieren; liefert eine Abmeldefunktion. */
  on(name: EventName, handler: EventHandler): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    set.add(handler);
    return () => set?.delete(handler);
  }

  /** Event an alle Abonnenten senden. Fehler einzelner Handler werden isoliert. */
  emit(name: EventName, payload?: unknown): void {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (e) {
        log.error(`Handler für "${name}" fehlgeschlagen:`, e);
      }
    }
  }

  /** Alle Abonnements entfernen (beim Herunterfahren). */
  clear(): void {
    this.listeners.clear();
  }
}
