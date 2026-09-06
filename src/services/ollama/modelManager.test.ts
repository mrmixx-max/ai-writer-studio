// Tests: Ollama-Modell-Manager (Sprint 9, Agent 4).
// NUR Mocks — kein Test zieht oder löscht echte Modelle (fetch ist global gemockt).
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  DEFAULT_OLLAMA_BASE_URL,
  ModelManagerError,
  deleteModel,
  formatModelSize,
  isLowDiskSpace,
  listInstalledModels,
  pullModel,
} from "./modelManager";

function mockFetchOnce(impl: (url: string, init?: RequestInit) => unknown) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => impl(url, init));
  vi.stubGlobal("fetch", fn);
  return fn;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** NDJSON-Stream wie Ollama /api/pull mit stream:true ihn liefert. */
function ndjsonResponse(lines: unknown[]): Response {
  const text = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listInstalledModels", () => {
  it("listet installierte Modelle mit Name und Größe (/api/tags)", async () => {
    const fetchFn = mockFetchOnce(() =>
      jsonResponse({
        models: [
          { name: "llama3.2:latest", size: 2_000_000_000, digest: "abc", modified_at: "2026-01-01T00:00:00Z" },
          { name: "qwen2.5:7b", size: 4_700_000_000 },
        ],
      }),
    );
    const models = await listInstalledModels();
    expect(fetchFn).toHaveBeenCalledWith(
      `${DEFAULT_OLLAMA_BASE_URL}/api/tags`,
      expect.objectContaining({ method: "GET" }),
    );
    expect(models).toHaveLength(2);
    expect(models[0]).toMatchObject({ name: "llama3.2:latest", size: 2_000_000_000 });
    expect(models[1]).toMatchObject({ name: "qwen2.5:7b", size: 4_700_000_000 });
  });

  it("leere Modellliste → leeres Array", async () => {
    mockFetchOnce(() => jsonResponse({ models: [] }));
    await expect(listInstalledModels()).resolves.toEqual([]);
  });

  it("fehlendes models-Feld → leeres Array (kein Crash)", async () => {
    mockFetchOnce(() => jsonResponse({}));
    await expect(listInstalledModels()).resolves.toEqual([]);
  });

  it("HTTP-Fehler (500) → ModelManagerError", async () => {
    mockFetchOnce(() => jsonResponse({ error: "boom" }, 500));
    await expect(listInstalledModels()).rejects.toBeInstanceOf(ModelManagerError);
  });

  it("nicht erreichbarer Server → ModelManagerError mit Start-Hinweis", async () => {
    mockFetchOnce(() => {
      throw new TypeError("fetch failed");
    });
    await expect(listInstalledModels()).rejects.toThrow(/ollama serve/);
  });

  it("eigene baseUrl wird verwendet", async () => {
    const fetchFn = mockFetchOnce(() => jsonResponse({ models: [] }));
    await listInstalledModels("http://localhost:11434");
    expect(fetchFn).toHaveBeenCalledWith(
      "http://localhost:11434/api/tags",
      expect.anything(),
    );
  });
});

describe("pullModel (Fortschritt)", () => {
  it("meldet Fortschritt mit Prozent (completed/total)", async () => {
    mockFetchOnce((_, init) => {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toMatchObject({ name: "llama3.2" });
      return ndjsonResponse([
        { status: "pulling manifest" },
        { status: "downloading", digest: "sha256:aaa", total: 1000, completed: 250 },
        { status: "downloading", digest: "sha256:aaa", total: 1000, completed: 1000 },
        { status: "success" },
      ]);
    });
    const seen: number[] = [];
    const progress: string[] = [];
    await pullModel("llama3.2", (p) => {
      progress.push(p.status);
      if (p.percent != null) seen.push(p.percent);
    });
    expect(progress).toContain("downloading");
    expect(progress[progress.length - 1]).toBe("success");
    expect(seen).toContain(25);
    expect(seen).toContain(100);
  });

  it("Fortschritt ohne total → percent null, kein NaN", async () => {
    mockFetchOnce(() =>
      ndjsonResponse([{ status: "pulling manifest" }, { status: "success" }]),
    );
    const percents: (number | null)[] = [];
    await pullModel("qwen2.5:7b", (p) => percents.push(p.percent));
    expect(percents.length).toBeGreaterThan(0);
    expect(percents.every((p) => p === null || Number.isFinite(p))).toBe(true);
  });

  it("error-Zeile im Stream → ModelManagerError, kein stiller Erfolg", async () => {
    mockFetchOnce(() => ndjsonResponse([{ status: "pulling manifest" }, { error: "model not found" }]));
    await expect(pullModel("gibts-nicht:99", () => {})).rejects.toBeInstanceOf(ModelManagerError);
  });

  it("HTTP-Fehler beim Pull → ModelManagerError", async () => {
    mockFetchOnce(() => jsonResponse({ error: "denied" }, 403));
    await expect(pullModel("llama3.2", () => {})).rejects.toBeInstanceOf(ModelManagerError);
  });

  it("funktioniert ohne onProgress-Callback", async () => {
    mockFetchOnce(() => ndjsonResponse([{ status: "success" }]));
    await expect(pullModel("llama3.2")).resolves.toBeUndefined();
  });

  it("leerer Modellname → sofortiger Fehler, kein Request", async () => {
    const fetchFn = mockFetchOnce(() => ndjsonResponse([{ status: "success" }]));
    await expect(pullModel("  ")).rejects.toThrow(/Modellname/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("deleteModel", () => {
  it("sendet DELETE /api/delete mit Modellnamen", async () => {
    const fetchFn = mockFetchOnce(() => new Response(null, { status: 200 }));
    await deleteModel("llama3.2:latest");
    expect(fetchFn).toHaveBeenCalledWith(
      `${DEFAULT_OLLAMA_BASE_URL}/api/delete`,
      expect.objectContaining({ method: "DELETE" }),
    );
    const body = JSON.parse(String(fetchFn.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ name: "llama3.2:latest" });
  });

  it("unbekanntes Modell (404) → ModelManagerError", async () => {
    mockFetchOnce(() => jsonResponse({ error: "model not found" }, 404));
    await expect(deleteModel("gibts-nicht:99")).rejects.toBeInstanceOf(ModelManagerError);
  });

  it("leerer Modellname → sofortiger Fehler, kein Request", async () => {
    const fetchFn = mockFetchOnce(() => new Response(null, { status: 200 }));
    await expect(deleteModel("")).rejects.toThrow(/Modellname/);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("formatModelSize", () => {
  it("formatiert B / MB / GB deutsch", () => {
    expect(formatModelSize(0)).toBe("0 B");
    expect(formatModelSize(512)).toBe("512 B");
    expect(formatModelSize(2_000_000_000)).toMatch(/GB/);
    expect(formatModelSize(4_700_000_000)).toBe("4,4 GB");
  });

  it("ungültige Werte → Platzhalter statt Crash", () => {
    expect(formatModelSize(NaN)).toBe("–");
    expect(formatModelSize(-1)).toBe("–");
  });
});

describe("isLowDiskSpace", () => {
  it("wenig freier Plattenplatz → true, genug → false", () => {
    expect(isLowDiskSpace(2 * 1024 ** 3)).toBe(true);
    expect(isLowDiskSpace(500 * 1024 ** 3)).toBe(false);
  });

  it("eigene Schwelle wird respektiert", () => {
    expect(isLowDiskSpace(9 * 1024 ** 3, 10 * 1024 ** 3)).toBe(true);
    expect(isLowDiskSpace(11 * 1024 ** 3, 10 * 1024 ** 3)).toBe(false);
  });
});
