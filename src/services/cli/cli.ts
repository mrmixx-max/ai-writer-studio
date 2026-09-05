#!/usr/bin/env node
// CLI-Einstiegspunkt (Sprint 4, Agent 1): interaktives Terminal-Interface
// für die Bookwriter-Orchestrierung.
//
// Ablauf beim Start:
//   1. CORS-Health-Monitor — Ampel (🟢/🟡/🔴) für lokale Instanzen.
//   2. Job-Recovery-UI — fragt bei abgebrochenen Jobs nach Fortsetzung.
//   3. CLI-Dashboard — Live-Fortschritt, Token-Verbrauch, Modell-Status.
//
// Bewusst ohne ink/inquirer: readline + ANSI-Steuerung reichen und halten
// die Abhängigkeitsfläche des Desktop-Produkts klein. Die Geschäftslogik
// liegt vollständig in den testbaren Modulen (dashboard.ts, jobRecovery.ts,
// healthMonitor.ts); diese Datei ist nur der dünne Terminal-Adapter.

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  createDashboard, upsertAgent, updateAgentProgress, recordTokens,
  setAgentStatus, renderDashboard, type DashboardState,
} from "./dashboard";
import { findInterruptedJobs, formatRecoveryPrompt, buildRecoveryChoice } from "./jobRecovery";
import { checkAllLocalInstances, renderTrafficLights } from "./healthMonitor";
import { parseHitlArg, createHitlSession, type HitlIo } from "./hitl";
import { parsePromptArgs, formatPromptFlags, loadPromptLibraryOverride } from "./promptArgs";
import { parseStatsArg, runStatsCommand } from "./statsCommand";

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  return rl.question(question).finally(() => rl.close());
}

/** Terminal-IO für die HITL-Session (readline-Adapter). */
const terminalIo: HitlIo = {
  question: (prompt) => ask(prompt),
  print: (msg) => console.log(msg),
};

/** Schritt 1: Ampel für lokale Instanzen. */
export async function runHealthCheck(): Promise<void> {
  const checks = await checkAllLocalInstances();
  console.log(renderTrafficLights(checks));
  console.log();
}

/** Schritt 2: Job-Recovery — fragt nach fortsetzbaren Jobs. */
export async function runJobRecovery(): Promise<void> {
  const jobs = findInterruptedJobs();
  if (jobs.length === 0) {
    console.log("Keine unterbrochenen Buchprojekte gefunden.");
    return;
  }
  for (const info of jobs) {
    const answer = await ask(`${formatRecoveryPrompt(info)} [j/N] `);
    const action = /^j(a)?$/i.test(answer.trim()) ? "resume" : "discard";
    const choice = await buildRecoveryChoice(info, action);
    if (choice.action === "resume") {
      console.log(`→ Fortsetzung bei Kapitel ${choice.startChapter} vorbereitet (Job ${choice.jobId}).`);
    } else {
      console.log("→ Job verworfen (Kapitel bleiben erhalten).");
    }
  }
}

/**
 * Schritt 3: Dashboard-Demo-/Steuer-Loop. Registriert Agenten, nimmt
 * Fortschritts-/Token-Updates entgegen und rendert live. In der
 * Produktions-Verdrahtung werden die Update-Callbacks vom
 * BookwriterRouter (onCall → recordTokens) und dem Generierungs-Workflow
 * (Kapitel fertig → updateAgentProgress) gespeist; hier demo-tauglich
 * über Tastenkürzel (q = Beenden).
 */
export async function runDashboardLoop(
  onTick?: (d: DashboardState) => Promise<void>,
): Promise<void> {
  let d: DashboardState = createDashboard();
  d = upsertAgent(d, { id: "writer", label: "Kapitel-Generator", model: "qwen2.5:7b", provider: "local" });
  d = upsertAgent(d, { id: "repair", label: "Konsistenz-Reparatur", model: "deepseek-chat", provider: "cloud" });

  let running = true;
  const paint = () => {
    process.stdout.write("\x1b[2J\x1b[H"); // clear + home
    console.log(renderDashboard(d));
    console.log("\n[q] Beenden");
  };

  const rl = readline.createInterface({ input, output, terminal: false });
  paint();
  while (running) {
    const key = await rl.question("");
    if (key.trim().toLowerCase() === "q") {
      running = false;
    } else {
      d = updateAgentProgress(d, "writer", { phase: "Schreibt", done: Math.min(8, (d.agents[0]?.done ?? 0) + 1), total: 8 });
      d = recordTokens(d, "writer", 1500);
      d = setAgentStatus(d, "repair", (d.agents[0]?.done ?? 0) >= 8 ? "done" : "running");
      if (onTick) await onTick(d);
      paint();
    }
  }
  rl.close();
}

/**
 * Baut die HITL-Workflow-Hooks für runBookwriter(). Ohne --hitl=true →
 * undefined (kein Verhalten). Mit Flag: interaktive Haltepunkte nach
 * Outline, Memory-Base und finalem Revisions-Loop; eingespeiste
 * Änderungswünsche werden als Inject in die nächsten Prompts übergeben.
 */
export function buildHitlHooks(): ReturnType<ReturnType<typeof createHitlSession>["workflowHooks"]> | undefined {
  const enabled = parseHitlArg(process.argv);
  const session = createHitlSession(enabled, terminalIo);
  return enabled ? session.workflowHooks() : undefined;
}

/** Haupteinstiegspunkt (nur bei direktem Aufruf, nicht bei Test-Import). */
export async function main(): Promise<void> {
  console.log("AI Writer Studio — CLI-Orchestrierung (Sprint 6)\n");
  // Sprint 6 (Agent 1): `--stats` → Token-Analytics-Historie statt Live-Loop.
  // await: ensureStatsDb() lädt die App-DB-Datei nach (außerhalb des Tauri-
  // Webviews existiert sonst keine DB — siehe statsCommand.ts).
  if (parseStatsArg(process.argv)) {
    await runStatsCommand();
    return;
  }
  // Sprint 6 (Agent 2): Prompt-Library-Flags — Genre-Profil, Zielgruppe,
  // Tonalität, Buchlänge (--genre=, --audience=, --tone=, --length=) und
  // optionaler Library-Override (--prompts=, validiert vor dem Start).
  const promptFlags = parsePromptArgs(process.argv);
  const flagLine = formatPromptFlags(promptFlags);
  if (flagLine) console.log(flagLine + "\n");
  try {
    loadPromptLibraryOverride(promptFlags.promptsPath);
  } catch (e) {
    console.error(`Prompt-Library-Fehler: ${(e as Error).message}`);
    process.exitCode = 1;
    return;
  }
  if (parseHitlArg(process.argv)) {
    console.log("HITL-Modus aktiv: Haltepunkte nach Outline, Memory-Base und finalem Revisions-Loop.\n");
  }
  await runHealthCheck();
  await runJobRecovery();
  await runDashboardLoop();
}

// Direkt-Ausführung: node dist/cli.js o.ä. (kein Import durch Tests).
const isDirect =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;
if (isDirect) {
  main().catch((e) => {
    console.error("CLI-Fehler:", e);
    process.exitCode = 1;
  });
}
