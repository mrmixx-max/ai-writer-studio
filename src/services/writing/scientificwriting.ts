// Wissenschaftliches Schreiben: Struktur-Generator, Textgenerator, Abstract, Umformulierung.
//
// Erzeugt wissenschaftliche Texte in klarer, nüchterner Sprache.
// Unterstützt Hausarbeiten, Seminararbeiten, Essays, Exposés, Abstracts.

// --- Types ---

export type ScientificWorkType =
  | "hausarbeit"
  | "seminararbeit"
  | "essay"
  | "expose"
  | "bachelorarbeit"
  | "masterarbeit"
  | "abstract"
  | "kapitelentwurf";

export type ScientificLevel = "bachelor" | "master" | "promotion" | "allgemein";

export type ScientificTone = "sachlich" | "analytisch" | "kritisch" | "neutral" | "akademisch-formal";

export type ScientificSection =
  | "einleitung"
  | "theoretischer_rahmen"
  | "methodik"
  | "analyse"
  | "diskussion"
  | "schluss"
  | "abstract"
  | "gliederung"
  | "umformulierung";

export type CitationStyle = "APA" | "MLA" | "Chicago" | "Harvard" | "IEEE" | "deutsch";

export type ScientificLength = "kurz" | "mittel" | "lang";

export interface ScientificWritingInput {
  workType: ScientificWorkType;
  topic: string;
  field?: string;
  level?: ScientificLevel;
  language?: string;
  tone?: ScientificTone;
  section?: ScientificSection;
  rawText?: string;
  sources?: string[];
  citationStyle?: CitationStyle;
  length?: ScientificLength;
  formality?: number; // 1-10
  shouldParaphrase?: boolean;
  shouldGenerateOutline?: boolean;
  shouldGenerateAbstract?: boolean;
  cautiousWithoutSources?: boolean;
}

export interface ScientificWarning {
  code: string;
  message: string;
}

export interface ScientificTextResult {
  title: string;
  outline: string[];
  text: string;
  abstract: string;
  citationHints: string[];
  warnings: ScientificWarning[];
  styleNotes: string[];
  rationale: string;
}

export interface ScientificOutlineResult {
  title: string;
  outline: string[];
  rationale: string;
}

export interface AcademicRewriteResult {
  original: string;
  rewritten: string;
  changes: string[];
}

export interface AbstractResult {
  text: string;
  keywords: string[];
}

// --- Stil-Regeln ---

const BANNED_PHRASES = [
  "in der heutigen schnelllebigen Welt",
  "es ist wichtig zu beachten",
  "tief eintauchen",
  "zentrale Rolle spielen",
  "ein spannendes Thema",
  "mega", "toll", "cool", "einfach super",
  "faszinierend", "atemberaubend", "unglaublich",
];

// --- Analyse ---

export function analyzeScientificInput(input: ScientificWritingInput): ScientificWarning[] {
  const warnings: ScientificWarning[] = [];

  if (!input.topic.trim()) {
    warnings.push({ code: "no-topic", message: "Kein Thema oder Forschungsfrage angegeben." });
  }

  if (!input.sources || input.sources.length === 0) {
    warnings.push({ code: "no-sources", message: "Keine Quellen angegeben. Wissenschaftliche Aussagen benötigen Fundierung." });
  }

  if (input.rawText && input.rawText.length < 50) {
    warnings.push({ code: "text-too-short", message: "Rohtext sehr kurz. Mehr Input führt zu besseren Ergebnissen." });
  }

  // Prüfe auf werbliche/umgangssprachliche Phrasen
  const textToCheck = (input.rawText ?? "").toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (textToCheck.includes(phrase.toLowerCase())) {
      warnings.push({ code: "banned-phrase", message: `Vermeiden Sie: "${phrase}"` });
    }
  }

  return warnings;
}

// --- Gliederung ---

export function generateScientificOutline(input: ScientificWritingInput): ScientificOutlineResult {
  const topic = input.topic;
  const level = input.level ?? "bachelor";

  const baseStructure = [
    `1. Einleitung`,
    `   1.1 Problemstellung und Relevanz`,
    `   1.2 Forschungsfrage und Zielsetzung`,
    `   1.3 Aufbau der Arbeit`,
    `2. Theoretischer Rahmen`,
    `   2.1 Begriffsdefinitionen`,
    `   2.2 Stand der Forschung`,
    `   2.3 Theoretische Grundlagen`,
    `3. Methodik`,
    `   3.1 Forschungsdesign`,
    `   3.2 Datenerhebung und -auswertung`,
    `4. Analyse und Ergebnisse`,
    `   4.1 Darstellung der Ergebnisse`,
    `   4.2 Interpretation`,
    `5. Diskussion`,
    `   5.1 Einordnung in den Forschungskontext`,
    `   5.2 Limitationen`,
    `6. Fazit und Ausblick`,
    `   6.1 Zusammenfassung`,
    `   6.2 Implikationen und weiterer Forschungsbedarf`,
  ];

  // Anpassung je nach Arbeitstyp
  if (input.workType === "essay") {
    return {
      title: topic,
      outline: [
        `1. Einleitung – These und Fragestellung`,
        `2. Hauptteil – Argumentation`,
        `   2.1 Argument A`,
        `   2.2 Argument B`,
        `   2.3 Gegenposition und Widerlegung`,
        `3. Schluss – Zusammenfassung und Einordnung`,
      ],
      rationale: "Essay-Struktur: kompakt, argumentationszentriert",
    };
  }

  if (input.workType === "abstract") {
    return {
      title: topic,
      outline: [
        `1. Hintergrund und Ziel`,
        `2. Methode`,
        `3. Zentrale Ergebnisse`,
        `4. Fazit`,
      ],
      rationale: "Abstract-Struktur: maximal kompakt",
    };
  }

  return {
    title: topic,
    outline: baseStructure,
    rationale: `Standardstruktur für ${input.workType} auf ${level}-Niveau`,
  };
}

