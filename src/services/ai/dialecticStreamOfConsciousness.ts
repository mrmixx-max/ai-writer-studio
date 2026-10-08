// dialecticStreamOfConsciousness.ts (WP 97.2)
// Zweigleisiger Bewusstseinsstrom-Synthesizer

export interface DialecticStreamProfile {
  id: string;
  characterName: string;
  setting: string;
  sensoryTrack: StreamSegment[]; // Track A: immediate sensory perceptions
  memoryTrack: StreamSegment[]; // Track B: involuntary memories/associations
  mergedStream: MergedSegment[];
  punctuationLevel: number; // 0 = no punctuation (pure flow), 1 = full punctuation
  seed: number;
}

export interface StreamSegment {
  text: string;
  trigger?: string; // what caused this segment (for sensory track)
  association?: string; // what memory/association this links to (for memory track)
  intensity: number; // 0-1
}

export interface MergedSegment {
  sensoryText: string;
  memoryText: string;
  interruption?: string; // sensory interruption that cuts into memory
  combinedText: string;
}

const SENSORY_TRIGGERS = [
  "ein tropfender Wasserhahn",
  "quietschende Reifen auf nassem Asphalt",
  "das Summen einer Fliege am Fenster",
  "Kirchenglocken in der Ferne",
  "das Knacken von Holz im Kamin",
  "ein plötzliches Kältegefühl am Nacken",
  "der Geruch von gebranntem Kaffee",
  "eine Vibration im Boden",
  "Lichtreflexe an der Wand",
  "das Rascheln von Papier",
];

const MEMORY_ASSOCIATIONS = [
  "der Tag, als sie ging",
  "das Versprechen, das ich brach",
  "meine Hände um ihren Hals",
  "der Brief, den ich nie abschickte",
  "der Geschmack von Blut in meinem Mund",
  "das Lachen meines Vaters",
  "die Beerdigung im Regen",
  "der Moment, wo ich aufhörte zu beten",
  "die Narbe an meinem Handgelenk",
  "die letzte Lüge, die ich glaubte",
];

const INTERRUPTIONS = [
  "— *Tropf.* —",
  "— *Quietsch.* —",
  "— *Summ.* —",
  "— *Glocken.* —",
  "— *Knack.* —",
  "— *Kälte.* —",
  "— *Geruch.* —",
  "— *Beben.* —",
  "— *Blitz.* —",
  "— *Raschel.* —",
];

