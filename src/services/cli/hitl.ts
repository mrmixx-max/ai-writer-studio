// HITL (Human-in-the-Loop) — Approval-Gates & CLI-Editor (Sprint 5, Agent 1).
//
// Manuelle Kontrolle für den Publisher: Mit `--hitl=true` pausiert die CLI
// an drei Haltepunkten und wartet auf eine Freigabe (approve/reject):
//   1. outline   — nach der Gliederung (Phase "gliederung")
//   2. memory    — vor/nach der Memory-Base-Nutzung (Phase "manuskript")
//   3. revision  — nach dem finalen Revisions-Loop (Phase "ueberarbeitung")
//
// Am Haltepunkt dient ein kleiner CLI-Editor (austauschbare HitlIo, im
// Terminal readline) als Inject-Kanal: Freitext wie
//   'Kapitel 3 Fokus ändern: Mehr Spannung'
// wird als verbindliche Redaktionsanweisung eingesammelt und vom Workflow
// per applyInjects() in die nächsten Prompts injiziert.
//
// Design-Vertrag:
// - Reine Logik in diesem Modul (State-Machine, Prompt-Formatierung,
//   Persistenz), dünner Terminal-Adapter in cli.ts — identisch zum
//   Sprint-4-Muster (dashboard.ts / jobRecovery.ts / healthMonitor.ts).
// - Entscheidungen persistieren über saveApproval() (bookwriter_approvals,
//   Sprint-1-Migration) — der Publisher kann Outline, Memory und Revision
//   approve/rejecten, die Historie landet im bestehenden Approval-Log.
// - Keine Breaking Changes: keine bestehende Signatur ändert sich; der
//   Workflow erhält ausschließlich optionale Hooks.

import { saveApproval } from "@/services/bookwriter/state";
import type { BookwriterPhase, BookOutline } from "@/types/bookwriter";

/** Haltepunkte im Bookwriter-Workflow. */
export type HitlGate = "outline" | "memory" | "revision";

/** Reihenfolge der Haltepunkte. */
export const HITL_GATES: HitlGate[] = ["outline", "memory", "revision"];

/** Workflow-Phase, an der ein Haltepunkt pausiert. */
export const GATE_PHASE: Record<HitlGate, BookwriterPhase> = {
  outline: "gliederung",
  memory: "manuskript",
  revision: "ueberarbeitung",
};

/** Deutsches Label je Haltepunkt. */
export const GATE_LABELS: Record<HitlGate, string> = {
  outline: "Gliederung (Outline)",
  memory: "Memory-Base (Charaktere, Orte, Fakten)",
  revision: "Finaler Revisions-Loop (Überarbeitung)",
};

/** Entscheidung am Haltepunkt. */
export type HitlDecision = "approved" | "rejected";

/** Persistenter Zustand der HITL-Steuerung. */
export interface HitlState {
  /** Durch --hitl=true aktiviert? */
  enabled: boolean;
  /** Getroffene Entscheidungen je Haltepunkt. */
  decisions: Partial<Record<HitlGate, HitlDecision>>;
  /** Aktueller Haltepunkt (während einer Pause), sonst null. */
  pendingGate: HitlGate | null;
  /** Eingespeiste Redaktionsanweisungen (CLI-Editor). */
  injects: string[];
}

/**
 * Liest --hitl[=true|false] aus argv. Ohne Flag → false, `--hitl` ohne
 * Wert → true (aktivierte Kurzform), `--hitl=true/false` → Wert.
 */
export function parseHitlArg(argv: string[]): boolean {
  const arg = argv.find((a) => a === "--hitl" || a.startsWith("--hitl="));
  if (!arg) return false;
  if (arg === "--hitl") return true;
  return arg.slice("--hitl=".length).toLowerCase() === "true";
}

/** Legt den Ausgangszustand fest. */
export function createHitl(enabled: boolean): HitlState {
  return { enabled, decisions: {}, pendingGate: null, injects: [] };
}

/** Pausiert der Workflow an diesem Haltepunkt (noch nicht entschieden)? */
export function shouldPauseAt(state: HitlState, gate: HitlGate): boolean {
  return state.enabled && HITL_GATES.includes(gate) && state.decisions[gate] === undefined;
}

/** Prompt-Text am Haltepunkt. */
export function buildGatePrompt(gate: HitlGate): string {
  return (
    `Haltepunkt erreicht: ${GATE_LABELS[gate]}. Möchten Sie freigeben? ` +
    "(a=Approve, x=Reject, Freitext=Änderungswunsch einspeisen, l=Liste, c=Liste leeren)"
  );
}

