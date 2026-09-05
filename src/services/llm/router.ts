// Bookwriter-Modell-Router (Sprint 2, B2 + B3).
//
// - Konfigurierbare Provider-Kette, Default: Ollama (lokal) → OpenRouter (Cloud).
// - Fallback-Trigger (konservativ): healthCheck rot, 2 Retry-Endfehler,
//   Timeout-Quote > 50 %. KEIN Fallback bei Abort oder 4xx.
// - Modell-Matrix nach Aufgabe: outline=stark, chapter=Hauptmodell,
//   summary/entities=schnelles Modell, repair=Hauptmodell.
// - Pro Call: provider, model, latency_ms, tokens_est, fallback_reason.
import type { ChatMessage, ChatOptions } from "@/types/llm";
import { ProviderError } from "@/types/llm";
import { OllamaProvider } from "./ollama";
import { OpenRouterProvider } from "./openrouter";
import { classifyError } from "@/services/writing/retry";

// --- B3: Modell-Matrix -------------------------------------------------------

/** Aufgaben-Typen des Bookwriters mit Qualitäts-Anforderung. */
export type BookwriterTaskKind = "outline" | "chapter" | "summary" | "entities" | "repair" | "metadata";

// --- Sprint 3: Spezialisiertes Agenten-Routing (Logik vs. Kreativ) ----------

/**
 * Sprint 3: Aufgaben-Klassen. "logic" = Faktenchecks, Entitäten-Extraktion,
 * Konsistenzprüfungen, Reparaturen → spezialisiertes Logik-Modell.
 * "creative" = reine Textgenerierung → kreatives Modell.
 */
export type TaskClass = "logic" | "creative";

/**
 * Sprint 3: Zuordnung Aufgabe → Modell-Rolle. LLM-Faktenchecks und
 * JSON-Reparatur brauchen strikte Befolgung — reine Kapitel-/Zusammen-
 * fassungs-Generierung profitiert von kreativen Modellen.
 */
export const TASK_CLASS_MATRIX: Record<BookwriterTaskKind, TaskClass> = {
  outline: "creative",
  chapter: "creative",
  summary: "creative",
  entities: "logic",
  repair: "logic",
  metadata: "creative",
};

/** Rollen-Namen für die Modellkonfiguration. */
export type TaskModelRole = "main" | "fast" | "strong" | "logic";

/** Erweiterte Modell-Config: logic = spezialisiertes Logik-/Faktencheck-Modell. */
export interface TaskModelsWithLogic extends TaskModels {
  /** Spezialisiertes Logik-Modell (Faktenchecks, JSON-Reparatur). Optional. */
  logic?: string;
}

/**
 * Wählt das Modell für eine Aufgabe unter Berücksichtigung der Aufgaben-Klasse
 * (Sprint 3). Logik-Aufgaben (entities/repair) bekommen bevorzugt das
 * spezialisierte Logik-Modell, sonst gilt die bestehende Modell-Matrix.
 * Konservativ: ohne logic-Kandidat bleibt es beim Matrix-Ergebnis —
 * es wird nie ein Modell erfunden.
 */
export function pickModelWithTaskClass(
  task: BookwriterTaskKind,
  models: TaskModelsWithLogic,
  available: string[] = [],
): string {
  if (TASK_CLASS_MATRIX[task] === "logic" && models.logic) return models.logic;
  return pickModelForTask(task, models, available);
}

/** Klassifiziert eine Aufgabe (für Router-Metadaten/Telemetrie). */
export function taskClassOf(task: BookwriterTaskKind): TaskClass {
  return TASK_CLASS_MATRIX[task];
}


export type ModelQuality = "strong" | "main" | "fast";

/** B3: Matrix Aufgabe → benötigte Qualität. outline=stark, chapter/repair=Haupt, summary/entities=schnell. */
export const MODEL_MATRIX: Record<BookwriterTaskKind, ModelQuality> = {
  outline: "strong",
  chapter: "main",
  summary: "fast",
  entities: "fast",
  repair: "main",
  metadata: "fast",
};

