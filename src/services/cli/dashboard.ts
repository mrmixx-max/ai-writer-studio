// CLI-Dashboard (Sprint 4, Agent 1 — Orchestrierung & CLI-Interface).
//
// Interaktives Terminal-Interface für den Vollautomatik-Lauf: zeigt den
// Live-Fortschritt der Agenten, den Token-Verbrauch und das aktive Modell
// (lokal vs. Cloud). Die Render-Logik ist eine reine Funktion
// (DashboardState → String) und damit vollständig testbar; die eigentliche
// Terminal-Ausgabe (ANSI, readline) passiert nur im thin Entry-Point
// (cli.ts). Bewusst OHNE `ink`/`inquirer`-Abhängigkeit — reines ANSI reicht
// für eine Ampel + Fortschrittsbalken und hält die Dependency-Fläche klein.

export type AgentProvider = "local" | "cloud";

export type AgentStatus = "idle" | "running" | "done" | "error";

export interface DashboardAgent {
  id: string;
  label: string;
  model: string;
  provider: AgentProvider;
  status: AgentStatus;
  phase: string;
  /** Fortschritt: fertig / gesamt (z.B. Kapitel). */
  done: number;
  total: number;
  /** Token-Schätzung dieses Agenten (RouterCallMeta.tokens_est). */
  tokens: number;
  error: string | null;
}

export interface DashboardState {
  agents: DashboardAgent[];
  /** Token-Summe über alle Agenten. */
  tokensTotal: number;
  startedAt: number;
}

/** Legt ein leeres Dashboard an. */
export function createDashboard(): DashboardState {
  return { agents: [], tokensTotal: 0, startedAt: Date.now() };
}

/** Registriert (oder ersetzt) einen Agenten. Pure. */
export function upsertAgent(
  d: DashboardState,
  agent: { id: string; label: string; model: string; provider: AgentProvider },
): DashboardState {
  const agents = [...d.agents];
  const existing = agents.findIndex((a) => a.id === agent.id);
  const next: DashboardAgent = {
    ...agent,
    status: "idle",
    phase: "",
    done: 0,
    total: 0,
    tokens: 0,
    error: null,
    ...(existing >= 0 ? agents[existing] : {}),
  };
  if (existing >= 0) agents[existing] = next;
  else agents.push(next);
  return { ...d, agents };
}

function requireAgent(d: DashboardState, id: string): DashboardAgent {
  const a = d.agents.find((x) => x.id === id);
  if (!a) throw new Error(`Unbekannter Dashboard-Agent: ${id}`);
  return a;
}

/** Aktualisiert Phase/Fortschritt eines Agenten. Pure. */
export function updateAgentProgress(
  d: DashboardState,
  id: string,
  progress: { phase?: string; done?: number; total?: number },
): DashboardState {
  requireAgent(d, id);
  const agents = d.agents.map((x) =>
    x.id === id
      ? {
          ...x,
          phase: progress.phase ?? x.phase,
          done: progress.done ?? x.done,
          total: progress.total ?? x.total,
          status: progress.phase || (progress.done ?? 0) < (progress.total ?? 0) ? ("running" as const) : x.status === "done" ? ("done" as const) : x.status,
        }
      : x,
  );
  return { ...d, agents };
}

/** Setzt den Status eines Agenten (done/error/idle/running). Pure. */
export function setAgentStatus(
  d: DashboardState,
  id: string,
  status: AgentStatus,
  error: string | null = null,
): DashboardState {
  requireAgent(d, id);
  return {
    ...d,
    agents: d.agents.map((x) => (x.id === id ? { ...x, status, error } : x)),
  };
}

/** Addiert Token-Verbrauch auf einen Agenten (kumulativ). Pure. */
export function recordTokens(d: DashboardState, id: string, tokens: number): DashboardState {
  requireAgent(d, id);
  return {
    ...d,
    tokensTotal: d.tokensTotal + tokens,
    agents: d.agents.map((x) => (x.id === id ? { ...x, tokens: x.tokens + tokens } : x)),
  };
}

/** Fortschrittsbalken mit Width-Zeichen (10 Segmente). */
export function progressBar(done: number, total: number, width = 10): string {
  if (total <= 0) return "░".repeat(width);
  const filled = Math.max(0, Math.min(width, Math.round((done / total) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

/** Statusmarker je Agent-Status. */
function statusMarker(status: AgentStatus): string {
  switch (status) {
    case "running": return "▸";
    case "done": return "✓";
    case "error": return "✗";
    default: return "·";
  }
}

/**
 * Rendert das Dashboard als mehrzeiligen Klartext (ohne ANSI — die Zeilen
 * werden vom Terminal-Loop farbig/überschrieben). Erwartet in Tests.
 */
export function renderDashboard(d: DashboardState): string {
  const lines: string[] = [];
  lines.push("═══ AI Writer Studio — Bookwriter-Orchestrierung ═══");
  if (d.agents.length === 0) {
    lines.push("  (keine Agenten aktiv)");
  }
  for (const a of d.agents) {
    const tag = a.provider === "local" ? "[LOKAL]" : "[CLOUD]";
    const marker = statusMarker(a.status);
    const bar = progressBar(a.done, a.total);
    const progress = a.total > 0 ? `${a.done}/${a.total}` : "—";
    const phase = a.phase || a.status;
    lines.push(` ${marker} ${a.label} — ${phase}  ${bar} ${progress}  ${a.tokens} Tokens  ${tag} ${a.model}`);
    if (a.error) {
      lines.push(`   ↳ Fehler: ${a.error}`);
    }
  }
  lines.push(`─── Token-Verbrauch gesamt: ${d.tokensTotal} ───`);
  return lines.join("\n");
}
