// SurrealDreamLogicSynthesizer (WP 99.1)
// Surrealer Traumlogik- & Visions-Synthesizer.
// 4 Traum-Dimensionen, prophetische Symbolik, traum-eigene Gesetzmäßigkeit.
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

export type DreamDimensionId =
  | "nonEuclidean"
  | "temporalStretch"
  | "identityFusion"
  | "emotionalDisplacement";

export interface DreamDimension {
  id: DreamDimensionId;
  name: string;
  law: string;
  example: string;
}

export const DREAM_DIMENSIONS: DreamDimension[] = [
  {
    id: "nonEuclidean",
    name: "Nicht-euklidische Raumfaltung",
    law: "Der Raum gehorcht nicht der Geometrie, sondern der Bedeutung.",
    example: "Man öffnet einen Kleiderschrank und steht an einem nebligen Strand.",
  },
  {
    id: "temporalStretch",
    name: "Zeitliche Dehnung",
    law: "Sekunden ziehen sich wie Jahre; Zeitsprünge geschehen ohne Übergang.",
    example: "Ein einziger Blick auf die Uhr dauert drei Winter, dann ist es Morgen.",
  },
  {
    id: "identityFusion",
    name: "Identitäts-Verschmelzung",
    law: "Wer spricht, ist nicht, wer aussieht; das Gesicht wechselt mit dem Satz.",
    example: "Die Mutter spricht mit der Stimme des längst verstorbenen Bruders.",
  },
  {
    id: "emotionalDisplacement",
    name: "Emotionale Verschiebung",
    law: "Das Gefühl ist der Größe seines Anlasses vollkommen enthoben.",
    example: "Unendliche Panik wegen einer winzigen Teetasse, die niemand berührt hat.",
  },
];

export function getDreamDimension(id: DreamDimensionId): DreamDimension | undefined {
  return DREAM_DIMENSIONS.find((d) => d.id === id);
}

export interface DreamImage {
  dimension: DreamDimensionId;
  image: string;
  lawDemonstrated: string;
}

const IMAGE_POOLS: Record<DreamDimensionId, string[]> = {
  nonEuclidean: [
    "Der Flur hinter der Küchentür mündet in den Garten der Kindheit, dreißig Jahre entfernt.",
    "Die Treppe führt hinauf und hinab zugleich; oben steht dasselbe Zimmer wie unten.",
    "Ein Spiegel zeigt den Raum hinter dir, doch die Möbel stehen verkehrt.",
    "Das Haus hat mehr Fenster als Wände, und jedes Fenster geht auf dieselbe Straße.",
    "Der Kleiderschrank atmet feuchte Seeluft, und hinter den Mänteln liegt ein nebliger Strand.",
  ],
  temporalStretch: [
    "Ein Tropfen fällt vom Hahn und braucht dafür eine ganze Nacht.",
    "Du liest einen Satz, und als du aufblickst, ist der Winter vorüber und niemand hat dich vermisst.",
    "Die Kerze brennt in einer Sekunde auf die Hälfte herunter, doch die Uhr schlägt nicht.",
    "Du zählst bis drei und stehst am Grab, obwohl eben noch ein Kind an deiner Hand hing.",
    "Der Regen fällt rückwärts in die Wolken, und die Toten werden jünger.",
  ],
  identityFusion: [
    "Deine Schwester lächelt, aber es ist das Lächeln deines Vaters auf ihrem Gesicht.",
    "Der Fremde im Zug trägt deine Hände und erzählt deine Träume als die seinen.",
    "Die Stimme am Telefon ist deine eigene, nur älter und müder.",
    "Dein Spiegelbild steht auf, während du sitzen bleibst, und verlässt den Raum.",
    "Der Priester trägt das Gesicht deiner ersten Liebe und segnet dich mit ihrem Namen.",
  ],
  emotionalDisplacement: [
    "Eine Teetasse steht auf dem Tisch, unberührt, und du begreifst, dass sie der Grund für deinen Untergang ist.",
    "Du weinst, weil ein Blatt Papier falsch gefaltet ist, und kannst nicht aufhören.",
    "Panik ergreift dich, weil die Wandfarbe um einen Ton zu blass ist — das ist das ganze Entsetzen.",
    "Du bist zornig auf einen Löffel, der im Besteckkasten verkehrt liegt, mit einer Wut, die Jahre nicht erklären.",
    "Scham überkommt dich, weil du beim Gehen zweimal dieselbe Fliese berührt hast.",
  ],
};

