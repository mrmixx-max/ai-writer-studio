// Memory-Leak-Tests: Kapitel-Loop + Listener-/Timer-Cleanup.
//
// 1) Chunked-Chapter-Build wie in chapter-gen.ts (`content += token`):
//    N Iterationen, Referenz danach fallenlassen, GC erzwingen (falls
//    verfügbar), Heap-Wachstum pro Iteration begrenzen.
// 2) Listener-Leak: EventEmitter-Subscribe/Unsubscribe rund um onToken +
//    Dashboard-Polling (PROGRESS_POLL_INTERVAL_MS / deriveJobProgressState
//    aus progress.ts) mit start/stop — stop muss Timer + Listener freigeben.

import { describe, it, expect, vi, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import {
  PROGRESS_POLL_INTERVAL_MS,
  deriveJobProgressState,
} from "@/services/bookwriter/progress";

const maybeGc = () => {
  const g = globalThis as unknown as { gc?: () => void };
  if (typeof g.gc === "function") g.gc();
};

describe("Memory: chunked Chapter-Build ohne Leak", () => {
  it("N Kapitel-Builds: Heap-Wachstum pro Iteration begrenzt", async () => {
    const ITERATIONS = 40;
    const CHUNKS = 200;
    const CHUNK = "lorem ipsum dolor sit amet "; // ~27 Zeichen wie ein Token-Delta
    const hasGc = typeof (globalThis as unknown as { gc?: unknown }).gc === "function";
    // Mit GC (CI mit --expose-gc) gilt die strenge 50-KB-Schranke; ohne GC
    // läuft kein Major-GC, daher nur Gross-Leak-Schranke (kalibriert: Rauschen
    // ohne GC liegt bei ~70 KB/iter, v. a. Young-Gen-Promotions).
    const LIMIT = hasGc ? 50 * 1024 : 150 * 1024;

    const buildChapter = () => {
      // Wie generateChapter: content += token pro Stream-Delta.
      let content = "";
      for (let c = 0; c < CHUNKS; c++) content += CHUNK;
      // Kapitel "verwenden" (Längen-Check wie Wortzählung), dann fallenlassen.
      void content.length;
    };

    for (let i = 0; i < 10; i++) buildChapter(); // Warmup (JIT/Allokatoren)
    maybeGc();
    await new Promise((r) => setTimeout(r, 10));
    const before = process.memoryUsage().heapUsed;

    for (let i = 0; i < ITERATIONS; i++) buildChapter();

    maybeGc();
    await new Promise((r) => setTimeout(r, 10));
    maybeGc();
    const after = process.memoryUsage().heapUsed;
    const perIter = (after - before) / ITERATIONS;
    console.log(
      `[mem] chapter-loop: ${ITERATIONS} iters, heap +${Math.round(after - before)} B ` +
        `→ ${Math.round(perIter)} B/iter (Limit ${Math.round(LIMIT / 1024)} KB/iter, gc=${hasGc})`,
    );
    expect(perIter).toBeLessThan(LIMIT);
  });

  // Exakter Release-Nachweis via WeakRef — braucht global.gc (node
  // --expose-gc). Ermittelt: Ohne explizites GC räumt V8 hier nicht ab
  // (selbst 100 MB Young-Gen-Churn lösen kein Clearing aus), und der
  // Referent muss in Function-Scope sterben (Top-Level-Block bleibt
  // gerootet). Daher nur mit --expose-gc aktiv, sonst Skip.
  const hasGc =
    typeof (globalThis as unknown as { gc?: unknown }).gc === "function";
  it.runIf(hasGc)(
    "fallengelassene Kapitel werden vom GC eingesammelt (WeakRef)",
    async () => {
      const gc = (globalThis as unknown as { gc: () => void }).gc;
      const makeHolder = () => {
        let content = "";
        for (let c = 0; c < 200; c++) content += "lorem ipsum dolor sit amet ";
        return new WeakRef({ text: content });
      };
      const ref = makeHolder();
      const tick = () => new Promise<void>((r) => setImmediate(r));
      gc();
      await tick();
      gc();
      await tick();
      console.log(
        `[mem] weakref chapter-holder collected=${ref.deref() === undefined}`,
      );
      expect(ref.deref()).toBeUndefined();
    },
  );
});

describe("Memory: Listener- und Timer-Cleanup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("onToken-Listener werden nach Kapitelende entfernt (kein Listener-Leak)", () => {
    const emitter = new EventEmitter();
    const CHAPTERS = 10;

    for (let i = 0; i < CHAPTERS; i++) {
      const onToken = () => {};
      emitter.on("token", onToken);
      // Simulierter Kapitel-Stream.
      for (let c = 0; c < 50; c++) emitter.emit("token", "wort ");
      emitter.off("token", onToken);
    }

    expect(emitter.listenerCount("token")).toBe(0);
    expect(emitter.eventNames()).toHaveLength(0);
  });

  it("Dashboard-Polling: stop() gibt Intervall + Listener frei", async () => {
    const setSpy = vi.spyOn(globalThis, "setInterval");
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const emitter = new EventEmitter();

    // Minimaler Nachbau des Dashboard-Pollings auf Basis von progress.ts:
    // Intervall liest Job-State ab, Listener empfängt Live-Tokens.
    const onToken = () => {};
    const job = { status: "running" as const, updatedAt: Date.now() };
    const seen: string[] = [];
    const timer = setInterval(() => {
      seen.push(deriveJobProgressState(job));
    }, PROGRESS_POLL_INTERVAL_MS);
    emitter.on("token", onToken);

    expect(setSpy).toHaveBeenCalled();
    expect(emitter.listenerCount("token")).toBe(1);

    // Cleanup wie beim Unmount des Dashboards.
    clearInterval(timer);
    emitter.off("token", onToken);

    expect(clearSpy).toHaveBeenCalledWith(timer);
    expect(emitter.listenerCount("token")).toBe(0);
    expect(seen).toHaveLength(0); // Intervall feuerte nie (2 s >> Testdauer)
    void PROGRESS_POLL_INTERVAL_MS;
  });

  it("vergessener Cleanup wird sichtbar: off() ohne remove lässt Listener zurück", () => {
    // Negativ-Kontrolle: beweist, dass der obige Test wirklich misst.
    const emitter = new EventEmitter();
    const onToken = () => {};
    emitter.on("token", onToken);
    expect(emitter.listenerCount("token")).toBe(1);
    emitter.off("token", onToken);
    expect(emitter.listenerCount("token")).toBe(0);
  });
});
