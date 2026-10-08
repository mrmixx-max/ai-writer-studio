// PantheonCreationMyth (WP 99.2)
// Götter-Theogonie- & Schöpfungsmythos-Weaver.
// Ursprungs-Kosmogonien, Götter-Stammbaum, Sakraltext-Synthesizer.
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

export type CosmogonyId =
  | "worldEgg"
  | "primalSong"
  | "slainTitan"
  | "eternalBreath";

export interface Cosmogony {
  id: CosmogonyId;
  name: string;
  firstLine: string;
  mechanism: string;
  echo: string;
}

export const COSMOGONIES: Cosmogony[] = [
  {
    id: "worldEgg",
    name: "Kosmisches Welten-Ei",
    firstLine: "Ehe Himmel und Erde geschieden waren, lag das Ei in der Leere, und die Leere war sein Nest.",
    mechanism: "Das Ei barst unter dem Gewicht seines eigenen Gesangs; aus der Schale ward der Himmel, aus dem Dotter die Erde.",
    echo: "Noch heute findet man Eierschalen im Gebirge, wo der Himmel die Erde berührt.",
  },
  {
    id: "primalSong",
    name: "Urgesang aus der Finsternis",
    firstLine: "Im Anfang war keine Gestalt, nur ein Ton, der sich selbst hörte und nicht verstummen wollte.",
    mechanism: "Der erste Ton teilte sich in drei Stimmen; wo sie sich trafen, erstarrte die Schwingung zu Fels und Stern.",
    echo: "Die Priester singen den ersten Ton nach, doch keine Kehle hat ihn je ganz getroffen.",
  },
  {
    id: "slainTitan",
    name: "Erschaffung aus dem Leib eines erschlagenen Titanen",
    firstLine: "Die Götter schlugen den Uralten nieder und fanden, dass die Welt aus ihm gebaut werden konnte.",
    mechanism: "Sein Fleisch ward Erde, sein Blut ward Meer, seine Knochen Berge, sein Haar Wald, sein Auge die Sonne.",
    echo: "Man sagt, der Titan schläft noch, und wenn er sich regt, bebt das Land.",
  },
  {
    id: "eternalBreath",
    name: "Aus dem ewigen Atem",
    firstLine: "Es gab nur den Atem, der ein- und ausging, ohne Lunge, ohne Mund, ohne Zeit.",
    mechanism: "Bei jedem Ausatmen entstand ein Zeitalter, bei jedem Einatmen verschwand es wieder; wir leben im gegenwärtigen Hauch.",
    echo: "Wenn der Atem stockt, so lehren die Seher, endet dieses Zeitalter ohne Warnung.",
  },
];

export function getCosmogony(id: CosmogonyId): Cosmogony | undefined {
  return COSMOGONIES.find((c) => c.id === id);
}

export interface Deity {
  id: string;
  name: string;
  domain: string;
  attributes: string[];
  sacredAnimal: string;
  sacrament: string;
  curse: string;
  parentIds: string[];
}

const DOMAINS = [
  "Sturm und Eid", "Ernte und Verfall", "Weisheit und Trauer",
  "Krieg und Handwerk", "Liebe und Verlust", "Tod und Wiederkunft",
  "Sonne und Ordnung", "Mond und Wandel", "Fluss und Gedächtnis",
];

const ATTRIBUTE_POOL = [
  "trägt einen Speer aus Wetterleuchten",
  "hat zwei Gesichter, eines für die Wachen, eines für die Träume",
  "spricht nur in Fragen",
  "zählt jeden Tropfen der Welt",
  "trägt ein Auge in der offenen Handfläche",
  "wandelt auf einem Pfad aus Asche",
  "schlief, bevor die Berge standen",
  "sieht die Schuld, noch ehe sie begangen ist",
];

const ANIMALS = ["Rabe", "Stier", "Schlange", "Wolf", "Falke", "Eber", "Lachs", "Hirsch", "Ziege"];
const SACRAMENTS = [
  "das dreimalige Brechen des Brotes",
  "das Verbrennen der ersten Ernte",
  "das Waschen der Hände in fließendem Wasser",
  "das Aufhängen einer Weihgabe im Baum",
  "das Trinken aus der Schale des Vorgängers",
  "das Schweigen von der Abenddämmerung bis zum Hahnenschrei",
];
const CURSES = [
  "Wer den Eid bricht, dessen Kinder werden niemals ruhig schlafen.",
  "Wer den Namen missbraucht, verliert seinen eigenen.",
  "Wer das Opfer zurückhält, dessen Felder kennen keinen Sommer mehr.",
  "Wer den Tempel schändet, wandelt sieben Jahre ohne Schatten.",
  "Wer den Toten die Münze verweigert, findet selbst kein Grab.",
  "Wer den Priester belügt, hört fortan nur die eigene Stimme.",
];

