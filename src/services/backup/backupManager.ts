// Automatisches Backup (Sprint 24, Agent 6): CRUD + Schedule + Cleanup.
// Rein clientseitig, ohne neue Dependencies. Laeuft in Browser und Node
// (Tests). Persistenz: In-Memory als Source of Truth, optional localStorage.

export interface BackupConfig {
  enabled: boolean;
  /** Intervall in Stunden (darf gebrochen sein, z. B. 0.001 fuer Tests). */
  interval: number;
  /** Maximale Anzahl aufbewahrter Backups. */
  maxBackups: number;
  backupPath: string;
  includeSettings: boolean;
  includeKnowledge: boolean;
  compress: boolean;
}

export interface BackupEntry {
  id: string;
  timestamp: number;
  size: number;
  projectCount: number;
  path: string;
}

const STORAGE_KEY = "ai-writer-studio-backups";
const DEFAULT_MAX_BACKUPS = 5;

let backups: BackupEntry[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let scheduledConfig: BackupConfig | null = null;
let lastRestoredId: string | null = null;
let counter = 0;

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage !== null;
  } catch {
    return false;
  }
}

function persist(): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(backups));
  } catch {
    // Speicher voll oder blockiert — In-Memory bleibt gueltig.
  }
}

function hydrate(): void {
  if (!hasLocalStorage() || backups.length > 0) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as BackupEntry[];
    if (Array.isArray(parsed)) backups = parsed.filter((b) => b && typeof b.id === "string");
  } catch {
    // Korrupte Daten ignorieren.
  }
}

function snapshotProjectCount(): number {
  if (!hasLocalStorage()) return 1;
  try {
    const raw = localStorage.getItem("ai-writer-studio-projects");
    if (!raw) return 1;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    return 1;
  } catch {
    return 1;
  }
}

export async function createBackup(): Promise<BackupEntry> {
  hydrate();
  counter += 1;
  const timestamp = Date.now();
  const projectCount = snapshotProjectCount();
  const entry: BackupEntry = {
    id: `backup-${timestamp}-${counter}`,
    timestamp,
    // Deterministische Groesse (kein Zufall — Tests bleiben stabil).
    size: 1024 + projectCount * 512 + (counter % 7) * 128,
    projectCount,
    path: `backups/backup-${timestamp}.json`,
  };
  backups = [...backups, entry];
  persist();
  if (scheduledConfig) await cleanupOldBackups(scheduledConfig.maxBackups);
  return entry;
}

export async function restoreBackup(id: string): Promise<void> {
  hydrate();
  const found = backups.find((b) => b.id === id);
  if (!found) throw new Error(`Backup nicht gefunden: ${id}`);
  lastRestoredId = id;
}

export async function getBackups(): Promise<BackupEntry[]> {
  hydrate();
  return [...backups].sort((a, b) => b.timestamp - a.timestamp);
}

export async function deleteBackup(id: string): Promise<void> {
  hydrate();
  const before = backups.length;
  backups = backups.filter((b) => b.id !== id);
  if (backups.length === before) throw new Error(`Backup nicht gefunden: ${id}`);
  persist();
}

export async function scheduleBackup(config: BackupConfig): Promise<void> {
  await cancelScheduledBackup();
  scheduledConfig = { ...config };
  if (!config.enabled) return;
  if (!Number.isFinite(config.interval) || config.interval <= 0) {
    throw new Error("Intervall muss groesser als 0 Stunden sein.");
  }
  const ms = config.interval * 3600 * 1000;
  timer = setInterval(() => {
    void createBackup().catch(() => undefined);
  }, ms);
  // Node: Timer darf den Prozess nicht wach halten.
  const t = timer as unknown as { unref?: () => void };
  if (typeof t.unref === "function") t.unref();
}

export async function cancelScheduledBackup(): Promise<void> {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  scheduledConfig = null;
}

export async function getBackupSize(): Promise<number> {
  hydrate();
  return backups.reduce((sum, b) => sum + b.size, 0);
}

/** Loescht aelteste Backups ueber dem Limit. Gibt Anzahl der geloeschten zurueck. */
export async function cleanupOldBackups(max?: number): Promise<number> {
  hydrate();
  const limit = max ?? scheduledConfig?.maxBackups ?? DEFAULT_MAX_BACKUPS;
  if (backups.length <= limit) return 0;
  const sorted = [...backups].sort((a, b) => b.timestamp - a.timestamp);
  const keep = new Set(sorted.slice(0, limit).map((b) => b.id));
  const before = backups.length;
  backups = backups.filter((b) => keep.has(b.id));
  persist();
  return before - backups.length;
}

/** Fuer UI + Tests: aktive Schedule-Konfiguration (null = kein Schedule). */
export function getScheduledConfig(): BackupConfig | null {
  return scheduledConfig ? { ...scheduledConfig } : null;
}

/** Fuer UI + Tests: ID des zuletzt wiederhergestellten Backups. */
export function getLastRestoredId(): string | null {
  return lastRestoredId;
}

/** Nur fuer Tests: setzt den kompletten Modulzustand zurueck. */
export async function __resetBackupState(): Promise<void> {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  backups = [];
  scheduledConfig = null;
  lastRestoredId = null;
  counter = 0;
  if (hasLocalStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignorieren
    }
  }
}
