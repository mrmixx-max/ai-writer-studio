// AI Writing Assistant — Writing-Prompts
// KI-generierte Schreibimpulse, an Projekt/Genre/Text anknüpfbar.
// Offline-Fallback: lokaler Prompt-Würfel (Elemente-Kombinatorik).

import type { AppSettings } from "@/types/config";
import type { ChatMessage } from "@/types/llm";
import { createProvider } from "@/services/llm";
import { createSlotProvider, findSlot } from "@/services/llm/multi";

export interface WritingPromptRequest {
  genre?: string;
  /** Bisheriger Text/Kontext, damit der Impulse anknüpft. */
  context?: string;
  /** Art des Impulses. */
  kind?: "szene" | "konflikt" | "figur" | "ort" | "öffnung" | "frei";
  count?: number;
  slotId?: string;
  signal?: AbortSignal;
}

export interface WritingPrompt {
  text: string;
  kind: string;
  offline: boolean;
}

const KIND_LABELS: Record<string, string> = {
  szene: "eine konkrete Szene",
  konflikt: "einen Konflikt oder eine Zuspitzung",
  figur: "eine Figur mit Geheimnis oder Widerspruch",
  ort: "einen Ort mit eigener Atmosphäre",
  öffnung: "einen ersten Satz / Eröffnungssatz",
  frei: "einen freien Schreibimpuls",
};

const SYSTEM_PROMPT =
  "Du bist ein inspirierender Schreibcoach. Du lieferst präzise, bildhafte Schreibimpulse — " +
  "keine Gemeinplätze, keine Abstraktionen ohne Bild. Jeder Impuls ist ein konkreter Funke: " +
  "Person, Ort, Gegenstand, Bruch — so, dass sofort geschrieben werden kann. Nummeriere die Impulse " +
  "(1., 2., …), ein Impuls pro Zeile, keine Erklärungen.";

export function buildWritingPromptPrompt(req: WritingPromptRequest): string {
  const kind = KIND_LABELS[req.kind ?? "frei"] ?? KIND_LABELS.frei;
  return (
    `Genre/Fokus: ${req.genre?.trim() || "offen"}\n` +
    `Gewünscht: ${kind}\n` +
    `Anzahl: ${req.count ?? 5}\n` +
    (req.context?.trim()
      ? `\nAnknüpfen an den bestehenden Text (Impulse müssen dorthin passen):\n${req.context.slice(0, 1500)}\n`
      : "")
  );
}

/** Lokaler Prompt-Würfel für den Offline-Fallback. */
const DICE = {
  person: ["eine Frau, die Wartezeiten sammelt", "ein Kartograf ohne Ziel", "ein Junge, der Schatten zählt", "eine Pfarrerswitwe mit Motorrad", "ein Schatztaucher mit Höhenangst", "eine Dolmetscherin, die lügt, wenn sie müde ist"],
  ort: ["eine Tankstelle kurz nach Mitternacht", "ein verlassenes Freibad im Winter", "der letzte Nachtzug ins Ruhrgebiet", "eine Kapelle mit neuem Dach", "ein Antiquariat mit feuchtem Keller", "eine Fähre, die nur Fahrkarten für Hinwege verkauft"],
  gegenstand: ["ein Schlüssel ohne Schloss", "eine Kassette mit fremder Stimme", "ein gestrichener Name in einem Fotoalbum", "ein Regenschirm mit Loch", "eine Postkarte, die 40 Jahre unterwegs war", "ein Angsthase aus Plüsch mit Zähnen"],
  bruch: ["plötzlich schweigen alle Telefone", "jemand kennt einen beim Namen, obwohl man fremd ist", "die Tür ist im Treppenhaus eine Etappe weiter", "der Regen fällt nur auf einer Straßenseite", "das Tier verhält sich menschlich", "die Uhr geht rückwärts"],
} as const;

export function localWritingPrompt(count = 5): string[] {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const out: string[] = [];
  const used = new Set<string>();
  while (out.length < count && used.size < 60) {
    const text = `Schreibe: ${pick(DICE.person)} an ${pick(DICE.ort)} — im Spiel: ${pick(DICE.gegenstand)}. Und dann: ${pick(DICE.bruch)}.`;
    if (used.has(text)) continue;
    used.add(text);
    out.push(text);
  }
  return out;
}

/** Holt Schreibimpulse vom LLM (Offline-Fallback: lokaler Würfel). */
export async function generateWritingPrompts(
  settings: AppSettings,
  req: WritingPromptRequest,
): Promise<WritingPrompt[]> {
  const count = req.count ?? 5;
  const slot =
    req.slotId && settings.kiModelSlots?.length
      ? findSlot(settings.kiModelSlots, req.slotId)
      : undefined;
  const provider = slot ? createSlotProvider(settings, slot) : createProvider(settings);
  const activeModel = slot?.model ?? settings.model;
  const kind = req.kind ?? "frei";

  try {
    const healthy = await provider.healthCheck();
    if (!healthy) throw new Error("Provider offline");
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildWritingPromptPrompt(req) },
    ];
    let raw = "";
    for await (const token of provider.chat(
      messages,
      { model: activeModel, temperature: 1.0, maxTokens: 600 },
      req.signal,
    )) {
      raw += token;
    }
    const prompts = raw
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^\d+[.)]\s*/, "").replace(/^[-*•]\s*/, ""))
      .filter((l) => l.length > 15)
      .slice(0, count)
      .map((text) => ({ text, kind, offline: false }));
    if (prompts.length === 0) throw new Error("Keine Impulse erkannt");
    return prompts;
  } catch {
    return localWritingPrompt(count).map((text) => ({ text, kind, offline: true }));
  }
}
