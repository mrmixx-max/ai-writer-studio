// Tests: OllamaProvider-Sprint-7-Verdrahtung (Pool + Cache).
// Fetch wird gemockt (keine echten Netzwerk-Calls).
import { describe, it, expect, vi, afterEach } from "vitest";
import { OllamaProvider } from "./ollama";
import { getPromptCache, resetPromptCache } from "@/services/ollama/promptCache";
import { getOllamaPool, resetOllamaPools } from "@/services/ollama/connectionPool";
import type { ChatMessage, ChatOptions } from "@/types/llm";

// Mock: fetch → NDJSON-Response aus einem Puffer.
function mockFetchNdj(responder: () => { status: number; lines: string[] }) {
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const spy = vi.fn(async (url: string | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    const spec = responder();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const line of spec.lines) {
          controller.enqueue(encoder.encode(line + "\n"));
        }
        controller.close();
      },
    });
    return new Response(body, { status: spec.status });
  });
  vi.stubGlobal("fetch", spy);
  return { spy, fetchCalls };
}

afterEach(() => {
  resetPromptCache();
  resetOllamaPools();
  vi.unstubAllGlobals();
});

const MSGS: ChatMessage[] = [{ role: "user", content: "Test-Prompt" }];
const OPTS: ChatOptions = { model: "llama3.1:8b", temperature: 0.7, maxTokens: 100 };

async function collect(gen: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const c of gen) out += c;
  return out;
}

describe("OllamaProvider: Response-Caching (opt-in)", () => {
  it("cache:true — zweiter identischer Call kommt aus dem Cache (kein zweiter fetch)", async () => {
    let fetchCount = 0;
    const { spy } = mockFetchNdj(() => {
      fetchCount++;
      return { status: 200, lines: [JSON.stringify({ message: { content: "Antwort" } })] };
    });
    const p = new OllamaProvider("http://127.0.0.1:11434");

    const t1 = await collect(p.chat(MSGS, { ...OPTS, cache: true }));
    const t2 = await collect(p.chat(MSGS, { ...OPTS, cache: true }));

    expect(t1).toBe("Antwort");
    expect(t2).toBe("Antwort");
    expect(fetchCount).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    const s = getPromptCache().getStats();
    expect(s.hits).toBe(1);
  });

  it("ohne cache:true — kein Caching, immer echter Call", async () => {
    let fetchCount = 0;
    mockFetchNdj(() => {
      fetchCount++;
      return { status: 200, lines: [JSON.stringify({ message: { content: "Antwort" } })] };
    });
    const p = new OllamaProvider("http://127.0.0.1:11434");
    await collect(p.chat(MSGS, OPTS));
    await collect(p.chat(MSGS, OPTS));
    expect(fetchCount).toBe(2);
  });

  it("Cache-Miss → Stream fließt und wird in den Cache gelegt", async () => {
    mockFetchNdj(() => ({
      status: 200,
      lines: [JSON.stringify({ message: { content: "A" } }), JSON.stringify({ message: { content: "B" } })],
    }));
    const p = new OllamaProvider("http://127.0.0.1:11434");
    const t = await collect(p.chat(MSGS, { ...OPTS, cache: true }));
    expect(t).toBe("AB");
    const s = getPromptCache().getStats();
    expect(s.size).toBe(1);
  });

  it("anderer Prompt → anderer Cache-Key (echter Call)", async () => {
    let fetchCount = 0;
    mockFetchNdj(() => {
      fetchCount++;
      return { status: 200, lines: [JSON.stringify({ message: { content: "x" } })] };
    });
    const p = new OllamaProvider("http://127.0.0.1:11434");
    await collect(p.chat([{ role: "user", content: "A" }], { ...OPTS, cache: true }));
    await collect(p.chat([{ role: "user", content: "B" }], { ...OPTS, cache: true }));
    expect(fetchCount).toBe(2);
  });
});

describe("OllamaProvider: Connection-Pool-Verdrahtung", () => {
  it("Parallele Chats teilen sich den Pool (maxConcurrent eingehalten)", async () => {
    const pool = getOllamaPool("http://127.0.0.1:11434", { maxConcurrent: 2 });
    let fetchInFlight = 0;
    let peak = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      fetchInFlight++;
      peak = Math.max(peak, fetchInFlight);
      await new Promise((r) => setTimeout(r, 20));
      fetchInFlight--;
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(encoder.encode(JSON.stringify({ message: { content: "x" } }) + "\n"));
          c.close();
        },
      });
      return new Response(body, { status: 200 });
    }));

    const p = new OllamaProvider("http://127.0.0.1:11434");
    await Promise.all(
      Array.from({ length: 6 }, () =>
        collect(p.chat([{ role: "user", content: `p${Math.random()}` }], OPTS)),
      ),
    );
    expect(peak).toBeLessThanOrEqual(2);
    expect(pool.getStats().completed).toBe(6);
  });
});
