// WebDAV/Nextcloud-Provider: PUT/GET/DELETE/PROPFIND über fetch mit Basic Auth.
// Funktioniert gegen Nextcloud (remote.php/dav/files/<user>) und jeden
// RFC-4918-WebDAV-Server. Keine Dependencies — nur fetch (Tauri v2 WebView
// erlaubt CORS-freie Requests gegen Tauri-HTTP-Whitelist bzw. http plugin).
// Datei: src/services/cloud/webdav.ts
import type { SyncProvider, RemoteEntry, WebDavConfig } from "./types";

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

/** Normalisiere Projektpfad relativ zur konfigurierten basePath. */
function fullUrl(config: WebDavConfig, path: string): string {
  const base = config.basePath ? joinUrl(config.baseUrl, config.basePath) : config.baseUrl;
  return joinUrl(base, path);
}

function basicAuthHeader(config: WebDavConfig): string {
  // btoa ist in Tauri-WebView, Browser und Node >= 16 verfügbar.
  const raw = `${config.username}:${config.password}`;
  return "Basic " + (typeof btoa === "function" ? btoa(raw) : Buffer.from(raw, "binary").toString("base64"));
}

/** ETag aus Response-Headern (case-insensitive). */
function etagOf(res: Response): string | null {
  return res.headers.get("etag") ?? res.headers.get("ETag") ?? null;
}

/** Datum aus Last-Modified-Header → ms. */
function lastModifiedOf(res: Response): number | null {
  const v = res.headers.get("last-modified") ?? res.headers.get("Last-Modified");
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

/**
 * Parst die WebDAV-Multistatus-XML-Antwort von PROPFIND ohne DOMParser-
 * Abhängigkeit (happy-dom/node-safe): einfacher Regex-Scan über <d:response>-
 * Blöcke. Reicht für href + getetag + getlastmodified + getcontentlength.
 */
export function parseMultistatus(xml: string): RemoteEntry[] {
  const entries: RemoteEntry[] = [];
  const responseBlocks = xml.match(/<(?:\w+:)?response[\s>][\s\S]*?<\/(?:\w+:)?response>/g) ?? [];
  for (const block of responseBlocks) {
    const href = block.match(/<(?:\w+:)?href[^>]*>([^<]+)<\/(?:\w+:)?href>/)?.[1] ?? "";
    if (!href) continue;
    if (/<(?:\w+:)?collection\s*\/?>/.test(block)) continue; // Ordner überspringen
    const etag = block.match(/<(?:\w+:)?getetag[^>]*>([^<]*)<\/(?:\w+:)?getetag>/)?.[1] ?? null;
    const lm = block.match(/<(?:\w+:)?getlastmodified[^>]*>([^<]*)<\/(?:\w+:)?getlastmodified>/)?.[1] ?? null;
    const size = block.match(/<(?:\w+:)?getcontentlength[^>]*>(\d+)<\/(?:\w+:)?getcontentlength>/)?.[1] ?? null;
    const modifiedAt = lm && !Number.isNaN(Date.parse(lm)) ? Date.parse(lm) : null;
    // href ist URL-encoded (Nextcloud kodiert Leerzeichen als %20)
    let decoded = href;
    try { decoded = decodeURIComponent(href); } catch { /* bereits dekodiert */ }
    entries.push({
      path: decoded.replace(/\/+$/, ""),
      etag: etag && etag.trim() !== "" ? etag.trim().replace(/"/g, "") : null,
      modifiedAt,
      size: size ? Number(size) : null,
    });
  }
  return entries;
}

export function createWebDavProvider(config: WebDavConfig, fetchImpl: typeof fetch = fetch): SyncProvider {
  const headers = (): Record<string, string> => ({
    Authorization: basicAuthHeader(config),
  });

  return {
    kind: "webdav",
    label: `WebDAV (${config.username})`,

    async put(path, data) {
      const res = await fetchImpl(fullUrl(config, path), {
        method: "PUT",
        headers: { ...headers(), "Content-Type": "application/json; charset=utf-8" },
        body: data,
      });
      if (!res.ok) throw new Error(`WebDAV PUT ${path} fehlgeschlagen: HTTP ${res.status}`);
      return { etag: etagOf(res)?.replace(/"/g, "") ?? null };
    },

    async get(path) {
      const res = await fetchImpl(fullUrl(config, path), { method: "GET", headers: headers() });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`WebDAV GET ${path} fehlgeschlagen: HTTP ${res.status}`);
      return {
        data: await res.text(),
        etag: etagOf(res)?.replace(/"/g, "") ?? null,
        modifiedAt: lastModifiedOf(res),
      };
    },

    async delete(path) {
      const res = await fetchImpl(fullUrl(config, path), { method: "DELETE", headers: headers() });
      if (!res.ok && res.status !== 404) {
        throw new Error(`WebDAV DELETE ${path} fehlgeschlagen: HTTP ${res.status}`);
      }
    },

    async list(prefix) {
      const dir = prefix.endsWith("/") || prefix === "" ? prefix : prefix + "/";
      const res = await fetchImpl(fullUrl(config, dir), {
        method: "PROPFIND",
        headers: { ...headers(), Depth: "1", "Content-Type": "application/xml" },
        body: `<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><d:getlastmodified/><d:getcontentlength/><d:resourcetype/></d:prop></d:propfind>`,
      });
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`WebDAV PROPFIND ${dir} fehlgeschlagen: HTTP ${res.status}`);
      const xml = await res.text();
      const entries = parseMultistatus(xml);
      // Den Verzeichnis-Eintrag selbst ausfiltern (href endet auf dem Verzeichnisnamen).
      return entries.filter((e) => e.path !== fullUrl(config, dir).replace(/^https?:\/\/[^/]+/, ""));
    },

    async ping() {
      try {
        const res = await fetchImpl(fullUrl(config, ""), {
          method: "PROPFIND",
          headers: { ...headers(), Depth: "0" },
        });
        return res.status < 500; // 401/404 heißt erreichbar, aber falsch konfiguriert
      } catch {
        return false;
      }
    },
  };
}
