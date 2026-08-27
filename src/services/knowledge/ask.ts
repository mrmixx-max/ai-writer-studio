// „Frage an das Projekt“ — KI-Antworten auf Basis des Wissensindex.
//
// Regel: Das Modell darf nur aus dem gelieferten Kontext antworten.
// Fehlt Kontext, wird das gesagt statt geraten. Der Prompt erzwingt das,
// und die Antwort trägt immer die verwendeten Quellen.

import type { AppSettings } from "@/types/config";
import type { RetrievalResult, SearchMode, KnowledgeSourceType } from "@/types/knowledge";
import { createProvider } from "@/services/llm";
import { searchKnowledge, formatContextBlock, formatSourceList } from "./retrieval";

/** Vordefinierte Fragetypen für die UI. */
export type ProjectQuestionKind = "about" | "mentions" | "conflicts" | "free";

export interface AskResult {
  answer: string;
  /** Das verwendete Retrieval — für die Kontextvorschau und Quellenanzeige. */
  retrieval: RetrievalResult;
  sources: string[];
  /** true wenn kein LLM verfügbar war und nur Fundstellen zurückkamen. */
  llmUnavailable: boolean;
  notice: string | null;
}

export interface AskOptions {
  mode?: SearchMode;
  limit?: number;
  sourceTypes?: KnowledgeSourceType[];
  onToken?: (t: string) => void;
}

const SYSTEM_PROMPT = `Du bist ein Assistent für ein literarisches Schreibprojekt.
Du beantwortest Fragen ausschließlich auf Grundlage der bereitgestellten Projektauszüge.

Strikte Regeln:
- Erfinde nichts. Nutze nur Informationen aus den Auszügen.
- Wenn die Auszüge die Frage nicht beantworten, sage genau das: "Dazu enthält das Projekt keine Angaben."
- Verweise auf die Quellennummern in eckigen Klammern, z. B. [Quelle 2].
- Antworte auf Deutsch, sachlich und knapp.
- Widersprüche zwischen Auszügen benennst du ausdrücklich, statt sie zu glätten.`;

/** Baut die Suchanfrage und die Nutzerfrage für einen vordefinierten Fragetyp. */
export function buildQuestion(kind: ProjectQuestionKind, subject: string): { query: string; question: string } {
  switch (kind) {
    case "about":
      return {
        query: subject,
        question: `Was weiß das Projekt über ${subject}? Fasse alle Angaben zusammen und nenne Widersprüche.`,
      };
    case "mentions":
      return {
        query: subject,
        question: `Wo wird ${subject} im Projekt erwähnt? Nenne die Stellen mit Quellenangabe.`,
      };
    case "conflicts":
      return {
        query: subject
          ? `Konflikt Spannung Problem ${subject}`
          : "Konflikt Spannung Problem Streit ungelöst offen",
        question: subject
          ? `Welche offenen Konflikte rund um ${subject} gibt es im Projekt?`
          : "Welche offenen Konflikte gibt es im Projekt? Nenne, was ungelöst bleibt.",
      };
    default:
      return { query: subject, question: subject };
  }
}

/**
 * Stellt eine Frage an das Projektwissen.
 * Wirft nicht: ohne LLM werden die gefundenen Auszüge selbst zurückgegeben,
 * damit der Autor trotzdem etwas in der Hand hat.
 */
export async function askProject(
  projectId: string,
  question: string,
  settings: AppSettings,
  options: AskOptions = {},
): Promise<AskResult> {
  const retrieval = await searchKnowledge(projectId, question, settings, {
    mode: options.mode ?? "hybrid",
    limit: options.limit ?? 8,
    sourceTypes: options.sourceTypes,
  });

  const sources = formatSourceList(retrieval);

  if (!retrieval.hits.length) {
    return {
      answer:
        "Dazu enthält das Projektwissen keine Angaben. " +
        (retrieval.notice ?? "Prüfe, ob das Projektwissen aktuell ist."),
      retrieval,
      sources,
      llmUnavailable: false,
      notice: retrieval.notice,
    };
  }

  const context = formatContextBlock(retrieval);
  const userPrompt = `Projektauszüge:\n\n${context}\n\n---\n\nFrage: ${question}`;

  try {
    const provider = createProvider(settings);
    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: userPrompt },
    ];
    let answer = "";
    for await (const token of provider.chat(messages, {
      model: settings.model,
      temperature: 0.2,
      maxTokens: settings.maxTokens,
    })) {
      answer += token;
      options.onToken?.(token);
    }
    return {
      answer: answer.trim(),
      retrieval,
      sources,
      llmUnavailable: false,
      notice: retrieval.notice,
    };
  } catch (e) {
    // Kein Modell erreichbar: Fundstellen als Ersatzantwort ausgeben.
    const fallback = retrieval.hits
      .map((h, i) => {
        const label = h.headingPath ? `${h.sourceTitle} › ${h.headingPath}` : h.sourceTitle;
        return `[Quelle ${i + 1}: ${label}]\n${h.text}`;
      })
      .join("\n\n");
    const reason = (e as Error).message || String(e);
    return {
      answer: fallback,
      retrieval,
      sources,
      llmUnavailable: true,
      notice:
        `Es ist kein Sprachmodell erreichbar (${reason}). ` +
        `Stattdessen werden die ${retrieval.hits.length} relevantesten Projektstellen unverändert angezeigt.`,
    };
  }
}

/**
 * Liefert den Retrieval-Kontext, ohne ein Modell zu befragen.
 * Für die Produktanforderung „Retrieval-Kontext vor dem Senden ansehen“.
 */
export async function previewContext(
  projectId: string,
  query: string,
  settings: AppSettings,
  options: AskOptions = {},
): Promise<RetrievalResult> {
  return searchKnowledge(projectId, query, settings, {
    mode: options.mode ?? "hybrid",
    limit: options.limit ?? 8,
    sourceTypes: options.sourceTypes,
  });
}
