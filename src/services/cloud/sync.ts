// SyncService: Orchestriert Provider + Konfliktloesung + Offline-Queue.
// Ein Projekt = eine JSON-Datei "<basePath>/projects/<projectId>.aiw.json".
// Datei: src/services/cloud/sync.ts
import { listChapters, listProjects } from "@/services/project";
import type { SyncConflict, SyncPayload, SyncProvider, SyncResult, ConflictResolution } from "./types";
import { OfflineQueue } from "./offlineQueue";
import { resolveConflict } from "./conflict";

const FILE_SUFFIX = ".aiw.json";

export interface SyncStateEntry {
  projectId: string;
  path: string;
  /** ETag/Hash des letzten erfolgreich synchronisierten Standes. */
  lastEtag: string | null;
  lastSyncedAt: number;
  /** JSON des letzten synchronisierten lokalen Standes (Change-Erkennung). */
  lastPayloadJson: string | null;
}

export interface SyncStore {
  all(): SyncStateEntry[];
  upsert(e: SyncStateEntry): void;
}

export function createMemorySyncStore(): SyncStore {
  let entries: SyncStateEntry[] = [];
  return {
    all: () => [...entries],
    upsert(e) {
      entries = [...entries.filter((x) => x.projectId !== e.projectId), e];
    },
  };
}

/**
 * Kanonische Form eines Payloads (ohne exportedAt) — Basis fuer die
 * Change-Erkennung, da exportedAt bei jedem Export neu gesetzt wird.
 */
export function canonicalJson(p: SyncPayload): string {
  return JSON.stringify({ project: p.project, chapters: p.chapters });
}

/** Payload eines Projekts aus der lokalen DB bauen. */
export function buildPayload(projectId: string): SyncPayload | null {
  const project = listProjects().find((p) => p.id === projectId);
  if (!project) return null;
  return {
    project,
    chapters: listChapters(projectId),
    exportedAt: Date.now(),
    schemaVersion: 1,
  };
}

export class SyncService {
  readonly queue: OfflineQueue;
  constructor(
    private provider: SyncProvider,
    private store: SyncStore = createMemorySyncStore(),
    basePath = "projects",
  ) {
    this.provider = provider;
    this.basePath = basePath.replace(/^\/+|\/+$/g, "");
    this.queue = new OfflineQueue();
  }
  private basePath: string;

  pathFor(projectId: string): string {
    return `/${this.basePath}/${projectId}${FILE_SUFFIX}`;
  }

  state(projectId: string): SyncStateEntry | null {
    return this.store.all().find((s) => s.projectId === projectId) ?? null;
  }

  listRemoteProjects() {
    return this.provider.list(`/${this.basePath}`);
  }

