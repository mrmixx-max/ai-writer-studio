// News Generator (Sprint 29): Vollautomatischer Zeitungsgenerator.
// Demo-Modus + optional LLM via Ollama (Hybrid).
import type { GeneratedNewsArticle } from "@/components/News/NewsGeneratorPanel";

export interface GenerateOptions {
  topic: string;
  language: "de" | "en";
  count?: number;
  useLLM?: boolean;
  llmModel?: string;
}

/**
 * Demo-Modus: 6 Templates mit echten Inhalten.
 */
async function generateDemoArticles(
  topic: string,
  language: "de" | "en",
  count: number,
): Promise<GeneratedNewsArticle[]> {
  await new Promise((resolve) => setTimeout(resolve, 800));

  const de = language === "de";
  const templates = buildTemplates(topic, de);
  const articles: GeneratedNewsArticle[] = [];

  for (let i = 0; i < count; i++) {
    const tpl = templates[i % templates.length];
    articles.push({
      id: `a${i + 1}`,
      headline: tpl.headline,
      teaser: tpl.teaser,
      body: tpl.body,
      imageUrl: undefined,
      source: tpl.source,
    });
  }

  return articles;
}

function buildTemplates(topic: string, de: boolean) {
  return [
    {
      headline: de ? `Einordnung: ${topic}` : `Analysis: ${topic}`,
      teaser: de
        ? `${topic} entwickelt sich rasant weiter. Experten sind sich einig über die Bedeutung für die Branche.`
        : `${topic} continues to evolve rapidly. Experts agree on the significance for the industry.`,
      body: de
        ? `${topic} ist eines der dynamischsten Themen der aktuellen Marktentwicklung. Experten beobachten seit Monaten einen klaren Aufwärtstrend, der sich in verschiedenen Branchen unterschiedlich schnell manifestiert. Während einige Sektoren bereits von neuen Standards profitieren, stehen andere noch am Anfang der Transformation.`
        : `${topic} is one of the most dynamic themes in current market development. Experts have observed a clear upward trend for months. While some sectors already benefit from new standards, others are just beginning their transformation.`,
      source: de ? "Redaktion" : "Editorial",
    },
    {
      headline: de ? `Was bringt ${topic} für Anwender?` : `What does ${topic} mean for users?`,
      teaser: de
        ? `Praxis-Check: Erste Ergebnisse sind vielversprechend, aber es gibt Herausforderungen.`
        : `Practical check: First results are promising, but challenges remain.`,
      body: de
        ? `Für Anweder bedeutet ${topic} sowohl Chancen als auch Herausforderungen. Erste Umsetzungen zeigen positive Effekte auf Effizienz und Qualität. Experten empfehlen einen schrittweisen Ansatz: Zuerst analysieren, dann pilotsieren, dann skalieren.`
        : `For users, ${topic} brings both opportunities and challenges. Initial implementations show positive effects. Experts recommend a phased approach: analyze first, then pilot, then scale.`,
      source: de ? "Marktbeobachtung" : "Market Watch",
    },
    {
      headline: de ? `${topic} im internationalen Vergleich` : `${topic} in international comparison`,
      teaser: de
        ? `Während andere Länder zögern, nutzt die deutsche Industrie die Chance.`
        : `While other nations hesitate, German industry seizes the opportunity.`,
      body: de
        ? `Im internationalen Vergleich nimmt Deutschland bei ${topic} eine Sonderrolle ein. Während in asiatischen Märkten das Wachstum stark forciert wird, dominiert in Europa ein behutsamerer Ansatz. Die deutsche Industrie setzt auf Qualität statt Quantität — mit Erfolg.`
        : `Internationally, Germany occupies a special position in ${topic}. While Asian markets push strongly for growth, Europe favors a more cautious approach. German industry focuses on quality over quantity — with success.`,
      source: de ? "Analyse" : "Analysis",
    },
    {
      headline: de ? `Fazit: ${topic} bleibt spannend` : `Conclusion: ${topic} remains exciting`,
      teaser: de
        ? `Die nächsten Monate werden entscheidend sein. Beobachte weiterentwicklungen.`
        : `The coming months will be crucial. Observers expect further developments.`,
      body: de
        ? `${topic} wird die Branche nachhaltig verändern — das ist jetzt schon klar. Die Geschwindigkeit der Entwicklung überrascht auch erfahrene Beobachter. Was als Nische begann, wird bald Mainstream.`
        : `${topic} will sustainably transform the industry — that is already clear. The speed of development surprises even experienced observers. What began as a niche will soon become mainstream.`,
      source: de ? "Kommentar" : "Commentary",
    },
    {
      headline: de ? `Die Kehrseite: Risiken bei ${topic}` : `The flip side: Risks in ${topic}`,
      teaser: de
        ? `Nicht alles ist positiv. Experten warnen vor Überhastung und fordern mehr Regulierung.`
        : `Not everything is positive. Experts warn against rushing and call for more regulation.`,
      body: de
        ? `Neben den Chancen birgt ${topic} auch Risiken. Datenschutz, ethische Fragen und die Gefahr einer Überregulierung stehen auf der Agenda. Experten fordern ein ausgewogenes Verhältnis: Förderung ja, aber mit klaren Grenzen.`
        : `Alongside opportunities, ${topic} also carries risks. Data protection, ethical questions, and the danger of over-regulation are on the agenda. Experts call for a balanced approach.`,
      source: de ? "Kritik" : "Critique",
    },
    {
      headline: de ? `Interview: ${topic} aus Sicht der Praxis` : `Interview: ${topic} from a practitioner's view`,
      teaser: de
        ? `Zwei Experten über Erfolge, Fehlschläge und den Weg nach vorn.`
        : `Two experts on successes, failures, and the way forward.`,
      body: de
        ? `"${topic} verändert unsere Arbeitswelt grundsätzlich", sagt Dr. Müller, Branchenexperte. "Aber wir stehen erst am Anfang." Sein Kollege Schmidt ergänzt: "Die Technik ist da. Jetzt geht es um Akzeptanz und Umsetzung."`
        : `"${topic} fundamentally changes our working world," says Dr. Müller. "But we are only at the beginning." His colleague Schmidt adds: "The technology is there. Now it's about acceptance."`,
      source: de ? "Interview" : "Interview",
    },
  ];
}

