// Tool-Calling im Hermes-Format: <tool_call> und <scratchpad>.
//
// Warum ein eigener Parser statt eines Provider-Features:
// Die Nous-Hermes-Modelle liefern Tool-Aufrufe als TEXT im Antwortstrom, nicht
// über das OpenAI-`tool_calls`-Feld. Ein Modell, das brav
// `<tool_call>{"name": "…"}</tool_call>` schreibt, würde ohne Parser als
// normaler Fließtext gelesen — der Aufruf verschwindet lautlos.
//
// Zwei Blöcke werden verstanden:
//   <scratchpad>…</scratchpad>   — Überlegung. Wird vom Nutzertext getrennt,
//                                  aber aufbewahrt (Debug/Nachvollziehbarkeit).
//   <tool_call>{"name":…,"arguments":{…}}</tool_call>
//                                — Werkzeugaufruf.
//
// Robustheit: Modelle schreiben die Blöcke uneinheitlich (Groß-/Kleinschreibung,
// Markdown-Fences darin, mehrere Aufrufe hintereinander, fehlendes
// schließendes Tag). Der Parser ist bewusst nachsichtig und repariert
// fehlerhaftes JSON über die Kaskade aus structured.ts.

import { parseJson } from "./structured";
import { getLogger } from "@/services/logger";

const log = getLogger("llm/toolCall");

/** Ein erkannter Werkzeugaufruf. */
export interface ToolCall {
  /** Name des Werkzeugs, wie vom Modell geschrieben (getrimmt). */
  name: string;
  /** Argumente als Objekt. Leeres Objekt, wenn keine/ungültige Argumente. */
  arguments: Record<string, unknown>;
  /** true, wenn die Argumente nicht als Objekt gelesen werden konnten. */
  argumentsInvalid: boolean;
}

/** Zerlegte Modell-Antwort. */
export interface ParsedResponse {
  /** Antwort ohne Scratchpad- und Tool-Call-Blöcke (das, was der Nutzer sieht). */
  text: string;
  /** Erkannter Denktext (mehrere Blöcke werden mit Leerzeile verbunden). */
  scratchpad: string;
  /** Erkannte Werkzeugaufrufe in Reihenfolge des Auftretens. */
  toolCalls: ToolCall[];
}

// Nachsichtig bei Groß/Klein, optionalen Fences und Whitespace.
const SCRATCHPAD_RE = /<scratchpad>([\s\S]*?)<\/scratchpad>/gi;
const TOOL_CALL_RE = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
// Ein offenes <tool_call> ohne schließendes Tag: bis zum nächsten Block oder Ende.
const TOOL_CALL_OPEN_RE = /<tool_call>([\s\S]*?)(?=<(?:tool_call|scratchpad)>|$)/i;

/**
 * Zerlegt eine Modell-Antwort in Text, Scratchpad und Werkzeugaufrufe.
 *
 * Reihenfolge der Blöcke bleibt erhalten (toolCalls in Auftretensreihenfolge),
 * damit eine Kette von Aufrufen nicht verdreht wird.
 */
export function parseModelResponse(raw: string): ParsedResponse {
  if (!raw || !raw.trim()) return { text: "", scratchpad: "", toolCalls: [] };

  const scratchpads: string[] = [];
  let work = raw.replace(SCRATCHPAD_RE, (_m, inner: string) => {
    const t = (inner as string).trim();
    if (t) scratchpads.push(t);
    return "";
  });

  const toolCalls: ToolCall[] = [];
  work = work.replace(TOOL_CALL_RE, (_m, inner: string) => {
    const call = parseToolCallBody(inner as string);
    if (call) toolCalls.push(call);
    return "";
  });

  // Einzelner Aufruf ohne schließendes Tag (Modell bricht mitten im Block ab).
  if (toolCalls.length === 0) {
    const open = work.match(TOOL_CALL_OPEN_RE);
    if (open) {
      const call = parseToolCallBody(open[1]);
      if (call) {
        toolCalls.push(call);
        work = work.replace(open[0], "");
      }
    }
  }

  return {
    text: work.replace(/\n{3,}/g, "\n\n").trim(),
    scratchpad: scratchpads.join("\n\n"),
    toolCalls,
  };
}

