// ToponymicEtymologyEngine (WP 132.1)
// Toponymisches Ortsnamen- & Sprachschicht-Engine.
// Kulturelle Sprachstämme, Landschafts-Komposita, Lautverschiebungs-Simulator
// und geschichtete Toponyme über mehrere Sprachschichten hinweg.
// Deterministisch & offline. Keine Node-Module.

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

function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Leere Liste — Auswahl nicht möglich.");
  return arr[Math.floor(rng() * arr.length)];
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------------------
// WP 132.1 — 1. Kulturelle Sprachstämme
// ---------------------------------------------------------------------------

/** Fünf kulturelle Sprachstämme mit Präfixen, Suffixen und Beispielnamen. */
export const LANGUAGE_STRATA = [
  {
    id: "angloSaxon",
    name: "Angelsächsisch",
    description: "Altenglischer Sprachstamm — Siedlungsnamen auf -ham, -ton, -wick; hart und geschlossen im Klang.",
    prefixes: ["Ald", "Bald", "Cead", "Dun", "Ead", "Grim", "Hroth", "Wulf"],
    suffixes: ["ham", "ton", "wick", "worth", "stead", "bury"],
    exampleName: "Grimswick",
  },
  {
    id: "norseGermanic",
    name: "Altnordisch/Germanisch",
    description: "Skandinavisch-germanischer Sprachstamm — Wikinger- und Siedlernamen auf -by, -thorpe, -holm.",
    prefixes: ["Thor", "Grim", "Hald", "Sig", "Ulf", "Vig", "Ketil", "Stein"],
    suffixes: ["by", "thorpe", "holm", "vik", "stad", "gard"],
    exampleName: "Thorsholm",
  },
  {
    id: "celticGaelic",
    name: "Keltisch/Gälisch",
    description: "Keltischer Sprachstamm — Flur- und Siedlungsnamen mit gälischem Einfluss, weich und fließend.",
    prefixes: ["Dun", "Inver", "Kil", "Bal", "Car", "Glen", "Loch", "Aber"],
    suffixes: ["more", "beg", "ness", "mor", "don", "drum"],
    exampleName: "Dunmore",
  },
  {
    id: "classicalRoman",
    name: "Klassisch-Römisch",
    description: "Lateinischer Sprachstamm — Kastell-, Kolonie- und Gutshofnamen auf -acum, -anum, -castrum.",
    prefixes: ["Aqu", "Castr", "Colon", "Fort", "Port", "Vall", "Nov", "Quint"],
    suffixes: ["acum", "anum", "ia", "ensis", "castrum", "forum"],
    exampleName: "Castranum",
  },
  {
    id: "desertSemitic",
    name: "Wüsten-Semitisch",
    description: "Semitischer Sprachstamm — Oasen-, Zisternen- und Karawanennamen mit Al-, Wadi- und Qasr-.",
    prefixes: ["Al", "Bir", "Wadi", "Qasr", "Tell", "Jabal", "Ain", "Sahra"],
    suffixes: ["iya", "ab", "ur", "et", "an", "in"],
    exampleName: "Alqasriyya",
  },
] as const;

export type LanguageStratum = (typeof LANGUAGE_STRATA)[number];
export type LanguageStratumId = LanguageStratum["id"];

// ---------------------------------------------------------------------------
// WP 132.1 — 2. Landschafts-Komposita
// ---------------------------------------------------------------------------

/** Landschafts-Morpheme als Grundwörter für Ortsnamen-Komposita. */
export const TERRAIN_MORPHEMES = [
  {
    id: "ford",
    name: "Furten",
    description: "Flussübergänge und seichte Furtstellen an Wegkreuzungen.",
    morphemes: ["-ford", "-furt", "-wath", "-vad"],
    meaning: "Furt — seichte Übergangsstelle im Wasser.",
  },
  {
    id: "ridge",
    name: "Höhenzüge",
    description: "Erhebungen, Bergrücken und aussichtsreiche Kuppen.",
    morphemes: ["-tor", "-berg", "-don", "-ridge"],
    meaning: "Höhenrücken — erhöhtes Gelände mit Fernsicht.",
  },
  {
    id: "clearing",
    name: "Rodungen",
    description: "Gerodete Waldflächen und junge Siedlungslichtungen.",
    morphemes: ["-reuth", "-rode", "-thwaite", "-ley"],
    meaning: "Rodung — von Wald befreites Siedlungsland.",
  },
  {
    id: "fortress",
    name: "Burgen",
    description: "Befestigte Anlagen, Kastelle und Fluchtburgen.",
    morphemes: ["-burg", "-caster", "-dun", "-chester"],
    meaning: "Befestigung — Burg, Kastell oder Wallanlage.",
  },
  {
    id: "water",
    name: "Gewässer",
    description: "Seen, Teiche und kleinere Wasserläufe.",
    morphemes: ["-mere", "-water", "-llyn", "-bach"],
    meaning: "Gewässer — See, Teich oder Bachlauf.",
  },
  {
    id: "valley",
    name: "Täler",
    description: "Talsenken, Schluchten und enge Einschnitte.",
    morphemes: ["-dale", "-combe", "-glen", "-tal"],
    meaning: "Tal — eingesenktes Gelände zwischen Höhen.",
  },
] as const;

