// Monitoring-Dashboard-CLI (Sprint 8, Agent 2 — Observability).
//
// `npm run monitor` zeigt Health, Metriken und aktive Alerts.
// Rendern ist pure (Snapshot → String), Sammlung injizierbar —
// keine echte Ollama-/DB-Abhängigkeit in Tests.

import {
  checkSystemHealth,
  type SystemHealth,
} from "@/services/monitoring/health";
import {
  getMetricsReport,
  type MetricsReport,
} from "@/services/monitoring/metrics";
import {
  alertManager,
  type Alert,
} from "@/services/monitoring/alert";
import { generateCorrelationId } from "@/services/monitoring/correlation";

/** Ein Dashboard-Schnappschuss: alles, was das CLI rendert. */
export interface MonitorSnapshot {
  health: SystemHealth;
  metrics: MetricsReport;
  alerts: Alert[];
  correlationId: string;
}

/** Injizierbare Abhängigkeiten für die Snapshot-Sammlung. */
export interface MonitorDeps {
  checkHealth?: () => Promise<SystemHealth>;
  readMetrics?: () => MetricsReport;
  readAlerts?: () => Alert[];
  newCorrelationId?: () => string;
  print?: (line: string) => void;
  printError?: (line: string) => void;
}

/**
 * Sammelt einen Dashboard-Schnappschuss.
 * Defaults nutzen die echten Module (Health, Metrics, AlertManager).
 */
export async function collectMonitorSnapshot(
  deps: MonitorDeps = {},
): Promise<MonitorSnapshot> {
  const {
    checkHealth = checkSystemHealth,
    readMetrics = getMetricsReport,
    readAlerts = () => alertManager.getAlerts(),
    newCorrelationId = generateCorrelationId,
  } = deps;
  const [health, metrics, alerts] = await Promise.all([
    checkHealth(),
    Promise.resolve(readMetrics()),
    Promise.resolve(readAlerts()),
  ]);
  return { health, metrics, alerts, correlationId: newCorrelationId() };
}

/** CLI-Argumente: `--json` und `--csv` werden erkannt, sonst Text. */
export function parseMonitorArgs(argv: string[]): {
  json: boolean;
  csv: boolean;
} {
  return {
    json: argv.includes("--json"),
    csv: argv.includes("--csv"),
  };
}

/** Rendert einen Schnappschuss als lesbares Text-Dashboard. */
export function renderMonitorDashboard(snap: MonitorSnapshot): string {
  const lines: string[] = [];
  lines.push(`AI Writer Studio — Status: ${snap.health.overall}`);
  lines.push("");
  lines.push("Checks:");
  for (const check of snap.health.checks) {
    const extra = check.message ? ` (${check.message})` : "";
    lines.push(
      `  [${check.status}] ${check.name} — ${check.responseTimeMs}ms${extra}`,
    );
  }
  lines.push("");
  lines.push("Metriken:");
  lines.push(`  Generierungen: ${snap.metrics.totalGenerations}`);
  lines.push(`  Erfolgreich: ${snap.metrics.successfulGenerations}`);
  lines.push(`  Fehlgeschlagen: ${snap.metrics.failedGenerations}`);
  lines.push(`  Ø Dauer: ${snap.metrics.avgDurationMs}ms`);
  lines.push(`  Tokens gesamt: ${snap.metrics.totalTokens}`);
  lines.push("  Pro Provider:");
  for (const [provider, data] of Object.entries(snap.metrics.byProvider)) {
    lines.push(
      `    ${provider}: ${data.count}×, ${data.tokens} Tokens, Ø ${data.avgMs}ms`,
    );
  }
  lines.push("");
  if (snap.alerts.length === 0) {
    lines.push("Keine aktiven Alerts.");
  } else {
    lines.push("Alerts:");
    for (const alert of snap.alerts) {
      lines.push(`  [${alert.severity}] ${alert.type}: ${alert.message}`);
    }
  }
  lines.push("");
  lines.push(`Correlation-ID: ${snap.correlationId}`);
  return lines.join("\n");
}

/** Serialisiert einen Schnappschuss verlustfrei als JSON. */
export function renderMonitorJson(snap: MonitorSnapshot): string {
  return JSON.stringify(snap, null, 2);
}

/** Rendert einen Schnappschuss als CSV (Health + Totals). */
export function renderMonitorCsv(snap: MonitorSnapshot): string {
  const header = "section,name,status,value";
  const rows: string[] = [header];
  for (const check of snap.health.checks) {
    rows.push(
      `check,${check.name},${check.status},${check.responseTimeMs}`,
    );
  }
  rows.push(`metric,totalGenerations,,${snap.metrics.totalGenerations}`);
  rows.push(`metric,totalTokens,,${snap.metrics.totalTokens}`);
  rows.push(`meta,correlationId,,${snap.correlationId}`);
  return rows.join("\n");
}

/**
 * Führt das Monitor-Kommando aus.
 * @returns 0 = ok, 1 = System down oder unbestätigter Critical-Alert, 2 = Sammlungsfehler.
 */
export async function runMonitorCommand(
  argv: string[],
  deps: MonitorDeps = {},
): Promise<number> {
  const {
    print = (line: string) => console.log(line),
    printError = (line: string) => console.error(line),
  } = deps;
  const args = parseMonitorArgs(argv);
  let snap: MonitorSnapshot;
  try {
    snap = await collectMonitorSnapshot(deps);
  } catch (err) {
    printError(
      `Monitor-Sammlung fehlgeschlagen: ${err instanceof Error ? err.message : "Unknown error"}`,
    );
    return 2;
  }
  if (args.json) {
    print(renderMonitorJson(snap));
  } else if (args.csv) {
    print(renderMonitorCsv(snap));
  } else {
    print(renderMonitorDashboard(snap));
  }
  const hasCritical = snap.alerts.some(
    (a) => a.severity === "critical" && !a.acknowledged,
  );
  if (snap.health.overall === "down" || hasCritical) {
    return 1;
  }
  return 0;
}
