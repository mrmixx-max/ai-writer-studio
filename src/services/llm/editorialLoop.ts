// Autonome Lektoratsschleife (WP1.1).
//
// Ablauf: Das Modell liest das Kapitel, analysiert Spannungsbogen, Pacing und
// Figurenstimmen und liefert KORREKTUR-PATCHES — keine Volltext-Neuschreibung.
//
// Warum Patches statt Neuschreiben:
// `reviseChapter` in writing/revise.ts ersetzt das ganze Kapitel. Bei einem
// 3000-Wörter-Kapitel ist das ein hohes Risiko: Das Modell ändert beim
// Neuschreiben ungewollt Dinge, die es nicht ändern sollte, und der Autor kann
// nicht erkennen, was eigentlich passiert ist. Ein Patch-Paar
// (search → replace) ist nachvollziehbar, ablehnbar und auf eine Stelle begrenzt.
//
// Die Schleife ist mehrstufig, aber begrenzt: Nach jedem Durchgang entscheidet
// der Aufrufer über die Patches. Ohne Freigabe endet der Lauf — es gibt keine
// automatische Übernahme in das Manuskript.

import { z } from "zod";
import { parseModelResponse, acceptToolCall, buildToolInstructions, type ToolCall } from "./toolCall";
import { applyPatches, sanityCheck, type TextPatch, type PatchResult } from "./textPatch";
import { parseStructuredJson } from "./structured";
import { getLogger } from "@/services/logger";

const log = getLogger("llm/editorialLoop");

/** Name des Werkzeugs, das das Modell aufrufen darf. */
export const TOOL_PROPOSE_PATCHES = "propose_patches";

/**
 * Struktur, die das Modell im Werkzeugaufruf liefern muss.
 *
 * Tolerant bei optionalen Feldern (reason), streng beim Kern: Ohne search und
 * replace ist ein Patch wertlos.
 */
export const patchArgumentSchema = z.object({
  patches: z
    .array(
      z.object({
        search: z.string({ error: "search fehlt" }).min(1, "search ist leer"),
        replace: z.string({ error: "replace fehlt" }),
        reason: z.string().optional(),
      }),
    )
    .min(1, "keine Patches geliefert"),
});

export type PatchArguments = z.infer<typeof patchArgumentSchema>;

/** Ein Analysedurchgang des Lektorats. */
export interface EditorialReview {
  /** Fachliche Analyse (Spannungsbogen, Pacing, Figurenstimmen). */
  analysis: string;
  /** Vorgeschlagene Änderungen. Leer, wenn das Modell nichts zu ändern fand. */
  patches: TextPatch[];
  /** Denktext des Modells, falls vorhanden (Nachvollziehbarkeit). */
  scratchpad: string;
  /** Rohantwort — für Diagnose, wenn nichts geparst werden konnte. */
  raw: string;
}

/** Ergebnis nach Anwendung der Patches. */
export interface EditorialOutcome extends EditorialReview {
  /** Text nach Anwendung. */
  revisedText: string;
  /** Wie viele Patches griffen. */
  applied: number;
  /** Abgelehnte Patches (nicht eindeutig, leer, unverhältnismäßig). */
  rejected: PatchResult["rejected"];
  /** Anzahl Modell-Aufrufe (Analyse + evtl. Reparatur). */
  attempts: number;
}

/** Die Werkzeugbeschreibung, die dem Modell angeboten wird. */
export const PATCH_TOOL = {
  name: TOOL_PROPOSE_PATCHES,
  description:
    "Schlägt gezielte Textkorrekturen vor. Jeder Patch ersetzt einen wörtlich " +
    "vorkommenden Ausschnitt. Nutze kurze, eindeutige Ausschnitte (ein bis drei Sätze).",
  parameters:
    '{"patches":[{"search":"wörtlicher Ausschnitt","replace":"verbesserte Fassung","reason":"warum"}]}',
};

/** Rollen-Vorgabe: Was das Lektorat prüfen soll. */
export const EDITORIAL_SYSTEM = `Du bist ein erfahrener Lektor für deutschsprachige Manuskripte.

Prüfe den Text auf:
- Spannungsbogen: Trägt die Szene? Wo fällt sie ab?
- Pacing: Wechseln sich Handlung, Reflexion und Dialog sinnvoll ab?
- Figurenstimmen: Sprechen die Figuren unterscheidbar und ihrer Rolle gemäß?

Wichtig:
- Ändere NICHTS, was schon funktioniert. Kein Umformulieren aus Geschmack.
- Schlage nur Änderungen vor, die einen konkreten Mangel beheben.
- Jeder Patch muss einen WÖRTLICH im Text vorkommenden Ausschnitt als "search"
  nennen — kurz genug, um eindeutig zu sein (ein bis drei Sätze).
- Wenn der Text gut ist, liefere keine Patches. Das ist ein legitimes Ergebnis.`;

/**
 * Baut den Analyse-Prompt für ein Kapitel.
 *
 * @param title   Kapiteltitel (Kontext für das Lektorat).
 * @param content Kapiteltext.
 * @param focus   Optionaler Schwerpunkt ("pacing", "stimmen", …).
 */