export function createDeity(name: string, seed: number = 42, parentIds: string[] = []): Deity {
  const rng = createSeededRandom(hashString("deity:" + name + ":" + seed));
  const attrCount = 1 + Math.floor(rng() * 3);
  const attributes: string[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (attributes.length < attrCount && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * ATTRIBUTE_POOL.length);
    if (used.has(idx)) continue;
    used.add(idx);
    attributes.push(ATTRIBUTE_POOL[idx]);
  }
  return {
    id: `DEUS-${hashString(name + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    name,
    domain: pick(DOMAINS, rng),
    attributes,
    sacredAnimal: pick(ANIMALS, rng),
    sacrament: pick(SACRAMENTS, rng),
    curse: pick(CURSES, rng),
    parentIds: [...parentIds],
  };
}

export interface Pantheon {
  id: string;
  name: string;
  cosmogony: Cosmogony;
  deities: Deity[];
  generations: number;
}

const GENERATION_NAMES = [
  ["Uralte", "Erste", "Älteste"],
  ["Mittlere", "Zweite", "Jüngere"],
  ["Späte", "Dritte", "Letzte"],
];

export function createPantheon(name: string, cosmogonyId: CosmogonyId, seed: number = 42): Pantheon {
  const cosmogony = getCosmogony(cosmogonyId) || COSMOGONIES[0];
  const rng = createSeededRandom(hashString("pantheon:" + name + ":" + seed));

  // Generation 1: die Urgötter
  const gen1Names = [
    pick(["Aetheron", "Chaoron", "Tartheus", "Ophion", "Nyktor", "Phanes"], rng),
    pick(["Gäa-Ur", "Themis-Ur", "Hydra-Ur", "Erebos", "Ananke", "Hemera"], rng),
  ];
  const gen1 = gen1Names.map((n, i) => createDeity(n, seed + i, []));

  // Generation 2: Kinder der Urgötter
  const gen2Count = 2 + Math.floor(rng() * 2);
  const gen2Names = ["Aurel", "Mordis", "Selune", "Karnak", "Vesper", "Thalia", "Rhun", "Ossira"];
  const gen2: Deity[] = [];
  for (let i = 0; i < gen2Count; i++) {
    const parent = gen1[Math.floor(rng() * gen1.length)];
    gen2.push(createDeity(gen2Names[i % gen2Names.length], seed + 100 + i, [parent.id]));
  }

  const deities = [...gen1, ...gen2];
  const generations = GENERATION_NAMES.length;
  return {
    id: `PANTHEON-${hashString(name + cosmogonyId + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    name,
    cosmogony,
    deities,
    generations,
  };
}

export function describeGeneration(pantheon: Pantheon, index: number): string {
  const genNames = GENERATION_NAMES[Math.min(index, GENERATION_NAMES.length - 1)];
  const label = genNames[Math.min(index, genNames.length - 1)];
  if (index === 0) return `${label} Götter: die ersten, die aus ${pantheon.cosmogony.name.toLowerCase()} hervorgingen.`;
  if (index === 1) return `${label} Götter: Kinder der Uralten, die Ordnung in das Werk ihrer Eltern brachten.`;
  return `${label} Götter: die Sterblichen-nahen, die zuletzt kamen und zuerst vergessen werden.`;
}

export interface SacredVerse {
  cosmogony: CosmogonyId;
  lines: string[];
  inscription: string;
}

const VERSE_TEMPLATES = [
  "Am Anfang war {anfang}, und {anfang} war ohne Zeugen.",
  "Da sprach {sprecher}, und die Leere hörte zum ersten Mal ihren Namen.",
  "Es ward geteilt: {teilA} von {teilB}, und zwischen ihnen trat die Zeit.",
  "Und {gottheit} sah das Werk und fand es nicht gut genug, und so schuf er weiter.",
  "Der erste Tag kannte kein Licht, nur das Verlangen danach.",
  "Und {gottheit} schrieb die Gesetze in den Stein, damit niemand sie vergessen könne.",
  "Da schwieg das Werk, und aus dem Schweigen wuchs der erste Wald.",
];

const INSCRIPTION_TEMPLATES = [
  "Grabe dies in den Fels, auf dass die Nachgeborenen wissen: {zeile}",
  "Gesprochen am ersten Morgen, eingemeißelt am letzten Abend: {zeile}",
  "So steht es geschrieben an der Pforte des Heiligtums: {zeile}",
];

export function generateSacredVerse(cosmogonyId: CosmogonyId, seed: number = 42, lineCount: number = 5): SacredVerse {
  const cosmogony = getCosmogony(cosmogonyId) || COSMOGONIES[0];
  const rng = createSeededRandom(hashString("verse:" + cosmogonyId + ":" + seed));
  const total = Math.max(1, Math.min(lineCount, VERSE_TEMPLATES.length));
  const lines: string[] = [cosmogony.firstLine];

  const gottheit = pick(["der Erste", "die Urmutter", "der Namenlose", "der Schläfer", "die Drei"], rng);
  const sprecher = pick(["das Wort", "der Ton", "der Wille", "die Notwendigkeit"], rng);
  const anfang = pick(["der Ton", "das Ei", "die Finsternis", "der Atem"], rng);
  const teilA = pick(["Himmel", "Licht", "Tag", "Feuer"], rng);
  const teilB = pick(["Erde", "Schatten", "Nacht", "Wasser"], rng);

  const used = new Set<number>();
  let guard = 0;
  while (lines.length < total + 1 && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * VERSE_TEMPLATES.length);
    if (used.has(idx)) continue;
    used.add(idx);
    lines.push(
      VERSE_TEMPLATES[idx]
        .replace(/\{anfang\}/g, anfang)
        .replace(/\{sprecher\}/g, sprecher)
        .replace(/\{teilA\}/g, teilA)
        .replace(/\{teilB\}/g, teilB)
        .replace(/\{gottheit\}/g, gottheit)
    );
  }

  const inscription = pick(INSCRIPTION_TEMPLATES, rng).replace(/\{zeile\}/g, lines[1] || lines[0]);
  return { cosmogony: cosmogonyId, lines, inscription };
}

export function createSamplePantheon(): Pantheon {
  return createPantheon("Das Zwölfgestirn", "slainTitan", 42);
}
