// Local-Model-Profile (Sprint 3, Agent 1 — Task 3).
// DeepSeek/Qwen via Ollama: konfigurierbare System-Prompts + Token-Limits,
// CORS-Header-Vertrag dokumentiert und getestet.

import { describe, it, expect, beforeEach } from "vitest";
import {
  detectLocalModelFamily,
  getLocalModelProfile,
  getEffectiveLocalModelProfile,
  configureLocalModelProfiles,
  applyLocalModelProfile,
  withLocalModelProfile,
  capMaxTokensForModel,
  ollamaRequestHeaders,
  OLLAMA_CORS_ORIGINS,
} from "./localModelProfiles";

describe("detectLocalModelFamily", () => {
  it("erkennt DeepSeek-Tags (deepseek-v3, deepseek-r1:14b) — case-insensitive", () => {
    expect(detectLocalModelFamily("deepseek-v3")).toBe("deepseek");
    expect(detectLocalModelFamily("DeepSeek-R1:14b")).toBe("deepseek");
  });

  it("erkennt Qwen-Tags (qwen2.5:7b, qwen3:32b)", () => {
    expect(detectLocalModelFamily("qwen2.5:7b")).toBe("qwen");
    expect(detectLocalModelFamily("Qwen3:32b")).toBe("qwen");
  });

  it("lässt andere Modelle neutral (llama3.2, mistral, leer)", () => {
    expect(detectLocalModelFamily("llama3.2")).toBe("default");
    expect(detectLocalModelFamily("mistral:7b")).toBe("default");
    expect(detectLocalModelFamily("")).toBe("default");
  });
});

describe("Profile: Defaults + Konfigurierbarkeit", () => {
  beforeEach(() => {
    // Overrides zwischen Tests zurücksetzen.
    configureLocalModelProfiles({ deepseek: null, qwen: null, default: null });
  });

  it("DeepSeek-Profil: strikter JSON-Prompt, hohes Token-Limit", () => {
    const p = getLocalModelProfile("deepseek-r1:14b");
    expect(p.family).toBe("deepseek");
    expect(p.systemPrompt).toContain("NUR");
    expect(p.systemPrompt).toContain("<think>");
    expect(p.maxTokens).toBeGreaterThan(4096);
  });

  it("Qwen-Profil: engeres Token-Limit als DeepSeek, instruktionsgetreuer Prompt", () => {
    const q = getLocalModelProfile("qwen2.5:7b");
    const d = getLocalModelProfile("deepseek-v3");
    expect(q.family).toBe("qwen");
    expect(q.maxTokens).toBeLessThan(d.maxTokens);
    expect(q.systemPrompt).toContain("Deutsch");
  });

  it("Default-Profil ist neutral (leerer System-Prompt) — kein Verhaltenssprung", () => {
    const p = getLocalModelProfile("llama3.2");
    expect(p.family).toBe("default");
    expect(p.systemPrompt).toBe("");
  });

  it("Konfigurierbarkeit: Overrides schlagen Familien-Defaults", () => {
    configureLocalModelProfiles({
      deepseek: { systemPrompt: "TEST-PROMPT-DEEPSEEK", maxTokens: 1234 },
      qwen: { maxTokens: 999 },
    });
    const d = getEffectiveLocalModelProfile("deepseek-v3");
    expect(d.systemPrompt).toBe("TEST-PROMPT-DEEPSEEK");
    expect(d.maxTokens).toBe(1234);
    expect(d.temperature).toBe(0.6); // nicht override't → Default bleibt
    const q = getEffectiveLocalModelProfile("qwen2.5:7b");
    expect(q.maxTokens).toBe(999);
    expect(q.systemPrompt).toContain("Schreibassistent"); // unverändert
  });

  it("null/undefined entfernt Overrides wieder (Rückkehr zu Defaults)", () => {
    configureLocalModelProfiles({ qwen: { maxTokens: 42 } });
    expect(getEffectiveLocalModelProfile("qwen3:8b").maxTokens).toBe(42);
    configureLocalModelProfiles({ qwen: null });
    expect(getEffectiveLocalModelProfile("qwen3:8b").maxTokens).not.toBe(42);
  });
});

