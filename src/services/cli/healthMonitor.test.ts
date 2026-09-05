// Unit-Tests: CORS-Health-Monitor (Ampel grün/gelb/rot für lokale Instanzen).
// fetch wird gemockt — keine echten Netzwerk-Calls in der Testsuite.
import { describe, it, expect, afterEach, vi } from "vitest";
import { checkInstanceHealth, renderTrafficLights, type HealthCheck } from "./healthMonitor";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetchOnce(responder: (url: string, init?: RequestInit) => Promise<{ ok: boolean; status: number }>): void {
  const mock = vi.fn(responder as unknown as typeof fetch);
  vi.stubGlobal("fetch", mock);
}

describe("CORS-Health-Monitor", () => {
  it("grün: erreichbar UND CORS ok", async () => {
    stubFetchOnce(async () => ({ ok: true, status: 200 }));
    const r = await checkInstanceHealth("Ollama", "http://127.0.0.1:11434/api/tags");
    expect(r.status).toBe("green");
    expect(r.reachable).toBe(true);
    expect(r.corsOk).toBe(true);
  });

  it("gelb: erreichbar, aber CORS blockiert (403)", async () => {
    stubFetchOnce(async () => ({ ok: false, status: 403 }));
    const r = await checkInstanceHealth("Ollama", "http://127.0.0.1:11434/api/tags");
    expect(r.status).toBe("yellow");
    expect(r.corsOk).toBe(false);
    expect(r.message).toContain("CORS");
  });

  it("rot: nicht erreichbar (fetch wirft)", async () => {
    stubFetchOnce(async () => { throw new Error("ECONNREFUSED"); });
    const r = await checkInstanceHealth("Ollama", "http://127.0.0.1:11434/api/tags");
    expect(r.status).toBe("red");
    expect(r.reachable).toBe(false);
  });

  it("rot: HTTP-Fehlerstatus ≠ 403 (z.B. 500)", async () => {
    stubFetchOnce(async () => ({ ok: false, status: 500 }));
    const r = await checkInstanceHealth("Ollama", "http://127.0.0.1:11434/api/tags");
    expect(r.status).toBe("red");
  });

  it("renderTrafficLights zeigt Ampel-Symbole je Status", () => {
    const checks: HealthCheck[] = [
      { name: "Ollama", url: "u1", reachable: true, corsOk: true, status: "green", message: "OK" },
      { name: "LM Studio", url: "u2", reachable: true, corsOk: false, status: "yellow", message: "CORS" },
      { name: "Hermes", url: "u3", reachable: false, corsOk: false, status: "red", message: "Nicht erreichbar" },
    ];
    const out = renderTrafficLights(checks);
    expect(out).toContain("🟢");
    expect(out).toContain("🟡");
    expect(out).toContain("🔴");
    expect(out).toContain("Ollama");
    expect(out).toContain("OLLAMA_ORIGINS");
    expect(out).toContain("Nicht erreichbar");
  });

  it("leere Checkliste rendert Hinweis statt leerer Block", () => {
    expect(renderTrafficLights([])).toContain("keine lokalen Instanzen");
  });

  it("Aggregate: alle grün → status ok", async () => {
    stubFetchOnce(async () => ({ ok: true, status: 200 }));
    const results = await Promise.all([
      checkInstanceHealth("Ollama", "http://127.0.0.1:11434/api/tags"),
      checkInstanceHealth("LM Studio", "http://127.0.0.1:1234/v1/models"),
    ]);
    expect(results.every((r) => r.status === "green")).toBe(true);
  });
});
