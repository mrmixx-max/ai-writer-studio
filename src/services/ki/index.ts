// KI-Panel-Service: führt die 6 Aktionen über den LLM-Provider aus.
// Streaming ins Panel, robust mit Offline-Fallback.

import type { AppSettings } from "@/types/config";
import { createProvider } from "@/services/llm";
import { createSlotProvider, findSlot } from "@/services/llm/multi";
import { OFFLINE_PROMPTS } from "@/services/prompt/offlinePrompts";
import type { KIRequest, KIResult } from "./types";

const ACTION_PROMPTS: Record<string, (req: KIRequest) => string> = {
  weiterschreiben: (req) =>
    `Schreibe den folgenden Text natürlich und im gleichen Stil weiter. Füge keinen Kommentar hinzu, nur den Fortsetzungstext.\n\nKONTEXT (bisheriges Dokument):\n${req.context}\n\nMARKIERTER TEXT (dort ansetzen):\n${req.selection}`,

  umschreiben: (req) => {
    const opts = req.rewriteOpts;
    const style = opts?.style ?? req.style ?? "sachlich";
    const lengthHint = opts?.length === "kürzer" ? "Fasse deutlich zusammen (ca. 50% der Länge)." : opts?.length === "länger" ? "Erweitere mit mehr Details und Beispielen." : "Behalte die ungefähre Länge bei.";
    const langHint = opts?.target === "en" ? "Schreibe die Antwort auf Englisch." : "Schreibe die Antwort auf Deutsch.";
    return `Schreibe den folgenden Text im Stil "${style}" um. ${lengthHint} ${langHint} Nur den umgeschriebenen Text ausgeben.\n\nTEXT:\n${req.selection}`;
  },

  zusammenfassen: (req) =>
    `Fasse den folgenden Text prägnant zusammen (max. 1/3 der Länge). Nur die Zusammenfassung ausgeben.\n\nTEXT:\n${req.selection || req.context}`,

  korrektur: (req) =>
    `Korrigiere Rechtschreibung und Grammatik des folgenden deutschen Textes. Behalte Stil und Satzbau bei. Gib NUR den korrigierten Text zurück, keinen Erläuterungen.\n\nTEXT:\n${req.selection || req.context}`,

  brainstorming: (req) =>
    `Gib eine Liste von 5 konkreten, kreativen Ideen/Ideenanstößen für den folgenden Text/Ansatz. Deutsch, präzise, keine Floskeln.\n\nAUSGANGSPUNKT:\n${req.selection || req.context}`,

  chat: (req) =>
    `Dokumentkontext (falls relevant):\n${req.context}\n\nNutzerfrage: ${req.chatMessage ?? ""}`,

  rede: (req) => buildRedePrompt(req),
};

/** Richtwert: gesprochene Wörter pro Minute (deutsch, Redetempo). */
export const REDE_WOERTER_PRO_MINUTE = 130;

/**
 * Baut den Generierungs-Prompt für eine komplette, vortragsfertige Rede.
 * Exportiert für Tests und Wiederverwendung (z. B. Redenschreiber-Panel).
 */
export function buildRedePrompt(req: KIRequest): string {
  const o = req.redeOpts ?? {
    anlass: "",
    publikum: "",
    ton: "sachlich" as const,
    minuten: 5,
    kernpunkte: "",
  };
  const minuten = Math.min(60, Math.max(1, Math.floor(o.minuten) || 5));
  const woerter = minuten * REDE_WOERTER_PRO_MINUTE;
  const punkte = o.kernpunkte
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `- ${p}`)
    .join("\n");
  const gegen = (o.gegenposition ?? "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `- ${p}`)
    .join("\n");
  return (
    `Schreibe eine komplette, vortragsfertige politische Rede auf Deutsch.\n\n` +
    `ANLASS: ${o.anlass.trim() || "(nicht angegeben)"}\n` +
    `PUBLIKUM: ${o.publikum.trim() || "(nicht angegeben)"}\n` +
    (o.funktion?.trim() ? `FUNKTION DER REDNERIN / DES REDNERS: ${o.funktion.trim()}\n` : "") +
    `TON: ${o.ton}\n` +
    `ZIELLÄNGE: ca. ${minuten} Minuten Redezeit (ca. ${woerter} Wörter)\n\n` +
    `KERNPUNKTE (unbedingt einbauen):\n${punkte || "- (keine vorgegeben)"}\n\n` +
    (gegen
      ? `GEGENPOSITIONEN (sachlich entkräften, ohne Polemik):\n${gegen}\n\n`
      : "") +
    (req.context.trim()
      ? `DOKUMENTKONTEXT (Stil-/Themenreferenz, falls relevant):\n${req.context}\n\n`
      : "") +
    `Anforderungen (politische Rhetorik): starke Eröffnung mit Hook oder aktuellem ` +
    `Bezug, klarer roter Faden mit 2–4 Hauptteilen, konkrete Forderungen statt ` +
    `Floskeln, einprägsamer Schluss mit Appell zum Handeln. Direkte Ansprache des ` +
    `Publikums („wir“-Perspektive), Sprechsprache (keine Schachtelsätze, ` +
    `Zwischenrufe einkalkulieren). Gib NUR den Redetext aus, keine Metakommentare.`
  );
}

