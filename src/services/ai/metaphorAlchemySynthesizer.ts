// metaphorAlchemySynthesizer.ts (WP 95.1)
// Metaphern-Alchemie & Cross-Domain-Synthesizer

export interface MetaphorProfile {
  id: string;
  targetConcept: string;
  sourceDomain: string;
  metaphors: GeneratedMetaphor[];
  clicheScore: number;
  seed: number;
}

export interface GeneratedMetaphor {
  text: string;
  targetConcept: string;
  sourceDomain: string;
  mappingType: "structural" | "orientational" | "ontological" | "compound";
  novelty: number; // 0-1, higher = more novel
  isCliche: boolean;
}

const SOURCE_DOMAINS = [
  "Architektur", "Astronomie", "Botanik", "Chemie", "Geologie",
  "Mechanik", "Medizin", "Meteorologie", "Musik", "Navigation",
  "Optik", "Physik", "Schifffahrt", "Statik", "Thermodynamik",
  "Vulkanologie", "Weberei", "Zoologie",
];

const CLICHE_METAPHORS = [
  "augen wie sterne", "herz wie ein hammer", "zeit heilt alle wunden",
  "leben ist eine reise", "liebe ist ein spiel", "wut kocht hoch",
  "eis brechen", "licht am ende des tunnels", "schwer wie blei",
  "schnell wie der wind", "still wie ein maus", "stark wie ein baum",
  "frei wie ein vogel", "tief wie das meer", "hell wie die sonne",
  "dunkel wie die nacht", "süß wie honig", "bitter wie galle",
  "scharf wie ein messer", "weich wie seide", "hart wie stein",
  "kalt wie eis", "heiß wie feuer", "leicht wie eine feder",
  "schwer wie ein berg", "klar wie wasser", "trüb wie ein see",
];

const STRUCTURAL_MAPPINGS: Record<string, string[]> = {
  "Architektur": ["Fundament", "Gerüst", "Balken", "Gewölbe", "Pfeiler", "Keller", "Dachfirst", "Mauerwerk", "Statik", "Tragfähigkeit"],
  "Mechanik": ["Zahnrad", "Hebel", "Feder", "Achse", "Getriebe", "Lager", "Welle", "Kupplung", "Bremse", "Antrieb"],
  "Weberei": ["Faden", "Kette", "Schuss", "Gewebe", "Muster", "Knüpfen", "Spinnen", "Webstuhl", "Kante", "Saum"],
  "Navigation": ["Kurs", "Kompass", "Hafen", "Strömung", "Riff", "Leuchtturm", "Seekarte", "Anker", "Bug", "Heck"],
  "Musik": ["Tonart", "Rhythmus", "Harmonie", "Dissonanz", "Kadenz", "Melodie", "Takt", "Intervall", "Akkord", "Tonleiter"],
};

const ORIENTATIONAL_MAPPINGS = [
  "aufwärts/abwärts", "innen/außen", "vorne/hinten", "oben/unten",
  "nah/fern", "zentral/peripher", "eingeschlossen/frei", "verbunden/getrennt",
];

const ONTOLOGICAL_MAPPINGS = [
  "Personifikation", "Objektivierung", "Substantivierung", "Verstofflichung",
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
    return (z ^ (z >>> 16)) / 4294967296;
  };
}

function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) return undefined as unknown as T;
  const idx = Math.floor(rng() * arr.length);
  return arr[Math.min(idx, arr.length - 1)];
}

function isCliche(text: string): boolean {
  const lower = text.toLowerCase();
  return CLICHE_METAPHORS.some(cliche => lower.includes(cliche));
}

function computeNovelty(text: string, sourceDomain: string): number {
  const lower = (text || "").toLowerCase();
  const words = lower.split(/\W+/).filter(w => w.length > 3);
  const domainWords = (STRUCTURAL_MAPPINGS[sourceDomain] || []).map(String);
  let matches = 0;
  for (const w of words) {
    if (domainWords.some(d => d.toLowerCase().includes(w) || w.includes(d.toLowerCase()))) {
      matches++;
    }
  }
  return Math.min(1, matches / Math.max(1, words.length) + 0.3);
}