export type TerrainMorpheme = (typeof TERRAIN_MORPHEMES)[number];
export type TerrainMorphemeId = TerrainMorpheme["id"];

export interface PlaceNameInput {
  stratumId: string;
  terrainId: string;
  root?: string;
}

export interface PlaceNameResult {
  name: string;
  stratum: string;
  terrain: string;
  morphemes: string[];
  meaning: string;
  layers: string[];
}

/**
 * Baut einen deterministischen Ortsnamen aus Sprachstamm-Grundwort und
 * Landschaftssuffix. Ohne übergebenen root wird ein Präfix des Stammes gewählt.
 */
export function buildPlaceName(input: PlaceNameInput, seed: number): PlaceNameResult {
  const stratum = LANGUAGE_STRATA.find((s) => s.id === input.stratumId);
  if (!stratum) throw new Error(`Unbekannter Sprachstamm: ${input.stratumId}`);
  const terrain = TERRAIN_MORPHEMES.find((t) => t.id === input.terrainId);
  if (!terrain) throw new Error(`Unbekannte Landschaftsform: ${input.terrainId}`);

  const rootRaw = input.root && input.root.trim().length > 0 ? input.root.trim() : "";
  const rng = createSeededRandom(hashString(`place:${input.stratumId}:${input.terrainId}:${rootRaw}:${seed}`));

  const rootPart = rootRaw.length > 0 ? capitalize(rootRaw) : capitalize(pick(stratum.prefixes, rng));
  const morpheme = pick(terrain.morphemes, rng);
  const morphemeCore = morpheme.replace(/^-+/, "");

  // Optionales Bindeglied aus dem Sprachstamm für mehr Namensvielfalt.
  const linker = rng() < 0.35 ? pick(stratum.suffixes, rng) : "";
  const name = `${rootPart}${linker}${morphemeCore}`;

  const morphemes = [rootPart, ...(linker.length > 0 ? [linker] : []), morpheme];
  const layers = [
    `Grundwort „${rootPart}“ aus dem Sprachstamm ${stratum.name}.`,
    linker.length > 0 ? `Bindeglied „${linker}“ (${stratum.name}).` : "",
    `Landschaftssuffix „${morpheme}“ — ${terrain.meaning}`,
  ].filter((entry) => entry.length > 0);

  const meaning = `${rootPart} + ${morphemeCore}: ${terrain.meaning} im Sprachstamm ${stratum.name}.`;

  return {
    name,
    stratum: stratum.name,
    terrain: terrain.name,
    morphemes,
    meaning,
    layers,
  };
}

// ---------------------------------------------------------------------------
// WP 132.1 — 3. Lautverschiebungs-Simulator
// ---------------------------------------------------------------------------

export interface SoundShiftInput {
  sourceName: string;
  years: number;
  stratumId?: string;
}

export interface SoundShiftStep {
  year: number;
  form: string;
  rule: string;
}

export interface SoundShiftResult {
  original: string;
  final: string;
  steps: SoundShiftStep[];
  totalYears: number;
  description: string;
}

interface ShiftRule {
  id: string;
  rule: string;
  apply: (value: string) => string;
}

const SOUND_SHIFT_RULES: readonly ShiftRule[] = [
  {
    id: "coalescence",
    rule: "Verschmelzung der Wortfuge",
    apply: (v) => {
      const joined = v.replace(/\s+/g, "");
      return joined.length === 0 ? joined : joined.charAt(0).toUpperCase() + joined.slice(1).toLowerCase();
    },
  },
  { id: "palatalisation", rule: "Palatalisierung (qu/k → ch)", apply: (v) => v.replace(/qu/gi, "ch").replace(/k(?=[aeiouäöü])/gi, "ch") },
  { id: "monophthongisation", rule: "Monophthongierung (au → a, ei → e, ou → o)", apply: (v) => v.replace(/au/gi, "a").replace(/ei/gi, "e").replace(/ou/gi, "o") },
  { id: "vowelCollapse", rule: "Vokalschmelze (aa → a, ee → e, oo → o)", apply: (v) => v.replace(/([aeiouäöü])\1+/gi, "$1") },
  { id: "lenition", rule: "Lenierung (t → d zwischen Vokalen)", apply: (v) => v.replace(/([aeiouäöü])t([aeiouäöü])/gi, "$1d$2") },
  { id: "spirantisation", rule: "Spirantisierung (d → t)", apply: (v) => v.replace(/d/gi, "t") },
  { id: "syncope", rule: "Synkope (Binnenvokal fällt)", apply: (v) => v.replace(/([bcdfghjklmnpqrstvwxz])[aeiouäöü](?=[bcdfghjklmnpqrstvwxz])/gi, "$1") },
  { id: "apocope", rule: "Apokope (Endvokal fällt)", apply: (v) => v.replace(/[aeiouäöü]$/i, "") },
  { id: "consonantShift", rule: "Zweite Lautverschiebung (t → z, p → pf)", apply: (v) => v.replace(/t/gi, "z").replace(/p/gi, "pf") },
  { id: "degemination", rule: "Vereinfachung von Doppelkonsonanten", apply: (v) => v.replace(/([bcdfghjklmnpqrstvwxz])\1+/gi, "$1") },
];

