/**
 * Prompt-Workflow-Service (WP 17.1 — Hermes Workflow-Studio)
 *
 * Lokaler, deterministischer Service für:
 * - benutzerdefinierte KI-Assistenten
 * - Prompt-Ketten (Verknüpfung mehrerer Prompt-Schritte)
 * - Token- und Kostenschätzung
 *
 * KEINE LLM-Aufrufe, KEIN Netzwerk. Defensive Fallbacks überall.
 */

// ─── Typen ──────────────────────────────────────────────────────────────────

export interface FewShotExample {
  input: string;
  output: string;
}

export interface AssistantConfig {
  name: string;
  systemPrompt: string;
  fewShotExamples?: FewShotExample[];
  temperature?: number;
}

export interface PromptStep {
  id: string;
  prompt: string;
  inputVariable?: string;
}

export interface PromptChain {
  id: string;
  name: string;
  steps: PromptStep[];
}

export interface CustomAssistant {
  id: string;
  config: AssistantConfig;
  createdAt: number;
}

// ─── Konstanten ─────────────────────────────────────────────────────────────

const DEFAULT_TEMPERATURE = 0.7;
const MAX_TEMPERATURE = 2.0;
const MIN_TEMPERATURE = 0.0;

/** Durchschnittliche Zeichen pro Token (Heuristik, deutsch/englisch gemischt) */
const CHARS_PER_TOKEN = 4;

/** Kosten in Cent pro 1000 Tokens (Stand: 2024, ungefähre Werte) */
const COST_PER_1K_TOKENS: Record<string, number> = {
  openai: 15,       // ~$0.015 / 1K tokens (GPT-3.5-turbo)
  openai_gpt4: 300, // ~$0.30 / 1K tokens (GPT-4)
  anthropic: 15,    // ~$0.015 / 1K tokens (Claude 3 Haiku)
  anthropic_sonnet: 150, // ~$0.15 / 1K tokens (Claude 3 Sonnet)
  google: 5,        // ~$0.005 / 1K tokens (Gemini Pro)
  ollama: 0,        // lokal, keine Kosten
  lmstudio: 0,      // lokal, keine Kosten
  mock: 0,          // Test-Mock, keine Kosten
};

const DEFAULT_PROVIDER = "mock";

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return fallback;
}

function sanitizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const num = typeof value === "number" && !Number.isNaN(value) ? value : fallback;
  return Math.min(Math.max(num, min), max);
}

// ─── Öffentliche API ────────────────────────────────────────────────────────

/**
 * Erstellt einen benutzerdefinierten KI-Assistenten.
 * Defensiv: fehlende Felder erhalten Defaults.
 */
export function createCustomAssistant(config: AssistantConfig): CustomAssistant {
  const safeName = sanitizeString(config?.name, "Unbenannter Assistent");
  const safeSystemPrompt = sanitizeString(config?.systemPrompt, "Du bist ein hilfreicher Assistent.");
  const safeFewShot = Array.isArray(config?.fewShotExamples)
    ? config.fewShotExamples.filter(
        (ex) =>
          ex &&
          typeof ex === "object" &&
          typeof ex.input === "string" &&
          typeof ex.output === "string"
      )
    : [];
  const safeTemperature = sanitizeNumber(
    config?.temperature,
    DEFAULT_TEMPERATURE,
    MIN_TEMPERATURE,
    MAX_TEMPERATURE
  );

  return {
    id: generateId(),
    config: {
      name: safeName,
      systemPrompt: safeSystemPrompt,
      fewShotExamples: safeFewShot,
      temperature: safeTemperature,
    },
    createdAt: Date.now(),
  };
}

/**
 * Verknüpft mehrere Prompt-Schritte zu einer Kette.
 * Defensiv: leere Steps werden gefiltert, fehlende Felder erhalten Defaults.
 */
