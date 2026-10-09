// SartorialFashionLedger (WP 122.2)
// Schneider- & Textilsemiotik-Hauptbuch für historische Romane.
// Textil- & Farbstoff-Taxonomie, Kleiderordnungs-Prüfer und sensorische Stoffprosa.
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
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Privater Auswahl-Helfer. Wirft bei leerem Array. */
function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error("pick: leeres Array kann kein Element liefern");
  }
  return arr[Math.floor(rng() * arr.length)];
}

/** Standes-Schicht für die Kleiderordnung. */
export type FashionSocialClass = "peasant" | "burgher" | "noble" | "royal";

/** Ein Textil (Gewebe). */
export interface Textile {
  id: string;
  name: string;
  description: string;
  /** Gewicht/Dichte 0..10 (10 = schwer). */
  weight: number;
  /** Kosten/Ansehen 0..10 (10 = teuer). */
  cost: number;
}

/** Ein Farbstoff. */
export interface Dye {
  id: string;
  name: string;
  description: string;
  /** Seltenheit 0..10 (10 = extrem selten). */
  rarity: number;
  /** Kosten 0..10 (10 = teuer). */
  cost: number;
}

/** Textil- & Gewebe-Taxonomie. */
export const TEXTILES: Textile[] = [
  {
    id: "brokat",
    name: "Brokat",
    description: "Schweres, golddurchwirktes Seidengewebe mit erhabenen Mustern. Vorrecht der höchsten Stände.",
    weight: 7,
    cost: 9,
  },
  {
    id: "damast",
    name: "Seidendamast",
    description: "Feines Seidengewebe mit in den Schuss eingewebten, beidseitig sichtbaren Blumen- und Rankenmustern.",
    weight: 5,
    cost: 7,
  },
  {
    id: "loden",
    name: "Grobe Lodenwolle",
    description: "Dicht gewalkter, wetterfester Wollstoff des einfachen Volkes. Rau, schwer und erdverbunden.",
    weight: 8,
    cost: 2,
  },
  {
    id: "samit",
    name: "Samit",
    description: "Mehrfädig gewebter, seidiger Prunkstoff des Mittelalters, oft mit Gold- oder Silberfäden durchsetzt.",
    weight: 6,
    cost: 6,
  },
  {
    id: "tuch",
    name: "Tuch",
    description: "Einfaches, gewalktes Wollgewebe. Alltagskleidung von Bauern und Bürgern in gedeckten Tönen.",
    weight: 4,
    cost: 3,
  },
  {
    id: "seide",
    name: "Seide",
    description: "Leichtes, glänzendes Gewebe aus dem Gespinst der Seidenraupe. Kostbar und begehrt.",
    weight: 3,
    cost: 8,
  },
];

/** Farbstoff-Taxonomie. */
export const DYES: Dye[] = [
  {
    id: "purpur",
    name: "Purpur",
    description: "Der tyrische Purpur aus dem Drüsensekret der Purpurschnecke. Farbe der Herrscher und Kaiser.",
    rarity: 10,
    cost: 10,
  },
  {
    id: "waid",
    name: "Waidblau",
    description: "Aus vergorenen Waidblättern gewonnenes Blau. Das Alltagsblau des Volkes.",
    rarity: 3,
    cost: 2,
  },
  {
    id: "malachit",
    name: "Malachitgrün",
    description: "Grün aus zerriebenem Malachitgestein. Giftig in der Herstellung, begehrt im Prunkgewand.",
    rarity: 6,
    cost: 5,
  },
  {
    id: "kermes",
    name: "Kermesscharlach",
    description: "Tiefroter Farbstoff aus der Kermesschildlaus. Leuchtend, teuer und standesbewusst.",
    rarity: 8,
    cost: 8,
  },
  {
    id: "indigo",
    name: "Indigo",
    description: "Importiertes, tiefblaues Farbpulver aus fernen Ländern. Dunkel und beständig.",
    rarity: 7,
    cost: 6,
  },
  {
    id: "ockra",
    name: "Ocker",
    description: "Erdiger Gelb- bis Braungelbton aus eisenhaltigem Lehm. Billig und allgegenwärtig.",
    rarity: 2,
    cost: 1,
  },
];

