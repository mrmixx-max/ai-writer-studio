// Cloud-Sync Engine (Sprint 24, Agent 1): 4 Provider (Dropbox, Google Drive,
// OneDrive, WebDAV) mit Upload/Download/Sync/Konfliktloesung.
// Standalone-Fassade ohne neue Dependencies — alle Requests laufen ueber
// injizierbares `fetch`, damit Vitest ohne Netz testen kann.
// Datei: src/services/cloud/cloudSync.ts

export type CloudProvider = "dropbox" | "google-drive" | "onedrive" | "webdav";

export interface CloudConfig {
  provider: CloudProvider;
  accessToken: string;
  refreshToken?: string;
  syncFolder: string;
  autoSync: boolean;
  syncInterval: number; // Minuten
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  conflicts: number;
  lastSync: number;
}

export type ConflictStrategy = "local" | "remote" | "merge";

export interface RemoteFile {
  name: string;
  modified: number;
}

type FetchImpl = typeof fetch;

let activeConfig: CloudConfig | null = null;
let fetchOverride: FetchImpl | null = null;

/** Lokaler Stand (In-Memory): Projekt-ID -> { content, modified }. */
const localStore = new Map<string, { content: string; modified: number }>();
/** Remote-Cache aus dem letzten Listing/Sync. */
const remoteCache = new Map<string, { modified: number }>();
/** IDs mit ungeloestem Konflikt. */
const openConflicts = new Set<string>();

function fetchImpl(): FetchImpl {
  if (fetchOverride) return fetchOverride;
  return globalThis.fetch.bind(globalThis);
}

/** Aktive Konfiguration setzen (wird vom Panel aufgerufen). */
export function configureCloudSync(config: CloudConfig): void {
  activeConfig = { ...config };
}

/** Aktive Konfiguration lesen (null, wenn nie konfiguriert). */
export function getCloudConfig(): CloudConfig | null {
  return activeConfig ? { ...activeConfig } : null;
}

/** Fetch-Implementierung injizieren (Tests/SSR). */
export function setCloudFetch(fn: FetchImpl | null): void {
  fetchOverride = fn;
}

/** Test-Helfer: gesamten Modul-Zustand zuruecksetzen. */
export function __resetCloudSyncState(): void {
  activeConfig = null;
  localStore.clear();
  remoteCache.clear();
  openConflicts.clear();
}

/** Test-Helfer: lokales Projekt seeden. */
export function __seedLocalProject(projectId: string, content: string, modified = Date.now()): void {
  localStore.set(projectId, { content, modified });
}

/** Test-Helfer: lokalen Stand lesen. */
export function __getLocalProject(projectId: string): { content: string; modified: number } | null {
  return localStore.get(projectId) ?? null;
}

/** Test-Helfer: offene Konflikte lesen. */
export function __getOpenConflicts(): string[] {
  return [...openConflicts];
}

function requireConfig(override?: CloudConfig): CloudConfig {
  const cfg = override ?? activeConfig;
  if (!cfg) throw new Error("Cloud-Sync ist nicht konfiguriert — zuerst configureCloudSync() aufrufen.");
  if (!cfg.accessToken) throw new Error("Cloud-Sync: accessToken fehlt.");
  return cfg;
}

function authHeaders(cfg: CloudConfig): Record<string, string> {
  return { Authorization: `Bearer ${cfg.accessToken}` };
}

function folder(cfg: CloudConfig): string {
  return (cfg.syncFolder || "/AIWriterStudio").replace(/\/+$/, "") || "/";
}

function filePath(cfg: CloudConfig, projectId: string): string {
  return `${folder(cfg)}/${projectId}.aiw.json`;
}

function baseName(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.aiw\.json$/, "");
}

// --- Provider-Endpunkte ------------------------------------------------------