function generateStructuralMetaphor(target: string, domain: string, rng: () => number): GeneratedMetaphor {
  const elements = STRUCTURAL_MAPPINGS[domain] || ["Element", "Struktur", "Verbindung"];
  const element1 = pickRandom(elements, rng);
  const element2 = pickRandom(elements.filter(e => e !== element1), rng);

  const templates = [
    `Das ${target} besitzt das ${element1} von ${domain.toLowerCase()}, gefügt mit der Präzision eines ${element2}.`,
    `Wie ein ${element1} im ${domain.toLowerCase()} hält das ${target} stand, getragen von ${element2}.`,
    `Das ${target} ist ein ${element1} aus ${domain.toLowerCase()}, dessen ${element2} nie bricht.`,
  ];

  return {
    text: pickRandom(templates, rng),
    targetConcept: target,
    sourceDomain: domain,
    mappingType: "structural",
    novelty: 0,
    isCliche: false,
  };
}

function generateOrientationalMetaphor(target: string, domain: string, rng: () => number): GeneratedMetaphor {
  const orientation = pickRandom(ORIENTATIONAL_MAPPINGS, rng);
  const [up, down] = orientation.split("/");

  const templates = [
    `Das ${target} zieht es unaufhaltsam ${up}, während die ${domain.toLowerCase()} nach ${down} drängt.`,
    `In der ${domain.toLowerCase()} des ${target} gibt es kein ${down}, nur ${up}.`,
    `Das ${target} navigiert zwischen ${up} und ${down}, wie ein Schiff in der ${domain.toLowerCase()}.`,
  ];

  return {
    text: pickRandom(templates, rng),
    targetConcept: target,
    sourceDomain: domain,
    mappingType: "orientational",
    novelty: 0,
    isCliche: false,
  };
}

function generateOntologicalMetaphor(target: string, domain: string, rng: () => number): GeneratedMetaphor {
  const _type = pickRandom(ONTOLOGICAL_MAPPINGS, rng);

  const templates = [
    `Das ${target} atmet wie ein lebendiges Wesen der ${domain.toLowerCase()}.`,
    `Die ${domain.toLowerCase()} des ${target} hat ein eigenes Bewusstsein entwickelt.`,
    `Das ${target} wird zur Personifikation der ${domain.toLowerCase()}.`,
  ];

  return {
    text: pickRandom(templates, rng),
    targetConcept: target,
    sourceDomain: domain,
    mappingType: "ontological",
    novelty: 0,
    isCliche: false,
  };
}

function generateCompoundMetaphor(target: string, domain1: string, domain2: string, rng: () => number): GeneratedMetaphor {
  const element1 = pickRandom(STRUCTURAL_MAPPINGS[domain1] || ["Kern"], rng);
  const element2 = pickRandom(STRUCTURAL_MAPPINGS[domain2] || ["Struktur"], rng);

  const templates = [
    `Das ${target} vereint das ${element1} der ${domain1.toLowerCase()} mit dem ${element2} der ${domain2.toLowerCase()}.`,
    `Wie ${element1} in der ${domain1.toLowerCase()} und ${element2} in der ${domain2.toLowerCase()} formt das ${target} eine neue Einheit.`,
    `Das ${target} ist die Kreuzung aus ${domain1.toLowerCase()}-${element1} und ${domain2.toLowerCase()}-${element2}.`,
  ];

  return {
    text: pickRandom(templates, rng),
    targetConcept: target,
    sourceDomain: `${domain1} × ${domain2}`,
    mappingType: "compound",
    novelty: 0,
    isCliche: false,
  };
}

