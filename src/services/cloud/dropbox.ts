// Dropbox-Provider über die HTTP-API v2 (content + rpc Endpunkte).
// Benötigt ein OAuth2-Access-Token mit files.content.read/write Scope.
// Datei: src/services/cloud/dropbox.ts
import type { SyncProvider, RemoteEntry, DropboxConfig } from "./types";

const API_BASE = "https://api.dropboxapi.com/2";
const CONTENT_BASE = "https://content.dropboxapi.com/2";

/** Dropbox-Pfad muss mit "/" beginnen und ist case-sensitiv. */
function dbPath(config: DropboxConfig, path: string): string {
  const base = (config.basePath ?? "").replace(/\/+$/, "");
  const p = "/" + (base + "/" + path).replace(/^\/+|\/+$/g, "");
  return p === "/" ? "/" : p;
}

interface DropboxMetadata {
  /** content_hash dient als ETag-Ersatz. */
  content_hash?: string;
  server_modified?: string;
  size?: number;
  path_lower?: string;
  ".tag"?: string;
  entries?: DropboxMetadata[];
}

function metaToEntry(m: DropboxMetadata): RemoteEntry {
  return {
    path: m.path_lower ?? "",
    etag: m.content_hash ?? null,
    modifiedAt: m.server_modified ? Date.parse(m.server_modified) : null,
    size: m.size ?? null,
  };
}

export function createDropboxProvider(config: DropboxConfig, fetchImpl: typeof fetch = fetch): SyncProvider {
  const rpcHeaders = (): Record<string, string> => ({
    Authorization: `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
  });

  return {
    kind: "dropbox",
    label: "Dropbox",

    async put(path, data) {
      // content.upload: Metadaten im Dropbox-API-Arg-Header, Body = Rohdaten.
      const arg = { path: dbPath(config, path), mode: "overwrite", mute: true };
      const res = await fetchImpl(`${CONTENT_BASE}/files/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Dropbox-API-Arg": JSON.stringify(arg),
          "Content-Type": "application/octet-stream",
        },
        body: data,
      });
      if (!res.ok) throw new Error(`Dropbox upload ${path} fehlgeschlagen: HTTP ${res.status} (${await res.text()})`);
      const meta = (await res.json()) as DropboxMetadata;
      return { etag: meta.content_hash ?? null };
    },

    async get(path) {
      const res = await fetchImpl(`${CONTENT_BASE}/files/download`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Dropbox-API-Arg": JSON.stringify({ path: dbPath(config, path) }),
        },
      });
      if (res.status === 409 || res.status === 404) return null; // path/not_found → 409 bei Dropbox
      if (!res.ok) throw new Error(`Dropbox download ${path} fehlgeschlagen: HTTP ${res.status}`);
      const meta = JSON.parse(res.headers.get("Dropbox-API-Result") ?? "{}") as DropboxMetadata;
      return {
        data: await res.text(),
        etag: meta.content_hash ?? null,
        modifiedAt: meta.server_modified ? Date.parse(meta.server_modified) : null,
      };
    },

    async delete(path) {
      const res = await fetchImpl(`${API_BASE}/files/delete_v2`, {
        method: "POST",
        headers: rpcHeaders(),
        body: JSON.stringify({ path: dbPath(config, path) }),
      });
      // 409 = path/not_found → idempotent als Erfolg werten.
      if (!res.ok && res.status !== 409) {
        throw new Error(`Dropbox delete ${path} fehlgeschlagen: HTTP ${res.status}`);
      }
    },

    async list(prefix) {
      const dir = dbPath(config, prefix.endsWith("/") ? prefix : prefix + "/");
      const res = await fetchImpl(`${API_BASE}/files/list_folder`, {
        method: "POST",
        headers: rpcHeaders(),
        body: JSON.stringify({ path: dir === "/" ? "" : dir, recursive: false, include_deleted: false }),
      });
      if (res.status === 409) return []; // Ordner existiert noch nicht
      if (!res.ok) throw new Error(`Dropbox list_folder fehlgeschlagen: HTTP ${res.status}`);
      const body = (await res.json()) as { entries: DropboxMetadata[] };
      return (body.entries ?? [])
        .filter((e) => e[".tag"] === "file")
        .map(metaToEntry);
    },

    async ping() {
      try {
        const res = await fetchImpl(`${API_BASE}/users/get_current_account`, {
          method: "POST",
          headers: rpcHeaders(),
          body: "null",
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
