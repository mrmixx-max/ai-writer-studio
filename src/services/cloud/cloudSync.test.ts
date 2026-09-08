// Engine-Tests: Cloud-Sync (Sprint 24, Agent 1) — fetch wird injiziert,
// kein Netz. Datei: src/services/cloud/cloudSync.test.ts
import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  __resetCloudSyncState,
  __seedLocalProject,
  __getLocalProject,
  configureCloudSync,
  setCloudFetch,
  uploadProject,
  downloadProject,
  getRemoteFiles,
  syncAll,
  resolveConflict,
  testConnection,
  type CloudConfig,
} from "./cloudSync";

const CFG: CloudConfig = {
  provider: "dropbox",
  accessToken: "token-123",
  syncFolder: "/AIWriterStudio",
  autoSync: false,
  syncInterval: 15,
};

/** Minimaler Response-Stub (ok/json/text/headers/status). */
function stubResponse(opts: {
  ok: boolean;
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
}): Response {
  return {
    ok: opts.ok,
    status: opts.status ?? (opts.ok ? 200 : 500),
    json: async () => opts.json ?? {},
    text: async () => opts.text ?? "",
    headers: new Headers(opts.headers ?? {}),
  } as unknown as Response;
}

beforeEach(() => {
  __resetCloudSyncState();
  configureCloudSync(CFG);
  setCloudFetch(null);
});

describe("uploadProject", () => {
  it("sendet PUT/POST an den Provider-Endpunkt (fetch gemockt)", async () => {
    __seedLocalProject("p1", "lokaler Inhalt");
    const fetchMock = vi.fn(async () => stubResponse({ ok: true }));
    setCloudFetch(fetchMock as unknown as typeof fetch);
    await uploadProject("p1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("dropboxapi.com");
    expect(init.method).toBe("POST");
    expect(init.body as string).toContain("p1");
  });
});

describe("downloadProject", () => {
  it("ueberschreibt den lokalen Stand mit der Remote-Version", async () => {
    __seedLocalProject("p1", "alt");
    const fetchMock = vi.fn(async () =>
      stubResponse({ ok: true, text: "REMOTE-INHALT" }),
    );
    setCloudFetch(fetchMock as unknown as typeof fetch);
    await downloadProject("p1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(__getLocalProject("p1")?.content).toBe("REMOTE-INHALT");
  });

  it("wirft, wenn das Projekt remote nicht existiert (404)", async () => {
    const fetchMock = vi.fn(async () => stubResponse({ ok: false, status: 404 }));
    setCloudFetch(fetchMock as unknown as typeof fetch);
    await expect(downloadProject("missing")).rejects.toThrow(/existiert nicht remote/);
  });
});

describe("testConnection", () => {
  it("erwartet true bei 2xx-Antwort", async () => {
    const fetchMock = vi.fn(async () => stubResponse({ ok: true }));
    setCloudFetch(fetchMock as unknown as typeof fetch);
    await expect(testConnection(CFG)).resolves.toBe(true);
  });

  it("liefert false bei Netzfehler statt zu werfen", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    setCloudFetch(fetchMock as unknown as typeof fetch);
    await expect(testConnection(CFG)).resolves.toBe(false);
  });
});

describe("syncAll / resolveConflict", () => {
  it("laedt lokale Projekte hoch, die remote fehlen", async () => {
    __seedLocalProject("p1", "inhalt");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("list_folder")) {
        return stubResponse({ ok: true, json: { entries: [] } });
      }
      return stubResponse({ ok: true });
    });
    setCloudFetch(fetchMock as unknown as typeof fetch);
    const r = await syncAll();
    expect(r.uploaded).toBe(1);
    expect(r.downloaded).toBe(0);
    expect(typeof r.lastSync).toBe("number");
  });

  it("resolveConflict mit 'local' pusht den lokalen Stand", async () => {
    __seedLocalProject("p1", "lokal");
    const fetchMock = vi.fn(async () => stubResponse({ ok: true }));
    setCloudFetch(fetchMock as unknown as typeof fetch);
    await resolveConflict("p1", "local");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("getRemoteFiles listet Remote-Dateien normalisiert", async () => {
    const fetchMock = vi.fn(async () =>
      stubResponse({ ok: true, json: { entries: [{ name: "buch.aiw.json", modified: 12345 }] } }),
    );
    setCloudFetch(fetchMock as unknown as typeof fetch);
    const files = await getRemoteFiles();
    expect(files).toEqual([{ name: "buch", modified: 12345 }]);
  });
});
