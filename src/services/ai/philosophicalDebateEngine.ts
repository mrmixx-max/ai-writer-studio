// PhilosophicalDebateEngine (WP 74.1)
//
// Generiert philosophische Dialektiken und moralische Dilemmata für
// literarische Figuren. Deterministisch: FNV-1a + mulberry32.
// Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Philosophische Position. */
export interface PhilosophicalPosition {
  id: string;
  name: string;
  description: string;
  keyPrinciples: string[];
  emotionalWound: string;
}

/** Ein Argument in der Debatte. */
export interface DebateArgument {
  speaker: string;
  position: string;
  claim: string;
  reasoning: string;
  emotionalStake: string;
}

/** Ein moralisches Dilemma. */
export interface MoralDilemma {
  id: string;
  title: string;
  description: string;
  options: DilemmaOption[];
  stakes: string;
}

/** Eine Option in einem Dilemma. */
export interface DilemmaOption {
  id: string;
  label: string;
  consequence: string;
  moralFramework: string;
}

/** Eine philosophische Debatte. */
export interface PhilosophicalDebate {
  topic: string;
  participants: PhilosophicalPosition[];
  arguments: DebateArgument[];
  dilemma: MoralDilemma;
  synthesis: string;
}

/** Philosophische Positionen. */
export const PHILOSOPHICAL_POSITIONS: PhilosophicalPosition[] = [
  {
    id: "utilitarian",
    name: "Utilitarismus",
    description: "Das Wohl der Mehrheit über das Individuum.",
    keyPrinciples: ["Nutzenmaximierung", "Konsequentialismus", "Gleiches Glück für alle"],
    emotionalWound: "Verantwortung für unzählige fremde Leben",
  },
  {
    id: "deontological",
    name: "Deontologie",
    description: "Pflicht und Moral stehen über Konsequenzen.",
    keyPrinciples: ["Kategorischer Imperativ", "Menschen als Zwecke", "Universelle Gesetze"],
    emotionalWound: "Schuld am eigenen Ideal",
  },
  {
    id: "virtue",
    name: "Tugendethik",
    description: "Gute Charaktere tragen gute Taten.",
    keyPrinciples: ["Praktische Weisheit", "Goldener Mittelweg", "Charakterbildung"],
    emotionalWound: "Angst vor moralischer Unvollkommenheit",
  },
  {
    id: "existentialist",
    name: "Existenzialismus",
    description: "Der Mensch ist verurteilt, frei zu sein.",
    keyPrinciples: ["Radikale Freiheit", "Authentizität", "Verantwortung für sich selbst"],
    emotionalWound: "Angst vor der eigenen Freiheit",
  },
  {
    id: "stoic",
    name: "Stoizismus",
    description: "Gleichmut gegenüber dem, was man nicht ändern kann.",
    keyPrinciples: ["Tugend als einziges Gut", "Akzeptanz des Schicksals", "Innere Freiheit"],
    emotionalWound: "Verlust der geliebten Person",
  },
  {
    id: "nihilist",
    name: "Nihilismus",
    description: "Kein inherente Bedeutung oder Moral existiert.",
    keyPrinciples: ["Absenz von Sinn", "Eigene Werte schaffen", "Revolte gegen Absurdität"],
    emotionalWound: "Erkenntnis der eigenen Bedeutungslosigkeit",
  },
];

/** Moralische Dilemmata. */
export const MORAL_DILEMMAS: MoralDilemma[] = [
  {
    id: "trolley",
    title: "Die Straßenbahn-Frage",
    description: "Eine Straßenbahn rollt auf fünf Personen zu. Du kannst einen Hebel umlegen, um sie auf ein anderes Gleis zu lenken, wo eine Person steht.",
    options: [
      { id: "pull", label: "Hebel umlegen", consequence: "Eine Person stirbt, fünf werden gerettet", moralFramework: "Utilitarismus" },
      { id: "dont-pull", label: "Nichts tun", consequence: "Fünf Personen sterben, du bist unschuldig", moralFramework: "Deontologie" },
    ],
    stakes: "Fünf Leben gegen eines",
  },
  {
    id: "truth-vs-mercy",
    title: "Wahrheit um jeden Preis vs. barmherzige Lüge",
    description: "Ein fragender Mensch sucht die Wahrheit, die ihn zerstören würde. Du könnten lügen, um ihn zu schützen.",
    options: [
      { id: "truth", label: "Wahrheit sagen", consequence: "Der Mensch erleidet schmerzhafte Erkenntnis", moralFramework: "Deontologie" },
      { id: "lie", label: "Barmherzige Lüge", consequence: "Der Mensch behält seine Illusion", moralFramework: "Tugendethik" },
    ],
    stakes: "Wahrheit vs. Schutz",
  },
  {
    id: "revolution-vs-reform",
    title: "Blutige Revolution vs. pazifistische Reform",
    description: "Ein tyrannisches Regime unterdrückt das Volk. Revolution würde Blutvergießen, Reform würde Generationen dauern.",
    options: [
      { id: "revolution", label: "Revolution", consequence: "Kurzfristiges Blutvergießen, langfristige Freiheit", moralFramework: "Utilitarismus" },
      { id: "reform", label: "Reform", consequence: "Langsame Veränderung, Generationen leiden weiter", moralFramework: "Tugendethik" },
    ],
    stakes: "Gegenwart vs. Zukunft",
  },
  {
    id: "free-will",
    title: "Freier Wille vs. Vorherbestimmung",
    description: "Eine Figur erfährt, dass ihr Schicksal vorherbestimmt ist. Soll sie kämpfen oder akzeptieren?",
    options: [
      { id: "fight", label: "Kämpfen", consequence: "Möglicherweise vergebens, aber authentisch", moralFramework: "Existenzialismus" },
      { id: "accept", label: "Akzeptieren", consequence: "Gleichmut, aber Resignation", moralFramework: "Stoizismus" },
    ],
    stakes: "Autonomie vs. Akzeptanz",
  },
];

