// Vernehmungs-Taktik- & Täuschungsdetektions-Labor (WP 115.1, Meilenstein 55.0 / v6.7.0).
//
// Deterministische Werkzeuge für Kriminalliteratur: Vernehmungsstrategien,
// Lügenindikatoren-Analyse, Dialog-Generator und Täuschungswahrscheinlichkeit.
//
// Design-Regeln:
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Eingaben werden nie mutiert.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefere leere Arrays
//     bzw. null statt zu werfen.
//   - Browser-kompatibel, keine node:-Module.

// ---------------------------------------------------------------------------
// Deterministische Kernfunktionen
// ---------------------------------------------------------------------------

/**
 * FNV-1a-Hash (32-bit, unsigned).
 * Deterministische Hash-Funktion für Strings.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Mulberry32-Pseudozufallszahlengenerator.
 * Liefert eine Funktion, die Werte im Intervall [0, 1) zurückgibt.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Private Hilfsfunktion: wählt ein zufälliges Element aus einem Array.
 * Wirft einen Fehler, wenn das Array leer ist.
 */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error('pick: Array ist leer');
  }
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// WP 115.1 — Feature 1: Vernehmungsstrategien
// ---------------------------------------------------------------------------

/** Vernehmungsstrategie mit rechtlicher Grundlage und Erfolgsquote. */
export interface InterrogationStrategy {
  /** Eindeutiger Identifier. */
  id: string;
  /** Anzeigename der Strategie. */
  name: string;
  /** Kurzbeschreibung. */
  description: string;
  /** Detaillierter Ansatz. */
  approach: string;
  /** Rechtliche Grundlage (StPO-Referenz). */
  legalBasis: string;
  /** Erfolgsquote (0–1). */
  successRate: number;
}

/** Die vier Vernehmungsstrategien. */
export const INTERROGATION_STRATEGIES: readonly InterrogationStrategy[] = [
  {
    id: 'cognitive',
    name: 'PEACE-Methode',
    description: 'Offene Fragen, mentale Rekonstruktion',
    approach:
      'Kognitive Interrogationstechnik mit offenen Fragen und mentaler Rekonstruktion des Geschehens. Der Verdächtige wird aufgefordert, die Ereignisse aus verschiedenen Perspektiven zu schildern.',
    legalBasis: 'StPO § 136, § 163a — Verbot von Täuschung und Zwang',
    successRate: 0.72,
  },
  {
    id: 'evidenceTrap',
    name: 'SBE-Technik',
    description: 'Verschweigen von Beweisen bis sich der Verdächtige verstrickt',
    approach:
      'Strategic Evidence Based — Beweise werden zurückgehalten, um Widersprüche zu provozieren. Der Verdächtige wird mit vagen Androhungen konfrontiert, um Selbstentschlüsse zu erzwingen.',
    legalBasis: 'StPO § 136 — Täuschungsverbot, aber erlaubt bei rechtmäßiger Anwendung',
    successRate: 0.65,
  },
  {
    id: 'minimization',
    name: 'Good Cop',
    description: 'Moralische Ausreden anbieten',
    approach:
      'Minimierung der Tat durch moralische Entschuldigungen und Empathie. Der Ermittler signalisiert Verständnis und bietet psychologische Ausreden an, um das Schuldgefühl zu reduzieren.',
    legalBasis: 'StPO § 136a — Verbot der Beeinflussung durch Versprechen',
    successRate: 0.58,
  },
  {
    id: 'maximization',
    name: 'Maximization',
    description: 'Konfrontation mit Höchststrafe',
    approach:
      'Konfrontation mit der Höchststrafe und Androhung von Konsequenzen. Der Ermittler übertreibt die Schwere der Tat, um Angst und Unsicherheit zu erzeugen.',
    legalBasis: 'StPO § 136 — Verbot der Einschüchterung',
    successRate: 0.45,
  },
] as const;

// ---------------------------------------------------------------------------
// WP 115.1 — Feature 2: Stress- & Lügen-Indikatoren
// ---------------------------------------------------------------------------