/** Liefert ein Textil anhand seiner Id. */
export function getTextile(id: string): Textile | undefined {
  return TEXTILES.find((t) => t.id === id);
}

/** Liefert einen Farbstoff anhand seiner Id. */
export function getDye(id: string): Dye | undefined {
  return DYES.find((d) => d.id === id);
}

/** Textil-Ids, die als Pelz/Edelpelz gelten (Kleiderordnung: Bauern verboten). */
const FUR_TEXTILE_IDS = new Set<string>(["pelz", "zobel", "hermelin", "feh"]);
/** Textil-Ids, die als Seide gelten. */
const SILK_TEXTILE_IDS = new Set<string>(["seide", "damast"]);
/** Textil-Ids, die als Goldstoff gelten (Kleiderordnung: Adel verboten). */
const GOLD_CLOTH_TEXTILE_IDS = new Set<string>(["brokat"]);
/** Farbstoff-Ids, die als Purpur gelten. */
const PURPLE_DYE_IDS = new Set<string>(["purpur"]);
/** Farbstoff-Ids, die als Hermelin-Weiß/Edelweiß gelten. */
const ERMINE_DYE_IDS = new Set<string>(["hermelin"]);

/** Ergebnis einer Kleiderordnungs-Prüfung. */
export interface SumptuaryResult {
  violated: boolean;
  law: string;
  penalty: string;
  description: string;
}

/** Prüft, ob ein Charakter gegen die Kleiderordnung seines Standes verstößt. */
export function checkSumptuaryLaw(
  character: { socialClass: FashionSocialClass },
  textileId: string,
  dyeId: string,
  era: string
): SumptuaryResult {
  const textile = getTextile(textileId);
  const dye = getDye(dyeId);
  const textileName = textile ? textile.name : textileId;
  const dyeName = dye ? dye.name : dyeId;
  const isFur = FUR_TEXTILE_IDS.has(textileId);
  const isSilk = SILK_TEXTILE_IDS.has(textileId);
  const isGoldCloth = GOLD_CLOTH_TEXTILE_IDS.has(textileId);
  const isPurple = PURPLE_DYE_IDS.has(dyeId);
  const isErmine = ERMINE_DYE_IDS.has(dyeId);
  const who = `Stand "${character.socialClass}"`;

  // Regel 4: Nur Könige dürfen Purpur tragen.
  if (isPurple && character.socialClass !== "royal") {
    return {
      violated: true,
      law: "Purpur-Vorrecht: Allein dem Herrscher ist die Farbe Purpur vorbehalten.",
      penalty: "Beschlagnahme des Gewands, Geldbuße nach Stand, im Wiederholungsfall Leibesstrafe.",
      description: `${who} trägt ${dyeName} an ${textileName} — ein Farbstoff, der in ${era} ausschließlich der Krone zusteht.`,
    };
  }

  // Regel 1: Bauern dürfen weder Pelz noch Seide tragen.
  if (character.socialClass === "peasant" && (isFur || isSilk)) {
    return {
      violated: true,
      law: "Bauernkleiderordnung: Pelz und Seide sind dem gemeinen Landvolk untersagt.",
      penalty: "Wegnahme des Kleidungsstücks, Pranger oder Züchtigung durch den Vogt.",
      description: `${who} trägt ${textileName} (${isFur ? "Pelz" : "Seide"}) — verboten für das Landvolk in ${era}.`,
    };
  }

  // Regel 2: Bürger dürfen weder Purpur noch Hermelin tragen.
  if (character.socialClass === "burgher" && (isPurple || isErmine)) {
    return {
      violated: true,
      law: "Bürgerkleiderordnung: Purpur und Hermelin sind dem Bürgertum verwehrt.",
      penalty: "Geldbuße nach Vermögensstand, Eintrag ins Ratsbuch, Verlust des Gewands.",
      description: `${who} trägt ${isPurple ? dyeName : textileName} (${isPurple ? "Purpur" : "Hermelin"}) — dem Bürgertum untersagt in ${era}.`,
    };
  }

  // Regel 3: Adel (noble) darf keinen Goldstoff tragen.
  if (character.socialClass === "noble" && isGoldCloth) {
    return {
      violated: true,
      law: "Adelskleiderordnung: Goldstoff (Brokat) ist allein dem Fürsten vorbehalten.",
      penalty: "Geldstrafe, Verlust des Kleidungsstücks und Verwarnung durch den Herold.",
      description: `${who} trägt ${textileName} (Goldstoff) — dem niederen Adel in ${era} nicht erlaubt.`,
    };
  }

  return {
    violated: false,
    law: "Kleiderordnung gewahrt.",
    penalty: "Keine.",
    description: `${who} trägt ${textileName} mit ${dyeName} — standesgemäß und ohne Verstoß gegen die Ordnung von ${era}.`,
  };
}

