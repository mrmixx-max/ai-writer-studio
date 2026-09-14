// Graceful Shutdown: Pending Jobs beenden, DB flushen, Connections schließen.
import { alertManager } from "./alert";

export interface ShutdownTask {
  name: string;
  priority: number;
  execute: () => Promise<void>;
  /** Max. Laufzeit in ms (Default 10_000). 0 = kein Timeout. */
  timeoutMs?: number;
}

export interface ShutdownResult {
  success: boolean;
  completedTasks: string[];
  failedTasks: { name: string; error: string }[];
  durationMs: number;
}

export class GracefulShutdown {
  private tasks: ShutdownTask[] = [];
  private shutdownInProgress = false;

  register(task: ShutdownTask): void {
    this.tasks.push(task);
    this.tasks.sort((a, b) => b.priority - a.priority);
  }

  async execute(signal?: string): Promise<ShutdownResult> {
    if (this.shutdownInProgress) {
      return {
        success: true,
        completedTasks: [],
        failedTasks: [],
        durationMs: 0,
      };
    }

    this.shutdownInProgress = true;
    const start = Date.now();
    const completedTasks: string[] = [];
    const failedTasks: { name: string; error: string }[] = [];

    alertManager.createAlert(
      "shutdown",
      "info",
      `Graceful Shutdown gestartet${signal ? ` (${signal})` : ""}`
    );

    for (const task of this.tasks) {
      try {
        await runWithTimeout(task);
        completedTasks.push(task.name);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        failedTasks.push({ name: task.name, error: message });
      }
    }

    const durationMs = Date.now() - start;
    this.shutdownInProgress = false;

    const success = failedTasks.length === 0;
    if (!success) {
      alertManager.createAlert(
        "shutdown_incomplete",
        "warning",
        `Graceful Shutdown mit ${failedTasks.length} Fehlern abgeschlossen`
      );
    }

    return { success, completedTasks, failedTasks, durationMs };
  }

  isShuttingDown(): boolean {
    return this.shutdownInProgress;
  }
}

export const gracefulShutdown = new GracefulShutdown();

/** Default-Timeout pro Shutdown-Task (ein Hänger darf den Shutdown nicht blockieren). */
export const DEFAULT_SHUTDOWN_TASK_TIMEOUT_MS = 10_000;

/**
 * Führt einen Shutdown-Task mit Timeout-Guard aus. Bei Überschreitung
 * wird ein Timeout-Error geworfen (der Aufrufer verbucht ihn als
 * fehlgeschlagenen Task, statt ewig zu hängen).
 */
async function runWithTimeout(task: ShutdownTask): Promise<void> {
  const ms = task.timeoutMs ?? DEFAULT_SHUTDOWN_TASK_TIMEOUT_MS;
  if (!(ms > 0)) return task.execute();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      task.execute(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Shutdown-Task "${task.name}" hat das Zeitlimit von ${ms} ms überschritten.`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Standard-Tasks registrieren
export function registerDefaultShutdownTasks(): void {
  gracefulShutdown.register({
    name: "flush-pending-jobs",
    priority: 100,
    execute: async () => {
      // BookWriter Jobs persistieren
       
      const { getDb } = await import("@/services/db");
      const db = getDb();
      db.run("PRAGMA wal_checkpoint(FULL);");
    },
  });

  gracefulShutdown.register({
    name: "persist-database",
    priority: 90,
    execute: async () => {
       
      const { persistNow } = await import("@/services/db");
      await persistNow();
    },
  });

  gracefulShutdown.register({
    name: "close-ollama-connections",
    priority: 50,
    execute: async () => {
      // Connection Pools zurücksetzen (wartende Queues verwerfen)
      const { resetOllamaPools } = await import(
        "@/services/ollama/connectionPool"
      );
      resetOllamaPools();
    },
  });
}