/** Indikatoren für Täuschung und Stress während einer Vernehmung. */
export interface DeceptionIndicators {
  /** Blinzelfrequenz (0–100, höher = auffälliger). */
  blinkRate: number;
  /** Schluckfrequenz (0–100, höher = auffälliger). */
  swallowRate: number;
  /** Pronomen-Distanzierung (0–100, höher = mehr Distanz). */
  pronounDistance: number;
  /** Anzahl der Pausen (0–100, höher = mehr Pausen). */
  pauseCount: number;
  /** Zappel-Score (0–100, höher = unruhiger). */
  fidgetScore: number;
}

/** Ergebnis der Täuschungsanalyse. */
export interface DeceptionAnalysis {
  /** Täuschungs-Score (0–100). */
  deceptionScore: number;
  /** Konfidenz der Analyse. */
  confidence: 'low' | 'medium' | 'high';
  /** Die ursprünglichen Indikatoren. */
  indicators: DeceptionIndicators;
  /** Erkannte Red Flags. */
  redFlags: string[];
  /** Menschenlesbare Analyse. */
  analysis: string;
}

/** Gewichtung der Indikatoren (Summe = 1.0). */
const WEIGHT_BLINK = 0.3;
const WEIGHT_SWALLOW = 0.2;
const WEIGHT_PRONOUN = 0.25;
const WEIGHT_PAUSE = 0.15;
const WEIGHT_FIDGET = 0.1;

/** Schwellenwert für Red Flags. */
const RED_FLAG_THRESHOLD = 70;

/**
 * Analysiert Täuschungsindikatoren und berechnet einen gewichteten Score.
 */
export function analyzeDeceptionIndicators(indicators: DeceptionIndicators): DeceptionAnalysis {
  // Normalisierung auf 0–100
  const blinkNorm = Math.min(100, Math.max(0, indicators.blinkRate));
  const swallowNorm = Math.min(100, Math.max(0, indicators.swallowRate));
  const pronounNorm = Math.min(100, Math.max(0, indicators.pronounDistance));
  const pauseNorm = Math.min(100, Math.max(0, indicators.pauseCount));
  const fidgetNorm = Math.min(100, Math.max(0, indicators.fidgetScore));

  // Gewichteter Score
  const deceptionScore = Math.round(
    blinkNorm * WEIGHT_BLINK +
    swallowNorm * WEIGHT_SWALLOW +
    pronounNorm * WEIGHT_PRONOUN +
    pauseNorm * WEIGHT_PAUSE +
    fidgetNorm * WEIGHT_FIDGET,
  );

  // Konfidenz basierend auf Score-Extremität
  let confidence: 'low' | 'medium' | 'high';
  if (deceptionScore >= 70) {
    confidence = 'high';
  } else if (deceptionScore >= 40) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Red Flags
  const redFlags: string[] = [];
  if (blinkNorm > RED_FLAG_THRESHOLD) {
    redFlags.push('Übermäßige Blinzelfrequenz');
  }
  if (swallowNorm > RED_FLAG_THRESHOLD) {
    redFlags.push('Häufiges Schlucken');
  }
  if (pronounNorm > RED_FLAG_THRESHOLD) {
    redFlags.push('Pronomen-Distanzierung');
  }
  if (pauseNorm > RED_FLAG_THRESHOLD) {
    redFlags.push('Viele Pausen');
  }
  if (fidgetNorm > RED_FLAG_THRESHOLD) {
    redFlags.push('Zappelverhalten');
  }

  // Analyse-Text
  const analysis = `Täuschungsanalyse: Score ${deceptionScore}/100 (${confidence} Konfidenz). ${
    redFlags.length > 0
      ? `${redFlags.length} Red Flag(s) erkannt.`
      : 'Keine signifikanten Red Flags.'
  }`;

  return {
    deceptionScore,
    confidence,
    indicators,
    redFlags,
    analysis,
  };
}

// ---------------------------------------------------------------------------
// WP 115.1 — Feature 3: Verhör-Dialog-Generator
// ---------------------------------------------------------------------------

