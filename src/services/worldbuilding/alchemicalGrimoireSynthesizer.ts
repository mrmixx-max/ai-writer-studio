// AlchemicalGrimoireSynthesizer (WP 98.1)
// Alchemistisches Grimoire- & Zauber-Studio.
// Harte Magie-Axiome, Reagenzien-Verträglichkeit, Inkantationen, Zauberkreis-SVG.
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

export type MagicAxiomId =
  | "sympathetic"
  | "runic"
  | "elemental"
  | "elder";

export interface MagicAxiom {
  id: MagicAxiomId;
  name: string;
  principle: string;
  cost: string;
  risk: string;
}

export const MAGIC_AXIOMS: MagicAxiom[] = [
  {
    id: "sympathetic",
    name: "Sympathische Alchemie",
    principle: "Gleiches wirkt auf Gleiches: Was dem Ziel ähnelt, bindet es.",
    cost: "Der Zauberer verliert ein Stück eigenen Leibes (Haar, Blut, Zahn).",
    risk: "Bindet sich das Ebenbild an den Falschen, kehrt der Fluch zurück.",
  },
  {
    id: "runic",
    name: "Runen-Gravur",
    principle: "Eingekerbte Zeichen zwingen die Welt in die Form der Schrift.",
    cost: "Körperliche Erschöpfung — jede Rune zehrt an Muskel und Mark.",
    risk: "Ein verwischter oder falsch gemeißelter Strich entfesselt die Rune unkontrolliert.",
  },
  {
    id: "elemental",
    name: "Elementar-Bindung",
    principle: "Ein Element wird an einen Träger gebunden und gehorcht dessen Willen.",
    cost: "Der Träger erleidet Hitzeentzug, Austrocknung oder Erfrierung je nach Element.",
    risk: "Reißt die Bindung, wendet das Element sich gegen seinen Meister.",
  },
  {
    id: "elder",
    name: "Ältere Zauberei",
    principle: "Worte aus der Zeit vor den Menschen formen die Wirklichkeit selbst.",
    cost: "Jahre des Lebens — der Zauberer altert bei jeder Anrufung sichtbar.",
    risk: "Falsche Betonung ruft etwas herbei, das nicht gerufen werden sollte.",
  },
];

export interface Reagent {
  name: string;
  essence: "feurig" | "wässrig" | "irden" | "luftig" | "ätherisch";
  potency: number;
  volatile: boolean;
}

export const REAGENTS: Reagent[] = [
  { name: "Drachenblut", essence: "feurig", potency: 9, volatile: true },
  { name: "Quecksilber", essence: "ätherisch", potency: 7, volatile: true },
  { name: "Nachtschattenpulver", essence: "irden", potency: 6, volatile: true },
  { name: "Mondwasser", essence: "wässrig", potency: 5, volatile: false },
  { name: "Salamanderasche", essence: "feurig", potency: 8, volatile: false },
  { name: "Feder des Sturmvogels", essence: "luftig", potency: 4, volatile: false },
  { name: "Wurzel des Alrauns", essence: "irden", potency: 7, volatile: false },
  { name: "Tau der Morgenröte", essence: "wässrig", potency: 3, volatile: false },
  { name: "Sternenmetall", essence: "ätherisch", potency: 10, volatile: true },
  { name: "Knochenmehl der Ahnen", essence: "irden", potency: 5, volatile: false },
];

export interface CompatibilityResult {
  reagentA: string;
  reagentB: string;
  compatible: boolean;
  reaction: string;
  explosionRisk: number;
  backlashRisk: number;
}

const OPPOSING: Record<string, string> = {
  feurig: "wässrig",
  wässrig: "feurig",
  irden: "luftig",
  luftig: "irden",
};

export function getReagent(name: string): Reagent | undefined {
  return REAGENTS.find((r) => r.name.toLowerCase() === name.toLowerCase());
}