/**
 * Trifft die Entscheidung an einem Haltepunkt und persistiert sie über das
 * bestehende Approval-Log (bookwriter_approvals, Phase gemäß GATE_PHASE).
 */
export async function resolveGate(
  state: HitlState,
  _projectId: string,
  runId: string,
  gate: HitlGate,
  decision: HitlDecision,
  note: string | null,
): Promise<HitlState> {
  if (!HITL_GATES.includes(gate)) {
    throw new Error(`Unbekannter Haltepunkt: ${gate}`);
  }
  await saveApproval(runId, GATE_PHASE[gate], decision, note);
  return {
    ...state,
    decisions: { ...state.decisions, [gate]: decision },
    pendingGate: null,
  };
}

/** Nimmt einen Freitext-Änderungswunsch aus dem CLI-Editor auf. */
export function addInject(state: HitlState, text: string): HitlState {
  const t = text.trim();
  if (!t) throw new Error("Leerer Änderungswunsch kann nicht eingespeist werden.");
  if (state.injects.includes(t)) return state;
  return { ...state, injects: [...state.injects, t] };
}

/**
 * Formatiert die eingespeisten Änderungswünsche als verbindlichen
 * Redaktionsblock für den Prompt. Ohne Injektionen: leerer String, sodass
 * bestehende Prompts byte-identisch bleiben (keine Breaking Changes).
 */
export function buildInjectBlock(injects: string[]): string {
  if (injects.length === 0) return "";
  const lines = injects.map((i) => `- ${i}`).join("\n");
  return (
    "\n\nRedaktionelle Anweisungen des Verlags (verbindlich umzusetzen):\n" +
    `${lines}\n` +
    "Setze diese Anweisungen inhaltlich um, ohne die übrigen Vorgaben zu verletzen."
  );
}

/** Hängt den Injektionsblock an einen Prompt an (neutral bei leerer Liste). */
export function withInjects(prompt: string, injects: string[]): string {
  if (injects.length === 0) return prompt;
  return `${prompt}${buildInjectBlock(injects)}`;
}

/** Kompakte Gliederungs-Übersicht für den Haltepunkt 'outline'. */
export function formatOutlineSummary(outline: BookOutline | null): string {
  if (!outline || outline.chapters.length === 0) {
    return "Keine Gliederung gefunden.";
  }
  const total =
    outline.totalWords ??
    outline.chapters.reduce((s, c) => s + (c.estimatedWords ?? 0), 0);
  const lines = outline.chapters.map(
    (c, i) => `  ${i + 1}. ${c.title} (ca. ${c.estimatedWords ?? 0} Wörter)`,
  );
  return (
    `Gliederung — ${outline.chapters.length} Kapitel, ${total} Wörter gesamt:\n` +
    lines.join("\n")
  );
}

/** Memory-Base-Block (buildContextBlock) für den Haltepunkt 'memory'. */
export function formatMemorySummary(memoryBlock: string): string {
  if (!memoryBlock.trim()) return "Memory-Base ist leer (keine Fakten gespeichert).";
  return `Memory-Base (verbindlicher Kontext):\n${memoryBlock}`;
}

/** Hinweistext für den Haltepunkt 'revision'. */
export function formatRevisionSummary(): string {
  return (
    "Finaler Revisions-Loop (Überarbeitung): Stil, Konsistenz und Lesbarkeit " +
    "wurden geprüft. Freigabe vor Export?"
  );
}

/** Eine geparste Editor-Eingabe. */
export type EditorCommand =
  | { type: "approve" }
  | { type: "reject" }
  | { type: "inject"; text: string }
  | { type: "list" }
  | { type: "clear" };

/**
 * Parst eine Editor-Zeile. Kurzbefehle: a/ok/j = approve, x/n = reject,
 * l = Injektionen auflisten, c = Injektionen verwerfen. Alles andere
 * (insbesondere freitextliche Änderungswünsche wie 'Kapitel 3 Fokus
 * ändern: Mehr Spannung') gilt als Inject-Anweisung.
 */
export function parseEditorLine(line: string): EditorCommand {
  const t = line.trim().toLowerCase();
  if (t === "a" || t === "ok" || t === "j") return { type: "approve" };
  if (t === "x" || t === "n") return { type: "reject" };
  if (t === "l") return { type: "list" };
  if (t === "c") return { type: "clear" };
  return { type: "inject", text: line.trim() };
}

