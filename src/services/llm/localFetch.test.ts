// Tests: localFetch — Tauri/Runtime-Weiche + Proxy-Pfad.
//
// - Browser-Pfad (kein __TAURI_INTERNALS__): window.fetch mit Timeout/Abbruch.
// - Tauri-Pfad (__TAURI_INTERNALS__ gesetzt): invoke("ollama_get/post/delete").
//   invoke ist aus @tauri-apps/api/core gemockt — kein Backend nötig.
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

const invokeCalls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args: Record<string, unknown>) => {
    invokeCalls.push({ cmd, args });
    if (cmd === "ollama_get") return JSON.stringify({ models: [{ name: "llama3.2" }] });
    if (cmd === "ollama_post") return JSON.stringify({ embedding: [0.1, 0.2] });
    if (cmd === "ollama_delete") return JSON.stringify({});
    throw new Error(`unerwartetes Command: ${cmd}`);
  }),
}));

import { getLocal, postLocalJson, deleteLocal, isTauriRuntime } from "./localFetch";

const TAURI_KEY = "__TAURI_INTERNALS__";

function setTauri(on: boolean): void {
  if (on) {
    (window as unknown as Record<string, unknown>)[TAURI_KEY] = {};
  } else {
    delete (window as unknown as Record<string, unknown>)[TAURI_KEY];
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  invokeCalls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  setTauri(false);
});

describe("isTauriRuntime", () => {
  it("false ohne Tauri-Internals (Browser/Test)", () => {
    setTauri(false);
    expect(isTauriRuntime()).toBe(false);
  });

  it("true mit Tauri-Internals (Desktop-App)", () => {
    setTauri(true);
    expect(isTauriRuntime()).toBe(true);
  });
});

describe("getLocal (Browser-Pfad)", () => {
  it("GET über window.fetch mit .ok und JSON", async () => {
    setTauri(false);
    const fetchFn = vi.fn(async () => jsonResponse({ models: [] }));
    vi.stubGlobal("fetch", fetchFn);
    const res = await getLocal("http://127.0.0.1:11434/api/tags", 5000);
    expect(res.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:11434/api/tags",
      expect.objectContaining({ method: "GET" }),
    );
    expect(invokeCalls).toHaveLength(0);
  });
});

describe("getLocal (Tauri-Pfad)", () => {
  it("GET über invoke ollama_get mit Timeout in Sekunden", async () => {
    setTauri(true);
    const res = await getLocal("http://127.0.0.1:11434/api/tags", 5000);
    expect(res.ok).toBe(true);
    expect(invokeCalls).toHaveLength(1);
    expect(invokeCalls[0].cmd).toBe("ollama_get");
    expect(invokeCalls[0].args).toMatchObject({
      url: "http://127.0.0.1:11434/api/tags",
      timeoutSecs: 5,
    });
    const data = (await res.json()) as { models: Array<{ name: string }> };
    expect(data.models[0].name).toBe("llama3.2");
  });

  it("Abort vor invoke wirft AbortError (kein Backend-Call)", async () => {
    setTauri(true);
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(getLocal("http://127.0.0.1:11434/api/tags", 5000, { signal: ctrl.signal })).rejects.toThrow();
    expect(invokeCalls).toHaveLength(0);
  });
});

describe("postLocalJson (Tauri-Pfad)", () => {
  it("POST über invoke ollama_post mit JSON-Body", async () => {
    setTauri(true);
    const res = await postLocalJson(
      "http://127.0.0.1:11434/api/embeddings",
      { model: "nomic-embed-text", prompt: "Hallo" },
      { timeoutMs: 20000 },
    );
    expect(res.ok).toBe(true);
    expect(invokeCalls).toHaveLength(1);
    expect(invokeCalls[0].cmd).toBe("ollama_post");
    expect(invokeCalls[0].args.timeoutSecs).toBe(20);
    const parsed = JSON.parse(String(invokeCalls[0].args.body)) as { model: string };
    expect(parsed.model).toBe("nomic-embed-text");
  });
});

describe("deleteLocal (Tauri-Pfad)", () => {
  it("DELETE über invoke ollama_delete", async () => {
    setTauri(true);
    const res = await deleteLocal("http://127.0.0.1:11434/api/delete", { name: "alt-modell" });
    expect(res.ok).toBe(true);
    expect(invokeCalls).toHaveLength(1);
    expect(invokeCalls[0].cmd).toBe("ollama_delete");
    const parsed = JSON.parse(String(invokeCalls[0].args.body)) as { name: string };
    expect(parsed.name).toBe("alt-modell");
  });
});