/** Szenario für die Dialoggenerierung. */
export interface InterrogationScenario {
  /** Name des Verdächtigen. */
  suspectName: string;
  /** Beschreibung der Tat. */
  crime: string;
  /** Verwendete Strategie. */
  strategy: 'cognitive' | 'evidenceTrap' | 'minimization' | 'maximization';
  /** Anzahl der bekannten Beweise. */
  evidenceCount: number;
}

/** Eine einzelne Dialogzeile. */
export interface DialogLine {
  /** Sprecher-Rolle. */
  speaker: 'detective' | 'suspect' | 'lawyer';
  /** Dialogtext. */
  text: string;
}

/** Ergebnis der Dialoggenerierung. */
export interface InterrogationDialog {
  /** Dialogzeilen. */
  dialog: DialogLine[];
  /** Rechtlicher Hinweis. */
  legalWarning: string;
  /** Notizen für den Autor. */
  notes: string[];
}

// ---------------------------------------------------------------------------
// Dialog-Bausteine (deterministisch, deutsch)
// ---------------------------------------------------------------------------

/** Belehrung nach StPO (Pflichtbestandteil). */
const BELEHRUNG = 'Sie sind nach § 136 StPO zu belehren: Sie haben das Recht zu schweigen. Alles, was Sie sagen, kann gegen Sie verwendet werden.';

/** Strategie-spezifische Einstiegsfragen. */
const STRATEGY_OPENERS: Record<string, readonly string[]> = {
  cognitive: [
    'Können Sie mir in eigenen Worten schildern, was an dem Tag passiert ist?',
    'Wie haben Sie die Situation wahrgenommen? Was ist Ihnen aufgefallen?',
    'Erzählen Sie mir von Anfang an — was war Ihr erster Gedanke?',
  ],
  evidenceTrap: [
    'Wir haben bereits Beweise. Was sagen Sie dazu?',
    'Es gibt Zeugen, die Sie gesehen haben. Was ist Ihre Erklärung?',
    'Die Ermittlungen sind weiter, als Sie denken. Wollen Sie noch etwas sagen?',
  ],
  minimization: [
    'Ich verstehe, dass es eine schwierige Situation für Sie war.',
    'Viele Menschen hätten in dieser Situation gehandelt wie Sie.',
    'Es muss eine Erklärung dafür geben, was passiert ist. Was sagen Sie?',
  ],
  maximization: [
    'Die Tat, die Ihnen zur Last gelegt wird, ist sehr schwerwiegend.',
    'Wenn Sie nicht kooperieren, drohen Ihnen die Höchststrafe.',
    'Die Beweislage ist eindeutig. Was haben Sie zu sagen?',
  ],
};

/** Strategie-spezifische Reaktionen des Verdächtigen. */
const STRATEGY_SUSPECT_RESPONSES: Record<string, readonly string[]> = {
  cognitive: [
    'Ich... ich weiß nicht genau. Es war alles so schnell.',
    'Ich war dort, aber ich habe nichts getan.',
    'Können Sie die Frage wiederholen? Ich muss nachdenken.',
  ],
  evidenceTrap: [
    'Was für Beweise? Ich habe nichts zu verbergen.',
    'Das stimmt nicht. Ich war nicht dort.',
    'Ich möchte meinen Anwalt sprechen.',
  ],
  minimization: [
    'Es war nicht so, wie es aussieht. Es gab einen Grund.',
    'Ich habe es nicht so gemeint. Es ist schiefgelaufen.',
    'Ich bereue es. Es war ein Fehler.',
  ],
  maximization: [
    'Das ist nicht fair. Ich habe nicht das getan, was Sie sagen.',
    'Ich verlasse mich auf mein Recht.',
    'Ohne Anwalt sage ich nichts.',
  ],
};