/** Sensorische Signatur-Phrasen je Textil (immer enthalten). */
const TEXTILE_SENSATIONS: Record<string, string[]> = {
  brokat: [
    "das Rascheln von Taft unter den Fingern",
    "das Gewicht golddurchwirkter Fäden auf den Schultern",
  ],
  damast: [
    "das Rascheln von Taft",
    "das kühle Gleiten des gemusterten Seidengewebes",
  ],
  loden: [
    "das Kratzen von Rohwolle auf der Haut",
    "der erdige Geruch nassen Wollfilzes",
  ],
  samit: [
    "das Rascheln von Taft",
    "das schwere Fallen seidiger Stoffbahnen",
  ],
  tuch: [
    "das Kratzen von Rohwolle auf der Haut",
    "die grobe Webstruktur unter den Fingern",
  ],
  seide: [
    "das Streicheln kühler Seide",
    "ein feines Rascheln von Taft bei jeder Bewegung",
  ],
};

/** Allgemeine sensorische Fragmente (u. a. Pelz-Gewicht). */
const GENERAL_SENSATIONS: string[] = [
  "das eisige Gewicht von Pelzen im Nacken",
  "ein Rascheln von Taft, das der Bewegung folgt",
  "das Kratzen von Rohwolle auf der Haut",
  "der Duft von Färberküche und feuchter Wolle",
  "das stumpfe Glänzen handgewebter Fäden",
];

/** Farbstoff-Signaturen für die Prosa. */
const DYE_SENSATIONS: Record<string, string> = {
  purpur: "Der Purpur wirkt im Licht fast schwarz und tiefrot zugleich.",
  waid: "Das Waidblau hat den matten Glanz eines Winterhimmels.",
  malachit: "Das Malachitgrün schimmert giftig und stolz.",
  kermes: "Der Kermesscharlach glüht wie lebendiges Feuer.",
  indigo: "Das Indigo saugt das Licht auf wie tiefes Wasser.",
  ockra: "Der Ocker liegt matt und erdig auf dem Gewebe.",
};

/** Erzeugt eine sensorische Textilbeschreibung. Deterministisch. */
export function generateTextileProse(textileId: string, dyeId: string, seed: number): string {
  const textile = getTextile(textileId);
  const dye = getDye(dyeId);
  const textileName = textile ? textile.name : textileId;
  const dyeName = dye ? dye.name : dyeId;

  const rng = createSeededRandom(hashString(`${textileId}:${dyeId}:${seed}`));

  const signature = TEXTILE_SENSATIONS[textileId] ?? GENERAL_SENSATIONS;
  const textilePhrase = pick(signature, rng);
  const generalPhrase = pick(GENERAL_SENSATIONS, rng);
  const dyePhrase = DYE_SENSATIONS[dyeId] ?? `Der Farbton des ${dyeName} bleibt schwer zu greifen.`;

  return (
    `${textileName} in ${dyeName}: ${dyePhrase} ` +
    `Man spürt ${textilePhrase}, dazu ${generalPhrase}. ` +
    `Die ${textile ? textile.description : "Stoffbahn"} ` +
    `liegt schwer (Gewicht ${textile ? textile.weight : "?"}/10) und kostet (${textile ? textile.cost : "?"}/10).`
  );
}

/** Erstellt ein Beispiel-Textil. */
export function createSampleTextile(): Textile {
  const rng = createSeededRandom(hashString("sample:textile"));
  return pick(TEXTILES, rng);
}

/** Erstellt einen Beispiel-Farbstoff. */
export function createSampleDye(): Dye {
  const rng = createSeededRandom(hashString("sample:dye"));
  return pick(DYES, rng);
}
