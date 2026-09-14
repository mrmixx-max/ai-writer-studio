// Observability-Regressionstests (Agent a3-sec): CSV-Quoting, Log-Guard.
import { describe, it, expect, beforeEach } from "vitest";
import { recordGeneration, exportCsv, clearMetrics } from "./metrics";
import { formatCorrelationLog } from "./correlation";

describe("exportCsv Quoting (a3-sec)", () => {
  beforeEach(() => {
    clearMetrics();
  });

  it("quotiert Felder mit Komma/Quote nach RFC 4180", () => {
    recordGeneration({
      timestamp: 1,
      bookId: 'buch,"spezial"',
      chapterCount: 2,
      totalTokens: 100,
      durationMs: 50,
      success: true,
      provider: "ollama",
      model: "m",
    });
    const csv = exportCsv();
    const row = csv.split("\n")[1];
    expect(row).toContain('"buch,""spezial"""');
    expect(csv.split("\n")[0]).toBe(
      "timestamp,bookId,chapterCount,totalTokens,durationMs,success,provider,model",
    );
  });

  it("lässt einfache Felder unquotiert", () => {
    recordGeneration({
      timestamp: 1,
      bookId: "b1",
      chapterCount: 1,
      totalTokens: 10,
      durationMs: 5,
      success: true,
      provider: "ollama",
      model: "llama",
    });
    expect(exportCsv().split("\n")[1]).toBe("1,b1,1,10,5,true,ollama,llama");
  });
});

describe("formatCorrelationLog Guard (a3-sec)", () => {
  it("crasht nicht bei zirkulären Daten", () => {
    const circ: Record<string, unknown> = {};
    circ.self = circ;
    expect(() => formatCorrelationLog("c1", "msg", circ)).not.toThrow();
    expect(formatCorrelationLog("c1", "msg", circ)).toContain("[unserializable data]");
  });
});
