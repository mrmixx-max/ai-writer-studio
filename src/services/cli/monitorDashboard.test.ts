// Tests: Monitoring-Dashboard-CLI (Sprint 8, Agent 2 — Observability).
// TDD: Rendern ist pure (Snapshot → String), Sammlung injizierbar —
// keine echte Ollama-/DB-Abhängigkeit in Tests.
import { describe, it, expect, vi } from "vitest";
import {
  collectMonitorSnapshot,
  parseMonitorArgs,
  renderMonitorDashboard,
  renderMonitorJson,
  runMonitorCommand,
  type MonitorSnapshot,
} from "./monitorDashboard";
import type { SystemHealth } from "@/services/monitoring/health";
import type { MetricsReport } from "@/services/monitoring/metrics";

function makeHealth(overall: SystemHealth["overall"] = "ok"): SystemHealth {
  return {
    overall,
    timestamp: 1700000000000,
    checks: [
      { name: "ollama", status: "ok", responseTimeMs: 12 },
      {
        name: "database",
        status: overall === "ok" ? "ok" : "down",
        responseTimeMs: 3,
        message: overall === "ok" ? undefined : "DB nicht initialisiert",
      },
      { name: "disk", status: "ok", responseTimeMs: 1 },
    ],
  };
}

function makeMetrics(): MetricsReport {
  return {
    totalGenerations: 10,
    successfulGenerations: 8,
    failedGenerations: 2,
    avgDurationMs: 1500,
    totalTokens: 42000,
    byProvider: {
      ollama: { count: 7, tokens: 30000, avgMs: 1200 },
      openrouter: { count: 3, tokens: 12000, avgMs: 2200 },
    },
  };
}

function makeSnapshot(
  overrides: Partial<MonitorSnapshot> = {},
): MonitorSnapshot {
  return {
    health: makeHealth(),
    metrics: makeMetrics(),
    alerts: [],
    correlationId: "corr-test-123",
    ...overrides,
  };
}

describe("renderMonitorDashboard", () => {
  it("zeigt Gesamtstatus und alle Check-Namen", () => {
    const out = renderMonitorDashboard(makeSnapshot());
    expect(out).toContain("ok");
    expect(out).toContain("ollama");
    expect(out).toContain("database");
    expect(out).toContain("disk");
  });

  it("markiert down/degraded-Checks unterscheidbar von ok", () => {
    const out = renderMonitorDashboard(
      makeSnapshot({ health: makeHealth("down") }),
    );
    expect(out).toContain("down");
    expect(out).toContain("DB nicht initialisiert");
  });

  it("rendert Metriken mit Totals und Provider-Aufschlüsselung", () => {
    const out = renderMonitorDashboard(makeSnapshot());
    expect(out).toContain("10"); // totalGenerations
    expect(out).toContain("42000"); // totalTokens
    expect(out).toContain("ollama");
    expect(out).toContain("openrouter");
  });

  it("zeigt aktive Alerts mit Severity, sonst Leer-Meldung", () => {
    const withAlert = renderMonitorDashboard(
      makeSnapshot({
        alerts: [
          {
            id: "alert-1",
            severity: "critical",
            type: "provider_down",
            message: "Provider ollama nicht erreichbar",
            timestamp: 1700000000000,
            acknowledged: false,
          },
        ],
      }),
    );
    expect(withAlert).toContain("critical");
    expect(withAlert).toContain("provider_down");

    const empty = renderMonitorDashboard(makeSnapshot());
    expect(empty).toMatch(/keine aktiven alerts/i);
  });

  it("enthält die Correlation-ID", () => {
    const out = renderMonitorDashboard(makeSnapshot());
    expect(out).toContain("corr-test-123");
  });
});

describe("collectMonitorSnapshot", () => {
  it("nutzt injizierte Deps und erzeugt Correlation-ID", async () => {
    const snap = await collectMonitorSnapshot({
      checkHealth: async () => makeHealth("degraded"),
      readMetrics: () => makeMetrics(),
      readAlerts: () => [],
      newCorrelationId: () => "corr-injected",
    });
    expect(snap.health.overall).toBe("degraded");
    expect(snap.metrics.totalGenerations).toBe(10);
    expect(snap.correlationId).toBe("corr-injected");
  });

  it("Default-Sammlung liefert gültige Snapshot-Form", async () => {
    const snap = await collectMonitorSnapshot({
      newCorrelationId: () => "corr-default",
    });
    expect(["ok", "degraded", "down"]).toContain(snap.health.overall);
    expect(Array.isArray(snap.health.checks)).toBe(true);
    expect(typeof snap.metrics.totalGenerations).toBe("number");
    expect(Array.isArray(snap.alerts)).toBe(true);
  });
});

describe("parseMonitorArgs", () => {
  it("erkennt --json und --csv, sonst Text-Default", () => {
    expect(parseMonitorArgs(["node", "monitor", "--json"]).json).toBe(true);
    expect(parseMonitorArgs(["node", "monitor", "--csv"]).csv).toBe(true);
    const def = parseMonitorArgs(["node", "monitor"]);
    expect(def.json).toBe(false);
    expect(def.csv).toBe(false);
  });
});

describe("runMonitorCommand", () => {
  const deps = (overall: SystemHealth["overall"], critical = false) => ({
    checkHealth: async () => makeHealth(overall),
    readMetrics: () => makeMetrics(),
    readAlerts: () =>
      critical
        ? [
            {
              id: "alert-crit",
              severity: "critical" as const,
              type: "provider_down",
              message: "down",
              timestamp: 1,
              acknowledged: false,
            },
          ]
        : [],
    newCorrelationId: () => "corr-run",
  });

  it("gibt 0 zurück und druckt Dashboard wenn alles ok", async () => {
    const print = vi.fn();
    const code = await runMonitorCommand(["node", "monitor"], {
      ...deps("ok"),
      print,
    });
    expect(code).toBe(0);
    expect(print.mock.calls.join("\n")).toContain("ollama");
  });

  it("gibt 1 zurück wenn System down", async () => {
    const code = await runMonitorCommand(["node", "monitor"], {
      ...deps("down"),
      print: () => {},
    });
    expect(code).toBe(1);
  });

  it("gibt 1 zurück bei unbestätigtem Critical-Alert trotz ok-Health", async () => {
    const code = await runMonitorCommand(["node", "monitor"], {
      ...deps("ok", true),
      print: () => {},
    });
    expect(code).toBe(1);
  });

  it("--json druckt valides JSON mit Correlation-ID", async () => {
    const print = vi.fn();
    const code = await runMonitorCommand(["node", "monitor", "--json"], {
      ...deps("ok"),
      print,
    });
    expect(code).toBe(0);
    const parsed = JSON.parse(print.mock.calls.map((c) => c[0]).join("\n"));
    expect(parsed.correlationId).toBe("corr-run");
    expect(parsed.health.overall).toBe("ok");
  });

  it("gibt 2 zurück wenn Sammlung fehlschlägt", async () => {
    const code = await runMonitorCommand(["node", "monitor"], {
      checkHealth: async () => {
        throw new Error("boom");
      },
      print: () => {},
      printError: () => {},
    });
    expect(code).toBe(2);
  });
});

describe("renderMonitorJson", () => {
  it("serialisiert Snapshot verlustfrei", () => {
    const snap = makeSnapshot();
    const parsed = JSON.parse(renderMonitorJson(snap));
    expect(parsed.metrics.totalTokens).toBe(42000);
    expect(parsed.health.checks).toHaveLength(3);
  });
});