export function createMetaphorProfile(
  targetConcept: string,
  sourceDomain: string = "",
  seed: number = 42
): MetaphorProfile {
  const rng = createSeededRandom(hashString(targetConcept + sourceDomain + seed));

  const domain = sourceDomain || pickRandom(SOURCE_DOMAINS, rng);
  const metaphors: GeneratedMetaphor[] = [];
  const numMetaphors = Math.max(4, 4 + Math.floor(rng() * 4));

  for (let i = 0; i < numMetaphors; i++) {
    const typeChoice = rng();
    let metaphor: GeneratedMetaphor;

    try {
      if (typeChoice < 0.35) {
        metaphor = generateStructuralMetaphor(targetConcept, domain, rng);
      } else if (typeChoice < 0.6) {
        metaphor = generateOrientationalMetaphor(targetConcept, domain, rng);
      } else if (typeChoice < 0.85) {
        metaphor = generateOntologicalMetaphor(targetConcept, domain, rng);
      } else {
        const secondDomain = pickRandom(SOURCE_DOMAINS.filter(d => d !== domain), rng);
        metaphor = generateCompoundMetaphor(targetConcept, domain, secondDomain, rng);
      }

      metaphor.novelty = computeNovelty(metaphor.text, metaphor.sourceDomain);
      metaphor.isCliche = isCliche(metaphor.text);
    } catch {
      metaphor = {
        text: `Das ${targetConcept} atmet wie die ${domain.toLowerCase()}.`,
        targetConcept,
        sourceDomain: domain,
        mappingType: "orientational",
        novelty: 0.5,
        isCliche: false,
      };
    }
    metaphors.push(metaphor);
  }

  const cliches = metaphors.filter(m => m.isCliche).length;
  const clicheScore = metaphors.length > 0 ? cliches / metaphors.length : 0;

  return {
    id: `META-${hashString(targetConcept + domain + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    targetConcept,
    sourceDomain: domain,
    metaphors,
    clicheScore: Math.round(clicheScore * 100) / 100,
    seed,
  };
}

export function formatMetaphorProfile(profile: MetaphorProfile): string {
  const typeLabels: Record<string, string> = {
    structural: "🏗️ STRUKTURELL",
    orientational: "🧭 ORIENTATIONAL",
    ontological: "👤 ONTOLOGISCH",
    compound: "⚗️ KOMPOUND (Cross-Domain)",
  };

  const lines = [
    "⚗️ METAPHERN-ALCHEMIE & CROSS-DOMAIN-SYNTHESIZER",
    `ID: ${profile.id}`,
    `Zielbegriff: ${profile.targetConcept}`,
    `Quelldomäne: ${profile.sourceDomain}`,
    `Klischee-Score: ${(profile.clicheScore * 100).toFixed(0)}% (${profile.clicheScore === 0 ? "KEINE Klischees" : "enthält Klischees"})`,
    `Seed: ${profile.seed}`,
    "",
    "✨ GENERIERTE METAPHERN:",
  ];

  for (let i = 0; i < profile.metaphors.length; i++) {
    const m = profile.metaphors[i];
    const noveltyBar = "★".repeat(Math.round(m.novelty * 5));
    const clicheMark = m.isCliche ? " ⚠️ KLISCHEE" : "";
    lines.push(
      `  ${i + 1}. [${typeLabels[m.mappingType] || m.mappingType}] ${noveltyBar}${clicheMark}`
    );
    lines.push(`     "${m.text}"`);
    lines.push(`     → Domäne: ${m.sourceDomain} | Neuartigkeit: ${(m.novelty * 100).toFixed(0)}%`);
    lines.push("");
  }

  const avgNovelty = profile.metaphors.reduce((sum, m) => sum + m.novelty, 0) / profile.metaphors.length;
  lines.push(`📊 Ø Neuartigkeit: ${(avgNovelty * 100).toFixed(0)}% | Klischee-Rate: ${(profile.clicheScore * 100).toFixed(0)}%`);

  return lines.join("\n");
}

export function createSampleProfile(): MetaphorProfile {
  return createMetaphorProfile("Trauer", "Architektur", 42);
}

export function createSampleClicheCheck(): { text: string; isCliche: boolean }[] {
  return [
    { text: "Ihre Augen waren wie Sterne am Nachthimmel", isCliche: true },
    { text: "Das Schweigen besaß das statische Gewicht von feuchtem Granit", isCliche: false },
  ];
}