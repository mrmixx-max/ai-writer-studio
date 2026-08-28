// AI Writing Assistant — Auto-Complete
// Kontextbasierte Vorschläge während des Tippens: schickt die letzten
// Zeichen des Dokuments an das LLM und liefert 1–3 kurze Fortsetzungen.
// Enthält Debounce-Logik + Offline-Fallback (heuristische Wortfortsetzung).

import type { AppSettings } from "@/types/config";
import type { ChatMessage } from "@/types/llm";
import { createProvider } from "@/services/llm";
import { createSlotProvider, findSlot } from "@/services/llm/multi";

export interface AutoCompleteRequest {
  /** Text direkt vor der Cursor-Position (empfohlen: letzte ~500 Zeichen). */
  prefix: string;
  /** Text nach der Cursor-Position (optional, für Kontinuität). */
  suffix?: string;
  /** Multi-Modell-Slot (optional). */
  slotId?: string;
  /** Abbruch für veraltete Requests (neues Tippen macht alte hinfällig). */
  signal?: AbortSignal;
}

export interface AutoCompleteSuggestion {
  text: string;
  kind: "llm" | "heuristic" | "offline";
}

const SYSTEM_PROMPT =
  "Du bist ein Auto-Complete-Assistent für Romane. Vervollständige den Text an der Cursor-Position. " +
  "Antworte NUR mit dem Fortsetzungstext (max. 1–2 Sätze), keine Erklärung, kein Zitat des Kontexts. " +
  "Schreibe im Stil und Genre des Kontexts, auf Deutsch.";

const ACTION_PROMPT = (req: AutoCompleteRequest): string =>
  `KONTEXT (Ende des Dokuments):\n${req.prefix}\n\n` +
  (req.suffix?.trim()
    ? `FORTSETZUNG NACH DER EINFÜGESTELLE (nicht wiederholen):\n${req.suffix.slice(0, 300)}\n\n`
    : "") +
  "Vervollständige an der Einfügestelle:";

/** Debounce-Helfer: ruft fn erst nach `ms` Stille auf. */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  ms: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wrapped = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  return wrapped;
}

/**
 * Heuristischer Offline-Fallback: wiederholt zuletzt gesehene Wortmuster.
 * Liefert bis zu 3 Fortsetzungskandidaten ohne LLM.
 */
export function heuristicSuggestions(prefix: string, max = 3): string[] {
  const words = prefix.split(/\s+/).filter(Boolean);
  if (words.length < 3) return [];
  const out: string[] = [];
  // N-Gramm-Fortsetzung: suche letztes Bi-Gramm im weiteren Text
  const bigram = words.slice(-2).join(" ").toLowerCase();
  const lower = prefix.toLowerCase();
  const idx = lower.lastIndexOf(bigram, Math.max(0, lower.length - bigram.length - 1));
  if (idx >= 0) {
    const after = prefix.slice(idx + bigram.length).trim();
    const nextWords = after.split(/\s+/).slice(0, 6).join(" ");
    if (nextWords) out.push(nextWords);
  }
  // Satzstarter-Vorschläge aus dem Text selbst
  const starters = Array.from(prefix.matchAll(/([A-ZÄÖÜ][^.!?]{10,60}[.,])/g))
    .map((m) => m[1])
    .slice(-max);
  for (const s of starters) {
    if (out.length >= max) break;
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, max);
}

/** Holt Auto-Complete-Vorschläge vom LLM (mit Heuristik-Fallback). */
export async function fetchAutoComplete(
  settings: AppSettings,
  req: AutoCompleteRequest,
): Promise<AutoCompleteSuggestion[]> {
  if (!req.prefix.trim()) return [];

  const slot =
    req.slotId && settings.kiModelSlots?.length
      ? findSlot(settings.kiModelSlots, req.slotId)
      : undefined;
  const provider = slot ? createSlotProvider(settings, slot) : createProvider(settings);
  const activeModel = slot?.model ?? settings.model;

  try {
    const healthy = await provider.healthCheck();
    if (!healthy) throw new Error("Provider offline");
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: ACTION_PROMPT(req) },
    ];
    let text = "";
    for await (const token of provider.chat(
      messages,
      { model: activeModel, temperature: 0.5, maxTokens: 80 },
      req.signal,
    )) {
      text += token;
      if (text.length > 400) break; // hartes Limit, Auto-Complete soll kurz bleiben
    }
    // Nur den ersten Vorschlag als LLM-Vorschlag, ggf. auf Satz/Grenze kürzen
    let suggestion = text.trim().replace(/^["„»\s]+/, "");
    const stop = suggestion.search(/[.!?…](?=\s|$)/);
    if (stop >= 0 && stop > 20) suggestion = suggestion.slice(0, stop + 1);
    if (!suggestion) throw new Error("Leere Antwort");
    return [{ text: suggestion, kind: "llm" }];
  } catch {
    // Offline / Fehler → Heuristik
    return heuristicSuggestions(req.prefix).map((text) => ({
      text,
      kind: "offline" as const,
    }));
  }
}