// --- Textgenerator ---

export function generateScientificText(input: ScientificWritingInput): ScientificTextResult {
  const warnings = analyzeScientificInput(input);
  const outline = generateScientificOutline(input);

  // Text je nach Abschnitt
  const section = input.section ?? "einleitung";
  const text = generateSectionText(input, section);

  // Abstract
  const abstract = generateAbstract({
    topic: input.topic,
    method: "qualitative Analyse",
    resultSummary: "Die Analyse zeigt signifikante Zusammenhänge.",
  });

  // Citation Hints
  const citationHints = generateCitationHints(input);

  // Style Notes
  const styleNotes = [
    "Sachliche, nüchterne Sprache verwendet",
    "Vermeidung von Umgangssprache",
    "Logische Verknüpfungen zwischen Absätzen",
  ];

  return {
    title: input.topic,
    outline: outline.outline,
    text,
    abstract: abstract.text,
    citationHints,
    warnings,
    styleNotes,
    rationale: `Abschnitt: ${section}, Ton: ${input.tone ?? "sachlich"}`,
  };
}

function generateIntroduction(input: ScientificWritingInput): string {
  const topic = input.topic;
  const field = input.field ?? "Fachgebiet";

  return `Die vorliegende Arbeit befasst sich mit ${topic}. Im Kontext von ${field} stellt dieses Thema ein relevantes Forschungsfeld dar, das einer näheren Analyse bedarf.

Die zentrale Forschungsfrage lautet: Wie lassen sich die Zusammenhänge im Bereich ${topic} systematisieren und bewerten? Ziel der Arbeit ist es, einen Überblick über den aktuellen Forschungsstand zu geben und offene Fragen zu identifizieren.

Im ersten Abschnitt wird der theoretische Rahmen dargelegt. Anschließend werden die angewandten Methoden erläutert, bevor die Ergebnisse präsentiert und diskutiert werden.`;
}

function generateTheoreticalFramework(input: ScientificWritingInput): string {
  return `Der theoretische Rahmen dieser Arbeit stützt sich auf bestehende Forschung zum Thema ${input.topic}. In der Literatur werden verschiedene Ansätze diskutiert, die im Folgenden dargestellt werden.

Zunächst werden die zentralen Begriffe definiert. Darauf aufbauend wird der Stand der Forschung systematisch dargelegt. In diesem Zusammenhang zeigt sich, dass verschiedene Perspektiven existieren, die einer kritischen Betrachtung bedürfen.

Die vorliegenden Studien deuten darauf hin, dass ${input.topic} ein vielschichtiges Phänomen ist, das nicht auf eine einzelne Theorie reduziert werden kann.`;
}

function generateMethodology(input: ScientificWritingInput): string {
  return `Die methodische Vorgehensweise dieser Arbeit basiert auf einer systematischen Analyse bestehender Literatur und Daten. Es wurde ein qualitativer Ansatz gewählt, um die Komplexität des Themas ${input.topic} angemessen zu erfassen.

Die Datenerhebung erfolgte durch eine strukturierte Recherche in relevanten Datenbanken. Die Auswertung orientiert sich an etablierten Verfahren der qualitativen Inhaltsanalyse.

Die gewählte Methodik ermöglicht eine detaillierte Betrachtung des Untersuchungsgegenstandes, bringt jedoch auch Limitationen mit sich, die in der Diskussion berücksichtigt werden.`;
}

function generateAnalysis(input: ScientificWritingInput): string {
  return `Die Analyse zeigt, dass ${input.topic} in der Forschung unterschiedlich bewertet wird. Die vorliegenden Studien lassen sich in mehrere Stränge unterteilen.

Einerseits gibt es Evidenz für signifikante Effekte. Andererseits weisen einige Studien auf methodische Limitationen hin, die eine Verallgemeinerung einschränken. In Anbetracht dieser Befunde erscheint eine differenzierte Betrachtung geboten.

Demzufolge lässt sich festhalten, dass die Forschungslage nicht eindeutig ist und weiterer Untersuchungen bedarf.`;
}