export function buildEditorialPrompt(title: string, content: string, focus?: string): string {
  const focusLine = focus ? `\nSchwerpunkt dieses Durchgangs: ${focus}\n` : "";
  return (
    `Kapitel: "${title}"\n${focusLine}\n` +
    `--- TEXT ---\n${content}\n--- ENDE TEXT ---\n\n` +
    `Analysiere das Kapitel und schlage Korrekturen als Patches vor. ` +
    `Nutze das Werkzeug ${TOOL_PROPOSE_PATCHES}.`
  );
}

/** Callback, der einen Modell-Aufruf macht (injizierbar → LLM-frei testbar). */
export type CompleteFn = (prompt: string) => Promise<string>;

/**
 * Führt einen Lektoratsdurchgang aus.
 *
 * Ablauf:
 *  1. Analyse-Prompt + Werkzeugbeschreibung an das Modell.
 *  2. Antwort zerlegen: Scratchpad, Text, Werkzeugaufruf.
 *  3. Aufruf gegen das erlaubte Werkzeug prüfen und die Argumente per Zod
 *     validieren (mit EINEM Reparaturversuch über parseStructuredJson).
 *  4. Patches gegen den Text prüfen: nicht anwendbare werden abgelehnt,
 *     unverhältnismäßige über sanityCheck markiert.
 *
 * Übernimmt NICHTS ins Manuskript — das entscheidet der Aufrufer.
 */
export async function runEditorialReview(
  title: string,
  content: string,
  complete: CompleteFn,
  options: { focus?: string; maxPatches?: number } = {},
): Promise<EditorialOutcome> {
  const prompt = buildEditorialPrompt(title, content, options.focus);
  const raw = await complete(prompt);
  const parsed = parseModelResponse(raw);

  const base: EditorialReview = {
    analysis: parsed.text,
    patches: [],
    scratchpad: parsed.scratchpad,
    raw,
  };

  if (parsed.toolCalls.length === 0) {
    // Kein Aufruf: Das Modell hat nur analysiert. Das ist gültig — aber wenn
    // es Text liefert, der wie ein Patch aussieht, protokollieren wir das.
    log.info("Lektorat ohne Werkzeugaufruf (reine Analyse).");
    return { ...base, revisedText: content, applied: 0, rejected: [], attempts: 1 };
  }

  const accepted = parsed.toolCalls
    .map((c) => acceptToolCall(c, [TOOL_PROPOSE_PATCHES]))
    .filter((c): c is ToolCall => c !== null);

  if (accepted.length === 0) {
    log.warn("Lektorat: kein gültiger Werkzeugaufruf.");
    return { ...base, revisedText: content, applied: 0, rejected: [], attempts: 1 };
  }

  // Erster Aufruf: Argumente validieren (mit Reparaturversuch).
  // `validationRounds` zählt die Modellaufrufe bis hierher unabhängig vom
  // Ergebnis — im Fehlerzweig liefert das Ergebnis selbst kein `attempts`.
  const first = accepted[0];
  let validationRounds = 1;
  const validated = await parseStructuredJson<PatchArguments>(
    JSON.stringify(first.arguments),
    patchArgumentSchema,
    // Der Reparatur-Call bekommt die Argumente, nicht die Werkzeug-Syntax:
    // kaputt sind die Argumente, nicht der Aufruf.
    async (repairPrompt) => {
      validationRounds = 2;
      const fixRaw = await complete(repairPrompt);
      const fixParsed = parseModelResponse(fixRaw);
      const fixCall = fixParsed.toolCalls
        .map((c) => acceptToolCall(c, [TOOL_PROPOSE_PATCHES]))
        .find((c): c is ToolCall => c !== null);
      return JSON.stringify(fixCall?.arguments ?? {});
    },
    "editorial-patches",
  );

  if (!validated.ok) {
    log.warn(`Lektorat: Patch-Argumente ungültig — ${validated.failure.messages.join("; ")}`);
    return { ...base, revisedText: content, applied: 0, rejected: [], attempts: validationRounds };
  }

  const max = options.maxPatches ?? 20;
  const proposed: TextPatch[] = validated.value.patches.slice(0, max).map((p) => ({
    search: p.search,
    replace: p.replace,
    reason: p.reason,
  }));

  // Unverhältnismäßige Ersetzungen vorab aussortieren — sie würden den Text
  // beschädigen, auch wenn sie formal anwendbar sind.
  const plausible: TextPatch[] = [];
  const rejected: PatchResult["rejected"] = [];
  for (const p of proposed) {
    const problem = sanityCheck(p.search, p.replace);
    if (problem) {
      rejected.push({ patch: p, reason: problem });
    } else {
      plausible.push(p);
    }
  }

  const result = applyPatches(content, plausible);

  return {
    ...base,
    patches: proposed,
    revisedText: result.text,
    applied: result.applied,
    rejected: [...rejected, ...result.rejected],
    // validated.attempts zählt die Validierungsrunden: 1 = nur der Analyse-Call,
    // 2 = Analyse + ein Reparatur-Call. Der Analyse-Call selbst ist die erste
    // Runde, deshalb hier KEIN weiteres +1.
    attempts: validationRounds,
  };
}

/** Der System-Prompt-Hinweis, der die Werkzeuge erklärt (für den Aufrufer). */
export function editorialToolInstructions(): string {
  return buildToolInstructions([PATCH_TOOL]);
}