export function generateDreamImage(dimension: DreamDimensionId, seed: number = 42): DreamImage {
  const dim = getDreamDimension(dimension) || DREAM_DIMENSIONS[0];
  const rng = createSeededRandom(hashString("img:" + dimension + ":" + seed));
  const pool = IMAGE_POOLS[dimension] || IMAGE_POOLS.nonEuclidean;
  const image = pick(pool, rng);
  return { dimension, image, lawDemonstrated: dim.law };
}

export interface PropheticSymbol {
  symbol: string;
  omen: string;
  weight: number;
}

const SYMBOL_POOL = [
  { symbol: "Der rückwärts fallende Regen", omen: "Eine Nachricht erreicht dich, bevor sie gesendet wurde.", weight: 3 },
  { symbol: "Die Teetasse, die niemand berührt", omen: "Ein Abschied naht, den du selbst herbeigeführt hast.", weight: 5 },
  { symbol: "Die Tür ohne Wand", omen: "Eine Wahl, die du für endgültig hieltest, steht dir noch offen.", weight: 4 },
  { symbol: "Das Gesicht, das die Stimme wechselt", omen: "Jemand, dem du vertraust, verbirgt seine Herkunft.", weight: 6 },
  { symbol: "Die Uhr ohne Zeiger", omen: "Eine Frist läuft ab, die du nie gekannt hast.", weight: 7 },
  { symbol: "Der Baum, der nach innen wächst", omen: "Ein Geheimnis wird sich wenden und dich selbst treffen.", weight: 4 },
  { symbol: "Das Wasser, das rückwärts fließt", omen: "Du wirst an einen Ort zurückkehren, den es nicht mehr gibt.", weight: 5 },
  { symbol: "Der Schatten ohne Träger", omen: "Eine Schuld folgt dir, die nicht die deine ist.", weight: 8 },
];

export function generatePropheticSymbols(count: number = 3, seed: number = 42): PropheticSymbol[] {
  const rng = createSeededRandom(hashString("prophecy:" + seed));
  const total = Math.max(1, Math.min(count, SYMBOL_POOL.length));
  const result: PropheticSymbol[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (result.length < total && guard < 100) {
    guard++;
    const idx = Math.floor(rng() * SYMBOL_POOL.length);
    if (used.has(idx)) continue;
    used.add(idx);
    result.push({ ...SYMBOL_POOL[idx] });
  }
  return result;
}

export interface DreamSequence {
  id: string;
  dimensions: DreamDimension[];
  images: DreamImage[];
  prophecies: PropheticSymbol[];
  prose: string;
  coherence: number;
}

function buildDreamProse(images: DreamImage[], prophecies: PropheticSymbol[], rng: () => number): string {
  const connectors = [
    "Dann, ohne Übergang,",
    "Und während du noch begreifst,",
    "Es gibt kein Vorher, nur dieses:",
    "Zwischen zwei Atemzügen,",
    "Doch der Traum kennt keine Reihenfolge, und so:",
  ];
  const parts: string[] = [];
  images.forEach((img, i) => {
    const c = i === 0 ? "" : pick(connectors, rng) + " ";
    parts.push(c + img.image);
  });
  if (prophecies.length > 0) {
    const p = pick(prophecies, rng);
    parts.push(`Und irgendwo unter allem liegt ein Zeichen: ${p.symbol}. Es bedeutet, dass ${p.omen.toLowerCase()}`);
  }
  return parts.join(" ");
}

export function createDreamSequence(
  dimensionIds: DreamDimensionId[],
  seed: number = 42,
  prophecyCount: number = 3
): DreamSequence {
  const rng = createSeededRandom(hashString("seq:" + dimensionIds.join(",") + ":" + seed));
  const dims = dimensionIds
    .map((id) => getDreamDimension(id))
    .filter((d): d is DreamDimension => Boolean(d));
  const active = dims.length > 0 ? dims : DREAM_DIMENSIONS;
  const images = active.map((d, i) => generateDreamImage(d.id, seed + i));
  const prophecies = generatePropheticSymbols(prophecyCount, seed);
  const prose = buildDreamProse(images, prophecies, rng);

  // Traum-Kohärenz: viele Dimensionen = weniger Kohärenz, viele Prophezeiungen = mehr Bedeutung
  const coherence = Math.max(
    0,
    Math.min(100, 100 - active.length * 12 + prophecies.length * 5)
  );

  return {
    id: `DREAM-${hashString(dimensionIds.join(",") + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    dimensions: active,
    images,
    prophecies,
    prose,
    coherence,
  };
}

export function createSampleDreamSequence(): DreamSequence {
  return createDreamSequence(["nonEuclidean", "identityFusion", "emotionalDisplacement"], 42, 3);
}
