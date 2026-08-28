// Dropbox-Provider-Tests: API- und Content-Endpunkte ueber vi.fn()-Fetch.
// Datei: src/services/cloud/dropbox.test.ts
import { describe, it, expect, vi } from "vitest";
import { createDropboxProvider } from "./dropbox";
import type { DropboxConfig } from "./types";

const config: DropboxConfig = { accessToken: "token-123", basePath: "/Apps/Writer" };

function jsonResp(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
}

describe("createDropboxProvider (vi.fn()-Fetch)", () => {
  it("put: upload mit Dropbox-API-Arg-Header, liefert content_hash", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResp({ content_hash: "hash-1", path_lower: "/apps/writer/p1.aiw.json", size: 10 }),
    );
    const p = createDropboxProvider(config, fetchImpl as unknown as typeof fetch);
    const { etag } = await p.put("p1.aiw.json", "INHALT");

    expect(etag).toBe("hash-1");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://content.dropboxapi.com/2/files/upload");
    expect(init.method).toBe("POST");
    expect(init.body).toBe("INHALT");
    expect(init.headers.Authorization).toBe("Bearer token-123");
    const arg = JSON.parse(init.headers["Dropbox-API-Arg"]);
    expect(arg.path).toBe("/Apps/Writer/p1.aiw.json"); // basePath eingearbeitet, fuehrender Slash
    expect(arg.mode).toBe("overwrite");
  });

  it("put: wirft bei HTTP-Fehler inkl. Antworttext", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResp("rate_limited", 429));
    const p = createDropboxProvider(config, fetchImpl as unknown as typeof fetch);
    await expect(p.put("x", "y")).rejects.toThrow(/429/);
  });

  it("get: 409 (path/not_found) -> null", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResp({ error: "path/not_found" }, 409));
    const p = createDropboxProvider(config, fetchImpl as unknown as typeof fetch);
    expect(await p.get("fehlt.json")).toBeNull();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://content.dropboxapi.com/2/files/download");
    expect(JSON.parse(init.headers["Dropbox-API-Arg"]).path).toBe("/Apps/Writer/fehlt.json");
  });

  it("get: Erfolg liest Dropbox-API-Result-Header als Metadaten", async () => {
    const meta = { content_hash: "hash-2", server_modified: "2026-08-26T10:00:00Z", size: 42 };
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResp("INHALT", 200, { "Dropbox-API-Result": JSON.stringify(meta) }),
    );
    const p = createDropboxProvider(config, fetchImpl as unknown as typeof fetch);
    const got = await p.get("da.json");
    expect(got?.data).toBe("INHALT");
    expect(got?.etag).toBe("hash-2");
    expect(got?.modifiedAt).toBe(Date.parse("2026-08-26T10:00:00Z"));
  });

  it("get: anderer Fehler wirft", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResp("nope", 401));
    const p = createDropboxProvider(config, fetchImpl as unknown as typeof fetch);
    await expect(p.get("x")).rejects.toThrow(/401/);
  });

  it("delete: 409 (not found) ist idempotent, anderer Fehler wirft", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResp({}, 200))
      .mockResolvedValueOnce(jsonResp({ error: "path/not_found" }, 409))
      .mockResolvedValueOnce(jsonResp("err", 500));
    const p = createDropboxProvider(config, fetchImpl as unknown as typeof fetch);
    await expect(p.delete("a")).resolves.toBeUndefined();
    await expect(p.delete("b")).resolves.toBeUndefined();
    await expect(p.delete("c")).rejects.toThrow(/500/);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.dropboxapi.com/2/files/delete_v2");
    expect(JSON.parse(init.body).path).toBe("/Apps/Writer/a");
  });

  it("list: filtert auf .tag=file und bildet RemoteEntries", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResp({
        entries: [
          { ".tag": "file", path_lower: "/apps/writer/p1.aiw.json", content_hash: "h1", size: 7, server_modified: "2026-08-26T00:00:00Z" },
          { ".tag": "folder", path_lower: "/apps/writer/ordner" },
        ],
      }),
    );
    const p = createDropboxProvider(config, fetchImpl as unknown as typeof fetch);
    const entries = await p.list("");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.dropboxapi.com/2/files/list_folder");
    expect(JSON.parse(init.body).path).toBe("/Apps/Writer"); // dbPath entfernt den trailing Slash
    expect(entries).toHaveLength(1);
    expect(entries[0].etag).toBe("h1");
    expect(entries[0].size).toBe(7);
  });

  it("list: 409 (Ordner fehlt) -> leeres Array, 500 wirft", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResp({ error: "path/not_found" }, 409))
      .mockResolvedValueOnce(jsonResp("err", 500));
    const p = createDropboxProvider(config, fetchImpl as unknown as typeof fetch);
    expect(await p.list("/nix")).toEqual([]);
    await expect(p.list("/boom")).rejects.toThrow(/list_folder.*500/);
  });

  it("ping: get_current_account entscheidet, Netzwerkfehler -> false", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResp({ account_id: "x" }))
      .mockResolvedValueOnce(jsonResp("", 401))
      .mockRejectedValueOnce(new TypeError("down"));
    const p = createDropboxProvider(config, fetchImpl as unknown as typeof fetch);
    expect(await p.ping()).toBe(true);
    expect(await p.ping()).toBe(false);
    expect(await p.ping()).toBe(false);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.dropboxapi.com/2/users/get_current_account");
  });

  it("kind/label und Pfad-Normalisierung ohne basePath", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResp({}, 200));
    const p = createDropboxProvider({ accessToken: "t" }, fetchImpl as unknown as typeof fetch);
    expect(p.kind).toBe("dropbox");
    expect(p.label).toBe("Dropbox");
    await p.delete("datei.json");
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).path).toBe("/datei.json");
  });
});
