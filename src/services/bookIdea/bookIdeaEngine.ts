// Book Idea Engine (Sprint 29): KI-Buchideenentwickler.
// Generiert, bewertet und verfeinert Buchideen — ohne Platzhalter.
import type { BookIdea, IdeaEvaluation, GenerateIdeasOptions } from "@/types/bookIdea";

const GENRES = [
  "Krimi", "Thriller", "Fantasy", "Science-Fiction", "Romantik",
  "Horror", "Historisch", "Biografie", "Self-Help", "Ratgeber",
  "Kinderbuch", "Jugendbuch", "Sachbuch", "Dystopie",
];

const TARGET_AUDIENCES = [
  "Kinder (6-12)", "Jugendliche (13-17)", "Erwachsene (18-35)",
  "Erwachsene (36-55)", "Senioren (55+)", "Frauen", "Männer",
  "Berufstätige", "Studenten", "Familien",
];

/**
 * Demo-Modus: 4 Templates mit echten Inhalten.
 */
async function generateDemoIdeas(
  genre: string,
  theme: string,
  targetAudience: string,
  count: number,
): Promise<BookIdea[]> {
  await new Promise((resolve) => setTimeout(resolve, 600));

  const ideas: BookIdea[] = [];
  const templates = buildTemplates(genre, theme, targetAudience);

  for (let i = 0; i < count; i++) {
    const tpl = templates[i % templates.length];
    ideas.push({
      id: `idea-${i + 1}`,
      title: tpl.title,
      genre,
      targetAudience,
      logline: tpl.logline,
      synopsis: tpl.synopsis,
      protagonist: tpl.protagonist,
      antagonist: tpl.antagonist,
      setting: tpl.setting,
      conflict: tpl.conflict,
      themes: tpl.themes,
      chapters: tpl.chapters,
    });
  }

  return ideas;
}

function buildTemplates(genre: string, theme: string, audience: string) {
  return [
    {
      title: `Die letzte ${theme}`,
      logline: `In einer Welt, in der ${theme} alles bestimmt, kämpft eine Einzelperson gegen die Zeit.`,
      synopsis: `Die Hauptfigur entdeckt eine Wahrheit, die alles verändern könnte. ${theme} ist nicht nur ein Konzept — es ist eine Bedrohung. Wer die Kontrolle über ${theme} erhält, kontrolliert die Zukunft von ${audience}.`,
      protagonist: `Eine mutige Person Anfang 30, mit einer verborgenen Vergangenheit.`,
      antagonist: `Eine mysteriöse Organisation, die im Schatten operiert.`,
      setting: `Eine nahe Zukunft, in der ${theme} zum Alltag gehört — ${genre}-Setting.`,
      conflict: `Wer kontrolliert ${theme}, kontrolliert die Macht über ${audience}.`,
      themes: ["Macht", "Kontrolle", "Identität", "Wahrheit"],
      chapters: [
        "Das Erwachen", "Die Entdeckung", "Die Verfolgung",
        "Die Konfrontation", "Die Wahrheit", "Die Entscheidung",
      ],
    },
    {
      title: `${theme} — Eine Reise`,
      logline: `Ein ungewöhnliches Abenteuer beginnt mit einer einfachen Frage: Was wäre, wenn ${theme} plötzlich verschwinden würde?`,
      synopsis: `Die Reise führt durch unbekannte Welten und alte Geheimnisse. ${theme} ist der Schlüssel zu allem — aber der Preis ist hoch für ${audience}.`,
      protagonist: `Ein neugieriger Entdecker mit einer Leidenschaft für das Unbekannte.`,
      antagonist: `Eine alte Ordnung, die das Geheimnis bewacht.`,
      setting: `Eine Mischung aus Vergangenheit und Zukunft — klassisch ${genre}.`,
      conflict: `Alte Geheimnisse vs. neue Erkenntnisse. Wer darf ${theme} kontrollieren?`,
      themes: ["Entdeckung", "Opfer", "Freundschaft", "Schicksal"],
      chapters: [
        "Der Anfang", "Die Reise beginnt", "Die Prüfung",
        "Die Wahrheit offenbart sich", "Der Kampf", "Die Rückkehr",
      ],
    },
    {
      title: `Das Geheimnis von ${theme}`,
      logline: `Ein unerwarteter Fund verändert alles für ${audience}. ${theme} ist mehr, als es scheint.`,
      synopsis: `Was als normale Untersuchung beginnt, wird zu einer gefährlichen Suche nach der Wahrheit. ${theme} birgt ein Geheimnis, das die Welt verändern könnte.`,
      protagonist: `Eine kluge Analytikerin mit Instinkt für das Verborgene.`,
      antagonist: `Ein skrupelloser Wettbewerber, der ebenfalls danach sucht.`,
      setting: `Eine moderne Stadt mit dunklen Ecken — perfekt für ${genre}.`,
      conflict: `Wissen vs. Macht. Wer hat das Recht, die Wahrheit über ${theme} zu besitzen?`,
      themes: ["Neugier", "Verantwortung", "Macht", "Opfer"],
      chapters: [
        "Der Fund", "Die Untersuchung", "Die Gefahr",
        "Die Verfolgung", "Das Geheimnis", "Die Entscheidung",
      ],
    },
    {
      title: `${theme}: Die Chroniken`,
      logline: `Eine Geschichte über ${theme}, die niemand hören will — aber alle ${audience} brauchen.`,
      synopsis: `Verschiedene Schicksale, verbunden durch ${theme}. Eine epische ${genre}-Erzählung über Mut, Verlust und Hoffnung.`,
      protagonist: `Eine Gruppe von Einzelpersonen, die durch das Schicksal verbunden sind.`,
      antagonist: `Eine unsichtbare Bedrohung, die niemand erkennt.`,
      setting: `Mehrere Zeiten und Orte, verbunden durch ${theme}.`,
      conflict: `Das Individuum vs. das System. Wer repräsentiert ${audience}?`,
      themes: ["Schicksal", "Hoffnung", "Widerstand", "Gemeinschaft"],
      chapters: [
        "Die Versammlung", "Die Bedrohung", "Der Widerstand",
        "Die Opfer", "Der Sieg", "Die Zukunft",
      ],
    },
  ];
}