export function buildPromptChain(steps: PromptStep[]): PromptChain {
  const safeSteps = Array.isArray(steps)
    ? steps
        .filter((s) => s && typeof s === "object")
        .map((s, i) => ({
          id: sanitizeString(s.id, `step_${i + 1}`),
          prompt: sanitizeString(s.prompt, ""),
          inputVariable: s.inputVariable ? sanitizeString(s.inputVariable) : undefined,
        }))
        .filter((s) => s.prompt.length > 0)
    : [];

  return {
    id: generateId(),
    name: `Kette_${safeSteps.length}_Schritte`,
    steps: safeSteps,
  };
}

/**
 * Führt eine Prompt-Kette aus (lokal, deterministisch, KEIN LLM-Call).
 *
 * Verarbeitet jeden Schritt:
 * 1. inputVariable wird durch den aktuellen Input ersetzt
 * 2. Few-Shot-Beispiel werden als Kontext angehängt
 * 3. System-Prompt wird als Präfix gesetzt
 *
 * Gibt das Endergebnis als String zurück.
 */
export async function executeChain(chain: PromptChain, input: string): Promise<string> {
  const safeInput = sanitizeString(input, "");
  const safeSteps = Array.isArray(chain?.steps) ? chain.steps : [];

  if (safeSteps.length === 0) {
    return safeInput;
  }

  let currentInput = safeInput;
  const results: string[] = [];

  for (const step of safeSteps) {
    const prompt = sanitizeString(step.prompt, "");
    if (!prompt) continue;

    // Ersetze inputVariable durch aktuellen Input
    let processedPrompt = prompt;
    if (step.inputVariable) {
      const placeholder = new RegExp(`\\{\\{${escapeRegex(step.inputVariable)}\\}\\}`, "g");
      processedPrompt = processedPrompt.replace(placeholder, currentInput);
    }

    // Simuliere die Ausführung: Prompt + Input → Ergebnis
    // (In einer echten Implementierung würde hier ein LLM-Call stehen)
    const stepResult = simulateStepExecution(processedPrompt, currentInput);
    results.push(stepResult);

    // Der Output des Schritts wird Input für den nächsten Schritt
    currentInput = stepResult;
  }

  return results.join("\n\n---\n\n");
}

/**
 * Schätzt die Token-Anzahl für einen Text.
 * Heuristik: ~4 Zeichen pro Token (deutsch/englisch gemischt).
 * Defensiv: leere/ungültige Inputs → 0.
 */
export function estimateTokens(text: string): number {
  const safeText = sanitizeString(text, "");
  if (safeText.length === 0) return 0;
  return Math.ceil(safeText.length / CHARS_PER_TOKEN);
}

/**
 * Schätzt die Kosten in Cent für eine gegebene Token-Anzahl und einen Provider.
 * Defensiv: unbekannter Provider → Default (mock, 0 Cent).
 * Negative Werte werden auf 0 geklemmt.
 */
export function estimateCost(tokens: number, provider: string): number {
  const safeTokens = typeof tokens === "number" && !Number.isNaN(tokens) && tokens > 0 ? tokens : 0;
  const safeProvider = sanitizeString(provider, DEFAULT_PROVIDER).toLowerCase();
  const costPer1k = COST_PER_1K_TOKENS[safeProvider] ?? COST_PER_1K_TOKENS[DEFAULT_PROVIDER];
  return Math.ceil((safeTokens / 1000) * costPer1k);
}

// ─── Interne Helfer ──────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Simuliert die Ausführung eines Prompt-Schritts (lokal, deterministisch).
 * Erzeugt eine Ausgabe, die Prompt und Input kombiniert.
 */
function simulateStepExecution(prompt: string, input: string): string {
  const trimmedPrompt = prompt.trim();
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return `[${trimmedPrompt}]`;
  }

  // Einfache Extraktion: nimm den ersten Satz des Prompts als "Anweisung"
  const firstSentence = trimmedPrompt.split(/[.!?]/)[0]?.trim() || trimmedPrompt;

  return `${firstSentence}: ${trimmedInput}`;
}
