// Sprint 19d (Agent 1, Timeout-Architektur): keep_alive, kein Whole-Request-
// Timeout für /api/chat, num_ctx-Deckel. Fetch wird gemockt (kein Netzwerk).
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  OllamaProvider,
  OLLAMA_CHAT_TIMEOUT_MS,
  OLLAMA_DEFAULT_NUM_CTX,
  OLLAMA_DEFAULT_KEEP_ALIVE,
} from "./ollama";
import { resetOllamaPools } from "@/services/ollama/connectionPool";
import type { ChatMessage, ChatOptions } from "@/types/llm";

// fetchWithTimeout-Aufrufe mitschneiden (echte Implementierung behalten).
const { fetchWithTimeoutCalls } = vi.hoisted(() => ({
  fetchWithTimeoutCalls: [] as Array<{ url: string; timeoutMs: number }>,
}));
vi.mock("./stream", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stream")>();
  return {
    ...actual,
    fetchWithTimeout: vi.fn((url: string, init: RequestInit, timeoutMs = 30000) => {
      fetchWithTimeoutCalls.push({ url, timeoutMs });
      return actual.fetchWithTimeout(url, init, timeoutMs);
    }),
  };
});

interface CapturedCall {
  url: string;
  init?: RequestInit;
  body?: any;
}
let captured: CapturedCall[] = [];
let responseDelayMs = 0;
let chunkDelayMs = 0;

function mockFetch(lines: string[], status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (responseDelayMs > 0) await new Promise((r) => setTimeout(r, responseDelayMs));
      let body: any;
      try {
        body = init?.body ? JSON.parse(String(init.body)) : undefined;
      } catch {
        body = undefined;
      }
      captured.push({ url: String(url), init, body });
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (const line of lines) {
            if (chunkDelayMs > 0) await new Promise((r) => setTimeout(r, chunkDelayMs));
            controller.enqueue(encoder.encode(line + "\n"));
          }
          controller.close();
        },
      });
      return new Response(stream, { status });
    }),
  );
}

function mockFetchJson(payload: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL, init?: RequestInit) => {
      captured.push({ url: String(url), init });
      return new Response(JSON.stringify(payload), { status });
    }),
  );
}

afterEach(() => {
  resetOllamaPools();
  vi.unstubAllGlobals();
  captured = [];
  responseDelayMs = 0;
  chunkDelayMs = 0;
  fetchWithTimeoutCalls.length = 0;
});

const MSGS: ChatMessage[] = [{ role: "user", content: "Hallo" }];
const OPTS: ChatOptions = { model: "llama3.2", temperature: 0.7, maxTokens: 100 };
const chatLines = [JSON.stringify({ message: { content: "Teil1 " } }), JSON.stringify({ message: { content: "Teil2" } })];

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const c of gen) out += c;
  return out;
}

describe("OllamaProvider Sprint 19d: keep_alive + num_ctx im Payload", () => {
  it("sendet keep_alive='keep' und num_ctx=8192 als Defaults", async () => {
    mockFetch(chatLines);
    const p = new OllamaProvider("http://127.0.0.1:11434");
    const text = await collect(p.chat(MSGS, OPTS));

    expect(text).toBe("Teil1 Teil2");
    expect(OLLAMA_DEFAULT_KEEP_ALIVE).toBe("keep");
    expect(OLLAMA_DEFAULT_NUM_CTX).toBe(8192);
    const chatCall = captured.find((c) => c.url.endsWith("/api/chat"));
    expect(chatCall).toBeDefined();
    expect(chatCall!.body.keep_alive).toBe("keep");
    expect(chatCall!.body.options.num_ctx).toBe(8192);
    // bestehende Felder unverändert
    expect(chatCall!.body.stream).toBe(true);
    expect(chatCall!.body.options.temperature).toBe(0.7);
    expect(chatCall!.body.options.num_predict).toBe(100);
  });

  it("keepAlive/numCtx pro Call überschreibbar (OllamaChatExtras)", async () => {
    mockFetch(chatLines);
    const p = new OllamaProvider("http://127.0.0.1:11434");
    await collect(p.chat(MSGS, { ...OPTS, keepAlive: "15m", numCtx: 4096 } as ChatOptions));

    const chatCall = captured.find((c) => c.url.endsWith("/api/chat"));
    expect(chatCall!.body.keep_alive).toBe("15m");
    expect(chatCall!.body.options.num_ctx).toBe(4096);
  });
});

describe("OllamaProvider Sprint 19d: kein Whole-Request-Timeout für chat", () => {
  it("empfiehlt 10min als externe Obergrenze", () => {
    expect(OLLAMA_CHAT_TIMEOUT_MS).toBeGreaterThanOrEqual(600_000);
  });

  it("langsamer First-Token (Model-Load): kein interner Abort, externer signal wird durchgereicht", async () => {
    // Simuliert 14-GB-CPU-Modell: 1,5s bis Response + tröpfelnde Chunks.
    responseDelayMs = 1500;
    chunkDelayMs = 300;
    mockFetch(chatLines);
    const ctrl = new AbortController();
    const p = new OllamaProvider("http://127.0.0.1:11434");

    const text = await collect(p.chat(MSGS, OPTS, ctrl.signal));

    expect(text).toBe("Teil1 Teil2");
    // Deterministisch: /api/chat darf KEINEN fetchWithTimeout-Timer armen.
    expect(fetchWithTimeoutCalls.filter((c) => c.url.endsWith("/api/chat"))).toHaveLength(0);
    // Externer Abortpfad bleibt verdrahtet.
    const chatCall = captured.find((c) => c.url.endsWith("/api/chat"));
    expect(chatCall!.init?.signal).toBe(ctrl.signal);
  });

  it("explizites options.timeoutMs aktiviert fetchWithTimeout für chat", async () => {
    mockFetch(chatLines);
    const p = new OllamaProvider("http://127.0.0.1:11434");
    await collect(p.chat(MSGS, { ...OPTS, timeoutMs: 5000 }));

    const chatTimeouts = fetchWithTimeoutCalls.filter((c) => c.url.endsWith("/api/chat"));
    expect(chatTimeouts).toHaveLength(1);
    expect(chatTimeouts[0].timeoutMs).toBe(5000);
  });
});

describe("OllamaProvider Sprint 19d: healthCheck/listModels behalten kurze Timeouts", () => {
  it("healthCheck mit 3s, listModels mit 10s via fetchWithTimeout", async () => {
    mockFetchJson({ models: [{ name: "llama3.2" }] });
    const p = new OllamaProvider("http://127.0.0.1:11434");

    expect(await p.healthCheck()).toBe(true);
    expect(await p.listModels()).toEqual(["llama3.2"]);

    const health = fetchWithTimeoutCalls.filter((c) => c.url.endsWith("/api/tags"));
    expect(health).toHaveLength(2);
    expect(health[0].timeoutMs).toBe(3000);
    expect(health[1].timeoutMs).toBe(10000);
  });
});