function seededRuleOrder(rng: () => number): number[] {
  const order = SOUND_SHIFT_RULES.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order;
}

function applyShiftStep(form: string, order: readonly number[]): { form: string; rule: string } {
  for (let i = 0; i < order.length; i++) {
    const rule = SOUND_SHIFT_RULES[order[i]];
    const out = rule.apply(form);
    if (out !== form && out.trim().length > 0) return { form: out, rule: rule.rule };
  }
  // Notfall: letzter Silbenverlust, damit jede Zeitstufe eine Änderung zeigt.
  const shortened = form.length > 3 ? form.slice(0, form.length - 1) : form;
  return { form: shortened, rule: "Endungsverfall (Silbenverlust)" };
}

/**
 * Simuliert die lautliche Entwicklung eines Namens über die angegebenen Jahre.
 * Eine Stufe je 100 Jahre; jede Stufe wendet die nächste wirksame Lautregel an.
 */
export function simulateSoundShift(input: SoundShiftInput, seed: number): SoundShiftResult {
  const original = input.sourceName;
  const totalYears = Math.max(0, Math.floor(input.years));
  const stratum = input.stratumId ? LANGUAGE_STRATA.find((s) => s.id === input.stratumId) : undefined;
  const rng = createSeededRandom(hashString(`shift:${original}:${totalYears}:${input.stratumId ?? ""}:${seed}`));

  const steps: SoundShiftStep[] = [];
  let form = original;
  const stepCount = totalYears <= 0 ? 0 : Math.max(1, Math.round(totalYears / 100));
  const order = seededRuleOrder(rng);

  for (let i = 1; i <= stepCount; i++) {
    const year = Math.round((totalYears * i) / stepCount);
    const applied = applyShiftStep(form, order);
    form = applied.form;
    steps.push({ year, form, rule: applied.rule });
  }

  const stratumNote = stratum ? ` Der Sprachstamm ${stratum.name} prägte den Wandel.` : "";
  const description =
    stepCount === 0
      ? `„${original}“ bleibt unverändert — keine Zeitstufe durchlaufen.`
      : `„${original}“ wandelte sich über ${totalYears} Jahre in ${stepCount} Stufen zu „${form}“.${stratumNote}`;

  return { original, final: form, steps, totalYears, description };
}

// ---------------------------------------------------------------------------
// WP 132.1 — 4. Geschichtete Toponyme
// ---------------------------------------------------------------------------

export interface LayeredToponymInput {
  baseName: string;
  strataIds: string[];
  eras?: number[];
}

export interface ToponymLayer {
  stratum: string;
  contribution: string;
  era: string;
}

export interface LayeredToponymResult {
  finalName: string;
  layers: ToponymLayer[];
  description: string;
}

/**
 * Schichtet mehrere Sprachstämme übereinander und verfolgt, welcher Stamm
 * welchen Namensbeitrag in welcher Epoche geliefert hat.
 */
export function buildLayeredToponym(input: LayeredToponymInput, seed: number): LayeredToponymResult {
  const strataIds = input.strataIds.length > 0 ? input.strataIds : ["classicalRoman"];
  const eras = input.eras ?? [];
  const rng = createSeededRandom(hashString(`layered:${input.baseName}:${strataIds.join(",")}:${eras.join(",")}:${seed}`));

  let name = input.baseName;
  const layers: ToponymLayer[] = [];

  strataIds.forEach((stratumId, index) => {
    const era = eras[index] !== undefined ? `um ${eras[index]}` : `Epoche ${index + 1}`;
    const stratum = LANGUAGE_STRATA.find((s) => s.id === stratumId);
    if (!stratum) {
      layers.push({ stratum: stratumId, contribution: "Unbekannter Sprachstamm — kein Beitrag.", era });
      return;
    }
    const usePrefix = rng() < 0.5;
    const element = usePrefix ? pick(stratum.prefixes, rng) : pick(stratum.suffixes, rng);
    if (usePrefix) {
      name = `${element}${name.charAt(0).toLowerCase()}${name.slice(1)}`;
    } else {
      name = `${name}${element.toLowerCase()}`;
    }
    layers.push({
      stratum: stratum.name,
      contribution: `${usePrefix ? "Präfix" : "Suffix"} „${element}“`,
      era,
    });
  });

  const description = `Schichtenmodell über ${strataIds.length} Sprachstufe(n): „${input.baseName}“ wurde zu „${name}“.`;

  return { finalName: name, layers, description };
}

// ---------------------------------------------------------------------------
// Beispiele
// ---------------------------------------------------------------------------

export function createSamplePlaceName(): PlaceNameResult {
  return buildPlaceName({ stratumId: "angloSaxon", terrainId: "ford", root: "Ald" }, 42);
}

export function createSampleSoundShift(): SoundShiftResult {
  return simulateSoundShift({ sourceName: "Aqua Alta", years: 500, stratumId: "classicalRoman" }, 42);
}
