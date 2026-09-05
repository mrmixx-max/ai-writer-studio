// Tests: Kompakte System-Prompts (Sprint 7, Agent 2).
import { describe, it, expect } from "vitest";
import {
  compactSystemPromptForModel,
  compactSystemPromptForFamily,
  compactProfile,
  applyCompactProfile,
  estimateTokens,
  compactSavings,
} from "./compactPrompts";

describe("compactSystemPromptForModel", () => {
  it("DeepSeek-Modell → DeepSeek-Kompaktprompt mit Pflicht-Formulierungen", () => {
    const p = compactSystemPromptForModel("deepseek-r1:14b");
    expect(p).toContain("NUR");
    expect(p).toContain("Format exakt");
    expect(p.length).toBeLessThan(
      "Du bist ein präziser Schreib- und Analyse-Assistent. Antworte NUR mit dem angeforderten Ergebnis — keine Einleitung, keine Erklärung, keine Meta-Kommentare, keine ```-Blöcke im Output. Halte dich exakt an das geforderte Format (z. B. nur valides JSON).".length,
    );
  });

  it("Qwen-Modell → Qwen-Kompaktprompt mit Deutsch-Anforderung", () => {
    const p = compactSystemPromptForModel("qwen2.5:7b");
    expect(p).toContain("Deutsch");
  });

  it("unbekanntes Modell → neutraler Default-Prompt (nichts erfunden)", () => {
    expect(compactSystemPromptForModel("llama3.1:8b")).toBe(
      compactSystemPromptForFamily("default"),
    );
  });
});

describe("Kompaktierung: Ersparnis", () => {
  it("kompakter Prompt ist deutlich kürzer als das Original-Profil", () => {
    for (const model of ["deepseek-r1:14b", "qwen2.5:7b"]) {
      const { original, compact, saved } = compactSavings(model);
      expect(compact).toBeGreaterThan(0);
      expect(saved).toBeGreaterThan(0);
      expect(compact).toBeLessThan(original);
    }
  });

  it("kompakter DeepSeek-Prompt spart ≥ 50 % der Prompt-Tokens", () => {
    const { original, compact } = compactSavings("deepseek-r1:14b");
    expect(compact).toBeLessThanOrEqual(original * 0.5);
  });

  it("estimateTokens: ~4 Zeichen/Token (Router-Konvention)", () => {
    expect(estimateTokens("12345678")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });
});

describe("compactProfile / applyCompactProfile", () => {
  it("compactProfile übernimmt maxTokens/temperature, ersetzt nur den Prompt", () => {
    const eff = compactProfile("qwen2.5:7b");
    expect(eff.maxTokens).toBe(4096);
    expect(eff.temperature).toBe(0.7);
    expect(eff.systemPrompt).toBe(compactSystemPromptForModel("qwen2.5:7b"));
  });

  it("applyCompactProfile: fügt System-Prompt hinzu, wenn keiner existiert", () => {
    const msgs = [{ role: "user" as const, content: "Schreibe etwas." }];
    const out = applyCompactProfile("qwen2.5:7b", msgs);
    expect(out.length).toBe(2);
    expect(out[0].role).toBe("system");
    expect(out[0].content).toBe(compactSystemPromptForModel("qwen2.5:7b"));
  });

  it("applyCompactProfile: bestehender System-Prompt gewinnt (kein Überschreiben)", () => {
    const msgs = [
      { role: "system" as const, content: "Eigener Stil-Prompt" },
      { role: "user" as const, content: "Hallo" },
    ];
    expect(applyCompactProfile("qwen2.5:7b", msgs)).toBe(msgs);
  });
});
