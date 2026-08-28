// AI Writing Assistant — Dialog-Generator
// Erzeugt realistische Dialoge zwischen Charakteren mit Ziel, Konflikt
// und Untertext (Subtext). Das LLM liefert strukturierte Dialogzeilen.

import type { AppSettings } from "@/types/config";
import type { ChatMessage } from "@/types/llm";
import { createProvider } from "@/services/llm";
import { createSlotProvider, findSlot } from "@/services/llm/multi";

export interface DialogCharacter {
  name: string;
  /** Kurze Beschreibung: Alter, Rolle, Sprachweise. */
  description?: string;
}

export interface DialogGeneratorRequest {
  characters: DialogCharacter[];
  /** Szene/Situation, in der der Dialog stattfindet. */
  situation: string;
  /** Was die Szene erreichen soll (Konflikt, Enthüllung, Annäherung …). */
  goal?: string;
  /** Untertext aktiv: Figuren sagen nicht, was sie meinen. */
  withSubtext?: boolean;
  /** Ungefähre Anzahl der Dialogzeilen. */
  lineCount?: number;
  slotId?: string;
  signal?: AbortSignal;
}

export interface DialogLine {
  speaker: string;
  text: string;
  /** Optionale Regieanweisung/Handlung in Klammern. */
  stageDirection?: string;
}

export interface DialogGeneratorResult {
  lines: DialogLine[];
  raw: string;
  offline: boolean;
}

const SYSTEM_PROMPT =
  "Du bist ein Dramaturg und Dialogautor. Du schreibst realistische, lebendige Dialoge für Romane. " +
  "Regeln: Jede Figur hat eine eigene, unverwechselbare Sprechweise. Die Figuren reden nicht für den Leser, " +
  "sondern füreinander. Keine Stereotypen, keine Erklär-Ballons, keine Floskeln. Umgangssprache, Pausen und " +
  "kleine Aggressionen sind erwünscht. Ausgabeformat: Pro Zeile eine Dialogzeile im Format 'NAME: Text' — " +
  "Handlungen in Klammern vor der Äußerung, z. B. 'ANNA (stellt die Tasse ab): …'. Kein weiterer Kommentar.";

export function buildDialogPrompt(req: DialogGeneratorRequest): string {
  const chars = req.characters
    .map(
      (c) =>
        `- ${c.name}${c.description ? `: ${c.description}` : ""}`,
    )
    .join("\n");
  return (
    `FIGUREN:\n${chars}\n\n` +
    `SITUATION: ${req.situation}\n\n` +
    (req.goal ? `ZIEL DER SZENE: ${req.goal}\n\n` : "") +
    `LÄNGE: ca. ${req.lineCount ?? 8} Dialogzeilen\n` +
    (req.withSubtext
      ? "UNTERRAST: Die Figuren sprechen das Eigentliche nicht direkt aus — es schwingt mit.\n"
      : "") +
    "\nSchreibe den Dialog."
  );
}

/** Parst LLM-Ausgabe ('NAME: Text' bzw. 'NAME (Regie): Text') in Dialogzeilen. */
export function parseDialogLines(raw: string): DialogLine[] {
  const lines: DialogLine[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^([^:(\n]{1,40}?)\s*(?:\(([^)]+)\))?\s*:\s*(.+)$/);
    if (!m) continue;
    const speaker = m[1].trim().replace(/^[-*•]\s*/, "");
    if (!speaker) continue;
    lines.push({
      speaker,
      text: m[3].trim().replace(/^["„«]|["»]$/g, ""),
      stageDirection: m[2]?.trim() || undefined,
    });
  }
  return lines;
}

/** Erzeugt einen Dialog zwischen den Charakteren. */
export async function generateDialog(
  settings: AppSettings,
  req: DialogGeneratorRequest,
): Promise<DialogGeneratorResult> {
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
      { role: "user", content: buildDialogPrompt(req) },
    ];
    let raw = "";
    for await (const token of provider.chat(
      messages,
      { model: activeModel, temperature: 0.9, maxTokens: settings.maxTokens },
      req.signal,
    )) {
      raw += token;
    }
    const lines = parseDialogLines(raw);
    if (lines.length === 0) throw new Error("Keine Dialogzeilen erkannt");
    return { lines, raw, offline: false };
  } catch {
    const hint =
      "(Offline-Modus) Dialog-Generator nicht verfügbar. " +
      "Tipp: Gib jeder Figur eine eigene Sprechweise (Satzlänge, Füllwörter, Tabus) " +
      "und lasse das Ziel der Szene nur im Untertext mitschwingen.";
    return { lines: [], raw: hint, offline: true };
  }
}
