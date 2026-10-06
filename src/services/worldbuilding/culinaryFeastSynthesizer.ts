// CulinaryFeastSynthesizer (WP 78.1)
//
// Generiert kulinarische Beschreibungen für fiktionale Welten:
// Biom-Zutaten, Standes-Kontraste und Geschmacks-Spektren.
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

/** Biom/Region. */
export type Biome = "coastal" | "mountain" | "steppe" | "forest" | "desert";

/** Standes-Schicht. */
export type SocialClass = "peasant" | "merchant" | "noble" | "royal";

/** Ein Gericht. */
export interface Dish {
  name: string;
  biome: Biome;
  socialClass: SocialClass;
  ingredients: string[];
  flavors: string[];
  textures: string[];
  description: string;
}

/** Ein Festmahl. */
export interface Feast {
  name: string;
  biome: Biome;
  socialClass: SocialClass;
  dishes: Dish[];
  totalCourses: number;
  description: string;
}

/** Biom-Labels. */
export const BIOME_LABELS: Record<Biome, string> = {
  coastal: "Küstenregion",
  mountain: "Bergland",
  steppe: "Steppe",
  forest: "Wald",
  desert: "Wüste",
};

/** Standes-Labels. */
export const CLASS_LABELS: Record<SocialClass, string> = {
  peasant: "Armenmahl",
  merchant: "Kaufmannstafel",
  noble: "Adelsbankett",
  royal: "Königliches Festmahl",
};

/** Zutaten je Biom. */
const BIOME_INGREDIENTS: Record<Biome, string[]> = {
  coastal: ["Algen", "gesalzener Dorsch", "Muscheln", "Seetang", "Räucherfisch"],
  mountain: ["Wild", "Esskastanien", "Bergkräuter", "Ziegenkäse", "Waldpilze"],
  steppe: ["Feigen", "Ziegenkäse", "Hafer", "Honig", "Würste"],
  forest: ["Wildschwein", "Eicheln", "Waldbeeren", "Brot", "Bier"],
  desert: ["Datteln", "Kamelmilz", "Gewürste", "Fladenbrot", "Tee"],
};

/** Zutaten je Standes-Schicht. */
const CLASS_INGREDIENTS: Record<SocialClass, string[]> = {
  peasant: ["Kohlbrühe", "Schiffszwieback", "Rüben", "Wasser", "Salz"],
  merchant: ["Brot", "Käse", "Wurst", "Bier", "Gemüse"],
  noble: ["Wildschwein", "Fasan", "Gewürzwein", "Kandierte Rosenblüten", "Honig"],
  royal: ["Honigkrusten-Wildschwein", "Fasane im Prachtkleid", "Gewürzweine", "Kandierte Rosenblüten", "Goldblättchen"],
};

/** Geschmacksrichtungen. */
const FLAVORS = ["süß", "salzig", "sauer", "bitter", "umami", "fettig", "würzig", "herb"];

/** Texturen. */
const TEXTURES = ["knusprig", "zähflüssig", "mürbe", "federnd", "gallertartig", "samtig", "körnig", "glatt"];

/** Generiert ein Gericht. */
export function generateDish(biome: Biome, socialClass: SocialClass, seed: number = 42): Dish {
  const rng = createSeededRandom(seed);
  const biomeIng = BIOME_INGREDIENTS[biome];
  const classIng = CLASS_INGREDIENTS[socialClass];

  const ingredients = [
    biomeIng[Math.floor(rng() * biomeIng.length)],
    classIng[Math.floor(rng() * classIng.length)],
  ];

  const flavors = [
    FLAVORS[Math.floor(rng() * FLAVORS.length)],
    FLAVORS[Math.floor(rng() * FLAVORS.length)],
  ];

  const textures = [
    TEXTURES[Math.floor(rng() * TEXTURES.length)],
    TEXTURES[Math.floor(rng() * TEXTURES.length)],
  ];

  const name = `${BIOME_LABELS[biome]}-Gericht`;
  const description = `Ein ${CLASS_LABELS[socialClass].toLowerCase()} aus ${BIOME_LABELS[biome]}: ${ingredients.join(", ")}. Geschmack: ${flavors.join(", ")}. Textur: ${textures.join(", ")}.`;

  return { name, biome, socialClass, ingredients, flavors, textures, description };
}

/** Generiert ein Festmahl. */
export function generateFeast(name: string, biome: Biome, socialClass: SocialClass, seed: number = 42): Feast {
  const rng = createSeededRandom(seed);
  const numDishes = 3 + Math.floor(rng() * 4);
  const dishes: Dish[] = [];

  for (let i = 0; i < numDishes; i++) {
    dishes.push(generateDish(biome, socialClass, seed + i * 100));
  }

  const description = `Ein ${CLASS_LABELS[socialClass]} in ${BIOME_LABELS[biome]} mit ${numDishes} Gängen.`;

  return { name, biome, socialClass, dishes, totalCourses: numDishes, description };
}

/** Formatiert ein Festmahl als Text. */
export function formatFeast(feast: Feast): string {
  const lines: string[] = [];
  lines.push(`=== FESTMAHL: ${feast.name} ===`);
  lines.push(`Biom: ${BIOME_LABELS[feast.biome]}`);
  lines.push(`Stand: ${CLASS_LABELS[feast.socialClass]}`);
  lines.push(`Gänge: ${feast.totalCourses}`);
  lines.push("");
  for (const dish of feast.dishes) {
    lines.push(`  ${dish.name}`);
    lines.push(`    Zutaten: ${dish.ingredients.join(", ")}`);
    lines.push(`    Geschmack: ${dish.flavors.join(", ")}`);
    lines.push(`    Textur: ${dish.textures.join(", ")}`);
    lines.push(`    ${dish.description}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Erstellt ein Beispiel-Festmahl. */
export function createSampleFeast(): Feast {
  return generateFeast("Das Bankett von Falkenstein", "forest", "royal", 42);
}