/**
 * Hybrid-Modus: Demo-Templates + LLM-Vervollständigung via Ollama.
 */
async function generateHybridArticles(
  topic: string,
  language: "de" | "en",
  count: number,
  model: string,
): Promise<GeneratedNewsArticle[]> {
  const demo = await generateDemoArticles(topic, language, count);
  const de = language === "de";

  const prompt = de
    ? `Verbessere diese ${count} Artikel zum Thema "${topic}". Antwiese als JSON-Array: { "headline": "...", "teaser": "...", "body": "...", "source": "..." }. Nur JSON. Original: ${JSON.stringify(demo)}`
    : `Improve these ${count} articles about "${topic}". JSON array: { "headline": "...", "teaser": "...", "body": "...", "source": "..." }. Only JSON. Original: ${JSON.stringify(demo)}`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.7, num_predict: 2000 },
      }),
    });

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);

    const data = await response.json();
    const text = data.response as string;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Keine JSON-Antwort");

    const parsed = JSON.parse(jsonMatch[0]) as Array<Partial<GeneratedNewsArticle>>;
    return parsed.map((a, i) => ({
      id: `hybrid-${i + 1}`,
      headline: a.headline ?? demo[i]?.headline ?? `${topic} - Artikel ${i + 1}`,
      teaser: a.teaser ?? demo[i]?.teaser ?? "",
      body: a.body ?? demo[i]?.body ?? "",
      imageUrl: undefined,
      source: a.source ?? "Hybrid",
    }));
  } catch (e) {
    console.warn("Hybrid-Modus fehlgeschlagen, nutze Demo:", e);
    return demo;
  }
}

/**
 * Hauptfunktion.
 */
export async function generateNewsArticles(
  options: GenerateOptions,
): Promise<GeneratedNewsArticle[]> {
  const { topic, language, count = 6, useLLM = false, llmModel = "llama3.2" } = options;

  await new Promise((resolve) => setTimeout(resolve, 500));

  if (useLLM) {
    return generateHybridArticles(topic, language, count, llmModel);
  }

  return generateDemoArticles(topic, language, count);
}

/**
 * Prüft ob Ollama läuft.
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
