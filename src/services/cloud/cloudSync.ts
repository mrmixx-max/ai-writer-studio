// Cloud-Sync-Engine (Sprint 24, Agent 1): 4 Provider (Dropbox, Google Drive,
// OneDrive, WebDAV) mit Upload/Download/Sync/Konfliktaufloesung.
// Arbeitet mit injizierbarem globalem `fetch` — Tests mocken per vi.stubGlobal.
// Lokale Projekte werden ueber eine In-Memory-Registry verwaltet (kein
// SQLite-Zugriff noetig), damit die Engine ohne Tauri-Kontext laeuft.
// Datei: src/services/cloud/cloudSync.ts
export type CloudProvider = 'dropbox' | 'google-drive' | 'onedrive' | 'webdav';

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

export type ConflictStrategy = 'local' | 'remote' | 'merge';

interface LocalEntry {
  content: string;
  modified: number;
}

interface ConflictEntry {
  projectId: string;
  localModified: number;
  remoteModified: number;
  detectedAt: number;
}

let activeConfig: CloudConfig | null = null;
const localRegistry = new Map<string, LocalEntry>();
const conflictRegistry = new Map<string, ConflictEntry>();
let lastResult: SyncResult | null = null;

/** Aktive Konfiguration setzen (UI speichert hier Auswahl + Token). */
export function configureCloudSync(config: CloudConfig): void {
  activeConfig = { ...config };
}

/** Aktive Konfiguration lesen (null, wenn nie konfiguriert). */
export function getCloudConfig(): CloudConfig | null {
  return activeConfig ? { ...activeConfig } : null;
}

/** Lokales Projekt in der Engine-Registry anlegen/aktualisieren. */
export function registerLocalProject(projectId: string, content: string, modified = Date.now()): void {
  localRegistry.set(projectId, { content, modified });
}

/** Lokalen Stand eines Projekts lesen (nach Download befuellt). */
export function getLocalProject(projectId: string): LocalEntry | null {
  const e = localRegistry.get(projectId);
  return e ? { ...e } : null;
}

/** Offene Konflikte auflisten. */
export function getConflicts(): ConflictEntry[] {
  return [...conflictRegistry.values()];
}

/** Letztes Sync-Ergebnis (fuer die Statusanzeige). */
export function getLastSyncResult(): SyncResult | null {
  return lastResult ? { ...lastResult } : null;
}

/** Engine-State zuruecksetzen (Tests / Logout). */
export function resetCloudSync(): void {
  activeConfig = null;
  localRegistry.clear();
  conflictRegistry.clear();
  lastResult = null;
}

function requireConfig(): CloudConfig {
  if (!activeConfig) throw new Error('Cloud-Sync ist nicht konfiguriert (configureCloudSync fehlt).');
  if (!activeConfig.accessToken) throw new Error('Access-Token fehlt.');
  return activeConfig;
}

function folder(cfg: CloudConfig): string {
  return (cfg.syncFolder || '/').replace(/\/+$/, '') || '/';
}

function authHeaders(cfg: CloudConfig): Record<string, string> {
  return { Authorization: `Bearer ${cfg.accessToken}` };
}

interface EndpointSet {
  upload: (name: string) => { url: string; method: string; headers: Record<string, string> };
  download: (name: string) => { url: string; headers: Record<string, string> };
  list: () => { url: string; method: string; headers: Record<string, string>; body?: string };
  ping: () => { url: string; method: string; headers: Record<string, string>; body?: string };
}

