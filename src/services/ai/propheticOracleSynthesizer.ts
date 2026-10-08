// PropheticOracleSynthesizer (WP 106.1)
// Pythisches Orakel- & Prophezeiungs-Studio.
// 4 Orakel-Archetypen, hermeneutische Doppel-Matrix, metrischer Hexameter-Generator.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

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
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export type OracleArchetypeId = "pythianTrance" | "ironDecree" | "ominousWarning" | "paradox";

export interface OracleArchetype {
  id: OracleArchetypeId;
  name: string;
  method: string;
  /** Wie die Erfüllung typischerweise eintritt. */
  fulfilment: string;
  exemplars: string[];
}

export const ORACLE_ARCHETYPES: OracleArchetype[] = [
  {
    id: "pythianTrance",
    name: "Die Pythische Trance",
    method: "Fiebriges, archaisches Versrätsel mit Doppelsinn.",
    fulfilment: "Der Doppelsinn erfüllt sich wörtlich — aber nicht in der gedeuteten Richtung.",
    exemplars: ["Ödipus (Sophokles)", "Das Orakel von Delphi", "Macbeth, I. Akt"],
  },
  {
    id: "ironDecree",
    name: "Das Eiserne Dekret",
    method: "Scheinbare Schicksalsgewissheit mit verstecktem juristischem Schlupfloch.",
    fulfilment: "Eine Auslegungslücke hebt die Gewissheit auf, ohne das Wort zu brechen.",
    exemplars: ["Macbeth: kein Mann von einem Weibe geboren", "König Ödipus", "Dune (Kwisatz Haderach)"],
  },
  {
    id: "ominousWarning",
    name: "Die Ominöse Warnung",
    method: "Warnung, die durch den Versuch, sie abzuwenden, erst wahr wird.",
    fulfilment: "Die Abwehrmaßnahme ist selbst das Werkzeug der Erfüllung.",
    exemplars: ["Ödipus' Flucht vor dem Orakel", "König Laios", "Das Schicksal der Atriden"],
  },
  {
    id: "paradox",
    name: "Das Paradoxon",
    method: "Prophezeiung, die sich gleichzeitig im Guten und im Bösen erfüllt.",
    fulfilment: "Segen und Fluch treffen im selben Augenblick ein.",
    exemplars: ["Dune: der Wüstenplanet", "Faust (Pakt und Erlösung)", "Die Ringparabel"],
  },
];

export function getOracleArchetype(id: OracleArchetypeId): OracleArchetype | undefined {
  return ORACLE_ARCHETYPES.find((a) => a.id === id);
}

export interface HermeneuticMatrix {
  archetype: OracleArchetypeId;
  /** Oberflächen-Glaube der Figuren. */
  surfaceBelief: string;
  /** Wahre Schicksals-Erfüllung. */
  trueFulfilment: string;
  /** Der versteckte Doppelsinn, der beides verbindet. */
  pivot: string;
}

const SURFACE_BELIEFS = [
  "Die Figur hält den Spruch für eine Zusage des Sieges.",
  "Die Figur deutet die Worte als Schutz für ihr Haus.",
  "Die Figur glaubt, das Verhängnis sei durch Wachsamkeit abwendbar.",
  "Die Figur liest den Spruch als Segen für den Thronerben.",
];

const TRUE_FULFILMENTS = [
  "Der Sieg kommt — doch der Sieger verliert alles, was den Sieg wert gewesen wäre.",
  "Der Schutz hält — und schließt das Haus mit dem Feind darin ein.",
  "Die Wachsamkeit ist selbst der Weg, auf dem das Verhängnis eintritt.",
  "Der Erbe empfängt Segen und Fluch im gleichen Augenblick.",
];

const PIVOTS = [
  "Das Wort „geboren“ meint nicht die Geburt, sondern die Art des Kommens.",
  "Das Wort „Haus“ meint nicht die Mauern, sondern das Blut.",
  "Das Wort „warnen“ wird zum Wort „führen“.",
  "Das Wort „einst“ steht nicht für morgen, sondern für heute.",
];

export function buildHermeneuticMatrix(archetypeId: OracleArchetypeId, seed: number = 42): HermeneuticMatrix {
  const archetype = getOracleArchetype(archetypeId) || ORACLE_ARCHETYPES[0];
  const rng = createSeededRandom(hashString(`herm:${archetypeId}:${seed}`));
  return {
    archetype: archetype.id,
    surfaceBelief: pick(SURFACE_BELIEFS, rng),
    trueFulfilment: pick(TRUE_FULFILMENTS, rng),
    pivot: pick(PIVOTS, rng),
  };
}

export interface HexameterVerse {
  text: string;
  /** Geschätzte Silbenzahl. */
  syllables: number;
  /** Anzahl Daktylen (—uu) und Spondeen (——). */
  feet: string[];
  /** Zäsur-Position (nach dem wievielten Fuß). */
  caesuraAfterFoot: number;
}