/** Modelle je Provider-Eintrag. */
export interface TaskModels {
  /** Hauptmodell (chapter, repair, Default für alles). */
  main: string;
  /** Schnelles Modell für summary/entities (optional). */
  fast?: string;
  /** Starkes Modell für outline (optional). */
  strong?: string;
}

/**
 * Auto-Heuristik (konservativ): erkennt bekannte kleine/große Modelle anhand
 * des Namens. Erfindet NIE Modell-IDs — ohne Treffer bleibt es beim
 * Hauptmodell.
 */
const FAST_MODEL_PATTERN = /(^|[:/\-.])(llama3\.2\b|qwen.*0\.5b\b|.*\b(1b|3b)\b|\bmini\b|\bflash\b|\bsmall\b|\btiny\b)/i;
const STRONG_MODEL_PATTERN = /(70b|72b|405b|\blarge\b|\bpro\b|\bopus\b|\bmax\b)/i;

export function looksLikeFastModel(model: string): boolean {
  return FAST_MODEL_PATTERN.test(model);
}

export function looksLikeStrongModel(model: string): boolean {
  return STRONG_MODEL_PATTERN.test(model);
}

/**
 * Wählt das Modell für eine Aufgabe nach Modell-Matrix (B3).
 * Priorität: explizit konfiguriert (fast/strong) > Auto-Heuristik über die
 * verfügbaren Kandidaten > Hauptmodell (konservativer Fallback).
 */
export function pickModelForTask(task: BookwriterTaskKind, models: TaskModels, available: string[] = []): string {
  const quality = MODEL_MATRIX[task];
  if (quality === "fast" && models.fast) return models.fast;
  if (quality === "strong" && models.strong) return models.strong;

  // Auto-Heuristik: nur aus explizit verfügbaren Kandidaten wählen.
  if (available.length > 0) {
    if (quality === "fast") {
      const fast = available.find((m) => looksLikeFastModel(m));
      if (fast) return fast;
    }
    if (quality === "strong") {
      const strong = available.find((m) => looksLikeStrongModel(m));
      if (strong) return strong;
    }
  }
  // Konservativ: Hauptmodell.
  return models.main;
}

// --- B2: Fallback-Routing ----------------------------------------------------

/** Grobe Token-Schätzung (~4 Zeichen/Token, modellunabhängig). */
export function estimateTokensRouter(text: string): number {
  return Math.ceil(text.length / 4);
}

export type RouterProviderId = "ollama" | "openrouter";

export interface RouterChainSpec {
  provider: RouterProviderId;
  /** Nur für ollama. */
  baseUrl?: string;
  /** Nur für openrouter. */
  apiKey?: string;
  models?: TaskModels;
}

/** Konfiguration der Router-Kette. Default: Ollama → OpenRouter. */
export interface BookwriterRouterConfig {
  chain: RouterChainSpec[];
  /** Timeout-Quote in Prozent, ab der ein Provider umgangen wird (B2). Default 50. */
  timeoutQuotaPercent?: number;
  /** Anzahl Retry-Endfehler, bevor gefallbackt wird (B2). Default 2. */
  retryErrorLimit?: number;
}

export const DEFAULT_ROUTER_CONFIG: BookwriterRouterConfig = {
  chain: [
    { provider: "ollama", baseUrl: "http://127.0.0.1:11434" },
    { provider: "openrouter" },
  ],
  timeoutQuotaPercent: 50,
  retryErrorLimit: 2,
};

/** Grund für eine Provider-Umschaltung (fallback_reason). */
export type FallbackReason = "health_check_failed" | "retry_exhausted" | "timeout_quota_exceeded";

/** Telemetrie eines einzelnen Calls (B2). */
export interface RouterCallMeta {
  provider: string;
  model: string;
  latency_ms: number;
  tokens_est: number;
  /** Warum ein anderer Provider als der erste der Kette bedient hat (null = keiner). */
  fallback_reason: FallbackReason | null;
  task: BookwriterTaskKind;
  /** Sprint 3: Aufgaben-Klasse (logic= Faktencheck/Reparatur, creative= Generierung). */
  task_class?: TaskClass;
  ok: boolean;
}

