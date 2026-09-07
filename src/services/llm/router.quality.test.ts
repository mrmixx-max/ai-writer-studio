// Tests: Sprint 13, Agent 2 — LLM-Router-Qualität (ADDITIV).
//
// - Task-aware Modellauswahl (Matrix + Task-Klasse + Prompt-Template-Brücke).
// - Automatischer Downgrade NUR bei Timeout (kein Crash, kein Throw bei Erfolg).
// - Per-Request-Ringpuffer (Modell, Task, Dauer, Fallback).
// ALLE Tests gemockt: Provider-Instanzen werden direkt gepatcht (healthCheck/chat),
// kein Netzwerk, kein Disk-Zugriff.
import { describe, it, expect } from "vitest";
import {
  BookwriterRouter,
  pickModelForTask,
  pickModelWithTaskClass,
  type RouterChainSpec,
} from "./router";
import {
  executeWithTimeoutDowngrade,
  isTimeoutError,
  resolveDowngradeModel,
} from "./timeoutDowngrade";
import { RouterRequestLog } from "./requestLog";
import { ProviderError } from "@/types/llm";

const MSGS = [{ role: "user" as const, content: "Test-Prompt" }];

type Step = { error?: unknown; text?: string };

/** Router mit gemockten Providern (kein Netzwerk). Gibt Chat-Call-Log zurück. */
function mockedRouter(
  chain: RouterChainSpec[],
  steps: Step[],
  configExtra: Record<string, unknown> = {},
): { router: BookwriterRouter; chatCalls: Array<{ provider: string; model: string }> } {
  const router = new BookwriterRouter({ chain, ...(configExtra as object) });
  const chatCalls: Array<{ provider: string; model: string }> = [];
  for (const entry of router.entries) {
    const id = entry.id;
    (entry.provider as unknown as { healthCheck: () => Promise<boolean> }).healthCheck =
      async () => true;
    (entry.provider as unknown as { chat: (...a: unknown[]) => AsyncGenerator<string> }).chat =
      async function* (_m: unknown, o: unknown) {
        chatCalls.push({ provider: id, model: (o as { model: string }).model });
        const step = steps.shift();
        if (step?.error) throw step.error;
        yield step?.text ?? "ok-text";
      };
  }
  return { router, chatCalls };
}

function singleChain(models: Record<string, string>): RouterChainSpec[] {
  return [{ provider: "ollama", baseUrl: "http://x", models: models as never }];
}

const timeoutErr = () => new DOMException("Timeout", "TimeoutError");

// --- 1-3: Task-aware Modellauswahl -------------------------------------------

describe("Sprint 13: task-aware Modellauswahl", () => {
  it("Matrix: summary/entities→fast, chapter/repair→main, outline→strong", () => {
    const models = { main: "llama3.1:8b", fast: "llama3.2", strong: "llama3.1:70b" };
    expect(pickModelForTask("summary", models)).toBe("llama3.2");
    expect(pickModelForTask("entities", models)).toBe("llama3.2");
    expect(pickModelForTask("chapter", models)).toBe("llama3.1:8b");
    expect(pickModelForTask("repair", models)).toBe("llama3.1:8b");
    expect(pickModelForTask("outline", models)).toBe("llama3.1:70b");
    expect(pickModelForTask("metadata", models)).toBe("llama3.2");
  });

  it("Task-Klasse: Logik-Aufgaben→logic-Modell, Kreativ-Aufgaben→Matrix", () => {
    const models = { main: "main-m", fast: "fast-m", logic: "logic-m" };
    expect(pickModelWithTaskClass("entities", models)).toBe("logic-m");
    expect(pickModelWithTaskClass("repair", models)).toBe("logic-m");
    expect(pickModelWithTaskClass("chapter", models)).toBe("main-m");
    expect(pickModelWithTaskClass("summary", models)).toBe("fast-m");
  });

  it("Prompt-Template-Brücke: chapter/outline direkt, revise→repair, system→metadata", () => {
    expect(BookwriterRouter.bookwriterTaskForPromptTask("chapter")).toBe("chapter");
    expect(BookwriterRouter.bookwriterTaskForPromptTask("outline")).toBe("outline");
    expect(BookwriterRouter.bookwriterTaskForPromptTask("revise")).toBe("repair");
    expect(BookwriterRouter.bookwriterTaskForPromptTask("system")).toBe("metadata");
  });
});

// --- 4-6: Timeout-Downgrade (pure Units) -------------------------------------