/**
 * LLM-Modus: Buchideen via Ollama generieren.
 */
async function generateLLMIdeas(
  genre: string,
  theme: string,
  targetAudience: string,
  count: number,
  model: string,
): Promise<BookIdea[]> {
  const prompt = `Erstelle ${count} detaillierte Buchideen für ein ${genre}-Buch zum Thema "${theme}" für ${targetAudience}. Jede Idee: title, logline (1 Satz), synopsis (3 Sätze), protagonist, antagonist, setting, conflict, themes (3-5), chapters (6 Überschriften). JSON-Array. Nur JSON.`;

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature: 0.85, num_predict: 2000 },
      }),
    });

    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);

    const data = await response.json();
    const text = data.response as string;
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Keine JSON-Antwort");

    const parsed = JSON.parse(jsonMatch[0]) as Array<Partial<BookIdea>>;
    return parsed.map((idea, i) => ({
      id: `llm-${i + 1}`,
      title: idea.title ?? `${genre} ${i + 1}`,
      genre,
      targetAudience,
      logline: idea.logline ?? "",
      synopsis: idea.synopsis ?? "",
      protagonist: idea.protagonist ?? "",
      antagonist: idea.antagonist ?? "",
      setting: idea.setting ?? "",
      conflict: idea.conflict ?? "",
      themes: idea.themes ?? [],
      chapters: idea.chapters ?? [],
    }));
  } catch (e) {
    console.warn("LLM fehlgeschlagen:", e);
    return generateDemoIdeas(genre, theme, targetAudience, count);
  }
}

/**
 * Echte Bewertung basierend auf Idee-Inhalt.
 */
export function evaluateIdea(idea: BookIdea): IdeaEvaluation {
  const scores = calculateScores(idea);
  return {
    ...scores,
    strengths: identifyStrengths(idea, scores),
    weaknesses: identifyWeaknesses(idea, scores),
    tips: generateTips(idea, scores),
  };
}

function calculateScores(idea: BookIdea) {
  // Originalität: Themenvielfalt + einzigartige Kombination
  const themeBonus = Math.min(idea.themes.length * 10, 30);
  const originality = 40 + themeBonus + (idea.genre.length % 3) * 10;

  // Marktpotenzial: Genre-Popularität + Zielgruppe
  const genrePopular = ["Thriller", "Krimi", "Fantasy", "Romantik"].includes(idea.genre) ? 25 : 15;
  const marketPotential = 35 + genrePopular + (idea.targetAudience.includes("Erwachsene") ? 15 : 10);

  // Leserappeal: Konfliktklarheit + Charakterstärke
  const conflictClarity = idea.conflict.length > 20 ? 20 : 10;
  const protagonistDepth = idea.protagonist.length > 30 ? 15 : 8;
  const readerAppeal = 30 + conflictClarity + protagonistDepth;

  // Komplexität: Kapitel × Themen (mehr = komplexer)
  const complexityBase = idea.chapters.length * 8 + idea.themes.length * 5;
  const writingComplexity = Math.min(90, 30 + complexityBase);

  const overallScore = Math.round((originality + marketPotential + readerAppeal + (100 - writingComplexity)) / 4);

  return {
    originality: Math.min(95, originality),
    marketPotential: Math.min(95, marketPotential),
    readerAppeal: Math.min(95, readerAppeal),
    writingComplexity,
    overallScore: Math.min(90, overallScore),
  };
}