export interface RouterResult {
  text: string;
  meta: RouterCallMeta;
}

/**
 * Erzeugt eine LLMProvider-Instanz aus einer Kettenspezifikation.
 * Cloud-Provider werden NUR erzeugt, wenn ein API-Key gesetzt ist —
 * ohne Key wird die Spec übersprungen (null).
 */
export function instantiateChainSpec(spec: RouterChainSpec): { id: RouterProviderId; provider: import("@/types/llm").LLMProvider } | null {
  switch (spec.provider) {
    case "ollama":
      return { id: "ollama", provider: new OllamaProvider(spec.baseUrl ?? "http://127.0.0.1:11434") };
    case "openrouter":
      if (!spec.apiKey) return null; // ohne Key keine Cloud-Kette
      return { id: "openrouter", provider: new OpenRouterProvider(spec.apiKey) };
    default:
      return null;
  }
}

/**
 * Bookwriter-Router: führt complete-Aufrufe über die Provider-Kette aus
 * und liefert pro Call Telemetrie (B2). Abort/4xx brechen SOFORT ab —
 * kein Fallback.
 */
export class BookwriterRouter {
  readonly entries: Array<{ id: RouterProviderId; spec: RouterChainSpec; provider: import("@/types/llm").LLMProvider }> = [];
  private state: Array<{ calls: number; timeouts: number; consecutiveRetryFailures: number }> = [];
  private readonly timeoutQuotaPercent: number;
  private readonly retryErrorLimit: number;
  private readonly onCall?: (meta: RouterCallMeta) => void;

  constructor(config: BookwriterRouterConfig, hooks?: { onCall?: (meta: RouterCallMeta) => void }) {
    this.timeoutQuotaPercent = config.timeoutQuotaPercent ?? 50;
    this.retryErrorLimit = config.retryErrorLimit ?? 2;
    this.onCall = hooks?.onCall;
    for (const spec of config.chain) {
      const inst = instantiateChainSpec(spec);
      if (!inst) continue; // z.B. OpenRouter ohne Key
      this.entries.push({ id: inst.id, spec, provider: inst.provider });
      this.state.push({ calls: 0, timeouts: 0, consecutiveRetryFailures: 0 });
    }
  }

  /** Timeout-Quote eines Providers in Prozent (0 bei keinen Calls). */
  timeoutQuota(idx: number): number {
    const s = this.state[idx];
    return s.calls === 0 ? 0 : Math.round((s.timeouts / s.calls) * 100);
  }

  /** Modelle eines Chain-Eintrags (Hauptmodell = spec.models.main oder Fallback). Sprint 3: inkl. logic-Rolle. */
  modelsFor(idx: number, fallbackMain: string): TaskModelsWithLogic {
    const spec = this.entries[idx].spec;
    return {
      main: spec.models?.main ?? fallbackMain,
      fast: spec.models?.fast,
      strong: spec.models?.strong,
      logic: (spec.models as TaskModelsWithLogic | undefined)?.logic,
    };
  }