function endpoints(cfg: CloudConfig): EndpointSet {
  const base = folder(cfg);
  const auth = authHeaders(cfg);
  switch (cfg.provider) {
    case 'dropbox': {
      const arg = (path: string) => JSON.stringify({ path: `${base}/${path}`.replace(/\/+/g, '/') });
      return {
        upload: (name) => ({
          url: 'https://content.dropboxapi.com/2/files/upload',
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: `${base}/${name}`.replace(/\/+/g, '/'), mode: 'overwrite' }) },
        }),
        download: (name) => ({
          url: 'https://content.dropboxapi.com/2/files/download',
          method: 'POST',
          headers: { ...auth, 'Dropbox-API-Arg': arg(name) },
        }),
        list: () => ({
          url: 'https://api.dropboxapi.com/2/files/list_folder',
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: base === '/' ? '' : base }),
        }),
        ping: () => ({
          url: 'https://api.dropboxapi.com/2/users/get_current_account',
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: 'null',
        }),
      };
    }
    case 'google-drive':
      return {
        upload: (name) => ({
          url: `https://www.googleapis.com/upload/drive/v3/files?uploadType=media&fields=id,modifiedTime&name=${encodeURIComponent(name)}`,
          method: 'POST',
          headers: { ...auth, 'Content-Type': 'application/json' },
        }),
        download: (name) => ({
          url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(name)}?alt=media`,
          method: 'GET',
          headers: { ...auth },
        }),
        list: () => ({
          url: `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${base}' in parents`)}&fields=files(id,name,modifiedTime)`,
          method: 'GET',
          headers: { ...auth },
        }),
        ping: () => ({
          url: 'https://www.googleapis.com/drive/v3/about?fields=user',
          method: 'GET',
          headers: { ...auth },
        }),
      };
    case 'onedrive':
      return {
        upload: (name) => ({
          url: `https://graph.microsoft.com/v1.0/me/drive/root:${base}/${name}:/content`,
          method: 'PUT',
          headers: { ...auth, 'Content-Type': 'application/json' },
        }),
        download: (name) => ({
          url: `https://graph.microsoft.com/v1.0/me/drive/root:${base}/${name}:/content`,
          method: 'GET',
          headers: { ...auth },
        }),
        list: () => ({
          url: `https://graph.microsoft.com/v1.0/me/drive/root:${base}:/children?$select=name,lastModifiedDateTime`,
          method: 'GET',
          headers: { ...auth },
        }),
        ping: () => ({
          url: 'https://graph.microsoft.com/v1.0/me/drive',
          method: 'GET',
          headers: { ...auth },
        }),
      };
    case 'webdav':
      return {
        upload: (name) => ({
          url: `${base}/${name}`,
          method: 'PUT',
          headers: { ...auth, 'Content-Type': 'application/json' },
        }),
        download: (name) => ({
          url: `${base}/${name}`,
          method: 'GET',
          headers: { ...auth },
        }),
        list: () => ({
          url: base,
          method: 'PROPFIND',
          headers: { ...auth, Depth: '1', 'Content-Type': 'application/xml' },
          body: '<?xml version="1.0"?><propfind xmlns="DAV:"><prop><getlastmodified/><displayname/></prop></propfind>',
        }),
        ping: () => ({
          url: base,
          method: 'PROPFIND',
          headers: { ...auth, Depth: '0' },
        }),
      };
  }
}

async function throwIfHttpError(res: Response, what: string): Promise<void> {
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.text()).slice(0, 200);
    } catch {
      detail = '';
    }
    throw new Error(`${what} fehlgeschlagen (HTTP ${res.status}${detail ? `: ${detail}` : ''}).`);
  }
}

/** Projekt hochladen (ueberschreibt den Remote-Stand). */
export async function uploadProject(projectId: string): Promise<void> {
  const cfg = requireConfig();
  const local = localRegistry.get(projectId);
  if (!local) throw new Error(`Lokales Projekt "${projectId}" unbekannt.`);
  const ep = endpoints(cfg).upload(`${projectId}.aiw.json`);
  const res = await fetch(ep.url, { method: ep.method, headers: ep.headers, body: local.content });
  await throwIfHttpError(res, `Upload von "${projectId}"`);
}

/** Projekt herunterladen (ueberschreibt den lokalen Stand). */
export async function downloadProject(projectId: string): Promise<void> {
  const cfg = requireConfig();
  const ep = endpoints(cfg).download(`${projectId}.aiw.json`);
  const res = await fetch(ep.url, { method: ep.method ?? 'GET', headers: ep.headers });
  await throwIfHttpError(res, `Download von "${projectId}"`);
  const content = await res.text();
  const modifiedHeader = res.headers?.get?.('last-modified') ?? res.headers?.get?.('Last-Modified');
  const modified = modifiedHeader ? Date.parse(modifiedHeader) : Date.now();
  localRegistry.set(projectId, { content, modified: Number.isNaN(modified) ? Date.now() : modified });
}

