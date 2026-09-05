// Benchmark: Ollama-Inferenz vor/nachher (Sprint 7, Agent 2).
//
// Ausführung (Projektroot):
//   node scripts/benchmark-ollama.mjs [--runs 3] [--parallel 4] [--model X] [--real]
//
// Misst drei Dimensionen und vergleicht sie mit einer "vorher"-Baseline:
//   1. Latenz identischer Prompts mit/ohne Prompt-Cache (Sprint-7-Cache).
//   2. Parallele Requests mit/ohne Connection-Pool-Begrenzung (Ressourcenschutz).
//   3. Token-Ersparnis der kompakten System-Prompts (statisch, ohne Server).
//
// Default (offline): deterministische Simulation — dieselben Code-Pfade
// (OllamaConnectionPool, PromptCache, compactSavings) werden unter
// simulierter Inferenz-Latenz gemessen. CI-tauglich, reproduzierbar,
// 0 echte API-Calls. Mit --real wird der lokale Ollama-Server benutzt
// (echte Cache-Ersparnis über HTTP; lokale Inferenz = keine Kosten).

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

// --- CLI-Args -------------------------------------------------------------------

const args = process.argv.slice(2);
function argValue(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const MODEL = argValue("model", "llama3.2:latest");
const RUNS = Math.max(1, parseInt(argValue("runs", "3"), 10));
const PARALLEL = Math.max(2, parseInt(argValue("parallel", "4"), 10));
const REAL = args.includes("--real");
const BASE_URL = argValue("base-url", "http://127.0.0.1:11434");

const ms = (n) => `${n.toFixed(1)} ms`;
const pct = (n) => `${(n * 100).toFixed(1)} %`;
function printSection(title) {
  console.log(`\n--- ${title} ${"-".repeat(Math.max(4, 62 - title.length))}`);
}

// --- TS-Quellen via esbuild bundle'n (Agent-Log-Konvention: bundler-sicher) ------

const BENCH_TS = `
import { OllamaConnectionPool } from "${path.resolve(ROOT, "src/services/ollama/connectionPool.ts").replace(/\\\\/g, "/")}";
import { PromptCache, promptCacheKey, compactSavings } from "${path.resolve(ROOT, "src/services/ollama/compactPrompts.ts").replace(/\\\\/g, "$1")}".replace("compactPrompts", "promptCache");
`;

// Sauberer: beide Module explizit.
const sources = {
  "connectionPool.ts": fs.readFileSync(path.join(ROOT, "src/services/ollama/connectionPool.ts"), "utf8"),
  "promptCache.ts": fs.readFileSync(path.join(ROOT, "src/services/ollama/promptCache.ts"), "utf8"),
  "compactPrompts.ts": fs.readFileSync(path.join(ROOT, "src/services/ollama/compactPrompts.ts"), "utf8"),
  "localModelProfiles.ts": fs.readFileSync(path.join(ROOT, "src/services/llm/localModelProfiles.ts"), "utf8"),
};

// Alias-Auflösung für den Bundle-Schritt: "@/x" → src/x.
const esbuild = "node_modules/esbuild/bin/esbuild";
const fwd = (p) => p.replace(/\\/g, "/");
const entry = `
export { OllamaConnectionPool, getOllamaPool, resetOllamaPools } from "${fwd(path.join(ROOT, "src/services/ollama/connectionPool.ts"))}";
export { PromptCache, promptCacheKey, getPromptCache, resetPromptCache } from "${fwd(path.join(ROOT, "src/services/ollama/promptCache.ts"))}";
export { compactSavings, compactSystemPromptForModel } from "${fwd(path.join(ROOT, "src/services/ollama/compactPrompts.ts"))}";
`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aws-bench-"));
const entryFile = path.join(tmpDir, "bench-entry.ts");
const outFile = path.join(tmpDir, "bench-bundle.mjs");
fs.writeFileSync(entryFile, entry);
const esbuildBin = path.join(ROOT, "node_modules", "esbuild", "bin", "esbuild");
execFileSync(
  process.execPath,
  [esbuildBin, fwd(entryFile), "--bundle", "--format=esm", "--platform=node", `--outfile=${fwd(outFile)}`, "--alias:@=./src"],
  { cwd: ROOT, stdio: "inherit" },
);
const { OllamaConnectionPool, PromptCache, promptCacheKey, compactSavings } = await import(
  `file:///${fwd(outFile)}`
);

// --- 1. Cache-Benchmark -----------------------------------------------------------

async function benchCache(mode) {
  const simulatedLatencyMs = 120; // simulierte Inferenz-Zeit pro Call
  const cache = new PromptCache({ ttlMs: 60_000 });
  const key = promptCacheKey(MODEL, [{ role: "user", content: PROMPT }], { temperature: 0.2 });
  let calls = 0;
  const infer = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, simulatedLatencyMs));
    return `Antwort #${calls}`;
  };
  const results = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    if (mode === "baseline") {
      await infer();
    } else {
      const hit = cache.get(key);
      if (!hit) {
        const text = await infer();
        cache.set(key, text);
      }
    }
    results.push(performance.now() - t0);
  }
  return {
    results,
    total: results.reduce((a, b) => a + b, 0),
    calls,
    hitRate: mode === "baseline" ? 0 : cache.getStats().hitRate,
  };
}

// --- 2. Pool-Benchmark ------------------------------------------------------------