/** Generiert eine philosophische Debatte. */
export function generateDebate(topic: string, seed: number = 42): PhilosophicalDebate {
  const rng = createSeededRandom(seed);
  const pos1Idx = Math.floor(rng() * PHILOSOPHICAL_POSITIONS.length);
  let pos2Idx = Math.floor(rng() * PHILOSOPHICAL_POSITIONS.length);
  while (pos2Idx === pos1Idx) {
    pos2Idx = Math.floor(rng() * PHILOSOPHICAL_POSITIONS.length);
  }

  const pos1 = PHILOSOPHICAL_POSITIONS[pos1Idx];
  const pos2 = PHILOSOPHICAL_POSITIONS[pos2Idx];

  const dilemmaIdx = Math.floor(rng() * MORAL_DILEMMAS.length);
  const dilemma = MORAL_DILEMMAS[dilemmaIdx];

  const arguments_: DebateArgument[] = [
    {
      speaker: pos1.name,
      position: pos1.name,
      claim: `Aus der Perspektive des ${pos1.name} ist die richtige Handlung klar.`,
      reasoning: pos1.keyPrinciples.join(", "),
      emotionalStake: pos1.emotionalWound,
    },
    {
      speaker: pos2.name,
      position: pos2.name,
      claim: `Der ${pos2.name} widerspricht: Es gibt höhere Werte als ${pos1.keyPrinciples[0].toLowerCase()}.`,
      reasoning: pos2.keyPrinciples.join(", "),
      emotionalStake: pos2.emotionalWound,
    },
  ];

  const synthesis = `Die Debatte zwischen ${pos1.name} und ${pos2.name} bleibt ungelöst — beide Positionen tragen wahre moralische Intuitionen in sich. Die Spannung liegt nicht in der Antwort, sondern in der Frage selbst.`;

  return {
    topic,
    participants: [pos1, pos2],
    arguments: arguments_,
    dilemma,
    synthesis,
  };
}

/** Generiert ein moralisches Dilemma. */
export function generateDilemma(seed: number = 42): MoralDilemma {
  const rng = createSeededRandom(seed);
  const idx = Math.floor(rng() * MORAL_DILEMMAS.length);
  return MORAL_DILEMMAS[idx];
}

/** Formatiert eine Debatte als Text. */
export function formatDebate(debate: PhilosophicalDebate): string {
  const lines: string[] = [];
  lines.push(`=== PHILOSOPHISCHE DEBATTE ===`);
  lines.push(`Thema: ${debate.topic}`);
  lines.push("");
  for (const arg of debate.arguments) {
    lines.push(`${arg.speaker} (${arg.position}):`);
    lines.push(`  These: ${arg.claim}`);
    lines.push(`  Begründung: ${arg.reasoning}`);
    lines.push(`  Emotionaler Einsatz: ${arg.emotionalStake}`);
    lines.push("");
  }
  lines.push(`DILEMMA: ${debate.dilemma.title}`);
  lines.push(`  ${debate.dilemma.description}`);
  for (const opt of debate.dilemma.options) {
    lines.push(`  [${opt.id}] ${opt.label}: ${opt.consequence} (${opt.moralFramework})`);
  }
  lines.push("");
  lines.push(`SYNTHESIS: ${debate.synthesis}`);
  return lines.join("\n");
}

/** Formatiert ein Dilemma als Text. */
export function formatDilemma(dilemma: MoralDilemma): string {
  const lines: string[] = [];
  lines.push(`=== DILEMMA: ${dilemma.title} ===`);
  lines.push(dilemma.description);
  lines.push(`Einsatz: ${dilemma.stakes}`);
  lines.push("");
  for (const opt of dilemma.options) {
    lines.push(`[${opt.id}] ${opt.label}`);
    lines.push(`  Konsequenz: ${opt.consequence}`);
    lines.push(`  Rahmen: ${opt.moralFramework}`);
  }
  return lines.join("\n");
}

/** Prüft, ob eine Position utilitaristisch ist. */
export function isUtilitarian(position: PhilosophicalPosition): boolean {
  return position.id === "utilitarian";
}

/** Prüft, wenn eine Position deontologisch ist. */
export function isDeontological(position: PhilosophicalPosition): boolean {
  return position.id === "deontological";
}

/** Findet eine Position nach ID. */
export function findPosition(id: string): PhilosophicalPosition | undefined {
  return PHILOSOPHICAL_POSITIONS.find((p) => p.id === id);
}

/** Findet ein Dilemma nach ID. */
export function findDilemma(id: string): MoralDilemma | undefined {
  return MORAL_DILEMMAS.find((d) => d.id === id);
}