  /**
   * Sync fuer ein einzelnes Projekt: Pull/Push mit Konfliktpruefung
   * (Optimistic Concurrency ueber ETag). Liefert SyncResult inkl. Konflikt,
   * falls eine gleichzeitige Aenderung vorliegt und der Merge fehlschlaegt.
   */
  async syncProject(
    projectId: string,
    strategy: ConflictResolution = "merged",
  ): Promise<SyncResult> {
    const path = this.pathFor(projectId);
    const local = buildPayload(projectId);
    if (!local) {
      return { projectId, path, action: "up-to-date", conflict: null, etag: null, error: "Projekt nicht gefunden" };
    }
    const localJson = canonicalJson(local);
    const localEtag = this.state(projectId)?.lastEtag ?? null;

    let remote: Awaited<ReturnType<SyncProvider["get"]>>;
    try {
      remote = await this.provider.get(path);
    } catch (err) {
      // Netzfehler -> Offline-Queue und Fehler melden.
      this.queue.enqueue("put", path, projectId, localJson);
      return {
        projectId, path, action: "up-to-date", conflict: null, etag: localEtag,
        error: `offline: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Fall 1: remote existiert nicht -> einfach hochladen.
    if (!remote) {
      const { etag } = await this.provider.put(path, localJson);
      this.store.upsert({ projectId, path, lastEtag: etag, lastSyncedAt: Date.now(), lastPayloadJson: localJson });
      return { projectId, path, action: "pushed", conflict: null, etag, error: null };
    }

    // Fall 2: remote identisch zum letzten Sync-Stand -> lokale Aenderung pushen.
    const remotePayload = JSON.parse(remote.data) as SyncPayload;
    const remoteCanonical = canonicalJson(remotePayload);
    const unchangedRemotely =
      localEtag !== null && remote.etag !== null && remote.etag === localEtag;

    const localUnchanged = (() => {
      const st = this.state(projectId);
      return st?.lastPayloadJson != null && st.lastPayloadJson === localJson;
    })();

    if (remoteCanonical === localJson || (unchangedRemotely && localUnchanged)) {
      if (remoteCanonical === localJson || localUnchanged) {
        this.store.upsert({ projectId, path, lastEtag: remote.etag, lastSyncedAt: Date.now(), lastPayloadJson: remoteCanonical });
        return { projectId, path, action: "up-to-date", conflict: null, etag: remote.etag, error: null };
      }
      const { etag } = await this.provider.put(path, localJson);
      this.store.upsert({ projectId, path, lastEtag: etag, lastSyncedAt: Date.now(), lastPayloadJson: localJson });
      return { projectId, path, action: "pushed", conflict: null, etag, error: null };
    }

    // Fall 3: remote wurde gleichzeitig geaendert -> Konflikt.
    const conflict: SyncConflict = {
      id: `c_${projectId}_${Date.now().toString(36)}`,
      projectId,
      projectPath: path,
      localPayload: local,
      remotePayload,
      remoteEtag: remote.etag,
      localTime: local.project.updatedAt,
      remoteTime: remotePayload.project.updatedAt,
      detectedAt: Date.now(),
      status: "open",
      resolution: null,
      mergedPayload: null,
    };
    const { conflict: resolved, payload } = resolveConflict(conflict, strategy);
    if (payload && resolved.status === "resolved") {
      const { etag } = await this.provider.put(path, JSON.stringify(payload));
      this.store.upsert({ projectId, path, lastEtag: etag, lastSyncedAt: Date.now(), lastPayloadJson: localJson });
      return { projectId, path, action: "pushed", conflict: resolved, etag, error: null };
    }
    return { projectId, path, action: "conflict", conflict: resolved, etag: remote.etag, error: null };
  }

  /** Remote-Version lokal uebernehmen (Pull, z.B. nach "remote-wins"). */
  async pullProject(projectId: string): Promise<SyncResult> {
    const path = this.pathFor(projectId);
    const remote = await this.provider.get(path);
    if (!remote) {
      return { projectId, path, action: "up-to-date", conflict: null, etag: null, error: "remote nicht gefunden" };
    }
    this.store.upsert({ projectId, path, lastEtag: remote.etag, lastSyncedAt: Date.now(), lastPayloadJson: remote.data });
    // Anwenden der Remote-Daten in die lokale DB macht der Aufrufer
    // (UI-Layer), da dies interaktiv bestaetigt werden sollte.
    return { projectId, path, action: "pulled", conflict: null, etag: remote.etag, error: null };
  }

  /** Alle lokalen Projekte synchronisieren; Offline-Queue nachziehen. */
  async syncAll(strategy: ConflictResolution = "merged"): Promise<SyncResult[]> {
    const results: SyncResult[] = [];
    if (await this.provider.ping()) {
      const flushed = await this.queue.flush(this.provider);
      if (flushed.error && flushed.error !== "offline") {
        results.push({ projectId: "*", path: "*", action: "up-to-date", conflict: null, etag: null, error: flushed.error });
      }
    }
    for (const p of listProjects()) {
      results.push(await this.syncProject(p.id, strategy));
    }
    return results;
  }

  async deleteRemote(projectId: string): Promise<void> {
    await this.provider.delete(this.pathFor(projectId));
  }

  async isOnline(): Promise<boolean> {
    return this.provider.ping();
  }
}