/** Remote-Dateien auflisten (Name + Aenderungszeitpunkt). */
export async function getRemoteFiles(): Promise<{ name: string; modified: number }[]> {
  const cfg = requireConfig();
  const ep = endpoints(cfg).list();
  const res = await fetch(ep.url, { method: ep.method, headers: ep.headers, body: ep.body });
  await throwIfHttpError(res, 'Remote-Dateiliste');
  const contentType = res.headers?.get?.('content-type') ?? '';
  const text = await res.text();
  // Dropbox list_folder: { entries: [{ name, server_modified }] }
  // Drive: { files: [{ name, modifiedTime }] } — OneDrive: { value: [{ name, lastModifiedDateTime }]}
  if (contentType.includes('json') || text.trimStart().startsWith('{')) {
    try {
      const json = JSON.parse(text) as {
        entries?: { name?: string; server_modified?: string }[];
        files?: { name?: string; modifiedTime?: string }[];
        value?: { name?: string; lastModifiedDateTime?: string }[];
      };
      const pick = (name: string | undefined, ts: string | undefined) => ({
        name: name ?? '',
        modified: ts ? Date.parse(ts) : Date.now(),
      });
      if (Array.isArray(json.entries)) return json.entries.map((e) => pick(e.name, e.server_modified)).filter((e) => e.name);
      if (Array.isArray(json.files)) return json.files.map((e) => pick(e.name, e.modifiedTime)).filter((e) => e.name);
      if (Array.isArray(json.value)) return json.value.map((e) => pick(e.name, e.lastModifiedDateTime)).filter((e) => e.name);
    } catch {
      // faellt unten auf XML-Parsing zurueck
    }
  }
  // WebDAV PROPFIND (multistatus-XML): displayname + getlastmodified extrahieren.
  const out: { name: string; modified: number }[] = [];
  const responses = text.match(/<[^>]*response>[\s\S]*?<\/[^>]*response>/gi) ?? [];
  for (const r of responses) {
    const name = r.match(/<[^>]*displayname>([^<]*)<\/[^>]*displayname>/i)?.[1]?.trim();
    const lm = r.match(/<[^>]*getlastmodified>([^<]*)<\/[^>]*getlastmodified>/i)?.[1]?.trim();
    if (name) out.push({ name, modified: lm ? Date.parse(lm) : Date.now() });
  }
  return out;
}

/** Alle Projekte synchronisieren: hoch/runter nach Neuheit, Konflikte zaehlen. */
export async function syncAll(): Promise<SyncResult> {
  const cfg = requireConfig();
  void cfg;
  const remote = await getRemoteFiles();
  const remoteByBase = new Map(remote.map((f) => [f.name.replace(/\.aiw\.json$/, ''), f]));
  let uploaded = 0;
  let downloaded = 0;
  let conflicts = 0;
  // Lokal -> remote: neu oder fehlend => hochladen.
  for (const [id, local] of localRegistry) {
    const r = remoteByBase.get(id);
    if (!r) {
      await uploadProject(id);
      uploaded++;
    } else if (Math.abs(local.modified - r.modified) > 1000) {
      // Beide Seiten geaendert und ungleich alt => Konflikt (kein stilles Ueberschreiben).
      conflictRegistry.set(id, { projectId: id, localModified: local.modified, remoteModified: r.modified, detectedAt: Date.now() });
      conflicts++;
    }
  }
  // Remote -> lokal: nur remote vorhanden => herunterladen.
  for (const [id, r] of remoteByBase) {
    if (!localRegistry.has(id)) {
      void r;
      await downloadProject(id);
      downloaded++;
    }
  }
  lastResult = { uploaded, downloaded, conflicts, lastSync: Date.now() };
  return { ...lastResult };
}

/** Konflikt loesen: local = hochladen, remote = herunterladen, merge = vereinen + hochladen. */
export async function resolveConflict(projectId: string, strategy: 'local' | 'remote' | 'merge'): Promise<void> {
  const conflict = conflictRegistry.get(projectId);
  if (!conflict) throw new Error(`Kein offener Konflikt fuer "${projectId}".`);
  if (strategy === 'local') {
    await uploadProject(projectId);
  } else if (strategy === 'remote') {
    await downloadProject(projectId);
  } else {
    const local = localRegistry.get(projectId);
    if (!local) throw new Error(`Lokales Projekt "${projectId}" unbekannt.`);
    const cfg = requireConfig();
    const ep = endpoints(cfg).download(`${projectId}.aiw.json`);
    const res = await fetch(ep.url, { method: ep.method ?? 'GET', headers: ep.headers });
    await throwIfHttpError(res, `Download von "${projectId}" (Merge)`);
    const remoteContent = await res.text();
    // Zeilenbasierter Merge ohne Ueberschneidung: gemeinsame Zeilen einmal, Rest beider Seiten.
    const localLines = local.content.split('\n');
    const remoteLines = remoteContent.split('\n');
    const seen = new Set(localLines);
    const merged = [...localLines, ...remoteLines.filter((l) => !seen.has(l))].join('\n');
    localRegistry.set(projectId, { content: merged, modified: Date.now() });
    await uploadProject(projectId);
  }
  conflictRegistry.delete(projectId);
}

/** Verbindung testen (billiger Ping je Provider). */
export async function testConnection(config: CloudConfig): Promise<boolean> {
  try {
    if (!config.accessToken) return false;
    const ep = endpoints(config).ping();
    const res = await fetch(ep.url, { method: ep.method, headers: ep.headers, body: ep.body });
    return res.ok;
  } catch {
    return false;
  }
}