const HEXAMETER_HEMISTICH_A = [
  "Sing mir, o Seherin, die vom Dreifuß",
  "Höre, du Stimme im Felsengrunde",
  "Wisse, o Fürst, was die Tiefe",
  "Vernimm, Wanderer, die dunkle",
  "Merke, du Königssohn, die verschwiegene",
];

const HEXAMETER_HEMISTICH_B = [
  "aus dem Rauche steigend das Wort,",
  "was kein Sterblicher je bedacht,",
  "vor der Stunde des Schwertes spricht:",
  "Kunde vom eigenen Fall,",
  "Rede, die niemand entrinnt:",
];

const HEXAMETER_HEMISTICH_C = [
  "kein Mann von einem Weibe geboren wird dich stürzen.",
  "die Krone trägt nur, wer den Grund nicht kennt.",
  "das Haus brennt nicht durch Feuer, sondern durch Treue.",
  "der Weg zurück ist länger als der Weg hinab.",
  "wer die Warnung hört, hat sie schon vollbracht.",
];

/** Schätzt Silben über Vokalgruppen (deutsche Heuristik). */
export function estimateSyllables(text: string): number {
  const matches = text.toLowerCase().match(/[aeiouäöüy]+/g);
  return matches ? matches.length : 0;
}

/** Klassifiziert einen Versfuß nach Vokalmuster: Daktylus (3) oder Spondee (2). */
export function classifyFeet(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return words.map((w) => (estimateSyllables(w) >= 3 ? "Daktylus" : "Spondeus"));
}

export function generateHexameter(archetypeId: OracleArchetypeId, seed: number = 42): HexameterVerse {
  const rng = createSeededRandom(hashString(`hex:${archetypeId}:${seed}`));
  const text = `${pick(HEXAMETER_HEMISTICH_A, rng)} ${pick(HEXAMETER_HEMISTICH_B, rng)} ${pick(HEXAMETER_HEMISTICH_C, rng)}`;
  const feet = classifyFeet(text);
  return {
    text,
    syllables: estimateSyllables(text),
    feet,
    caesuraAfterFoot: Math.max(1, Math.floor(feet.length / 2)),
  };
}

export interface Prophecy {
  id: string;
  archetype: OracleArchetype;
  verse: HexameterVerse;
  matrix: HermeneuticMatrix;
  /** Wahrscheinlichkeit, dass die Figuren den Spruch falsch deuten (0..1). */
  misreadingProbability: number;
}

export function forgeProphecy(archetypeId: OracleArchetypeId, seed: number = 42): Prophecy {
  const archetype = getOracleArchetype(archetypeId) || ORACLE_ARCHETYPES[0];
  const verse = generateHexameter(archetypeId, seed);
  const matrix = buildHermeneuticMatrix(archetypeId, seed);
  const rng = createSeededRandom(hashString(`prop:${archetypeId}:${seed}`));

  // Selbstbewusste Dekrete werden seltener falsch gedeutet als trancehafte Rätsel.
  const base = archetypeId === "ironDecree" ? 0.85 : archetypeId === "pythianTrance" ? 0.75 : archetypeId === "ominousWarning" ? 0.9 : 0.6;
  const misreadingProbability = Math.round(Math.min(1, base * (0.9 + rng() * 0.2)) * 100) / 100;

  return {
    id: `ORACLE-${hashString(`${archetypeId}:${seed}:${verse.text.length}`).toString(16).padStart(8, "0").toUpperCase()}`,
    archetype,
    verse,
    matrix,
    misreadingProbability,
  };
}

export interface OracleReport {
  id: string;
  prophecies: Prophecy[];
  averageMisreading: number;
  dominantArchetype: OracleArchetypeId | null;
}

export function analyzeOracle(archetypeIds: OracleArchetypeId[], seed: number = 42): OracleReport {
  const active = archetypeIds
    .map((id) => getOracleArchetype(id))
    .filter((a): a is OracleArchetype => Boolean(a));
  const list = active.length > 0 ? active : ORACLE_ARCHETYPES;
  const prophecies = list.map((a, i) => forgeProphecy(a.id, seed + i));
  const averageMisreading =
    prophecies.length > 0
      ? Math.round((prophecies.reduce((s, p) => s + p.misreadingProbability, 0) / prophecies.length) * 100) / 100
      : 0;
  const sorted = [...prophecies].sort((a, b) => b.misreadingProbability - a.misreadingProbability);
  return {
    id: `ORACLEREPORT-${hashString(archetypeIds.join(",") + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    prophecies,
    averageMisreading,
    dominantArchetype: sorted.length > 0 ? sorted[0].archetype.id : null,
  };
}

export function createSampleProphecy(): Prophecy {
  return forgeProphecy("ironDecree", 42);
}

export function createSampleOracleReport(): OracleReport {
  return analyzeOracle(["pythianTrance", "ironDecree", "ominousWarning", "paradox"], 42);
}