describe("Sprint 13: Timeout-Downgrade Units", () => {
  it("isTimeoutError: nur Timeout-Signaturen (kein Abort, kein 4xx)", () => {
    expect(isTimeoutError(new DOMException("Timeout", "TimeoutError"))).toBe(true);
    expect(isTimeoutError(new Error("request timed out after 30s"))).toBe(true);
    expect(isTimeoutError(new Error("ETIMEDOUT"))).toBe(true);
    expect(isTimeoutError(new DOMException("Aborted", "AbortError"))).toBe(false);
    expect(isTimeoutError(new ProviderError("Ollama chat fehlgeschlagen (HTTP 401). x"))).toBe(
      false,
    );
    expect(isTimeoutError(new Error("ECONNREFUSED"))).toBe(false);
  });

  it("resolveDowngradeModel: fast-Kandidat bevorzugt, nie erfunden, current nie wieder", () => {
    expect(resolveDowngradeModel("llama3.1:8b", ["llama3.1:8b", "llama3.2"])).toBe("llama3.2");
    expect(resolveDowngradeModel("m", [])).toBe("m");
    expect(resolveDowngradeModel("m", ["m"])).toBe("m");
    // Ohne fast-Muster: erster anderer Kandidat.
    expect(resolveDowngradeModel("a", ["a", "b"])).toBe("b");
  });

  it("executeWithTimeoutDowngrade: Erfolg direkt / Timeout→downgrade / 4xx fliegt", async () => {
    const ok = await executeWithTimeoutDowngrade(
      async () => "primär",
      async () => "fallback",
    );
    expect(ok).toMatchObject({ result: "primär", downgraded: false });

    let logged: unknown = null;
    const dg = await executeWithTimeoutDowngrade(
      async () => {
        throw new DOMException("Timeout", "TimeoutError");
      },
      async () => "kleines-modell-ok",
      { from: "big", to: "small", onDowngrade: (i) => (logged = i) },
    );
    expect(dg).toMatchObject({ result: "kleines-modell-ok", downgraded: true });
    expect(logged).toMatchObject({ from: "big", to: "small" });

    let downgradeCalled = false;
    await expect(
      executeWithTimeoutDowngrade(
        async () => {
          throw new ProviderError("x (HTTP 401). Unauthorized");
        },
        async () => {
          downgradeCalled = true;
          return "nie";
        },
      ),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(downgradeCalled).toBe(false);
  });
});

// --- 7-8: Router-Downgrade-Integration (gemockt) ------------------------------

describe("Sprint 13: Router-Downgrade bei Timeout (gemockt)", () => {
  it("Timeout→Downgrade: Retry läuft auf kleinerem Modell, meta.downgraded gesetzt", async () => {
    const { router, chatCalls } = mockedRouter(
      singleChain({ main: "llama3.1:8b", fast: "llama3.2" }),
      [{ error: timeoutErr() }, { text: "Antwort nach Downgrade" }],
      { downgradeModels: ["llama3.2"], retryErrorLimit: 2 },
    );
    const { text, meta } = await router.complete("chapter", MSGS, {});
    expect(text).toBe("Antwort nach Downgrade");
    expect(meta.provider).toBe("ollama");
    expect(meta.fallback_reason).toBeNull(); // gleicher Provider, kein Provider-Fallback
    expect(meta.downgraded).toBe(true);
    expect(meta.downgradedFrom).toBe("llama3.1:8b");
    expect(meta.model).toBe("llama3.2");
    expect(chatCalls.map((c) => c.model)).toEqual(["llama3.1:8b", "llama3.2"]);
  });

  it("KEIN Downgrade bei Netzwerkfehler; abschaltbar via enableTimeoutDowngrade:false", async () => {
    const netErr = () => new ProviderError("Ollama chat fehlgeschlagen. ECONNREFUSED");
    const { router, chatCalls } = mockedRouter(
      singleChain({ main: "llama3.1:8b", fast: "llama3.2" }),
      [{ error: netErr() }, { text: "Retry-Antwort" }],
      { downgradeModels: ["llama3.2"], retryErrorLimit: 2 },
    );
    const { meta } = await router.complete("chapter", MSGS, {});
    expect(meta.downgraded).toBeUndefined();
    expect(meta.model).toBe("llama3.1:8b");
    expect(chatCalls.map((c) => c.model)).toEqual(["llama3.1:8b", "llama3.1:8b"]);

    const off = mockedRouter(singleChain({ main: "llama3.1:8b", fast: "llama3.2" }), [
      { error: timeoutErr() },
      { error: timeoutErr() },
    ], { downgradeModels: ["llama3.2"], retryErrorLimit: 2, enableTimeoutDowngrade: false });
    await expect(off.router.complete("chapter", MSGS, {})).rejects.toBeInstanceOf(ProviderError);
    expect(off.chatCalls.map((c) => c.model)).toEqual(["llama3.1:8b", "llama3.1:8b"]);
  });
});

// --- 9-13: Per-Request-Ringpuffer ---------------------------------------------

describe("Sprint 13: per-Request-Ringpuffer", () => {
  it("RouterRequestLog: Überlauf wirft älteste raus, seq läuft weiter, last/clear", () => {
    const log = new RouterRequestLog(2);
    expect(log.maxSize).toBe(2);
    log.push({ model: "a", task: "chapter", durationMs: 10, fallbackUsed: false });
    log.push({ model: "b", task: "summary", durationMs: 20, fallbackUsed: false });
    log.push({ model: "c", task: "repair", durationMs: 30, fallbackUsed: true });
    expect(log.size).toBe(2);
    expect(log.entries().map((e) => e.model)).toEqual(["b", "c"]);
    expect(log.entries().map((e) => e.seq)).toEqual([2, 3]);
    expect(log.last(1).map((e) => e.model)).toEqual(["c"]);
    expect(log.last(0)).toEqual([]);
    log.clear();
    expect(log.size).toBe(0);
    expect(log.push({ model: "d", task: "x", durationMs: 1, fallbackUsed: false }).seq).toBe(4);
  });

  it("Erfolg: ein Eintrag mit Modell/Task/Dauer/Fallback=false", async () => {
    const { router } = mockedRouter(singleChain({ main: "main-m", fast: "fast-m" }), [
      { text: "Hallo Welt" },
    ]);
    const { meta } = await router.complete("summary", MSGS, {});
    expect(meta.model).toBe("fast-m");
    expect(router.requestLog.size).toBe(1);
    const e = router.requestLog.entries()[0];
    expect(e.model).toBe("fast-m");
    expect(e.task).toBe("summary");
    expect(e.durationMs).toBeGreaterThanOrEqual(0);
    expect(e.fallbackUsed).toBe(false);
    expect(e.ok).toBe(true);
    expect(e.provider).toBe("ollama");
    expect(router.recentRequests(1)).toHaveLength(1);
  });

  it("Provider-Fallback: Eintrag mit fallbackUsed=true + Cloud-Provider", async () => {
    const router = new BookwriterRouter({
      chain: [
        { provider: "ollama", baseUrl: "http://x", models: { main: "m" } },
        { provider: "openrouter", apiKey: "sk-test", models: { main: "cloud-m" } },
      ],
    });
    for (const entry of router.entries) {
      const p = entry.provider as unknown as {
        healthCheck: () => Promise<boolean>;
        chat: (...a: unknown[]) => AsyncGenerator<string>;
      };
      p.healthCheck =
        entry.id === "ollama" ? async () => false : async () => true;
      p.chat = async function* () {
        yield "Cloud-Text";
      };
    }
    const { meta } = await router.complete("chapter", MSGS, { model: "m" });
    expect(meta.fallback_reason).toBe("health_check_failed");
    const e = router.requestLog.entries()[0];
    expect(e.fallbackUsed).toBe(true);
    expect(e.provider).toBe("openrouter");
    expect(e.ok).toBe(true);
  });

  it("Kettenfehler: ok:false-Eintrag; Kapazität begrenzt den Puffer", async () => {
    const router = new BookwriterRouter({
      chain: [{ provider: "ollama", baseUrl: "http://x", models: { main: "m" } }],
      requestLogCapacity: 2,
    });
    for (const entry of router.entries) {
      (entry.provider as unknown as { healthCheck: () => Promise<boolean> }).healthCheck =
        async () => false;
    }
    await expect(router.complete("chapter", MSGS, {})).rejects.toBeInstanceOf(ProviderError);
    await expect(router.complete("chapter", MSGS, {})).rejects.toBeInstanceOf(ProviderError);
    await expect(router.complete("chapter", MSGS, {})).rejects.toBeInstanceOf(ProviderError);
    expect(router.requestLog.size).toBe(2); // Kapazität greift
    expect(router.requestLog.entries().every((e) => e.ok === false)).toBe(true);
    expect(router.requestLog.entries().map((e) => e.seq)).toEqual([2, 3]);
  });

  it("Downgrade-Erfolg landet mit fallbackUsed=true im Log", async () => {
    const { router } = mockedRouter(
      singleChain({ main: "llama3.1:8b", fast: "llama3.2" }),
      [{ error: timeoutErr() }, { text: "ok" }],
      { downgradeModels: ["llama3.2"], retryErrorLimit: 2 },
    );
    await router.complete("chapter", MSGS, {});
    const e = router.requestLog.entries()[0];
    expect(e.model).toBe("llama3.2");
    expect(e.fallbackUsed).toBe(true);
    expect(e.ok).toBe(true);
  });
});
