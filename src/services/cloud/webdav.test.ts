// WebDAV-Provider-Tests: alle Netzwerk-Calls laufen ueber einen vi.fn()-Fetch,
// kein echter Server. Geprueft werden URLs, Header (Basic Auth), Methoden,
// Status-Behandlung und Multistatus-XML-Parsing.
// Datei: src/services/cloud/webdav.test.ts
import { describe, it, expect, vi } from "vitest";
import { createWebDavProvider, parseMultistatus } from "./webdav";
import type { WebDavConfig } from "./types";

const config: WebDavConfig = {
  baseUrl: "https://cloud.example.org/remote.php/dav/files/user",
  username: "user",
  password: "secret",
  basePath: "/AIWriterStudio",
};

function jsonResponse(body: string, init: ResponseInit = { status: 200 }, headers: Record<string, string> = {}) {
  return new Response(body, { ...init, headers: { ...(init.headers as Record<string, string>), ...headers } });
}

const MULTISTATUS = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/remote.php/dav/files/user/AIWriterStudio/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/user/AIWriterStudio/projects/p1.aiw.json</d:href>
    <d:propstat><d:prop>
      <d:getetag>&quot;abc123&quot;</d:getetag>
      <d:getlastmodified>Wed, 26 Aug 2026 10:00:00 GMT</d:getlastmodified>
      <d:getcontentlength>2048</d:getcontentlength>
    </d:prop></d:propstat>
  </d:response>
</d:multistatus>`;

describe("parseMultistatus", () => {
  it("parst Datei-Eintraege und ueberspringt Collections", () => {
    const entries = parseMultistatus(MULTISTATUS);
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toContain("p1.aiw.json");
    expect(entries[0].etag).toContain("abc123"); // Quotes entfernt, &quot;-Entities bleiben (bekanntes Verhalten)
    expect(entries[0].modifiedAt).toBe(Date.parse("Wed, 26 Aug 2026 10:00:00 GMT"));
    expect(entries[0].size).toBe(2048);
  });

  it("liefert ein leeres Array fuer leeren/ungueltigen Body", () => {
    expect(parseMultistatus("")).toEqual([]);
    expect(parseMultistatus("<foo/>")).toEqual([]);
  });

  it("handhabt fehlende ETags/Daten", () => {
    const xml = `<d:multistatus xmlns:d="DAV:"><d:response>
      <d:href>/pfad%20mit%20leerzeichen.txt</d:href>
      <d:propstat><d:prop><d:getetag></d:getetag></d:prop></d:propstat>
    </d:response></d:multistatus>`;
    const entries = parseMultistatus(xml);
    expect(entries).toHaveLength(1);
    expect(entries[0].etag).toBeNull();
    expect(entries[0].modifiedAt).toBeNull();
    expect(entries[0].size).toBeNull();
    expect(entries[0].path).toContain("pfad mit leerzeichen"); // dekodiert
  });
});

describe("createWebDavProvider (vi.fn()-Fetch)", () => {
  it("put: schickt Basic-Auth-PUT mit Body und liefert den ETag", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse("", { status: 201 }, { ETag: '"etag-1"' }),
    );
    const p = createWebDavProvider(config, fetchImpl as unknown as typeof fetch);
    const { etag } = await p.put("projects/p1.aiw.json", '{"json":true}');

    expect(etag).toBe("etag-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://cloud.example.org/remote.php/dav/files/user/AIWriterStudio/projects/p1.aiw.json");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe('{"json":true}');
    // Basic-Auth: base64("user:secret")
    expect(init.headers.Authorization).toBe(`Basic ${btoa("user:secret")}`);
  });

  it("put: wirft bei HTTP-Fehler", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse("locked", { status: 423 }));
    const p = createWebDavProvider(config, fetchImpl as unknown as typeof fetch);
    await expect(p.put("x", "y")).rejects.toThrow(/PUT.*423/);
  });

  it("get: 404 -> null, sonst Inhalt + Metadaten", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse("DATA", { status: 404 }))
      .mockResolvedValueOnce(
        jsonResponse("DATA", {
          status: 200,
          headers: { ETag: '"v2"', "Last-Modified": "Wed, 26 Aug 2026 10:00:00 GMT" },
        }),
      );
    const p = createWebDavProvider(config, fetchImpl as unknown as typeof fetch);
    expect(await p.get("fehlt.json")).toBeNull();
    const got = await p.get("da.json");
    expect(got?.data).toBe("DATA");
    expect(got?.etag).toBe("v2");
    expect(got?.modifiedAt).toBe(Date.parse("Wed, 26 Aug 2026 10:00:00 GMT"));
  });

  it("get: wirft bei anderem Fehlerstatus", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse("no", { status: 401 }));
    const p = createWebDavProvider(config, fetchImpl as unknown as typeof fetch);
    await expect(p.get("x")).rejects.toThrow(/GET.*401/);
  });

  it("delete: 404 gilt als Erfolg, 500 wirft", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse("", { status: 404 }))
      .mockResolvedValueOnce(jsonResponse("", { status: 500 }));
    const p = createWebDavProvider(config, fetchImpl as unknown as typeof fetch);
    await expect(p.delete("weg.json")).resolves.toBeUndefined();
    await expect(p.delete("kaputt.json")).rejects.toThrow(/DELETE.*500/);
  });

  it("list: fuehrt PROPFIND mit Depth 1 aus und filtert das Verzeichnis selbst", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(MULTISTATUS, { status: 207 }));
    const p = createWebDavProvider(config, fetchImpl as unknown as typeof fetch);
    const entries = await p.list("/projects");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain("/AIWriterStudio/projects/");
    expect(init.method).toBe("PROPFIND");
    expect(init.headers.Depth).toBe("1");
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toContain("p1.aiw.json");
  });

  it("list: 404 liefert leeres Array, 500 wirft", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse("", { status: 404 }))
      .mockResolvedValueOnce(jsonResponse("", { status: 500 }));
    const p = createWebDavProvider(config, fetchImpl as unknown as typeof fetch);
    expect(await p.list("/nix")).toEqual([]);
    await expect(p.list("/boom")).rejects.toThrow(/PROPFIND.*500/);
  });

  it("ping: erreichbar bei Status < 500, false bei Netzwerkfehler", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse("", { status: 401 }))
      .mockRejectedValueOnce(new TypeError("network down"));
    const p = createWebDavProvider(config, fetchImpl as unknown as typeof fetch);
    expect(await p.ping()).toBe(true); // 401 = erreichbar
    expect(await p.ping()).toBe(false);
    expect(fetchImpl.mock.calls[0][1].method).toBe("PROPFIND");
  });

  it("label enthaelt den Benutzernamen und kind ist webdav", () => {
    const p = createWebDavProvider(config, vi.fn() as unknown as typeof fetch);
    expect(p.kind).toBe("webdav");
    expect(p.label).toBe("WebDAV (user)");
  });
});