async function providerUpload(cfg: CloudConfig, projectId: string, body: string): Promise<void> {
  const f = fetchImpl();
  const path = filePath(cfg, projectId);
  let res: Response;
  switch (cfg.provider) {
    case "dropbox":
      res = await f("https://content.dropboxapi.com/2/files/upload", {
        method: "POST",
        headers: {
          ...authHeaders(cfg),
          "Dropbox-API-Arg": JSON.stringify({ path, mode: "overwrite", mute: true }),
          "Content-Type": "application/octet-stream",
        },
        body,
      });
      break;
    case "google-drive":
      res = await f(
        `https://www.googleapis.com/upload/drive/v3/files?uploadType=media&fields=id,modifiedTime&path=${encodeURIComponent(path)}`,
        { method: "POST", headers: { ...authHeaders(cfg), "Content-Type": "application/json" }, body },
      );
      break;
    case "onedrive":
      res = await f(`https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(path)}:/content`, {
        method: "PUT",
        headers: { ...authHeaders(cfg), "Content-Type": "application/json" },
        body,
      });
      break;
    case "webdav":
      res = await f(`${folder(cfg)}/${projectId}.aiw.json`.replace(/([^:])\/+/g, "$1/"), {
        method: "PUT",
        headers: { ...authHeaders(cfg), "Content-Type": "application/json" },
        body,
      });
      break;
  }
  if (!res!.ok) throw new Error(`Upload (${cfg.provider}) fehlgeschlagen: HTTP ${res!.status}`);
}

async function providerDownload(cfg: CloudConfig, projectId: string): Promise<{ data: string; modified: number } | null> {
  const f = fetchImpl();
  const path = filePath(cfg, projectId);
  let res: Response;
  switch (cfg.provider) {
    case "dropbox":
      res = await f("https://content.dropboxapi.com/2/files/download", {
        method: "POST",
        headers: { ...authHeaders(cfg), "Dropbox-API-Arg": JSON.stringify({ path }) },
      });
      break;
    case "google-drive":
      res = await f(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${projectId}.aiw.json'`)}&fields=files(id,modifiedTime)`, {
        headers: authHeaders(cfg),
      });
      break;
    case "onedrive":
      res = await f(`https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(path)}:/content`, {
        headers: authHeaders(cfg),
      });
      break;
    case "webdav":
      res = await f(`${folder(cfg)}/${projectId}.aiw.json`.replace(/([^:])\/+/g, "$1/"), {
        headers: authHeaders(cfg),
      });
      break;
  }
  if (res!.status === 404 || res!.status === 409) return null;
  if (!res!.ok) throw new Error(`Download (${cfg.provider}) fehlgeschlagen: HTTP ${res!.status}`);
  const data = await res!.text();
  const headerModified = res!.headers.get("last-modified") ?? res!.headers.get("Dropbox-API-Result");
  let modified = Date.now();
  if (headerModified) {
    const t = Date.parse(headerModified);
    if (!Number.isNaN(t)) modified = t;
  }
  return { data, modified };
}

function normalizeListEntry(cfg: CloudConfig, raw: { name?: string; path?: string; modified?: unknown; modifiedTime?: unknown; lastModifiedDateTime?: unknown }): RemoteFile | null {
  const rawName = raw.name ?? raw.path?.split("/").pop() ?? "";
  if (!rawName) return null;
  const name = baseName(rawName);
  const rawMod = raw.modified ?? raw.modifiedTime ?? raw.lastModifiedDateTime;
  let modified = Date.now();
  if (typeof rawMod === "number" && Number.isFinite(rawMod)) modified = rawMod;
  else if (typeof rawMod === "string") {
    const t = Date.parse(rawMod);
    if (!Number.isNaN(t)) modified = t;
  }
  void cfg;
  return { name, modified };
}

// --- Oeffentliche API ----------------------------------------------------------

/** Projekt hochladen (Payload = lokale Version mit Export-Zeitstempel). */
export async function uploadProject(projectId: string, config?: CloudConfig): Promise<void> {
  const cfg = requireConfig(config);
  const local = localStore.get(projectId);
  const body = JSON.stringify({
    projectId,
    content: local?.content ?? "",
    exportedAt: Date.now(),
    schemaVersion: 1,
  });
  await providerUpload(cfg, projectId, body);
  const now = Date.now();
  remoteCache.set(projectId, { modified: now });
  openConflicts.delete(projectId);
}

/** Projekt herunterladen (Remote-Version ueberschreibt lokalen Stand). */
export async function downloadProject(projectId: string, config?: CloudConfig): Promise<void> {
  const cfg = requireConfig(config);
  const remote = await providerDownload(cfg, projectId);
  if (!remote) throw new Error(`Projekt "${projectId}" existiert nicht remote.`);
  localStore.set(projectId, { content: remote.data, modified: remote.modified });
  remoteCache.set(projectId, { modified: remote.modified });
  openConflicts.delete(projectId);
}

