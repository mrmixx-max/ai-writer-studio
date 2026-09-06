// Tests: Observability & Monitoring
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateCorrelationId,
  formatCorrelationLog,
  withCorrelation,
  getCorrelationId,
} from "@/services/monitoring/correlation";
import {
  recordGeneration,
  getMetricsReport,
  exportCsv,
  clearMetrics,
  type GenerationMetric,
} from "@/services/monitoring/metrics";
import {
  checkOllamaHealth,
  checkSystemHealth,
} from "@/services/monitoring/health";

describe("Correlation ID", () => {
  it("generiert eindeutige IDs", () => {
    const id1 = generateCorrelationId();
    const id2 = generateCorrelationId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^corr-/);
  });

  it("formatiert Log-Message korrekt", () => {
    const msg = formatCorrelationLog("corr-123", "Test message");
    expect(msg).toBe("[corr-123] Test message");
  });

  it("formatiert mit Daten", () => {
    const msg = formatCorrelationLog("corr-123", "Test", { key: "value" });
    expect(msg).toContain('{"key":"value"}');
  });

  it("withCorrelation setzt Correlation-ID", async () => {
    let capturedId: string | undefined;
    await withCorrelation(async () => {
      capturedId = getCorrelationId();
    });
    expect(capturedId).toBeDefined();
    expect(capturedId).toMatch(/^corr-/);
  });

  it("getCorrelationId gibt undefined außerhalb zurück", () => {
    expect(getCorrelationId()).toBeUndefined();
  });
});

describe("Metrics", () => {
  beforeEach(() => {
    clearMetrics();
  });

  const sampleMetric: GenerationMetric = {
    timestamp: Date.now(),
    bookId: "book-1",
    chapterCount: 5,
    totalTokens: 10000,
    durationMs: 5000,
    success: true,
    provider: "ollama",
    model: "llama3.2",
  };

  it("erfasst Generierungen", () => {
    recordGeneration(sampleMetric);
    const report = getMetricsReport();
    expect(report.totalGenerations).toBe(1);
    expect(report.successfulGenerations).toBe(1);
  });

  it("berechnet Durchschnitt", () => {
    recordGeneration({ ...sampleMetric, durationMs: 1000 });
    recordGeneration({ ...sampleMetric, durationMs: 3000 });
    const report = getMetricsReport();
    expect(report.avgDurationMs).toBe(2000);
  });

  it("gruppiert nach Provider", () => {
    recordGeneration({ ...sampleMetric, provider: "ollama" });
    recordGeneration({ ...sampleMetric, provider: "openrouter" });
    const report = getMetricsReport();
    expect(Object.keys(report.byProvider)).toHaveLength(2);
    expect(report.byProvider["ollama"].count).toBe(1);
  });

  it("zählt failed separat", () => {
    recordGeneration({ ...sampleMetric, success: false });
    recordGeneration({ ...sampleMetric, success: true });
    const report = getMetricsReport();
    expect(report.successfulGenerations).toBe(1);
    expect(report.failedGenerations).toBe(1);
  });

  it("exportiert als CSV", () => {
    recordGeneration(sampleMetric);
    const csv = exportCsv();
    expect(csv).toContain("timestamp,bookId,chapterCount");
    expect(csv).toContain("book-1");
  });

  it("clearMetrics leert alles", () => {
    recordGeneration(sampleMetric);
    clearMetrics();
    const report = getMetricsReport();
    expect(report.totalGenerations).toBe(0);
  });
});

describe("Health Checks", () => {
  it("checkOllamaHealth gibt ok/down zurück", async () => {
    // Mock fetch
    const mockOk = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockOk);
    const result = await checkOllamaHealth();
    expect(result.status).toBe("ok");
    expect(result.name).toBe("ollama");
    vi.unstubAllGlobals();
  });

  it("checkSystemHealth aggregiert alle Checks", async () => {
    // Mock fetch für Ollama (ok)
    const mockOk = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockOk);
    const health = await checkSystemHealth();
    expect(health.overall).toMatch(/ok|degraded|down/);
    expect(health.checks).toHaveLength(3);
    vi.unstubAllGlobals();
  });
});