export function checkReagentCompatibility(a: string, b: string): CompatibilityResult {
  const ra = getReagent(a);
  const rb = getReagent(b);
  if (!ra || !rb) {
    return {
      reagentA: a,
      reagentB: b,
      compatible: false,
      reaction: "Unbekannte Essenz — keine verlässliche Vorhersage möglich.",
      explosionRisk: 0,
      backlashRisk: 0,
    };
  }

  const opposing = OPPOSING[ra.essence] === rb.essence;
  const same = ra.essence === rb.essence;
  const volatileCount = (ra.volatile ? 1 : 0) + (rb.volatile ? 1 : 0);
  const potencySum = ra.potency + rb.potency;

  let compatible = true;
  let reaction = "";
  if (opposing) {
    compatible = false;
    reaction = `Gegenkraft: ${ra.essence} trifft ${rb.essence} — die Essenzen zerreißen einander.`;
  } else if (same) {
    compatible = true;
    reaction = `Verstärkung: Gleiche Essenz (${ra.essence}) verdoppelt die Wirkung.`;
  } else {
    compatible = true;
    reaction = `Neutral: ${ra.essence} und ${rb.essence} verbinden sich ruhig.`;
  }

  const base = opposing ? 70 : same ? 25 : 10;
  const explosionRisk = Math.min(100, base + volatileCount * 12 + Math.round(potencySum * 1.5));
  const backlashRisk = Math.min(100, (opposing ? 55 : 8) + volatileCount * 10 + Math.round(potencySum));

  return {
    reagentA: ra.name,
    reagentB: rb.name,
    compatible,
    reaction,
    explosionRisk,
    backlashRisk,
  };
}

export function analyzeReagentGrid(names: string[]): {
  pairs: CompatibilityResult[];
  overallExplosionRisk: number;
  overallBacklashRisk: number;
  stable: boolean;
} {
  const pairs: CompatibilityResult[] = [];
  const list = names.filter((n) => getReagent(n));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      pairs.push(checkReagentCompatibility(list[i], list[j]));
    }
  }
  if (pairs.length === 0) {
    return { pairs: [], overallExplosionRisk: 0, overallBacklashRisk: 0, stable: true };
  }
  const overallExplosionRisk = Math.min(
    100,
    Math.round(pairs.reduce((s, p) => s + p.explosionRisk, 0) / pairs.length + (pairs.length - 1) * 4)
  );
  const overallBacklashRisk = Math.min(
    100,
    Math.round(pairs.reduce((s, p) => s + p.backlashRisk, 0) / pairs.length + (pairs.length - 1) * 3)
  );
  const stable = pairs.every((p) => p.compatible) && overallExplosionRisk < 60;
  return { pairs, overallExplosionRisk, overallBacklashRisk, stable };
}

export interface Incantation {
  axiom: MagicAxiomId;
  formula: string;
  meter: string;
  phonetic: string;
}

const RUNE_SYLLABLES = [
  "thal", "mor", "vel", "ryn", "ash", "gor", "ith", "nur", "sel", "dra",
  "kaun", "fehu", "uruz", "ansuz", "raido", "kenaz", "gebo", "wunjo",
];

const AXIOM_OPENERS: Record<MagicAxiomId, string[]> = {
  sympathetic: [
    "Wie {a} dem {b} gleicht, so binde sich",
    "Was {a} berührt, berühre auch {b}",
    "In {a} liegt {b}, und {b} gehorcht dem {a}",
  ],
  runic: [
    "Ich ritze {r} in {a}, auf dass {b} sich neige",
    "Drei Zeichen: {r}, {r}, {r} — gemeißelt in {a}",
    "Mit {r} versiegle ich {a} und zwinge {b}",
  ],
  elemental: [
    "Feuer von {a}, gehorche dem Ruf nach {b}",
    "Wind über {a}, trage meinen Willen zu {b}",
    "Erde unter {a}, verschlinge was {b} heißt",
  ],
  elder: [
    "Vor den Jahren, da {a} noch nicht {b} war, sprach ich:",
    "Im Namen des Ersten, der {a} und {b} schied:",
    "Höret, ihr Alten, die ihr {a} wobt aus {b}:",
  ],
};

const AXIOM_CLOSERS: Record<MagicAxiomId, string[]> = {
  sympathetic: ["— also geschehe es.", "— das Band ist geknüpft.", "— wie oben, so unten."],
  runic: ["— die Kerbe ist gezogen.", "— kein Wort löscht sie mehr.", "— es sei geritzt."],
  elemental: ["— so tobe und gehorche!", "— binde dich, entfessle dich!", "— dreimal gerufen, einmal gezahlt."],
  elder: ["— so war es, so sei es, so bleibe es.", "— älter als der Eid, tiefer als das Grab.", "— das Erste spricht, und es geschieht."],
};

