// Health-Checks: Prüft kritische Abhängigkeiten (Ollama, Datenbank, Speicher).
// Liefert Status für Monitoring und Load Balancer.

export interface HealthCheckResult {
  name: string;
  status: "ok" | "degraded" | "down";
  responseTimeMs: number;
  message?: string;
}

export interface SystemHealth {
  overall: "ok" | "degraded" | "down";
  checks: HealthCheckResult[];
  timestamp: number;
}

/**
 * Prüft, ob Ollama erreichbar ist.
 */
export async function checkOllamaHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      method: "GET",
    });
    const elapsed = Date.now() - start;
    if (!res.ok) {
      return {
        name: "ollama",
        status: "degraded",
        responseTimeMs: elapsed,
        message: `HTTP ${res.status}`,
      };
    }
    return { name: "ollama", status: "ok", responseTimeMs: elapsed };
  } catch (e: unknown) {
    const elapsed = Date.now() - start;
    return {
      name: "ollama",
      status: "down",
      responseTimeMs: elapsed,
      message: e instanceof Error ? e.message : "Unknown error",
    };
  }
}

/**
 * Prüft die Datenbank-Integrität.
 * Nutzt die vorhandene getDb() Funktion.
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Dynamischer Import um Zirkularität zu vermeiden
    const { getDb } = await import("@/services/db");
    const db = getDb();
    db.exec("PRAGMA quick_check");
    const elapsed = Date.now() - start;
    return { name: "database", status: "ok", responseTimeMs: elapsed };
  } catch (e: unknown) {
    const elapsed = Date.now() - start;
    return {
      name: "database",
      status: "down",
      responseTimeMs: elapsed,
      message: e instanceof Error ? e.message : "Database error",
    };
  }
}

/**
 * Prüft, ob genug Speicherplatz vorhanden ist.
 * Mindestens 500 MB frei vorausgesetzt.
 */
export async function checkDiskSpace(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const fs = await import("node:fs/promises");
    const os = await import("node:os");
    const homeDir = os.homedir();
    const stat = await fs.statfs(homeDir);
    const freeBytes = stat.bavail * stat.bfree;
    const elapsed = Date.now() - start;
    const minBytes = 500 * 1024 * 1024; // 500 MB
    if (freeBytes < minBytes) {
      return {
        name: "disk",
        status: "degraded",
        responseTimeMs: elapsed,
        message: `Low space: ${(freeBytes / 1024 / 1024).toFixed(0)} MB free`,
      };
    }
    return { name: "disk", status: "ok", responseTimeMs: elapsed };
  } catch (e: unknown) {
    const elapsed = Date.now() - start;
    return {
      name: "disk",
      status: "down",
      responseTimeMs: elapsed,
      message: e instanceof Error ? e.message : "Disk check error",
    };
  }
}

/**
 * Führt alle Health-Checks aus.
 */
export async function checkSystemHealth(): Promise<SystemHealth> {
  const [ollama, database, disk] = await Promise.all([
    checkOllamaHealth(),
    checkDatabaseHealth(),
    checkDiskSpace(),
  ]);
  const checks = [ollama, database, disk];
  const hasDown = checks.some((c) => c.status === "down");
  const hasDegraded = checks.some((c) => c.status === "degraded");
  const overall = hasDown ? "down" : hasDegraded ? "degraded" : "ok";
  return { overall, checks, timestamp: Date.now() };
}