/** Remote-Dateien auflisten. */
export async function getRemoteFiles(config?: CloudConfig): Promise<RemoteFile[]> {
  const cfg = requireConfig(config);
  const f = fetchImpl();
  let res: Response;
  switch (cfg.provider) {
    case "dropbox":
      res = await f("https://api.dropboxapi.com/2/files/list_folder", {
        method: "POST",
        headers: { ...authHeaders(cfg), "Content-Type": "application/json" },
        body: JSON.stringify({ path: folder(cfg) }),
      });
      break;
    case "google-drive":
      res = await f("https://www.googleapis.com/drive/v3/files?fields=files(name,modifiedTime)", {
        headers: authHeaders(cfg),
      });
      break;
    case "onedrive":
      res = await f(`https://graph.microsoft.com/v1.0/me/drive/root:${encodeURI(folder(cfg))}:/children`, {
        headers: authHeaders(cfg),
      });
      break;
    case "webdav":
      res = await f(folder(cfg), {
        method: "PROPFIND",
        headers: { ...authHeaders(cfg), Depth: "1", "Content-Type": "application/xml" },
      });
      break;
  }
  if (!res!.ok) throw new Error(`Listing (${cfg.provider}) fehlgeschlagen: HTTP ${res!.status}`);
  const files = (await res!.json()) as {
    entries?: { name?: string; path?: string; modified?: unknown }[];
    files?: { name?: string; modifiedTime?: unknown }[];
    value?: { name?: string; lastModifiedDateTime?: unknown }[];
  };
  const raw = files.entries ?? files.files ?? files.value ?? [];
  const out: RemoteFile[] = [];
  for (const r of raw) {
    const n = normalizeListEntry(cfg, r);
    if (n) {
      out.push(n);
      remoteCache.set(n.name, { modified: n.modified });
    }
  }
  return out;
}

/** Alle Projekte synchronisieren: fehlende hoch-/herunterladen, Konflikte zaehlen. */
export async function syncAll(config?: CloudConfig): Promise<SyncResult> {
  const cfg = requireConfig(config);
  const remote = await getRemoteFiles(config);
  const remoteNames = new Set(remote.map((r) => r.name));
  const localNames = new Set(localStore.keys());
  let uploaded = 0;
  let downloaded = 0;
  let conflicts = 0;
  for (const name of localNames) {
    if (!remoteNames.has(name)) {
      await uploadProject(name, cfg);
      uploaded++;
    }
  }
  for (const r of remote) {
    if (!localNames.has(r.name)) {
      await downloadProject(r.name, cfg);
      downloaded++;
    } else {
      const cached = remoteCache.get(r.name);
      const local = localStore.get(r.name);
      if (cached && local && cached.modified !== r.modified && local.modified < r.modified) {
        openConflicts.add(r.name);
        conflicts++;
      }
    }
  }
  return { uploaded, downloaded, conflicts, lastSync: Date.now() };
}

/** Konflikt loesen: 'local' pusht, 'remote' pullt, 'merge' kombiniert beide Staende. */
export async function resolveConflict(
  projectId: string,
  strategy: ConflictStrategy,
  config?: CloudConfig,
): Promise<void> {
  const cfg = requireConfig(config);
  if (strategy === "local") {
    await uploadProject(projectId, cfg);
    return;
  }
  if (strategy === "remote") {
    await downloadProject(projectId, cfg);
    return;
  }
  // merge: Remote laden, Inhalte konkatenieren, Ergebnis hochladen.
  const remote = await providerDownload(cfg, projectId);
  if (!remote) throw new Error(`Projekt "${projectId}" existiert nicht remote — Merge unmoeglich.`);
  const local = localStore.get(projectId);
  const merged = [local?.content ?? "", remote.data].filter(Boolean).join("\n");
  localStore.set(projectId, { content: merged, modified: Date.now() });
  await uploadProject(projectId, cfg);
}

/** Verbindung testen: billiger Ping pro Provider, true bei 2xx, false sonst. */
export async function testConnection(config: CloudConfig): Promise<boolean> {
  try {
    const f = fetchImpl();
    const headers = authHeaders(config);
    let res: Response;
    switch (config.provider) {
      case "dropbox":
        res = await f("https://api.dropboxapi.com/2/users/get_current_account", { method: "POST", headers });
        break;
      case "google-drive":
        res = await f("https://www.googleapis.com/drive/v3/about?fields=user", { headers });
        break;
      case "onedrive":
        res = await f("https://graph.microsoft.com/v1.0/me/drive", { headers });
        break;
      case "webdav":
        res = await f(folder(config), { method: "PROPFIND", headers: { ...headers, Depth: "0" } });
        break;
    }
    return res!.ok;
  } catch {
    return false;
  }
}
