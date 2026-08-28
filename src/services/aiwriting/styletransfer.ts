// AI Writing Assistant — Style Transfer
// Schreibt Text in einen literarischen Zielstil um (Jünger, Hemingway, …).

import type { AppSettings } from "@/types/config";
import type { ChatMessage } from "@/types/llm";
import { createProvider } from "@/services/llm";
import { createSlotProvider, findSlot } from "@/services/llm/multi";

export interface StyleDefinition {
  id: string;
  label: string;
  /** Stil-Merkblatt, das in den System-Prompt eingeht. */
  brief: string;
  temperature: number;
}

export const LITERARY_STYLES: StyleDefinition[] = [
  {
    id: "juenger",
    label: "Ernst Jünger",
    temperature: 0.7,
    brief:
      "Kühle, präzise, distinguierte Prosa. Lange, geschlossene Sätze; selten Konjunktionen wie 'weil' oder 'dass'. " +
      "Genau beobachtete Natur- und Sachdetails, Präzision der Namen und Materialien (Baumarten, Waffen, Gewitterwolken). " +
      "Gelassene, unerschrockene Grundhaltung; das Schreckliche wird sachlich-notiert, nicht beklagt. " +
      "Keine Umgangssprache, keine Idiotismen; eher substantivierte Verben, Fremdwörter erlaubt. Nüchterner, fast heraldischer Ton.",
  },
  {
    id: "hemingway",
    label: "Ernest Hemingway",
    temperature: 0.7,
    brief:
      "Kurze, einfache Hauptsätze. Wenige Adjektive und Adverbien ('und' statt Unterordnungen). " +
      "Konkrete, handgreifliche Details (Getränke, Wetter, Hände); keine direkte Erklärung von Gefühlen — " +
      "die Eisberg-Theorie: das Wichtige bleibt ungesagt. Reine Dialoge ohne erläuternde Adverbien. Nüchterner, reporterhafter Ton.",
  },
  {
    id: "kerouac",
    label: "Jack Kerouac",
    temperature: 0.9,
    brief:
      "Spontaner, atemlanger Rhythmus. Lange, rauschhafte Satzketten mit 'und' verbunden, kaum Punkte. " +
      "Straße, Jazz, Bewegung, Geschwindigkeit. Direkt, begeistert, assoziativ. Slang erlaubt.",
  },
  {
    id: "wolf",
    label: "Christa Wolf",
    temperature: 0.75,
    brief:
      "Reflexive, erkundende Prosa in der ersten Person. Gedanken kommen im Entstehen: 'Vielleicht…', 'Ich weiß nicht…'. " +
      "Erinnerungsschichtung, Brüche zwischen Damals und Jetzt. Sanfter, fragender, moralisch wacher Ton.",
  },
  {
    id: "lovecraft",
    label: "H. P. Lovecraft",
    temperature: 0.8,
    brief:
      "Archaisierende, schwerblütige Prosa. Wörter wie 'düsternis', 'unheilig', 'schemenhaft', 'abgrundtief'. " +
      "Langsamer Aufbau der Andeutung, niemals direkte Beschreibung des Unaussprechlichen; erstarrte Zeugen, verbotene Schriften, " +
      "ungewöhnliche Winkel und Verhältnisse. Erzähler als verzagter Chronist.",
  },
  {
    id: "boll",
    label: "Heinrich Böll",
    temperature: 0.65,
    brief:
      "Klare, unaufgeregte Sätze; Alltagsgegenstände und kleine Gesten tragen die Bedeutung. " +
      "Katholisch-menschlicher Blick, Mitgefühl mit kleinen Leuten, präzise Zeit- und Geldangaben. Trockener, warmherziger Ton.",
  },
];

export function findStyle(id: string): StyleDefinition {
  return LITERARY_STYLES.find((s) => s.id === id) ?? LITERARY_STYLES[0];
}

export interface StyleTransferRequest {
  text: string;
  styleId: string;
  slotId?: string;
  signal?: AbortSignal;
}

export interface StyleTransferResult {
  text: string;
  styleId: string;
  offline: boolean;
}

const SYSTEM_PROMPT =
  "Du bist ein Meister des literarischen Style Transfers. Du schreibst den gegebenen Text komplett in einem " +
  "vorgegebenen Autorenstil um, ohne Inhalt, Figuren oder Plotpunkte zu verändern. Gib NUR den umgeschriebenen " +
  "Text aus — keine Erklärung, keine Vorrede, keine Anmerkungen.";

export function buildStyleTransferPrompt(req: StyleTransferRequest): string {
  const style = findStyle(req.styleId);
  return (
    `ZIELSTIL: ${style.label}\nSTILMERKMALE:\n${style.brief}\n\n` +
    `AUFGABE: Schreibe den folgenden Text vollständig im Zielstil um. Behalte alle Ereignisse, Figuren und ` +
    `die Aussage bei — verändere nur Sprache, Rhythmus und Bildgebung.\n\nTEXT:\n${req.text}`
  );
}

/** Schreibt den Text in den gewählten literarischen Stil um. */
export async function transferStyle(
  settings: AppSettings,
  req: StyleTransferRequest,
): Promise<StyleTransferResult> {
  const slot =
    req.slotId && settings.kiModelSlots?.length
      ? findSlot(settings.kiModelSlots, req.slotId)
      : undefined;
  const provider = slot ? createSlotProvider(settings, slot) : createProvider(settings);
  const activeModel = slot?.model ?? settings.model;
  const style = findStyle(req.styleId);

  try {
    const healthy = await provider.healthCheck();
    if (!healthy) throw new Error("Provider offline");
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildStyleTransferPrompt(req) },
    ];
    let out = "";
    for await (const token of provider.chat(
      messages,
      { model: activeModel, temperature: style.temperature, maxTokens: settings.maxTokens },
      req.signal,
    )) {
      out += token;
    }
    const text = out.trim().replace(/^[„"»\s]+|["«\s]+$/g, "");
    if (!text) throw new Error("Leere Antwort");
    return { text, styleId: style.id, offline: false };
  } catch {
    // Offline-Fallback: minimale lokale Stilverdrehung (kein echter Transfer)
    const hint = `(Offline-Modus) Kein Stiltransfer möglich. Zielstil „${style.label}" — Kernmerkmale:\n${style.brief}`;
    return { text: hint, styleId: style.id, offline: true };
  }
}