describe("applyLocalModelProfile (Prompt-Integration)", () => {
  beforeEach(() => {
    configureLocalModelProfiles({ deepseek: null, qwen: null, default: null });
  });

  it("DeepSeek: fügt System-Prompt vor User-Message", () => {
    const msgs = applyLocalModelProfile("deepseek-r1:14b", [{ role: "user", content: "Gliederung erstellen" }]);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe("system");
    expect(msgs[0].content).toContain("<think>");
    expect(msgs[1].content).toBe("Gliederung erstellen");
  });

  it("Qwen: fügt Qwen-System-Prompt (nicht DeepSeek)", () => {
    const msgs = applyLocalModelProfile("qwen2.5:7b", [{ role: "user", content: "X" }]);
    expect(msgs[0].content).toBe(getLocalModelProfile("qwen2.5:7b").systemPrompt);
  });

  it("Default-Familie: Messages UNVERÄNDERT (kein System-Prompt injiziert)", () => {
    const msgs = [{ role: "user" as const, content: "Hallo" }];
    expect(applyLocalModelProfile("llama3.2", msgs)).toBe(msgs);
  });

  it("bestehender System-Prompt gewinnt — Profil überschreibt nicht", () => {
    const msgs = [
      { role: "system" as const, content: "EXISTIERENDER STIL-PROFIL-PROMPT" },
      { role: "user" as const, content: "X" },
    ];
    const out = applyLocalModelProfile("deepseek-v3", msgs);
    expect(out).toBe(msgs); // Referenz-identisch: nichts verändert
  });
});

describe("withLocalModelProfile + capMaxTokensForModel (Token-Limits)", () => {
  beforeEach(() => {
    configureLocalModelProfiles({ deepseek: null, qwen: null, default: null });
  });

  it("withLocalModelProfile: fehlende Optionen aus Profil, explizite schlagen Profil", () => {
    const o = withLocalModelProfile("qwen2.5:7b", { model: "qwen2.5:7b", maxTokens: 512 });
    expect(o.maxTokens).toBe(512); // explizit gewinnt
    expect(o.temperature).toBe(0.7); // aus Qwen-Profil
    expect(o.systemPrompt).toContain("Deutsch");
    expect(o.contextTokens).toBe(8192);
  });

  it("capMaxTokensForModel: DeepSeek erlaubt 8192, Qwen deckt auf 4096", () => {
    expect(capMaxTokensForModel("deepseek-v3", 8192)).toBe(8192);
    expect(capMaxTokensForModel("qwen2.5:7b", 8192)).toBe(4096);
    expect(capMaxTokensForModel("qwen2.5:7b", 2048)).toBe(2048); // kleiner bleibt
  });

  it("capMaxTokensForModel: Default-Familie durchgereicht (kein Breaking Change)", () => {
    expect(capMaxTokensForModel("llama3.2", 8192)).toBe(8192);
    expect(capMaxTokensForModel("mistral:7b", 300)).toBe(300);
  });

  it("Override: Qwen-Limit via configureLocalModelProfiles anhebbar", () => {
    configureLocalModelProfiles({ qwen: { maxTokens: 16384 } });
    expect(capMaxTokensForModel("qwen2.5:7b", 16384)).toBe(16384);
  });
});

describe("CORS-Header-Vertrag (Ollama)", () => {
  it("nur Content-Type application/json — kein Preflight-Trigger, keine Credentials", () => {
    const h = ollamaRequestHeaders();
    expect(Object.keys(h)).toEqual(["Content-Type"]);
    expect(h["Content-Type"]).toBe("application/json");
  });

  it("extra-Header werden gemergt (z. B. Autorisierung für Proxy)", () => {
    const h = ollamaRequestHeaders({ Authorization: "Bearer test" });
    expect(h["Content-Type"]).toBe("application/json");
    expect(h["Authorization"]).toBe("Bearer test");
  });

  it("dokumentierte Tauri-/Dev-Orgins für OLLAMA_ORIGINS", () => {
    expect(OLLAMA_CORS_ORIGINS).toContain("tauri://localhost");
    expect(OLLAMA_CORS_ORIGINS).toContain("http://tauri.localhost");
    expect(OLLAMA_CORS_ORIGINS).toContain("http://localhost:5173");
  });
});
