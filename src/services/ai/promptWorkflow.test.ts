// Unit-Tests: Prompt-Workflow-Service (WP 17.1 — Hermes Workflow-Studio)
// ALLE Tests lokal, deterministisch, KEINE LLM-Calls, KEIN Netzwerk.
import { describe, it, expect } from "vitest";
import {
  createCustomAssistant,
  buildPromptChain,
  executeChain,
  estimateTokens,
  estimateCost,
  type AssistantConfig,
  type PromptStep,
} from "@/services/ai/promptWorkflow";

// ─── createCustomAssistant ──────────────────────────────────────────────────

describe("createCustomAssistant", () => {
  it("erstellt einen Assistenten mit allen Feldern", () => {
    const config: AssistantConfig = {
      name: "Mein Assistent",
      systemPrompt: "Du bist ein hilfreicher Schreibassistent.",
      fewShotExamples: [{ input: "Hallo", output: "Hallo! Wie kann ich helfen?" }],
      temperature: 0.5,
    };
    const assistant = createCustomAssistant(config);
    expect(assistant.id).toBeTruthy();
    expect(assistant.config.name).toBe("Mein Assistent");
    expect(assistant.config.systemPrompt).toBe("Du bist ein hilfreicher Schreibassistent.");
    expect(assistant.config.fewShotExamples).toHaveLength(1);
    expect(assistant.config.temperature).toBe(0.5);
    expect(assistant.createdAt).toBeGreaterThan(0);
  });

  it("verwendet Defaults bei fehlenden optionalen Feldern", () => {
    const config: AssistantConfig = {
      name: "Minimal",
      systemPrompt: "Sei hilfreich.",
    };
    const assistant = createCustomAssistant(config);
    expect(assistant.config.fewShotExamples).toEqual([]);
    expect(assistant.config.temperature).toBe(0.7);
  });

  it("filtert ungültige fewShotExamples", () => {
    const config = {
      name: "Test",
      systemPrompt: "Test",
      fewShotExamples: [
        { input: "a", output: "b" },
        { input: 123, output: "ungültig" },
        null,
        { input: "c" },
      ],
    } as unknown as AssistantConfig;
    const assistant = createCustomAssistant(config);
    expect(assistant.config.fewShotExamples).toHaveLength(1);
    expect(assistant.config.fewShotExamples?.[0].input).toBe("a");
  });

  it("klemmt temperature auf gültigen Bereich", () => {
    const config = {
      name: "Test",
      systemPrompt: "Test",
      temperature: 5.0,
    } as AssistantConfig;
    const assistant = createCustomAssistant(config);
    expect(assistant.config.temperature).toBe(2.0);
  });

  it("verwendet Fallback bei leerem Namen", () => {
    const config: AssistantConfig = {
      name: "",
      systemPrompt: "Test",
    };
    const assistant = createCustomAssistant(config);
    expect(assistant.config.name).toBe("Unbenannter Assistent");
  });
});

// ─── buildPromptChain ───────────────────────────────────────────────────────

describe("buildPromptChain", () => {
  it("erstellt eine Kette mit mehreren Schritten", () => {
    const steps: PromptStep[] = [
      { id: "s1", prompt: "Analysiere: {{text}}" },
      { id: "s2", prompt: "Verbessere: {{text}}" },
    ];
    const chain = buildPromptChain(steps);
    expect(chain.id).toBeTruthy();
    expect(chain.steps).toHaveLength(2);
    expect(chain.steps[0].id).toBe("s1");
    expect(chain.steps[1].prompt).toBe("Verbessere: {{text}}");
  });

  it("filtert leere Schritte", () => {
    const steps = [
      { id: "s1", prompt: "Gültig" },
      { id: "s2", prompt: "" },
      { id: "s3", prompt: "Auch gültig" },
    ] as PromptStep[];
    const chain = buildPromptChain(steps);
    expect(chain.steps).toHaveLength(2);
  });

  it("verwendet Default-ID bei fehlender id", () => {
    const steps = [{ prompt: "Test" }] as PromptStep[];
    const chain = buildPromptChain(steps);
    expect(chain.steps[0].id).toBe("step_1");
  });

  it("verarbeitet leeres Array defensiv", () => {
    const chain = buildPromptChain([]);
    expect(chain.steps).toEqual([]);
    expect(chain.id).toBeTruthy();
  });
});

// ─── executeChain ───────────────────────────────────────────────────────────

describe("executeChain", () => {
  it("führt eine einfache Kette aus", async () => {
    const chain = buildPromptChain([
      { id: "s1", prompt: "Analysiere: {{text}}", inputVariable: "text" },
    ]);
    const result = await executeChain(chain, "Der Hund bellt.");
    expect(result).toContain("Analysiere");
    expect(result).toContain("Der Hund bellt.");
  });

  it("verknüpft mehrere Schritt (Output → Input)", async () => {
    const chain = buildPromptChain([
      { id: "s1", prompt: "Schritt 1: {{text}}", inputVariable: "text" },
      { id: "s2", prompt: "Schritt 2: {{text}}", inputVariable: "text" },
    ]);
    const result = await executeChain(chain, "Eingabe");
    expect(result).toContain("Schritt 1");
    expect(result).toContain("Schritt 2");
  });

  it("gibt Input bei leerer Kette zurück", async () => {
    const chain = buildPromptChain([]);
    const result = await executeChain(chain, "Hallo");
    expect(result).toBe("Hallo");
  });

  it("verarbeitet leeren Input defensiv", async () => {
    const chain = buildPromptChain([
      { id: "s1", prompt: "Verarbeite: {{text}}", inputVariable: "text" },
    ]);
    const result = await executeChain(chain, "");
    expect(result).toBeTruthy();
  });
});

// ─── estimateTokens ─────────────────────────────────────────────────────────

describe("estimateTokens", () => {
  it("schätzt Tokens für einen Text", () => {
    const tokens = estimateTokens("Hallo Welt, das ist ein Test.");
    expect(tokens).toBeGreaterThan(0);
  });

  it("gibt 0 für leeren String zurück", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("skaliert mit der Länge", () => {
    const short = estimateTokens("kurz");
    const long = estimateTokens("kurz ".repeat(100));
    expect(long).toBeGreaterThan(short);
  });
});

// ─── estimateCost ───────────────────────────────────────────────────────────

describe("estimateCost", () => {
  it("berechnet Kosten für bekannten Provider", () => {
    const cost = estimateCost(1000, "openai");
    expect(cost).toBeGreaterThan(0);
  });

  it("gibt 0 für unbekannten Provider zurück", () => {
    const cost = estimateCost(1000, "unbekannt");
    expect(cost).toBe(0);
  });

  it("gibt 0 für 0 Tokens zurück", () => {
    const cost = estimateCost(0, "openai");
    expect(cost).toBe(0);
  });

  it("gibt 0 für lokale Provider zurück", () => {
    expect(estimateCost(1000, "ollama")).toBe(0);
    expect(estimateCost(1000, "lmstudio")).toBe(0);
  });
});
