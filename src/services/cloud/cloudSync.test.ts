// Cloud-Sync-Engine-Tests (Sprint 24, Agent 1): Upload/Download/Verbindung/
// Sync-Logik ueber gemocktes globales fetch (vi.stubGlobal).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  configureCloudSync,
  registerLocalProject,
  getLocalProject,
  uploadProject,
  downloadProject,
  getRemoteFiles,
  syncAll,
  resolveConflict,
  testConnection,
  resetCloudSync,
  type CloudConfig,
} from "./cloudSync";

const DROPBOX_CFG: CloudConfig = {
  provider: "dropbox",
  accessToken: "token-123",
  syncFolder: "/Apps/Writer",
  autoSync: false,
  syncInterval: 15,
};

function okResp(body: string, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "application/json", ...headers } });
}

beforeEach(() => {
  resetCloudSync();
  configureCloudSync(DROPBOX_CFG);
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T10:00:00Z"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("cloudSync.uploadProject (fetch gemockt)", () => {
  it("POSTet an den Dropbox-Upload-Endpunkt mit Bearer-Token", async () => {
    registerLocalProject("p1", '{"title":"Test"}');
    const fetchMock = vi.fn(async () => okResp("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await uploadProject("p1");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://content.dropboxapi.com/2/files/upload");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-123");
    expect(init.body).toBe('{"title":"Test"}');
  });

  it("wirft bei HTTP-Fehler und unbekanntem Projekt", async () => {
    registerLocalProject("p1", "x");
    vi.stubGlobal("fetch", vi.fn(async () => okResp("rate_limited", {}, 429)));
    await expect(uploadProject("p1")).rejects.toThrow(/429/);
    await expect(uploadProject("unbekannt")).rejects.toThrow(/unbekannt/);
  });
});

describe("cloudSync.downloadProject (fetch gemockt)", () => {
  it("schreibt den Remote-Inhalt in die lokale Registry", async () => {
    const fetchMock = vi.fn(async () => okResp('{"title":"Remote"}'));
    vi.stubGlobal("fetch", fetchMock);
    await downloadProject("p2");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://content.dropboxapi.com/2/files/download");
    expect(getLocalProject("p2")?.content).toBe('{"title":"Remote"}');
  });
});

describe("cloudSync.testConnection", () => {
  it("erwartet true bei erreichbarem Provider", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResp('{"account_id":"a"}')));
    await expect(testConnection(DROPBOX_CFG)).resolves.toBe(true);
  });

  it("liefert false bei Netzfehler oder leerem Token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    await expect(testConnection(DROPBOX_CFG)).resolves.toBe(false);
    await expect(testConnection({ ...DROPBOX_CFG, accessToken: "" })).resolves.toBe(false);
  });
});

describe("cloudSync.syncAll + getRemoteFiles", () => {
  it("laedt fehlende Remote-Projekte hoch und meldet Konflikte", async () => {
    registerLocalProject("neu", "inhalt", Date.parse("2026-09-08T10:00:00Z"));
    registerLocalProject("alt", "inhalt", Date.parse("2026-09-08T10:00:00Z"));
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("list_folder")) {
        return okResp(JSON.stringify({ entries: [{ name: "alt.aiw.json", server_modified: "2026-09-01T10:00:00Z" }] }));
      }
      return okResp("{}");
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const result = await syncAll();
    expect(result.uploaded).toBe(1); // "neu" fehlt remote
    expect(result.conflicts).toBe(1); // "alt" beidseitig unterschiedlich
    expect(result.downloaded).toBe(0);
    expect(result.lastSync).toBe(Date.parse("2026-09-08T10:00:00Z"));
  });

  it("resolveConflict mit remote-Strategie laedt herunter und schliesst den Konflikt", async () => {
    registerLocalProject("k", "lokal", Date.parse("2026-09-08T10:00:00Z"));
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("list_folder")) {
        return okResp(JSON.stringify({ entries: [{ name: "k.aiw.json", server_modified: "2026-09-05T10:00:00Z" }] }));
      }
      return okResp("remote-inhalt");
    }) as unknown as typeof fetch);
    const synced = await syncAll();
    expect(synced.conflicts).toBe(1);
    await resolveConflict("k", "remote");
    expect(getLocalProject("k")?.content).toBe("remote-inhalt");
  });
});