/** Minimal-IO des CLI-Editors (im Terminal: readline, in Tests: scripted). */
export interface HitlIo {
  question(prompt: string): Promise<string>;
  print(message: string): void;
}

/**
 * Interaktive HITL-Session: verwaltet Zustand und Editor-Loop über die
 * Haltepunkte hinweg. `runGate` blockiert bis zu einer Entscheidung und
 * sammelt unterwegs eingespeiste Änderungswünsche ein.
 */
export interface HitlSession {
  readonly enabled: boolean;
  /** Pausiert der Workflow an diesem Haltepunkt? */
  shouldPause(gate: HitlGate): boolean;
  /** Interaktiver Haltepunkt: fragt bis approve/reject, sammelt Injektionen. */
  runGate(runId: string, projectId: string, gate: HitlGate, summary?: string): Promise<HitlDecision>;
  /** Alle bisher eingespeisten Änderungswünsche. */
  allInjects(): string[];
  /** Workflow-Hooks für die Produktions-Verdrahtung. */
  workflowHooks(): {
    shouldPause(gate: HitlGate): boolean;
    onGate(gate: HitlGate, runId: string, projectId: string, summary?: string): Promise<void>;
    applyInjects(prompt: string): string;
  };
}

/** Baut eine HITL-Session mit übergebener IO (Terminal oder Test-Stub). */
export function createHitlSession(enabled: boolean, io: HitlIo): HitlSession {
  const injects: string[] = [];
  const decisions: Partial<Record<HitlGate, HitlDecision>> = {};

  const snapshotState = (pendingGate: HitlGate | null): HitlState => ({
    enabled,
    decisions: { ...decisions },
    pendingGate,
    injects: [...injects],
  });

  const session: HitlSession = {
    enabled,

    shouldPause(gate) {
      return enabled && HITL_GATES.includes(gate);
    },

    async runGate(runId, projectId, gate, summary) {
      if (!enabled) return "approved";

      io.print("");
      io.print(`⏸ HALTEPUNKT — ${GATE_LABELS[gate]}`);
      if (summary) io.print(summary);
      io.print(buildGatePrompt(gate));

      for (;;) {
        const answer = await io.question("hitl> ");
        const cmd = parseEditorLine(answer);
        switch (cmd.type) {
          case "approve": {
            const s = await resolveGate(
              snapshotState(gate), projectId, runId, gate, "approved",
              injects.length > 0 ? injects.join(" | ") : null,
            );
            Object.assign(decisions, s.decisions);
            io.print("→ Freigegeben.");
            return "approved";
          }
          case "reject": {
            const s = await resolveGate(
              snapshotState(gate), projectId, runId, gate, "rejected",
              injects.length > 0 ? injects.join(" | ") : null,
            );
            Object.assign(decisions, s.decisions);
            io.print("→ Abgelehnt. Lauf wird gestoppt.");
            return "rejected";
          }
          case "inject": {
            try {
              addInject(snapshotState(null), cmd.text);
              injects.push(cmd.text.trim());
              io.print(`→ Eingespeist (${injects.length}): ${cmd.text.trim()}`);
            } catch (e) {
              io.print(`✗ ${(e as Error).message}`);
            }
            break;
          }
          case "list":
            io.print(
              injects.length > 0
                ? `Eingespeiste Änderungswünsche:\n${injects.map((i, k) => `  ${k + 1}. ${i}`).join("\n")}`
                : "Keine Änderungswünsche eingespeist.",
            );
            break;
          case "clear":
            injects.length = 0;
            io.print("→ Änderungswünsche verworfen.");
            break;
        }
      }
    },

    allInjects() {
      return [...injects];
    },

    workflowHooks() {
      return {
        shouldPause: (gate) => enabled && HITL_GATES.includes(gate),

        /**
         * Führt den interaktiven Haltepunkt aus. Bei 'rejected' wirft er —
         * der Workflow-Caller behandelt das wie einen Abbruch (Phase bleibt
         * stehen, run.status → paused).
         */
        async onGate(gate, runId, projectId, summary) {
          if (!enabled) return;
          const verdict = await session.runGate(runId, projectId, gate, summary);
          if (verdict === "rejected") {
            throw new Error(`Haltepunkt '${gate}' vom Publisher abgelehnt.`);
          }
        },

        /** Injiziert die eingespeisten Änderungswünsche in den Prompt. */
        applyInjects(prompt) {
          return withInjects(prompt, [...injects]);
        },
      };
    },
  };

  return session;
}