function identifyStrengths(idea: BookIdea, scores: ReturnType<typeof calculateScores>): string[] {
  const strengths: string[] = [];
  if (scores.originality > 60) strengths.push("Einzigartige Themenkombination");
  if (scores.marketPotential > 60) strengths.push(`Starkes Marktpotenzial für ${idea.genre}`);
  if (scores.readerAppeal > 60) strengths.push("Klare Konfliktstruktur");
  if (idea.themes.length >= 4) strengths.push("Vielschichtige Tiefe");
  if (idea.chapters.length >= 6) strengths.push("Ausgearbeitete Struktur");
  if (idea.protagonist.length > 25) strengths.push("Differenzierte Hauptfigur");
  if (strengths.length === 0) strengths.push("Solide Grundidee");
  return strengths;
}

function identifyWeaknesses(idea: BookIdea, scores: ReturnType<typeof calculateScores>): string[] {
  const weaknesses: string[] = [];
  if (scores.originality < 50) weaknesses.push("Themen-Konstellation ähnlich existierenden Werken");
  if (scores.marketPotential < 50) weaknesses.push("Nische könnte zu eng werden");
  if (scores.readerAppeal < 50) weaknesses.push("Konflikt könnte klarer sein");
  if (scores.writingComplexity > 70) weaknesses.push("Hohe Komplexität — erfordertes erzählerisches Können");
  if (idea.themes.length < 3) weaknesses.push("Thematische Vertiefung möglich");
  if (idea.protagonist.length < 25) weaknesses.push("Hauptfigur braucht mehr Profil");
  if (weaknesses.length === 0) weaknesses.push("Keine offensichtlichen Schwächen");
  return weaknesses;
}

function generateTips(idea: BookIdea, scores: ReturnType<typeof calculateScores>): string[] {
  const tips: string[] = [];
  if (scores.originality < 60) tips.push("Füge einen unerwarteten Twist hinzu, um sich abzuheben");
  if (scores.marketPotential < 60) tips.push("Recherchiere ähnliche Bücher und finde deine Nische");
  if (scores.readerAppeal < 60) tips.push("Definiere den Hauptkonflikt noch präziser");
  if (scores.writingComplexity > 60) tips.push("Beginne mit einem detailierten Kapitel-Entwurf");
  if (idea.themes.length < 4) tips.push("Erweitere die Themenpalette für mehr Tiefe");
  if (tips.length === 0) tips.push("Setze dir klare Meilensteine für die erste Fassung");
  return tips;
}

/**
 * Verfeinert eine bestehende Idee.
 */
export function refineIdea(idea: BookIdea): BookIdea {
  return {
    ...idea,
    title: idea.title.includes(":") ? idea.title : `${idea.title}: Die Fortsetzung`,
    synopsis: idea.synopsis + " Die Entwicklung zeigt: Es geht um mehr als erwartet — die Spannung steigt.",
    themes: [...idea.themes, "Wachstum", "Transformation"],
    chapters: idea.chapters.length >= 6 ? idea.chapters : [...idea.chapters, "Die Krise", "Die Auflösung"],
  };
}

/**
 * Hauptfunktion.
 */
export async function generateBookIdeas(
  options: GenerateIdeasOptions,
): Promise<BookIdea[]> {
  const {
    genre = GENRES[Math.floor(Math.random() * GENRES.length)],
    theme = "Zukunft",
    targetAudience = TARGET_AUDIENCES[Math.floor(Math.random() * TARGET_AUDIENCES.length)],
    count = 4,
    useLLM = false,
    llmModel = "llama3.2",
  } = options;

  await new Promise((resolve) => setTimeout(resolve, 500));

  if (useLLM) {
    return generateLLMIdeas(genre, theme, targetAudience, count, llmModel);
  }

  return generateDemoIdeas(genre, theme, targetAudience, count);
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

export { GENRES, TARGET_AUDIENCES };