/** Strategie-spezifische Ermittler-Fortsetzungen. */
const STRATEGY_DETECTIVE_FOLLOWUPS: Record<string, readonly string[]> = {
  cognitive: [
    'Das ist interessant. Können Sie das genauer beschreiben?',
    'Und was ist danach passiert?',
    'Wie haben Sie sich in dem Moment gefühlt?',
  ],
  evidenceTrap: [
    'Das können wir überprüfen. Was sagen Sie zu den Beweisen?',
    'Es gibt Widersprüche in Ihrer Aussage. Wollen Sie das erklären?',
    'Wir haben noch mehr Beweise. Wollen Sie noch etwas sagen?',
  ],
  minimization: [
    'Ich verstehe. Aber es gibt noch Fragen, die geklärt werden müssen.',
    'Das klingt plausibel. Aber was ist mit den Beweisen?',
    'Ich sehe, dass Sie unter Druck stehen. Können wir das klären?',
  ],
  maximization: [
    'Die Konsequenzen sind ernst. Wollen Sie kooperieren?',
    'Die Beweislage ist eindeutig. Was haben Sie zu sagen?',
    'Wenn Sie nicht mit uns sprechen, wird es schlimmer für Sie.',
  ],
};

/** Anwalt-Eingriffe. */
const LAWYER_INTERVENTIONS: readonly string[] = [
  'Mein Mandant macht keine weiteren Aussagen ohne mich.',
  'Ich werde meine Aussage anfechten.',
  'Das ist eine Verletzung der Vernehmungsordnung.',
  'Mein Mandant bleibt schweigen.',
];

/** Abschlussformulierungen. */
const CLOSINGS: readonly string[] = [
  'Die Vernehmung wird vorerst unterbrochen.',
  'Wir werden die Aussage protokollieren.',
  'Das Protokoll wird Ihnen vorgelegt.',
  'Die Ermittlungen werden fortgesetzt.',
];

/**
 * Generiert einen Verhör-Dialog (8–12 Wechsel) basierend auf Szenario und Seed.
 */
export function generateInterrogationDialog(
  scenario: InterrogationScenario,
  seed: number,
): InterrogationDialog {
  const rng = createSeededRandom(seed);
  const dialog: DialogLine[] = [];

  // Belehrung nach StPO (Pflicht)
  dialog.push({
    speaker: 'detective',
    text: BELEHRUNG,
  });

  // Strategie-spezifischer Einstieg
  const openers = STRATEGY_OPENERS[scenario.strategy] ?? STRATEGY_OPENERS.cognitive;
  dialog.push({
    speaker: 'detective',
    text: pick(openers, rng),
  });

  // Verdächtiger reagiert
  const suspectResponses = STRATEGY_SUSPECT_RESPONSES[scenario.strategy] ?? STRATEGY_SUSPECT_RESPONSES.cognitive;
  dialog.push({
    speaker: 'suspect',
    text: pick(suspectResponses, rng),
  });

  // Anzahl der Wechsel (4–8, Gesamtlänge 8–12 inkl. Belehrung/Opener/Abschluss)
  const exchangeCount = 4 + Math.floor(rng() * 5);

  // Dialog-Wechsel generieren
  for (let i = 0; i < exchangeCount; i++) {
    const roll = rng();

    if (roll < 0.15 && i > 2) {
      // Anwalt-Eingriff
      dialog.push({
        speaker: 'lawyer',
        text: pick(LAWYER_INTERVENTIONS, rng),
      });
    } else if (roll < 0.55) {
      // Ermittler-Fortsetzung
      const followups = STRATEGY_DETECTIVE_FOLLOWUPS[scenario.strategy] ?? STRATEGY_DETECTIVE_FOLLOWUPS.cognitive;
      dialog.push({
        speaker: 'detective',
        text: pick(followups, rng),
      });
    } else {
      // Verdächtiger-Antwort
      const responses = STRATEGY_SUSPECT_RESPONSES[scenario.strategy] ?? STRATEGY_SUSPECT_RESPONSES.cognitive;
      dialog.push({
        speaker: 'suspect',
        text: pick(responses, rng),
      });
    }
  }

  // Abschluss
  dialog.push({
    speaker: 'detective',
    text: pick(CLOSINGS, rng),
  });

  // Rechtlicher Hinweis
  const legalWarning =
    'Dieses Dialog ist ein fiktives Beispiel. Es ersetzt keine rechtliche Beratung. ' +
    'Die Belehrung nach § 136 StPO ist in der Praxis verpflichtend.';

  // Notizen für den Autor
  const notes: string[] = [
    `Strategie: ${scenario.strategy}`,
    `Beweise: ${scenario.evidenceCount}`,
    `Tat: ${scenario.crime}`,
    'Dialog ist deterministisch und kann mit demselben Seed reproduziert werden.',
  ];

  return {
    dialog,
    legalWarning,
    notes,
  };
}