/**
 * Liest den Inhalt eines <tool_call>-Blocks.
 *
 * Unterstützte Formen:
 *   {"name":"x","arguments":{…}}     — OpenAI-artig
 *   {"tool":"x","args":{…}}          — Kurzform
 *   {"name":"x"}                     — ohne Argumente
 *   x                                — nur ein Name als Text
 */
function parseToolCallBody(body: string): ToolCall | null {
  const clean = body.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  if (!clean) return null;

  const parsed = parseJson<unknown>(clean);
  if (parsed === null) {
    // Kein JSON: Vielleicht steht nur der Werkzeugname da.
    const bare = clean.split(/[\s\n]/)[0]?.trim();
    if (bare && /^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(bare)) {
      log.warn(`tool_call ohne JSON — nur Name erkannt: ${bare}`);
      return { name: bare, arguments: {}, argumentsInvalid: false };
    }
    log.warn(`tool_call nicht lesbar: ${clean.slice(0, 120)}`);
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    log.warn("tool_call ist kein Objekt.");
    return null;
  }

  const obj = parsed as Record<string, unknown>;
  const name = String(obj.name ?? obj.tool ?? obj.function ?? "").trim();
  if (!name) {
    log.warn("tool_call ohne Namen.");
    return null;
  }

  // Argumente liegen unter arguments/args/parameters — oder direkt flach.
  const rawArgs = obj.arguments ?? obj.args ?? obj.parameters;
  if (rawArgs === undefined) {
    // Flache Form: {"name":"x","text":"…"} → alles außer name/tool ist Argument.
    const { name: _n, tool: _t, function: _f, ...rest } = obj;
    void _n; void _t; void _f;
    return { name, arguments: rest, argumentsInvalid: false };
  }

  if (typeof rawArgs === "object" && rawArgs !== null && !Array.isArray(rawArgs)) {
    return { name, arguments: rawArgs as Record<string, unknown>, argumentsInvalid: false };
  }

  // Argumente als String, der JSON enthält (kommt häufig vor).
  if (typeof rawArgs === "string") {
    const inner = parseJson<unknown>(rawArgs);
    if (inner !== null && typeof inner === "object" && !Array.isArray(inner)) {
      return { name, arguments: inner as Record<string, unknown>, argumentsInvalid: false };
    }
  }

  return { name, arguments: {}, argumentsInvalid: true };
}

/**
 * Prüft einen Aufruf gegen eine Liste erlaubter Werkzeugnamen.
 * Gibt den Aufruf zurück, wenn er erlaubt ist — sonst null.
 *
 * Bewusst streng: Ein Modell, das einen erfundenen Werkzeugnamen liefert, darf
 * nicht in die Ausführung laufen.
 */
export function acceptToolCall(call: ToolCall, allowed: readonly string[]): ToolCall | null {
  if (!allowed.includes(call.name)) {
    log.warn(`Unbekanntes Werkzeug abgelehnt: "${call.name}" (erlaubt: ${allowed.join(", ")})`);
    return null;
  }
  if (call.argumentsInvalid) {
    log.warn(`Werkzeug "${call.name}" mit ungültigen Argumenten abgelehnt.`);
    return null;
  }
  return call;
}

/**
 * Baut den Hinweis, der dem Modell das Werkzeugformat erklärt.
 * Wird an den System-Prompt gehängt, wenn Werkzeuge angeboten werden.
 */
export function buildToolInstructions(
  tools: Array<{ name: string; description: string; parameters?: string }>,
): string {
  if (tools.length === 0) return "";
  const list = tools
    .map((t) => `- ${t.name}: ${t.description}${t.parameters ? `\n  Argumente: ${t.parameters}` : ""}`)
    .join("\n");

  return (
    `Du kannst Werkzeuge benutzen. Schreibe deine Überlegung in ` +
    `<scratchpad>…</scratchpad> und einen Aufruf als\n` +
    `<tool_call>{"name":"werkzeugname","arguments":{…}}</tool_call>\n\n` +
    `Verfügbare Werkzeuge:\n${list}\n\n` +
    `Regeln:\n` +
    `- Höchstens EIN Werkzeugaufruf pro Antwort.\n` +
    `- Der Aufruf muss valides JSON im arguments-Feld enthalten.\n` +
    `- Nutze ein Werkzeug nur, wenn es die Aufgabe wirklich erfordert.`
  );
}
