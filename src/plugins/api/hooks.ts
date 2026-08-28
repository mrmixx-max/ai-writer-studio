// Hook-System: Plugins hängen sich an benannte Punkte und können
// Werte sequenziell transformieren (Kette in Registrierungsreihenfolge).

import type { HookName, HookHandler } from "../types";

type HandlerMap = Map<HookName, Set<HookHandler>>;

export class HookRegistry {
  private handlers: HandlerMap = new Map();

  /** Hook registrieren; liefert eine Abmeldefunktion. */
  register(name: HookName, handler: HookHandler): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler);
    return () => set?.delete(handler);
  }

  /**
   * Alle Handler eines Punkts der Reihe nach ausführen. Jeder Handler
   * erhält das Ergebnis des vorherigen. Fehler werden isoliert und
   * führen NICHT zum Abbruch der Kette.
   */
  run<V>(name: HookName, value: V): V {
    const set = this.handlers.get(name);
    if (!set) return value;
    let current = value;
    for (const handler of [...set]) {
      try {
        current = handler(current) as V;
      } catch (e) {
        console.error(`[hooks] Handler für "${name}" fehlgeschlagen:`, e);
      }
    }
    return current;
  }

  clear(): void {
    this.handlers.clear();
  }
}
