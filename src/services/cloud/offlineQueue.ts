// Offline-Queue: Aenderungen werden gepuffert, solange kein Netz/Provider
// verfuegbar ist, und beim Wiederverbinden in Reihenfolge abgearbeitet.
// Persistiert in der lokalen DB (Tabelle cloud_sync_queue), damit die Queue
// App-Neustarts ueberlebt. Datei: src/services/cloud/offlineQueue.ts
import type { SyncProvider } from "./types";

export type QueueOp = "put" | "delete";

export interface QueueEntry {
  id: string;
  op: QueueOp;
  path: string;
  /** Serialisierter Payload (bei op="put"), null bei delete. */
  data: string | null;
  projectId: string;
  enqueuedAt: number;
  attempts: number;
  lastError: string | null;
}

export interface QueueStore {
  /** Alle Einträge in Einreihungs-Reihenfolge. */
  all(): QueueEntry[];
  upsert(entry: QueueEntry): void;
  remove(id: string): void;
}

/** In-Memory-Store (Fallback + fuer Tests). */
export function createMemoryStore(): QueueStore {
  let entries: QueueEntry[] = [];
  return {
    all: () => [...entries],
    upsert(e) {
      entries = [...entries.filter((x) => x.id !== e.id), e];
    },
    remove(id) {
      entries = entries.filter((x) => x.id !== id);
    },
  };
}

function newId(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export class OfflineQueue {
  constructor(private store: QueueStore = createMemoryStore()) {}

  get size(): number {
    return this.store.all().length;
  }

  pending(): QueueEntry[] {
    return this.store.all().sort((a, b) => a.enqueuedAt - b.enqueuedAt);
  }

  enqueue(op: QueueOp, path: string, projectId: string, data: string | null): QueueEntry {
    const entry: QueueEntry = {
      id: newId(),
      op,
      path,
      projectId,
      data,
      enqueuedAt: Date.now(),
      attempts: 0,
      lastError: null,
    };
    this.store.upsert(entry);
    return entry;
  }

  /**
   * Queued-Operation ausfuehren: sofort, wenn der Provider erreichbar ist,
   * sonst in die Queue. Liefert true, wenn sofort ausgefuehrt.
   */
  async push(
    op: QueueOp,
    path: string,
    projectId: string,
    data: string | null,
    provider: SyncProvider,
  ): Promise<boolean> {
    if (!(await provider.ping())) {
      this.enqueue(op, path, projectId, data);
      return false;
    }
    await this.apply({ op, path, data } as QueueEntry, provider);
    return true;
  }

  private async apply(entry: QueueEntry, provider: SyncProvider): Promise<void> {
    if (entry.op === "delete") {
      await provider.delete(entry.path);
    } else {
      if (entry.data === null) throw new Error(`Queue-Entry ${entry.id}: put ohne Daten`);
      await provider.put(entry.path, entry.data);
    }
  }

  /**
   * Queue abarbeiten (nach Wiederverbinden). Bricht beim ersten Fehler ab und
   * laesst den Rest in der Queue. Eintraege mit op="put" werden fuer die
   * Konfliktpruefung NICHT blind hochgeladen — das macht der SyncService;
   * hier geht es um Nachhol-Operationen (z.B. Loeschungen, Retry).
   */
  async flush(provider: SyncProvider): Promise<{ processed: number; remaining: number; error: string | null }> {
    if (!(await provider.ping())) {
      return { processed: 0, remaining: this.size, error: "offline" };
    }
    let processed = 0;
    let error: string | null = null;
    for (const entry of this.pending()) {
      try {
        await this.apply(entry, provider);
        this.store.remove(entry.id);
        processed++;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        this.store.upsert({ ...entry, attempts: entry.attempts + 1, lastError: error });
        break; // Reihenfolge wahren
      }
    }
    return { processed, remaining: this.size, error };
  }

  clear(): void {
    for (const e of this.store.all()) this.store.remove(e.id);
  }
}