async function benchPool(mode) {
  // 2*PARALLEL parallele "Chunk-Requests", jeder dauert simulatedLatencyMs.
  const simulatedLatencyMs = 50;
  const pool =
    mode === "baseline"
      ? new OllamaConnectionPool({ maxConcurrent: 1024 }) // ungebremst ≈ vorher
      : new OllamaConnectionPool({ maxConcurrent: 2 });   // Sprint 7: begrenzt
  const t0 = performance.now();
  await Promise.all(
    Array.from({ length: PARALLEL * 2 }, (i) =>
      pool.run(async () => {
        await new Promise((r) => setTimeout(r, simulatedLatencyMs));
        return i;
      }),
    ),
  );
  return { total: performance.now() - t0, stats: pool.getStats() };
}

// --- 3. Realer Server-Modus (optional, --real) -------------------------------------

const PROMPT = "Nenne in einem Wort die Hauptstadt von Deutschland.";

async function realChat(text) {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: text }],
      stream: false,
      options: { temperature: 0.2, num_predict: 64 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return data.message?.content ?? "";
}

async function benchCacheReal() {
  const cache = new PromptCache({ ttlMs: 60_000 });
  const key = promptCacheKey(MODEL, [{ role: "user", content: PROMPT }], { temperature: 0.2 });
  const results = [];
  let calls = 0;
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const hit = cache.get(key);
    if (!hit) {
      calls++;
      const text = await realChat(PROMPT);
      cache.set(key, text);
    }
    results.push(performance.now() - t0);
  }
  return { results, total: results.reduce((a, b) => a + b, 0), calls, hitRate: cache.getStats().hitRate };
}

async function benchCacheRealBaseline() {
  const results = [];
  let calls = 0;
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    calls++;
    await realChat(PROMPT);
    results.push(performance.now() - t0);
  }
  return { results, total: results.reduce((a, b) => a + b, 0), calls };
}

// --- Auswertung --------------------------------------------------------------------

const fmtRuns = (rs) => rs.map((r) => r.toFixed(0)).join(" / ");

async function main() {
  console.log("=== Ollama-Inferenz-Benchmark (Sprint 7) ===");
  console.log(`Modell: ${MODEL} | Runs: ${RUNS} | Parallel: ${PARALLEL} | Modus: ${REAL ? "realer Ollama-Server" : "offline (Simulation)"}`);

  if (REAL) {
    try {
      const res = await fetch(`${BASE_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      console.log(`Server: ${BASE_URL} OK`);
    } catch {
      console.error(`Server ${BASE_URL} nicht erreichbar — bitte \`ollama serve\` starten oder ohne --real laufen lassen.`);
      process.exit(1);
    }
    printSection("1. Response-Caching (realer Server)");
    const base = await benchCacheRealBaseline();
    const s7 = await benchCacheReal();
    console.log(`Baseline (ohne Cache):  ${fmtRuns(base.results)} ms | Calls: ${base.calls}`);
    console.log(`Sprint 7 (mit Cache):   ${fmtRuns(s7.results)} ms | Calls: ${s7.calls} | Hit-Rate: ${pct(s7.hitRate)}`);
    const gain = base.total > 0 ? 1 - s7.total / base.total : 0;
    console.log(`Ersparnis gesamt: ${pct(gain)}`);
  } else {
    printSection("1. Response-Caching (identischer Prompt, N Runs, simuliert)");
    const base = await benchCache("baseline");
    const s7 = await benchCache("sprint7");
    console.log(`Baseline (ohne Cache):  ${fmtRuns(base.results)} ms | Calls: ${base.calls}`);
    console.log(`Sprint 7 (mit Cache):   ${fmtRuns(s7.results)} ms | Calls: ${s7.calls} | Hit-Rate: ${pct(s7.hitRate)}`);
    const gain = base.total > 0 ? 1 - s7.total / base.total : 0;
    console.log(`Ersparnis gesamt: ${pct(gain)}`);
    if (gain <= 0) console.log("  HINWEIS: kein Gewinn messbar — Cache-TTL/Hits prüfen.");
  }

  printSection(`2. Connection-Pool (${PARALLEL * 2} Requests)`);
  const pBase = await benchPool("baseline");
  const pS7 = await benchPool("sprint7");
  console.log(`Baseline (ungebremst, max 1024): ${ms(pBase.total)} | Spitze: ${Math.min(1024, PARALLEL * 2)} gleichzeitig`);
  console.log(`Sprint 7 (max 2 parallel):       ${ms(pS7.total)} | Spitze: 2 | ø Queue-Wait: ${ms(pS7.stats.avgWaitMs)}`);
  console.log("  → Der Pool begrenzt die Spitzenlast (Ressourcenschutz); Durchsatz bleibt durch die Inferenz-Limitierung des Servers deterministisch.");

  printSection("3. Kompakte System-Prompts (statisch)");
  for (const r of compactSavingsForModels()) {
    console.log(`${r.model.padEnd(18)} Original ~${r.original} tok → kompakt ~${r.compact} tok  (−${r.saved} tok/Call)`);
  }

  console.log("\nBenchmark abgeschlossen.");
}

function compactSavingsForModels() {
  return ["deepseek-r1:14b", "qwen2.5:7b", "llama3.1:8b"].map((m) => ({ model: m, ...compactSavings(m) }));
}

main().catch((e) => {
  console.error("Benchmark-Fehler:", e);
  process.exit(1);
});