// ---------------------------------------------------------------------------
// WP 115.1 — Feature 4: Täuschungs-Wahrscheinlichkeits-Kalkulator
// ---------------------------------------------------------------------------

/** Ergebnis der Täuschungswahrscheinlichkeits-Berechnung. */
export interface DeceptionProbabilityResult {
  /** Täuschungswahrscheinlichkeit (0–100). */
  deceptionProbability: number;
  /** Konfidenzintervall [untere Grenze, obere Grenze]. */
  confidenceInterval: [number, number];
  /** Einflussfaktoren. */
  factors: string[];
  /** Empfehlung für die Vernehmung. */
  recommendation: string;
}

/**
 * Berechnet die Täuschungswahrscheinlichkeit basierend auf Wahrhaftigkeit,
 * Stresslevel und Vorbereitung.
 */
export function calculateDeceptionProbability(
  truthfulnessScore: number,
  stressLevel: number,
  preparationLevel: number,
): DeceptionProbabilityResult {
  // Normalisierung auf 0–100
  const truth = Math.min(100, Math.max(0, truthfulnessScore));
  const stress = Math.min(100, Math.max(0, stressLevel));
  const prep = Math.min(100, Math.max(0, preparationLevel));

  // Gewichtete Berechnung
  const deceptionProbability = Math.round(
    (100 - truth) * 0.4 + stress * 0.35 + (100 - prep) * 0.25,
  );

  // Konfidenzintervall (±10)
  const margin = 10;
  const confidenceInterval: [number, number] = [
    Math.max(0, deceptionProbability - margin),
    Math.min(100, deceptionProbability + margin),
  ];

  // Einflussfaktoren
  const factors: string[] = [];
  if (truth < 50) {
    factors.push('Niedriger Wahrhaftigkeitsscore');
  }
  if (stress > 60) {
    factors.push('Hoher Stresslevel');
  }
  if (prep < 40) {
    factors.push('Geringe Vorbereitung');
  }
  if (factors.length === 0) {
    factors.push('Keine signifikanten Risikofaktoren');
  }

  // Empfehlung
  let recommendation: string;
  if (deceptionProbability >= 70) {
    recommendation = 'Hohe Täuschungswahrscheinlichkeit — intensivieren Sie die Vernehmung.';
  } else if (deceptionProbability >= 40) {
    recommendation = 'Mäßige Täuschungswahrscheinlichkeit — weitere Indikatoren prüfen.';
  } else {
    recommendation = 'Geringe Täuschungswahrscheinlichkeit — Standardverfahren anwenden.';
  }

  return {
    deceptionProbability,
    confidenceInterval,
    factors,
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// Factory-Funktionen
// ---------------------------------------------------------------------------

/**
 * Erstellt einen Beispiel-Verhör-Dialog mit festen Parametern.
 */
export function createSampleInterrogationDialog(): InterrogationDialog {
  return generateInterrogationDialog(
    {
      suspectName: 'Max Mustermann',
      crime: 'Mord an einem Geschäftspartner',
      strategy: 'cognitive',
      evidenceCount: 3,
    },
    42,
  );
}

/**
 * Erstellt eine Beispiel-Täuschungsanalyse mit festen Parametern.
 */
export function createSampleDeceptionAnalysis(): DeceptionAnalysis {
  return analyzeDeceptionIndicators({
    blinkRate: 75,
    swallowRate: 60,
    pronounDistance: 80,
    pauseCount: 55,
    fidgetScore: 70,
  });
}
