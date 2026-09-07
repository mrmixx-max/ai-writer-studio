// Sprint 13, Agent 2: Per-Request-Log als In-Memory-Ringpuffer (ADDITIV).
//
// Pro Request ein Eintrag: Modell, Task, Dauer, Fallback benutzt.
// Ausschließlich In-Memory (Array mit fester Kapazität) — KEIN Disk-,
// KEIN Netzwerk-Zugriff. Älteste Einträge fallen bei Überlauf raus.

/** Ein Log-Eintrag pro Request. */
export interface RouterRequestLogEntry {
  /** Laufende Nummer (pro Puffer-Instanz, ab 1). */
  seq: number;
  /** Verwendetes Modell. */
  model: string;
  /** Aufgabe (Bookwriter-Task oder freier Task-Name). */
  task: string;
  /** Dauer in ms. */
  durationMs: number;
  /** true = Fallback/Downgrade wurde benutzt. */
  fallbackUsed: boolean;
  /** true = Request erfolgreich. Default true. */
  ok?: boolean;
  /** Provider (optional, z. B. "ollama"/"openrouter"). */
  provider?: string;
  /** Unix-Zeit in ms (Default: Date.now()). */
  at?: number;
}

export type NewRouterRequestLogEntry = Omit<RouterRequestLogEntry, "seq" | "at"> & {
  at?: number;
};

/** Fester In-Memory-Ringpuffer für Request-Einträge. */
export class RouterRequestLog {
  private readonly capacity: number;
  private buf: RouterRequestLogEntry[] = [];
  private nextSeq = 1;

  constructor(capacity = 100) {
    this.capacity = Math.max(1, Math.floor(capacity));
  }

  /** Kapazität des Puffers. */
  get maxSize(): number {
    return this.capacity;
  }

  /** Aktuelle Eintragszahl (≤ Kapazität). */
  get size(): number {
    return this.buf.length;
  }

  /** Einen Request loggen (ältester Eintrag fällt bei Überlauf raus). */
  push(entry: NewRouterRequestLogEntry): RouterRequestLogEntry {
    const full: RouterRequestLogEntry = {
      ...entry,
      ok: entry.ok ?? true,
      seq: this.nextSeq++,
      at: entry.at ?? Date.now(),
    };
    this.buf.push(full);
    while (this.buf.length > this.capacity) this.buf.shift();
    return full;
  }

  /** Alle Einträge (älteste zuerst). Kopie — Puffer bleibt unverändert. */
  entries(): RouterRequestLogEntry[] {
    return [...this.buf];
  }

  /** Die n neuesten Einträge (neueste zuletzt). */
  last(n: number): RouterRequestLogEntry[] {
    if (n <= 0) return [];
    return this.buf.slice(Math.max(0, this.buf.length - Math.floor(n)));
  }

  /** Puffer leeren (Seq-Zähler läuft weiter — keine Seq-Wiederverwendung). */
  clear(): void {
    this.buf = [];
  }
}
