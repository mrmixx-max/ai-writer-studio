// KI-Panel-Service: führt die 6 Aktionen über den LLM-Provider aus.
// Streaming ins Panel, robust mit Offline-Fallback.

import type { AppSettings } from "@/types/config";
import { createProvider } from "@/services/llm";
import { OFFLINE_PROMPTS } from "@/services/prompt/offlinePrompts";
import type { KIRequest, KIResult } from "./types";

const ACTION_PROMPTS: Record<string, (req: KIRequest) => string> = {
  weiterschreiben: (req) =>
    `Schreibe den folgenden Text natürlich und im gleichen Stil weiter. Füge keinen Kommentar hinzu, nur den Fortsetzungstext.\n\nKONTEXT (bisheriges Dokument):\n${req.context}\n\nMARKIERTER TEXT (dort ansetzen):\n${req.selection}`,

  umschreiben: (req) =>
    `Schreibe den markierten Text im Stil "${req.style ?? "sachlich"}" um. Behalte die Bedeutung bei. Nur den umgeschriebenen Text ausgeben.\n\nTEXT:\n${req.selection}`,

  zusammenfassen: (req) =>
    `Fasse den folgenden Text prägnant zusammen (max. 1/3 der Länge). Nur die Zusammenfassung ausgeben.\n\nTEXT:\n${req.selection || req.context}`,

  korrektur: (req) =>
    `Korrigiere Rechtschreibung und Grammatik des folgenden deutschen Textes. Behalte Stil und Satzbau bei. Gib NUR den korrigierten Text zurück, keinen Erläuterungen.\n\nTEXT:\n${req.selection || req.context}`,

  brainstorming: (req) =>
    `Gib eine Liste von 5 konkreten, kreativen Ideen/Ideenanstößen für den folgenden Text/Ansatz. Deutsch, präzise, keine Floskeln.\n\nAUSGANGSPUNKT:\n${req.selection || req.context}`,

  chat: (req) =>
    `Dokumentkontext (falls relevant):\n${req.context}\n\nNutzerfrage: ${req.chatMessage ?? ""}`,
};

const SYSTEM_PROMPT =
  "Du bist ein hilfreicher Schreibassistent für Autoren. Antworte auf Deutsch, präzise, im Ton des Textes. Keine Einleitungsfloskel.";

/** Führt eine KI-Aktion aus. Streamt Token via onToken. */
export async function runKIAction(
  settings: AppSettings,
  req: KIRequest,
  onToken: (t: string) => void,
): Promise<KIResult> {
  const provider = createProvider(settings);
  const healthy = await provider.healthCheck().catch(() => false);
  if (!healthy) {
    // Offline-Fallback: generischen Hinweistext + zufälligen Prompt als Inspiration
    const fallback = OFFLINE_PROMPTS[Math.floor(Math.random() * OFFLINE_PROMPTS.length)];
    const msg = `(Offline-Modus) Provider nicht erreichbar. Inspiration:\n${fallback.text}`;
    onToken(msg);
    return { text: msg, offline: true };
  }

  const userContent = ACTION_PROMPTS[req.action](req);
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: userContent },
  ];

  let raw = "";
  try {
    for await (const token of provider.chat(messages, {
      model: settings.model,
      temperature: req.action === "korrektur" || req.action === "zusammenfassen" ? 0.3 : 0.8,
      maxTokens: settings.maxTokens,
    })) {
      raw += token;
      onToken(token);
    }
  } catch (e) {
    const msg = `Fehler bei KI-Aufruf: ${(e as Error).message}`;
    onToken(msg);
    return { text: msg, offline: true };
  }
  return { text: raw, offline: false };
}