export function generateIncantation(axiom: MagicAxiomId, seed: number = 42): Incantation {
  const rng = createSeededRandom(hashString(axiom + ":" + seed));
  const openers = AXIOM_OPENERS[axiom] || AXIOM_OPENERS.sympathetic;
  const closers = AXIOM_CLOSERS[axiom] || AXIOM_CLOSERS.sympathetic;
  const opener = pick(openers, rng);
  const closer = pick(closers, rng);

  const a = pick(["Nacht", "Klinge", "Grab", "Sturm", "Auge", "Herz"], rng);
  const b = pick(["Feind", "Treue", "Verrat", "Schwur", "Angst", "Blut"], rng);
  const r = pick(RUNE_SYLLABLES, rng);

  let formula = opener.replace(/\{a\}/g, a).replace(/\{b\}/g, b).replace(/\{r\}/g, r.toUpperCase());
  formula += " " + closer;

  const syllableCount = (formula.match(/[aeiouäöü]+/gi) || []).length;
  const meter = `${syllableCount} Silben · ${syllableCount >= 16 ? "Langvers (fornyrðislag-nah)" : "Kurzvers (ljóðaháttr-nah)"}`;

  const phonetic = formula
    .replace(/ch/g, "k")
    .replace(/sch/g, "sch")
    .replace(/th/g, "þ")
    .replace(/v/g, "w")
    .replace(/z/g, "s");

  return { axiom, formula, meter, phonetic };
}

export interface SpellCircleSvg {
  id: string;
  svg: string;
  ringCount: number;
  runes: string[];
}

export function generateSpellCircle(axiom: MagicAxiomId, seed: number = 42): SpellCircleSvg {
  const rng = createSeededRandom(hashString("circle:" + axiom + ":" + seed));
  const ringCount = 2 + Math.floor(rng() * 3);
  const runeCount = 6 + Math.floor(rng() * 5);
  const runes: string[] = [];
  for (let i = 0; i < runeCount; i++) {
    runes.push(pick(RUNE_SYLLABLES, rng).toUpperCase());
  }

  const size = 260;
  const c = size / 2;
  let body = "";
  for (let i = 0; i < ringCount; i++) {
    const radius = 40 + i * 26;
    body += `<circle cx="${c}" cy="${c}" r="${radius}" fill="none" style="stroke: var(--accent)" stroke-width="1.5" />`;
  }
  for (let i = 0; i < runes.length; i++) {
    const angle = (i / runes.length) * Math.PI * 2;
    const x = c + Math.cos(angle) * (40 + (ringCount - 1) * 26 + 18);
    const y = c + Math.sin(angle) * (40 + (ringCount - 1) * 26 + 18);
    body += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" style="fill: var(--accent)" font-size="9">${runes[i]}</text>`;
  }
  const axiomIdx = MAGIC_AXIOMS.findIndex((m) => m.id === axiom);
  const spokeCount = 3 + (axiomIdx >= 0 ? axiomIdx : 0);
  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * Math.PI * 2;
    const x1 = c + Math.cos(angle) * 40;
    const y1 = c + Math.sin(angle) * 40;
    const x2 = c + Math.cos(angle) * (40 + (ringCount - 1) * 26);
    const y2 = c + Math.sin(angle) * (40 + (ringCount - 1) * 26);
    body += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" style="stroke: var(--border-strong)" stroke-width="1" />`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${body}</svg>`;
  return {
    id: `CIRC-${hashString(axiom + ":" + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    svg,
    ringCount,
    runes,
  };
}

export interface GrimoirePage {
  id: string;
  axiom: MagicAxiom;
  incantation: Incantation;
  reagents: Reagent[];
  compatibility: ReturnType<typeof analyzeReagentGrid>;
  circle: SpellCircleSvg;
}

export function createGrimoirePage(axiom: MagicAxiomId, reagentNames: string[], seed: number = 42): GrimoirePage {
  const axiomDef = MAGIC_AXIOMS.find((m) => m.id === axiom) || MAGIC_AXIOMS[0];
  const incantation = generateIncantation(axiom, seed);
  const reagents = reagentNames.map((n) => getReagent(n)).filter((r): r is Reagent => Boolean(r));
  const compatibility = analyzeReagentGrid(reagentNames);
  const circle = generateSpellCircle(axiom, seed);
  return {
    id: `GRIM-${hashString(axiom + reagentNames.join(",") + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    axiom: axiomDef,
    incantation,
    reagents,
    compatibility,
    circle,
  };
}

export function createSampleGrimoirePage(): GrimoirePage {
  return createGrimoirePage("elemental", ["Drachenblut", "Salamanderasche", "Mondwasser"], 42);
}