const PUNCTUATION_STYLES = {
  0: { name: "fluss", description: "keine Satzzeichen, reiner Gedankenstrom" },
  0.25: { name: "atmend", description: "nur Kommas, atemlose Phrasen" },
  0.5: { name: "fragmentiert", description: "Punkte und Kommas, bruchstückhaft" },
  0.75: { name: "strukturiert", description: "volle Interpunktion, aber assoziativ" },
  1: { name: "klar", description: "klare Sätze, innerer Monolog" },
};

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

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function applyPunctuationStyle(text: string, level: number): string {
  if (level === 0) {
    // Remove all punctuation
    return text.replace(/[.,;:!?()\-—"']/g, " ").replace(/\s+/g, " ").trim();
  } else if (level <= 0.25) {
    // Only commas
    return text.replace(/[.!?()\-—"']/g, " ").replace(/;:/g, ",").replace(/\s+/g, " ").trim();
  } else if (level <= 0.5) {
    // Periods and commas, but fragmented
    return text.replace(/[;:()\-—"']/g, " ").replace(/\s+/g, " ").trim();
  } else if (level <= 0.75) {
    // Full punctuation but keep flow
    return text.replace(/\s+/g, " ").trim();
  }
  // Level 1: clear sentences
  return text.replace(/\s+/g, " ").trim();
}

function generateSensoryTrack(rng: () => number, setting: string, punctuationLevel: number): StreamSegment[] {
  const triggers = shuffleArray([...SENSORY_TRIGGERS], rng);
  const segments: StreamSegment[] = [];
  const numSegments = 6 + Math.floor(rng() * 4);

  for (let i = 0; i < numSegments; i++) {
    const trigger = triggers[i % triggers.length];
    const sensoryTexts = [
      `Das ${trigger} durchdringt die Stille`,
      `Ich nehme wahr: ${trigger}`,
      `Da ist ${trigger}, unaufhaltsam`,
      `Mein Sensorium registriert: ${trigger}`,
      `${trigger} — real, unmittelbar, jetzt`,
    ];
    const text = pickRandom(sensoryTexts, rng) || sensoryTexts[0];
    segments.push({
      text: applyPunctuationStyle(text, punctuationLevel),
      trigger,
      intensity: 0.5 + rng() * 0.5,
    });
  }
  return segments;
}

function generateMemoryTrack(rng: () => number, punctuationLevel: number): StreamSegment[] {
  const associations = shuffleArray([...MEMORY_ASSOCIATIONS], rng);
  const segments: StreamSegment[] = [];
  const numSegments = 6 + Math.floor(rng() * 4);

  for (let i = 0; i < numSegments; i++) {
    const association = associations[i % associations.length];
    const memoryTexts = [
      `Und wieder: ${association}`,
      `Die Erinnerung an ${association} steigt auf`,
      `${association} — warum jetzt?`,
      `Unwillkürlich: ${association}`,
      `Der Geist kehrt zurück zu ${association}`,
    ];
    const text = pickRandom(memoryTexts, rng) || memoryTexts[0];
    segments.push({
      text: applyPunctuationStyle(text, punctuationLevel),
      association,
      intensity: 0.4 + rng() * 0.6,
    });
  }
  return segments;
}

function mergeTracks(
  sensory: StreamSegment[],
  memory: StreamSegment[],
  rng: () => number,
  punctuationLevel: number
): MergedSegment[] {
  const merged: MergedSegment[] = [];
  const maxLen = Math.max(sensory.length, memory.length);
  const interruptions = shuffleArray([...INTERRUPTIONS], rng);

  for (let i = 0; i < maxLen; i++) {
    const sensorySeg = sensory[i];
    const memorySeg = memory[i];
    const interruption = rng() < 0.4 ? pickRandom(interruptions, rng) : undefined;

    let combined = "";
    if (sensorySeg && memorySeg) {
      if (interruption) {
        combined = `${memorySeg.text} ${interruption} ${sensorySeg.text}`;
      } else {
        combined = `${memorySeg.text} — ${sensorySeg.text}`;
      }
    } else if (sensorySeg) {
      combined = sensorySeg.text;
    } else if (memorySeg) {
      combined = memorySeg.text;
    }

    merged.push({
      sensoryText: sensorySeg?.text || "",
      memoryText: memorySeg?.text || "",
      interruption,
      combinedText: applyPunctuationStyle(combined, punctuationLevel),
    });
  }
  return merged;
}

export function createDialecticStreamProfile(
  characterName: string = "Protagonist",
  setting: string = "ein dunkles Zimmer",
  punctuationLevel: number = 0.5,
  seed: number = 42
): DialecticStreamProfile {
  const rng = createSeededRandom(hashString(characterName + setting + punctuationLevel + seed));
  const sensoryTrack = generateSensoryTrack(rng, setting, punctuationLevel);
  const memoryTrack = generateMemoryTrack(rng, punctuationLevel);
  const mergedStream = mergeTracks(sensoryTrack, memoryTrack, rng, punctuationLevel);

  return {
    id: `STREAM-${hashString(characterName + setting + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    characterName,
    setting,
    sensoryTrack,
    memoryTrack,
    mergedStream,
    punctuationLevel,
    seed,
  };
}

export function formatDialecticStreamProfile(profile: DialecticStreamProfile): string {
  const style = PUNCTUATION_STYLES[profile.punctuationLevel as keyof typeof PUNCTUATION_STYLES] || PUNCTUATION_STYLES[0.5];

  const lines = [
    `═══ ZWEIGLEISIGER BEWUSSTSEINSSTROM ═══`,
    `ID: ${profile.id}`,
    `Figur: ${profile.characterName}`,
    `Setting: ${profile.setting}`,
    `Interpunktions-Stil: ${style.name} (${style.description})`,
    `Seed: ${profile.seed}`,
    `═══ SPUR A: SENSORISCHE WAHRNEHMUNG ═══`,
  ];

  for (let i = 0; i < profile.sensoryTrack.length; i++) {
    const seg = profile.sensoryTrack[i];
    lines.push(`${i + 1}. [${seg.trigger || "unbekannt"}] ${seg.text}`);
  }

  lines.push(`\n═══ SPUR B: UNWILLKÜRLICHE ERINNERUNGEN ═══`);
  for (let i = 0; i < profile.memoryTrack.length; i++) {
    const seg = profile.memoryTrack[i];
    lines.push(`${i + 1}. [→ ${seg.association || "unbekannt"}] ${seg.text}`);
  }

  lines.push(`\n═══ VERSCHMOLZENER STROM ═══`);
  for (let i = 0; i < profile.mergedStream.length; i++) {
    const seg = profile.mergedStream[i];
    if (seg.interruption) {
      lines.push(`${i + 1}. ${seg.memoryText} ${seg.interruption} ${seg.sensoryText}`);
    } else {
      lines.push(`${i + 1}. ${seg.memoryText} — ${seg.sensoryText}`);
    }
  }

  lines.push(`\n═══ FLIESSTEXT (KOMPLETT) ═══`);
  const fullText = profile.mergedStream.map(s => s.combinedText).join(" ");
  lines.push(fullText);

  return lines.join("\n");
}

export function createSampleProfile(): DialecticStreamProfile {
  return createDialecticStreamProfile("K", "Küche um 3 Uhr morgens", 0.25, 888);
}