// sensoryEpiphanySynthesizer.ts (WP 96.2)
// Transzendentale Epiphanie- & Gnadenmoment-Synthesizer

export interface SensoryEpiphanyProfile {
  id: string;
  triggerSense: "visual" | "auditory" | "olfactory" | "tactile" | "gustatory";
  triggerDetail: string;
  characterName: string;
  phase1_stillness: string;
  phase2_collapse: string;
  phase3_catharsis: string;
  fullEpiphanyText: string;
  seed: number;
}

const SENSORY_TRIGGERS = {
  visual: [
    "Staubtanzen im Nachmittagslicht",
    "ein einzelner Riss in der Teetasse",
    "das Flackern einer sterbenden Glühbirne",
    "Regen, der diagonale Muster an die Scheibe malt",
    "eine Ameise, die über den Handrücken krabbelt",
    "das verblasste Foto an der Kühlschranktür",
  ],
  auditory: [
    "das Klirren eines Löffels in der Porzellantasse",
    "fernes Glockengeläut durch den Nebel",
    "das Knarren der dritten Diele von links",
    "Atemgeräusch im leeren Nebenzimmer",
    "das Surren der Kühlschrankkompressor",
    "ein sich lösender Schuhbandknoten auf Parkett",
  ],
  olfactory: [
    "der Geruch von altem Papier und Zitronenwachs",
    "Regen auf heißem Asphalt (Petrichor)",
    "verbranntes Toastbrot am Sonntagmorgen",
    "Lavendel aus dem Säckchen der Großmutter",
    "Ölfarbe und Terpentin im Atelier",
    "Meersalz und Tang in der Winterluft",
  ],
  tactile: [
    "kaltes Porzellan an den Fingerspitzen",
    "raue Rinde unter der Handfläche",
    "ein plötzliches Kältegefühl im Nacken",
    "die Vibration einer vorbeifahrenden Bahn",
    "Seide, die über trockene Haut streicht",
    "der Druck eines vergessenen Rings am Finger",
  ],
  gustatory: [
    "metallischer Geschmack von Blut auf der Zunge",
    "bitterer Kaffee, der zu lange stand",
    "Süße einer überreifen Feige",
    "Salz der eigenen Tränen am Mundwinkel",
    "der Geschmack von Kindheit: Erdbeermarmelade",
    "Kreide und Minze zugleich",
  ],
};

const PHASE1_STILLNESS_TEMPLATES = [
  "Die Zeit hielt den Atem an. {character} sah {detail}, und für einen Bruchteil der Ewigkeit gab es nichts anderes.",
  "Alles Geräusch fiel weg. Nur {detail} existierte noch, schwebend in einer Stille, die ohrenbetäubend war.",
  "Der Moment dehnte sich. {detail} wurde zum Mittelpunkt eines Universums, das sich auf eine Nadelspitze zusammengezogen hatte.",
  "Kein Gedanke, keine Sorge, kein Morgen. Nur {detail}, rein und vollkommen in seiner Bedeutungslosigkeit.",
];

const PHASE2_COLLAPSE_TEMPLATES = [
  "Und dann brach die Welt zusammen. In {detail} sah {character} plötzlich alles: die verpassten Gelegenheiten, die unausgesprochenen Worte, das Leben, das daneben ging.",
  "Die Erkenntnis traf {character} wie ein physischer Schlag. {detail} war der Spiegel, in dem das wahre Gesicht der eigenen Lügen sichtbar wurde.",
  "Die sorgfältig errichtete Fassade bröckelte. {detail} zeigte gnadenlos: {character} hatte sich selbst betrogen, Jahre lang, Tag für Tag.",
  "In der Klarheit dieses einen Sinnesfragments erkannte {character}: Die Liebe, die man festhalten wollte, war schon lange fortgegangen.",
];

const PHASE3_CATHARSIS_TEMPLATES = [
  "Und doch, in den Trümmern fand {character} einen seltsamen Frieden. Nicht Vergebung, nicht Vergessen – nur Akzeptanz. {detail} leuchtete noch immer, nun als Grablicht für das alte Ich.",
  "Die Last fiel ab. Nicht weil sie gelöst war, sondern weil {character} aufhörte, sie zu tragen. {detail} wurde zum Zeichen: Es ist vorbei. Und das ist gut so.",
  "Ein sanftes Loslassen. {character} atmete aus, zum ersten Mal seit Jahren frei. {detail} war der Anker, der nun losgelassen werden durfte.",
  "Versöhnung mit dem Unvollendeten. {character} strich über {detail} und flüsterte: 'Es reicht. Ich lasse los.' Der Friede war nicht laut. Er war einfach da.",
];

export function hashString(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), 0x2c9b3d);
    z = Math.imul(z ^ (z >>> 13), 0x29712d);
    return ((z ^ (z >>> 16)) >>> 0) / 4294967296;
  };
}

function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  if (!arr || arr.length === 0) return undefined as unknown as T;
  const idx = Math.min(Math.floor(rng() * arr.length), arr.length - 1);
  return arr[idx];
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/{(\w+)}/g, (_, key) => vars[key] || "");
}

export function createSensoryEpiphanyProfile(
  triggerSense: "visual" | "auditory" | "olfactory" | "tactile" | "gustatory" = "visual",
  characterName: string = "Protagonist",
  seed: number = 42
): SensoryEpiphanyProfile {
  const rng = createSeededRandom(hashString(triggerSense + characterName + seed));
  const triggers = SENSORY_TRIGGERS[triggerSense];
  const triggerDetail = pickRandom(triggers, rng) || triggers[0];

  const vars = { character: characterName, detail: triggerDetail };

  const phase1 = fillTemplate(pickRandom(PHASE1_STILLNESS_TEMPLATES, rng) || "", vars);
  const phase2 = fillTemplate(pickRandom(PHASE2_COLLAPSE_TEMPLATES, rng) || "", vars);
  const phase3 = fillTemplate(pickRandom(PHASE3_CATHARSIS_TEMPLATES, rng) || "", vars);

  const fullText = `${phase1}\n\n${phase2}\n\n${phase3}`;

  return {
    id: `EPIPH-${hashString(triggerSense + characterName + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    triggerSense,
    triggerDetail,
    characterName,
    phase1_stillness: phase1,
    phase2_collapse: phase2,
    phase3_catharsis: phase3,
    fullEpiphanyText: fullText,
    seed,
  };
}

export function formatSensoryEpiphanyProfile(profile: SensoryEpiphanyProfile): string {
  return [
    `═══ TRANZENDENTALE EPIPHANIE ═══`,
    `ID: ${profile.id}`,
    `Sinnesauslöser: ${profile.triggerSense} — "${profile.triggerDetail}"`,
    `Figur: ${profile.characterName}`,
    `Seed: ${profile.seed}`,
    `═══ PHASE 1: STILLSTAND DER ZEIT ═══`,
    profile.phase1_stillness,
    `═══ PHASE 2: EINSTURZ DER LEBENSLÜGE ═══`,
    profile.phase2_collapse,
    `═══ PHASE 3: TIEFER FRIEDE / KATHARSIS ═══`,
    profile.phase3_catharsis,
    `═══ VOLLSTÄNDIGER TEXT ═══`,
    profile.fullEpiphanyText,
  ].join("\n");
}

export function createSampleProfile(): SensoryEpiphanyProfile {
  return createSensoryEpiphanyProfile("auditory", "Elara", 999);
}