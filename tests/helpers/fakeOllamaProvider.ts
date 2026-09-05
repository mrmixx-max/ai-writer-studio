// A1: FakeOllamaProvider — skriptbarer Ollama-Ersatz für Resilienz-/Chaos-Tests.
//
// Wird via vi.mock("@/services/llm/ollama") anstelle des echten Providers
// installiert. Kein Netzwerk, kein echter Ollama — CI-sicher.
//
// Skript-API: Sequenz von FakeStep-Einträgen, die call für call abgearbeitet
// wird. Alternativ ein Router (prompt → Antwort), wenn der Ablauf vom
// Prompt-Inhalt abhängt (z.B. Outline-/Kapitel-/Summary-Calls unterscheiden).
//
// Chaos-Modi:
//   "timeouts" — jeder Call wirft nach chaosDelayMs einen TimeoutError
//   "random"   — deterministisch geseedeter Zufall aus allen Fehlerarten
//
// Erschöpfte Warteschlange: letzter guter Text wird wiederholt
// (exhaustedText überschreibbar) — kein stiller Test-Abbruch.

export type FakeStep =
  | { kind: "good"; text: string }
  | { kind: "brokenJson"; text: string }
  | { kind: "timeout"; delayMs?: number }
  | { kind: "abort"; delayMs?: number }
  | { kind: "empty" }
  | { kind: "huge"; words?: number }
  | { kind: "charChunks"; text: string; chunkSize?: number; delayMs?: number }
  | { kind: "throw"; error: Error };

export interface FakeCallRecord {
  index: number;
  prompt: string;
  model: string;
  options: Record<string, unknown>;
}

export type ChaosMode = "off" | "timeouts" | "random";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Wartet auf Abort des Signals (oder capMs) und wirft dann einen AbortError.
 * Ohne Signal: bounded 100 ms, damit Chaos-Tests nie hängen.
 */
function waitForAbort(signal: AbortSignal | undefined, capMs: number): Promise<never> {
  return new Promise((_resolve, reject) => {
    const abortErr = () => new DOMException("Aborted", "AbortError");
    if (!signal) {
      setTimeout(() => reject(abortErr()), Math.min(capMs, 100));
      return;
    }
    if (signal.aborted) {
      reject(abortErr());
      return;
    }
    const timer = setTimeout(() => reject(abortErr()), capMs);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortErr());
      },
      { once: true },
    );
  });
}

/** n pseudo-Wörter (deterministisch, gleiche Tokens zyklisch). */
export function fakeWords(n: number): string {
  return Array.from({ length: n }, (_, i) => `Wort${i % 1000}`).join(" ");
}

