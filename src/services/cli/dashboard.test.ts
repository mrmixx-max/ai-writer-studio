// Unit-Tests: CLI-Dashboard (Live-Fortschritt, Token-Verbrauch, Modell-Status).
// Reine Logik — kein Terminal nötig, renderDashboard() liefert einen String.
import { describe, it, expect } from "vitest";
import {
  createDashboard,
  upsertAgent,
  updateAgentProgress,
  recordTokens,
  renderDashboard,
  setAgentStatus,
} from "./dashboard";

describe("CLI-Dashboard", () => {
  it("startet leer mit 0 Tokens", () => {
    const d = createDashboard();
    expect(d.agents).toEqual([]);
    expect(d.tokensTotal).toBe(0);
  });

  it("zeigt Agent mit Fortschritt, Tokens und Modell-Tag (lokal)", () => {
    let d = createDashboard();
    d = upsertAgent(d, { id: "a1", label: "Kapitel-Generator", model: "qwen2.5:7b", provider: "local" });
    d = updateAgentProgress(d, "a1", { phase: "Schreibt", done: 3, total: 8 });
    d = recordTokens(d, "a1", 12500);

    const out = renderDashboard(d);
    expect(out).toContain("Kapitel-Generator");
    expect(out).toContain("Schreibt");
    expect(out).toContain("3/8");
    expect(out).toContain("12500");
    expect(out).toContain("[LOKAL]");
    expect(out).toContain("qwen2.5:7b");
  });

  it("zeigt Cloud-Modell mit [CLOUD]-Tag", () => {
    let d = createDashboard();
    d = upsertAgent(d, { id: "a2", label: "Gliederung", model: "deepseek-chat", provider: "cloud" });
    const out = renderDashboard(d);
    expect(out).toContain("[CLOUD]");
    expect(out).not.toContain("[LOKAL]");
  });

  it("rendert Fortschrittsbalken proportional (50 % → halb gefüllt)", () => {
    let d = createDashboard();
    d = upsertAgent(d, { id: "a1", label: "X", model: "m", provider: "local" });
    d = updateAgentProgress(d, "a1", { phase: "P", done: 4, total: 8 });
    const out = renderDashboard(d);
    expect(out).toContain("█".repeat(5));
    expect(out).toContain("░".repeat(5));
  });

  it("summiert Token-Verbrauch über alle Agenten in der Gesamtzeile", () => {
    let d = createDashboard();
    d = upsertAgent(d, { id: "a1", label: "A", model: "m", provider: "local" });
    d = upsertAgent(d, { id: "a2", label: "B", model: "m", provider: "cloud" });
    d = recordTokens(d, "a1", 1000);
    d = recordTokens(d, "a2", 2500);
    const out = renderDashboard(d);
    expect(out).toContain("3500");
    expect(d.tokensTotal).toBe(3500);
  });

  it("recordTokens auf unbekanntem Agent wirft", () => {
    const d = createDashboard();
    expect(() => recordTokens(d, "nope", 5)).toThrow();
  });

  it("setAgentStatus zeigt Fehler-Agent mit Statusmarker", () => {
    let d = createDashboard();
    d = upsertAgent(d, { id: "a1", label: "A", model: "m", provider: "local" });
    d = setAgentStatus(d, "a1", "error", "Timeout nach 30 s");
    const out = renderDashboard(d);
    expect(out).toContain("✗");
    expect(out).toContain("Timeout nach 30 s");
  });

  it("updateAgentProgress auf unbekanntem Agent wirft", () => {
    const d = createDashboard();
    expect(() => updateAgentProgress(d, "nope", { done: 1, total: 2 })).toThrow();
  });
});