const SYSTEM_PROMPT =
  "Du bist ein hilfreicher Schreibassistent für Autoren. Antworte auf Deutsch, präzise, im Ton des Textes. Keine Einleitungsfloskel.";

/** Führt eine KI-Aktion aus. Streamt Token via onToken. opts.signal bricht den Stream ab. */
export async function runKIAction(
  settings: AppSettings,
  req: KIRequest,
  onToken: (t: string) => void,
  opts?: { signal?: AbortSignal },
): Promise<KIResult> {
  // Multi-Modell: wenn ein Slot mit slotId existiert, diesen Provider + sein Modell nutzen
  const slot = req.slotId && settings.kiModelSlots?.length
    ? findSlot(settings.kiModelSlots, req.slotId)
    : undefined;
  const provider = slot ? createSlotProvider(settings, slot) : createProvider(settings);
  const activeModel = slot?.model ?? settings.model;
  const healthy = await provider.healthCheck().catch(() => false);
  if (!healthy) {
    // Offline-Fallback: generischen Hinweistext + zufälligen Prompt als Inspiration
    const fallback = OFFLINE_PROMPTS[Math.floor(Math.random() * OFFLINE_PROMPTS.length)];
    const msg = `(Offline-Modus) Provider nicht erreichbar. Inspiration:\n${fallback.text}`;
    onToken(msg);
    return { text: msg, offline: true };
  }

  const userContent = ACTION_PROMPTS[req.action](req);
  // Langzeit-Gedächtnis: relevante Erinnerungen dem Prompt voranstellen
  const withMemory = req.memoryContext
    ? `${req.memoryContext}\n\n${userContent}`
    : userContent;
  // Dokumenten-RAG: relevante Chunks aus Büchern/Dokumenten des Projekts
  // (Wissensindex) anhängen. Still bei leerem Index/Fehler — kein RAG.
  let ragBlock = "";
  let ragSources: string[] = [];
  if (req.projectId && req.rag?.enabled !== false) {
    try {
      const query = (
        req.chatMessage ||
        req.selection ||
        req.redeOpts?.kernpunkte ||
        withMemory
      ).slice(0, 1000);
      const { searchKnowledge, formatContextBlock, formatSourceList } =
        await import("@/services/knowledge/retrieval");
      const result = await searchKnowledge(req.projectId, query, settings, {
        limit: req.rag?.limit ?? 6,
      });
      const block = formatContextBlock(result, req.rag?.maxChars ?? 4000);
      if (block) {
        ragBlock =
          `DOKUMENTE AUS DEINEN BÜCHERN/DATEIEN (Faktenbasis — nutze sie, ` +
          `widersprich ihnen nicht):\n${block}`;
        ragSources = formatSourceList(result);
      }
    } catch {
      // RAG ist Zusatz — Fehler dürfen die Generierung nie blockieren.
    }
  }
  const finalContent = ragBlock ? `${ragBlock}\n\n${withMemory}` : withMemory;
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...(req.history ?? []),
    { role: "user" as const, content: finalContent },
  ];

  let raw = "";
  try {
    if (opts?.signal?.aborted) throw new DOMException("Abgebrochen", "AbortError");
    for await (const token of provider.chat(messages, {
      model: activeModel,
      temperature: req.action === "korrektur" || req.action === "zusammenfassen" ? 0.3 : 0.8,
      maxTokens: settings.maxTokens,
    }, opts?.signal)) {
      raw += token;
      onToken(token);
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError" || opts?.signal?.aborted) {
      throw e;
    }
    const msg = `Fehler bei KI-Aufruf: ${(e as Error).message}`;
    onToken(msg);
    return { text: msg, offline: true, ragSources };
  }
  return { text: raw, offline: false, ragSources };
}
