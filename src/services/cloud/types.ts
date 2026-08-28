// Cloud-Sync: gemeinsame Typen für Provider, Konflikte und Offline-Queue.
// Datei: src/services/cloud/types.ts
import type { Project, Chapter } from "@/types/project";

/** Ein synchronisierbares Projekt-Paket (Projekt + Kapitel) als JSON-Blob. */
export interface SyncPayload {
  project: Project;
  chapters: Chapter[];
  /** Zeitstempel der Paket-Erstellung (ms). */
  exportedAt: number;
  /** Schema-Version des Payloads für zukünftige Migrationen. */
  schemaVersion: number;
}

/** Metadaten einer entfernten Datei (aus PROPFIND / list_folder). */
export interface RemoteEntry {
  /** Pfad auf dem Server, z.B. "/Projekte/mein-projekt.aiw.json". */
  path: string;
  /** ETag oder Hash — dient als Optimistic-Concurrency-Token. */
  etag: string | null;
  /** Letzte Änderung auf dem Server (ms) oder null, wenn unbekannt. */
  modifiedAt: number | null;
  size: number | null;
}

/** Konflikt-Auflösungsstrategie. */
export type ConflictResolution =
  | "local-wins"      // lokale Version überschreibt remote
  | "remote-wins"     // remote überschreibt lokal
  | "merged"          // automatischer Merge (zeilenweise, ohne Überschneidung)
  | "manual";         // Konflikt bleibt offen, Nutzer entscheidet

/** Ein erkannter Konflikt zwischen lokaler und entfernter Version. */
export interface SyncConflict {
  id: string;
  projectId: string;
  projectPath: string;
  localPayload: SyncPayload;
  remotePayload: SyncPayload;
  remoteEtag: string | null;
  /** ms-Epochen der beiden Versionen. */
  localTime: number;
  remoteTime: number;
  detectedAt: number;
  status: "open" | "resolved";
  resolution: ConflictResolution | null;
  /** Ergebnis-Payload bei resolution="merged". */
  mergedPayload: SyncPayload | null;
}

/** Ergebnis eines Sync-Vorgangs für ein Projekt. */
export interface SyncResult {
  projectId: string;
  path: string;
  /** "pushed" = lokal hochgeladen, "pulled" = remote geholt, "up-to-date" = nichts zu tun. */
  action: "pushed" | "pulled" | "up-to-date" | "conflict";
  conflict: SyncConflict | null;
  etag: string | null;
  error: string | null;
}

/**
 * Einheitliche Provider-Schnittstelle. Beide Implementierungen
 * (WebDAV/Nextcloud und Dropbox) arbeiten mit injizierbarem `fetch`,
 * damit sie in Vitest ohne Netz getestet werden können.
 */
export interface SyncProvider {
  readonly kind: "webdav" | "dropbox";
  /** Kurzname für UI/Logs. */
  readonly label: string;
  /** Datei anlegen/überschreiben; liefert ETag/Hash des neuen Standes. */
  put(path: string, data: string): Promise<{ etag: string | null }>;
  /** Datei lesen; liefert null, wenn sie nicht existiert (404). */
  get(path: string): Promise<{ data: string; etag: string | null; modifiedAt: number | null } | null>;
  /** Datei löschen. 404 gilt als Erfolg (idempotent). */
  delete(path: string): Promise<void>;
  /** Verzeichnis auflisten (nicht-rekursiv) — für die Projektübersicht. */
  list(prefix: string): Promise<RemoteEntry[]>;
  /** Erreichbarkeit prüfen (billiger Request). */
  ping(): Promise<boolean>;
}

export interface WebDavConfig {
  /** Basis-URL inkl. Pfad, z.B. "https://cloud.example.org/remote.php/dav/files/user". */
  baseUrl: string;
  username: string;
  password: string;
  /** Optionaler Unterordner, z.B. "/AIWriterStudio". */
  basePath?: string;
}

export interface DropboxConfig {
  /** OAuth2 Access Token (App Permission: files.content.write). */
  accessToken: string;
  basePath?: string;
}