function generateDiscussion(_input: ScientificWritingInput): string {
  return `Die Ergebnisse der vorliegenden Arbeit werden im Folgenden in den breiteren Forschungskontext eingeordnet. In der Literatur finden sich sowohl übereinstimmende als auch abweichende Befunde.

Die Übereinstimmung mit früheren Studien stärkt die Validität der Ergebnisse. Gleichwohl sind die Limitationen dieser Arbeit zu berücksichtigen, insbesondere hinsichtlich der Generalisierbarkeit.

In diesem Zusammenhang wäre eine vertiefte Analyse mit größeren Stichproben wünschenswert, um die vorliegenden Befunde zu bestätigen.`;
}

function generateConclusion(input: ScientificWritingInput): string {
  return `Die vorliegende Arbeit hat sich mit ${input.topic} auseinandergesetzt. Zusammenfassend lässt sich festhalten, dass das Thema weiterhin relevanter Forschungsbedarf besteht.

Die zentrale Erkenntnis ist, dass eine differenzierte Betrachtung notwendig ist, die verschiedene Perspektiven berücksichtigt. Darüber hinaus wurden offene Fragen identifiziert, die weiterer Untersuchung bedürfen.

Implikationen für die Praxis und zukünftige Forschung werden abschließend skizziert.`;
}

function generateSectionText(input: ScientificWritingInput, section: string): string {
  switch (section) {
    case "einleitung": return generateIntroduction(input);
    case "theoretischer_rahmen": return generateTheoreticalFramework(input);
    case "methodik": return generateMethodology(input);
    case "analyse": return generateAnalysis(input);
    case "diskussion": return generateDiscussion(input);
    case "schluss": return generateConclusion(input);
    default: return generateIntroduction(input);
  }
}

// --- Abstract ---

export function generateAbstract(input: {
  topic: string;
  method: string;
  resultSummary: string;
}): AbstractResult {
  const text = `Ziel: Diese Arbeit untersucht ${input.topic}.
Methode: Es wurde eine ${input.method} durchgeführt.
Ergebnisse: ${input.resultSummary}
Fazit: Die Ergebnisse zeigen relevante Zusammenhänge auf, die weiterer Forschung bedürfen.`;

  return {
    text,
    keywords: ["Forschung", "Analyse", "Methodik", "Ergebnisse"],
  };
}

// --- Umformulierung ---

export function rewriteAcademic(input: {
  inputText: string;
  tone?: ScientificTone;
}): AcademicRewriteResult {
  let rewritten = input.inputText;

  // Ersetze umgangssprachliche Formulierungen
  rewritten = rewritten.replace(/mega|toll|cool/gi, "relevant");
  rewritten = rewritten.replace(/einfach super/gi, "besonders geeignet");
  rewritten = rewritten.replace(/hilft beim/gi, "unterstützt den Prozess des");
  rewritten = rewritten.replace(/macht vieles einfacher/gi, "erleichtert die Bearbeitung erheblich");

  // Füge akademische Verknüpfungen hinzu
  if (!rewritten.includes("darüber hinaus") && !rewritten.includes("in diesem Zusammenhang")) {
    rewritten += " In diesem Zusammenhang sind weitere wissenschaftliche Untersuchungen wünschenswert.";
  }

  return {
    original: input.inputText,
    rewritten,
    changes: [
      "Umgangssprache durch sachliche Formulierungen ersetzt",
      "Akademische Verknüpfungen hinzugefügt",
    ],
  };
}

// --- Zitation-Hinweise ---

function generateCitationHints(input: ScientificWritingInput): string[] {
  const hints: string[] = [];

  if (!input.sources || input.sources.length === 0) {
    hints.push("Alle Aussagen benötigen eine Quellenangabe.");
    hints.push("Verwenden Sie konsistent einen Zitationsstil (APA, Harvard, etc.).");
  }

  hints.push(`Zitationsstil: ${input.citationStyle ?? "APA"}`);
  hints.push("Direkte Zitate mit Seitenzahlen versehen.");
  hints.push("Paraphrasen klar kennzeichnen.");

  return hints;
}

// --- Gliederungsprüfung ---

export function checkOutlineStructure(outline: string[]): ScientificWarning[] {
  const warnings: ScientificWarning[] = [];

  if (outline.length < 3) {
    warnings.push({ code: "outline-too-short", message: "Gliederung sehr kurz. Mindestens 3 Hauptpunkte empfohlen." });
  }

  if (!outline.some((line) => line.toLowerCase().includes("einleitung"))) {
    warnings.push({ code: "no-introduction", message: "Keine Einleitung in der Gliederung gefunden." });
  }

  if (!outline.some((line) => line.toLowerCase().includes("fazit") || line.toLowerCase().includes("schluss"))) {
    warnings.push({ code: "no-conclusion", message: "Kein Fazit/Schluss in der Gliederung gefunden." });
  }

  return warnings;
}
