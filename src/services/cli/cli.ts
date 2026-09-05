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

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  return rl.question(question).finally(() => rl.close());
}

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

/** Haupteinstiegspunkt (nur bei direktem Aufruf, nicht bei Test-Import). */
export async function main(): Promise<void> {
  console.log("AI Writer Studio — CLI-Orchestrierung (Sprint 4)\n");
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