/** Deterministischer PRNG (mulberry32) für reproduzierbares Chaos. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class FakeOllamaProvider {
  /** Warteschlange der Antworten/Fehler; wird der Reihe nach abgearbeitet. */
  static queue: FakeStep[] = [];
  /** Chaos-Modus ("off" | "timeouts" | "random"). */
  static chaos: ChaosMode = "off";
  static chaosDelayMs = 10;
  static chaosSeed = 42;
  /** Optionaler Router: prompt → Step | Text | null (null = Warteschlange). */
  static router: ((prompt: string, callIndex: number) => FakeStep | string | null) | null = null;
  /** Text bei erschöpfter Warteschlange (Default: letzter guter Text). */
  static exhaustedText: string | null = null;
  /** Alle chat()-Aufrufe mit Prompt/Modell/Optionen (für Assertionen). */
  static calls: FakeCallRecord[] = [];

  private static lastGood = "";
  private static rng: () => number = Math.random;

  static reset(): void {
    FakeOllamaProvider.queue = [];
    FakeOllamaProvider.chaos = "off";
    FakeOllamaProvider.chaosDelayMs = 10;
    FakeOllamaProvider.router = null;
    FakeOllamaProvider.exhaustedText = null;
    FakeOllamaProvider.calls = [];
    FakeOllamaProvider.lastGood = "";
    FakeOllamaProvider.rng = Math.random;
  }

  /** Antwort-Sequenz setzen (wird pro Call einmal konsumiert). */
  static script(...steps: FakeStep[]): void {
    FakeOllamaProvider.queue = [...steps];
  }

  static setChaos(mode: ChaosMode, seed = 42, delayMs = 10): void {
    FakeOllamaProvider.chaos = mode;
    FakeOllamaProvider.chaosDelayMs = delayMs;
    FakeOllamaProvider.rng = mulberry32(seed);
  }

  private static nextStep(prompt: string): FakeStep {
    const callIndex = FakeOllamaProvider.calls.length - 1;

    if (FakeOllamaProvider.router) {
      const routed = FakeOllamaProvider.router(prompt, callIndex);
      if (routed !== null && routed !== undefined) {
        const step: FakeStep = typeof routed === "string" ? { kind: "good", text: routed } : routed;
        if (step.kind === "good") FakeOllamaProvider.lastGood = step.text;
        return step;
      }
    }

    if (FakeOllamaProvider.chaos === "timeouts") {
      return { kind: "timeout", delayMs: FakeOllamaProvider.chaosDelayMs };
    }
    if (FakeOllamaProvider.chaos === "random") {
      const r = FakeOllamaProvider.rng();
      if (r < 0.4) return { kind: "good", text: FakeOllamaProvider.lastGood };
      if (r < 0.5) return { kind: "brokenJson", text: "{'kaputt': true,}" };
      if (r < 0.6) return { kind: "timeout", delayMs: FakeOllamaProvider.chaosDelayMs };
      if (r < 0.7) return { kind: "empty" };
      if (r < 0.8) return { kind: "abort", delayMs: 100 };
      if (r < 0.85) return { kind: "huge", words: 20000 };
      return { kind: "charChunks", text: FakeOllamaProvider.lastGood, chunkSize: 1, delayMs: 0 };
    }

    const step = FakeOllamaProvider.queue.shift();
    if (step) {
      if (step.kind === "good") FakeOllamaProvider.lastGood = step.text;
      return step;
    }
    // Skript erschöpft: letzten guten Text wiederholen (oder exhaustedText).
    return { kind: "good", text: FakeOllamaProvider.exhaustedText ?? FakeOllamaProvider.lastGood };
  }

  constructor(baseUrl: string) {
    // Signaturkompatibel zum echten OllamaProvider; keine Verbindung.
    void baseUrl;
  }

  async *chat(
    messages: { role: string; content: string }[],
    options: Record<string, unknown> = {},
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const prompt = messages.map((m) => m.content).join("\n");
    // Vertrags-Treue zum echten Provider: bereits abgebrochenes Signal →
    // sofortiger AbortError (fetch würde sofort abbrechen).
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    FakeOllamaProvider.calls.push({
      index: FakeOllamaProvider.calls.length,
      prompt,
      model: String(options.model ?? ""),
      options,
    });

    const step = FakeOllamaProvider.nextStep(prompt);

    switch (step.kind) {
      case "throw":
        throw step.error;
      case "timeout":
        await sleep(step.delayMs ?? FakeOllamaProvider.chaosDelayMs);
        throw new DOMException("Timeout", "TimeoutError");
      case "abort":
        await waitForAbort(signal, step.delayMs ?? 100);
        throw new DOMException("Aborted", "AbortError");
      case "empty":
        return;
      case "huge": {
        const text = fakeWords(step.words ?? 300000);
        for (let i = 0; i < text.length; i += 8192) {
          yield text.slice(i, i + 8192);
        }
        return;
      }
      case "charChunks": {
        const size = step.chunkSize ?? 1;
        for (let i = 0; i < step.text.length; i += size) {
          if (step.delayMs) await sleep(step.delayMs);
          yield step.text.slice(i, i + size);
        }
        return;
      }
      case "brokenJson":
        yield step.text;
        return;
      case "good":
      default:
        yield step.text;
        return;
    }
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async listModels(): Promise<string[]> {
    return ["fake-model"];
  }

  describe(): string {
    return "FakeOllamaProvider (A1)";
  }
}

/** Gültige 8-Kapitel-Gliederung als JSON (Gate-passend, Summaries ≥ 20 Wörter). */
export function goodOutlineJson(chapterCount = 8): string {
  return JSON.stringify({
    title: "KI im Alltag",
    genre: "Sachbuch",
    targetAudience: "Erwachsene",
    chapters: Array.from({ length: chapterCount }, (_, i) => ({
      number: i + 1,
      title: `Kapitel ${i + 1}: Grundlagen und Ausblick`,
      summary:
        `Kapitel ${i + 1} behandelt den Themenkomplex in der Tiefe, stellt die zentralen ` +
        `Fragen des Buches, führt die wichtigsten Personen ein und schließt mit einem ` +
        `klaren Ausblick auf die Folgekapitel und das Gesamtfazit des Werkes.`,
    })),
  });
}