  /**
   * Führt eine Chat-Anfrage über die Kette aus.
   * Reihenfolge: healthCheck rot → Timeout-Quote → bis zu retryErrorLimit
   * Retry-Runden → nächster Provider. Abort/4xx werden sofort geworfen.
   */
  async complete(
    task: BookwriterTaskKind,
    messages: ChatMessage[],
    opts: { model?: string; temperature?: number; maxTokens?: number; timeoutMs?: number },
    signal?: AbortSignal,
  ): Promise<RouterResult> {
    if (this.entries.length === 0) {
      throw new Error("Bookwriter-Router: keine Provider in der Kette konfiguriert.");
    }
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const errors: unknown[] = [];
    let fallbackReason: FallbackReason | null = null;

    for (let idx = 0; idx < this.entries.length; idx++) {
      const entry = this.entries[idx];
      const state = this.state[idx];

      // Trigger 1: healthCheck rot → nächster Provider.
      const healthy = await entry.provider.healthCheck().catch(() => false);
      if (!healthy) {
        errors.push(new Error(`${entry.id}: healthCheck fehlgeschlagen`));
        fallbackReason = "health_check_failed";
        console.warn(`[Bookwriter-Router] ${entry.id} healthCheck rot — nächster Provider.`);
        continue;
      }

      // Trigger 2: Timeout-Quote > Limit (min. 2 Calls für eine Aussage).
      if (state.calls >= 2 && this.timeoutQuota(idx) > this.timeoutQuotaPercent) {
        fallbackReason = "timeout_quota_exceeded";
        console.warn(
          `[Bookwriter-Router] ${entry.id} Timeout-Quote ${this.timeoutQuota(idx)}% > ${this.timeoutQuotaPercent}% — Provider wird umgangen.`,
        );
        continue;
      }

      const models = this.modelsFor(idx, opts.model ?? "");
      // Sprint 3: Logik-/Faktencheck-Aufgaben bevorzugt an spezialisierte
      // Logik-Modelle, Kreativ-Aufgaben an das Matrix-Modell.
      const model = pickModelWithTaskClass(task, models, []);
      const chatOpts: ChatOptions = {
        model,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        timeoutMs: opts.timeoutMs,
      };

      const startedAt = Date.now();
      // Bis zu retryErrorLimit Versuche (B2: "2 Retry-Endfehler" → dann
      // Fallback). Klassifikation via classifyError: Abort/4xx fliegen
      // sofort, Timeout/Netzwerk/JSON zählen als Retry-Endfehler.
      const attempts = Math.max(1, this.retryErrorLimit);
      for (let round = 0; round < attempts; round++) {
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        try {
          const chunks: string[] = [];
          for await (const chunk of entry.provider.chat(messages, chatOpts, signal)) {
            chunks.push(chunk);
          }
          const latency = Date.now() - startedAt;
          state.calls += 1;
          state.consecutiveRetryFailures = 0;
          const text = chunks.join("");
          const meta: RouterCallMeta = {
            provider: entry.id,
            model,
            latency_ms: latency,
            tokens_est: estimateTokensRouter(text),
            fallback_reason: fallbackReason,
            task,
            task_class: taskClassOf(task),
            ok: true,
          };
          this.onCall?.(meta);
          return { text, meta };
        } catch (e: unknown) {
          const kind = classifyError(e);
          // KEIN Fallback bei Abort — Abbruch gehört zum Vertrag.
          // (TimeoutError ist KEIN Abort: Timeouts sind retry-/fallbackbar.)
          if (kind === "abort") throw e;
          // KEIN Fallback bei 4xx — Client-Fehler, anderer Provider hilft nicht.
          if (kind === "http4xx") throw e;
          state.calls += 1;
          if (kind === "timeout") state.timeouts += 1;
          state.consecutiveRetryFailures += 1;
          errors.push(e);
        }
      }
      // Versuche aufgebraucht → Fallback auf den nächsten Provider.
      fallbackReason = "retry_exhausted";
    }

    throw new ProviderError(
      `Alle Provider fehlgeschlagen (${this.entries.length} in der Kette). Letzter Fehler: ${
        errors.length
          ? String((errors[errors.length - 1] as Error)?.message ?? errors[errors.length - 1])
          : "unbekannt"
      }`,
      errors[errors.length - 1],
    );
  }
}

/** Default-Kette: Ollama zuerst, OpenRouter als Cloud-Fallback (B2). */
export function defaultChain(settingsLike: { ollamaBaseUrl?: string; openrouterApiKey?: string }): RouterChainSpec[] {
  const chain: RouterChainSpec[] = [
    { provider: "ollama", baseUrl: settingsLike.ollamaBaseUrl ?? "http://127.0.0.1:11434" },
  ];
  if (settingsLike.openrouterApiKey) {
    chain.push({ provider: "openrouter", apiKey: settingsLike.openrouterApiKey });
  }
  return chain;
}