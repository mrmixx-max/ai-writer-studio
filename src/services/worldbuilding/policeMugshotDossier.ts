// PoliceMugshotDossier (WP 128.2, Meilenstein 62.0, v7.4.0)
// Polizeiliche Identifikation & Akteneinsicht für Krimi-/Thriller-Fiktion.
// Mugshot-Hintergrund mit Höhenmarken, Fingerabdruck-Karte und Signalement.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module, browser-kompatibel.

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

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error('Leeres Array');
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// 1. Mugshot-Hintergrund & Schild
// ---------------------------------------------------------------------------

export type UnitSystem = 'metric' | 'imperial';

export interface MugshotPlateInput {
  prisonerNumber: string;
  name: string;
  precinct: string;
  date: string;
  unitSystem: UnitSystem;
}

export interface MugshotPlateResult {
  plateText: string;
  heightMarks: string[];
  unitSystem: string;
  svg: string;
}

const PRECINCT_LABELS: Record<string, string> = {
  '1. Bezirk': 'Revier Mitte',
  '2. Bezirk': 'Revier Nord',
  '3. Bezirk': 'Revier Süd',
  '4. Bezirk': 'Revier Ost',
  '5. Bezirk': 'Revier West',
};

function buildMugshotSvg(input: MugshotPlateInput, heightMarks: string[]): string {
  const marks: string[] = [];
  heightMarks.forEach((mark, index) => {
    const y = 250 - index * 25;
    marks.push(
      `<line x1="30" y1="${y}" x2="50" y2="${y}" style="stroke: var(--border-strong)" stroke-width="1.5" />`
    );
    marks.push(
      `<text x="55" y="${y + 4}" style="fill: var(--muted)" font-size="10">${mark}</text>`
    );
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
  <rect x="0" y="0" width="400" height="500" style="fill: var(--bg)" />
  <rect x="10" y="10" width="380" height="480" style="fill: none; stroke: var(--border-strong)" stroke-width="2" />
  <g>${marks.join('')}</g>
  <rect x="150" y="120" width="100" height="120" style="fill: var(--panel); stroke: var(--border-strong)" stroke-width="2" />
  <circle cx="200" cy="150" r="15" style="fill: none; stroke: var(--border-strong)" stroke-width="1.5" />
  <line x1="185" y1="150" x2="215" y2="150" style="stroke: var(--border-strong)" stroke-width="1" />
  <text x="200" y="200" text-anchor="middle" style="fill: var(--text)" font-size="12" font-weight="bold">${input.name}</text>
  <text x="200" y="230" text-anchor="middle" style="fill: var(--muted)" font-size="10">Nr. ${input.prisonerNumber}</text>
  <text x="200" y="380" text-anchor="middle" style="fill: var(--text)" font-size="14">${input.precinct}</text>
  <text x="200" y="400" text-anchor="middle" style="fill: var(--muted)" font-size="10">${input.date}</text>
  <text x="200" y="470" text-anchor="middle" style="fill: var(--muted)" font-size="9">Erkennungsdienstliche Behandlung</text>
</svg>`;
}

export function buildMugshotPlate(input: MugshotPlateInput, _seed: number): MugshotPlateResult {
  const unit = input.unitSystem;
  const marks: string[] = [];

  if (unit === 'metric') {
    for (let h = 140; h <= 200; h += 5) {
      marks.push(`${h} cm`);
    }
  } else {
    for (let f = 4; f <= 6; f++) {
      for (let i = 0; i < 12; i += 2) {
        marks.push(`${f}'${i}"`);
      }
    }
  }

  const precinctLabel = PRECINCT_LABELS[input.precinct] ?? input.precinct;
  const plateText = [
    `POLIZEI · ${precinctLabel}`,
    `Gefangenen-Nr.: ${input.prisonerNumber}`,
    `Name: ${input.name}`,
    `Aufnahmedatum: ${input.date}`,
    `Maßeinheit: ${unit === 'metric' ? 'Zentimeter' : 'Fuß/Zoll'}`,
  ].join('\n');

  return {
    plateText,
    heightMarks: marks,
    unitSystem: unit,
    svg: buildMugshotSvg(input, marks),
  };
}

// ---------------------------------------------------------------------------
// 2. Forensische Fingerabdruck-Karte
// ---------------------------------------------------------------------------

export interface FingerprintPattern {
  id: string;
  name: string;
  description: string;
}

export const FINGERPRINT_PATTERNS: FingerprintPattern[] = [
  {
    id: 'loop',
    name: 'Schleife',
    description:
      'Die Papillarleisten treten an der einen Seite ein und verlassen die andere Seite in einer gebogenen Kurve.',
  },
  {
    id: 'whorl',
    name: 'Wirbel',
    description:
      'Die Papillarleisten bilden konzentrische oder spiralförmige Muster um einen zentralen Kern.',
  },
  {
    id: 'arch',
    name: 'Bogen',
    description:
      'Die Papillarleisten steigen seitlich an und flachen in der Mitte zu einem sanften Bogen ab.',
  },
];

export interface FingerprintPrint {
  finger: string;
  patternId: string;
  patternName: string;
  ridges: number;
}

export interface FingerprintCardResult {
  prints: FingerprintPrint[];
  svg: string;
}

const FINGERS: string[] = [
  'Daumen links',
  'Daumen rechts',
  'Zeigefinger links',
  'Zeigefinger rechts',
  'Mittelfinger links',
  'Mittelfinger rechts',
  'Ringfinger links',
  'Ringfinger rechts',
  'kleiner Finger links',
  'kleiner Finger rechts',
];

function buildFingerprintSvg(prints: FingerprintPrint[]): string {
  const cards: string[] = [];
  prints.forEach((print, idx) => {
    const x = 10 + (idx % 5) * 80;
    const y = 10 + Math.floor(idx / 5) * 110;
    cards.push(
      `<rect x="${x}" y="${y}" width="70" height="90" style="fill: var(--panel); stroke: var(--border-strong)" stroke-width="1.5" />`
    );
    cards.push(
      `<text x="${x + 35}" y="${y + 12}" text-anchor="middle" style="fill: var(--muted)" font-size="8">${print.finger}</text>`
    );

    const patternIdx = FINGERPRINT_PATTERNS.findIndex((p) => p.id === print.patternId);
    const cy = y + 45;
    if (patternIdx === 0) {
      // Schleife
      for (let i = 0; i < 4; i++) {
        cards.push(
          `<path d="M ${x + 20} ${cy - 20 + i * 5} Q ${x + 35} ${cy - 35 + i * 5} ${x + 50} ${cy - 20 + i * 5}" style="fill: none; stroke: var(--text)" stroke-width="1.2" />`
        );
      }
    } else if (patternIdx === 1) {
      // Wirbel
      for (let i = 0; i < 3; i++) {
        cards.push(
          `<circle cx="${x + 35}" cy="${cy}" r="${6 + i * 5}" style="fill: none; stroke: var(--text)" stroke-width="1.2" />`
        );
      }
    } else {
      // Bogen
      for (let i = 0; i < 4; i++) {
        cards.push(
          `<path d="M ${x + 20} ${cy - 10 + i * 5} Q ${x + 35} ${cy - 20 + i * 5} ${x + 50} ${cy - 10 + i * 5}" style="fill: none; stroke: var(--text)" stroke-width="1.2" />`
        );
      }
    }
    cards.push(
      `<text x="${x + 35}" y="${y + 85}" text-anchor="middle" style="fill: var(--muted)" font-size="7">Linien: ${print.ridges}</text>`
    );
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" width="400" height="240">
  <rect x="0" y="0" width="400" height="240" style="fill: var(--bg)" />
  <g>${cards.join('')}</g>
</svg>`;
}

export function buildFingerprintCard(seed: number): FingerprintCardResult {
  const rng = createSeededRandom(hashString(`fingerprint:${seed}`));
  const prints: FingerprintPrint[] = FINGERS.map((finger) => {
    const pattern = pick(FINGERPRINT_PATTERNS, rng);
    return {
      finger,
      patternId: pattern.id,
      patternName: pattern.name,
      ridges: 12 + Math.floor(rng() * 28),
    };
  });

  return { prints, svg: buildFingerprintSvg(prints) };
}

// ---------------------------------------------------------------------------
// 3. Signalement & Täterprofil
// ---------------------------------------------------------------------------

export interface SignalementResult {
  scars: string[];
  tattoos: string[];
  aliases: string[];
  eyeColor: string;
  height: string;
  priorConvictions: string[];
  description: string;
}

const SCARS: string[] = [
  'Scharfe Narbe am rechten Handgelenk',
  'Brandnarbe am linken Unterarm',
  'Operationsnarbe am Bauchraum',
  'Kinnnarbe mit dunkler Pigmentierung',
  'Rippennarbe an der linken Schläfe',
];

const TATTOOS: string[] = [
  'Tribal-Muster am rechten Oberarm',
  'Schädel mit Dagger am linken Unterschenkel',
  'Krähe mit ausgebreiteten Flügeln am Brustkorb',
  'Klan-Zeichen am linken Handrücken',
  'Gotische Buchstaben am Nacken',
];

const ALIASES: string[] = [
  '„Der Schatten“',
  '„Adlerauge“',
  '„Stiller Max“',
  '„Nachtjäger“',
  '„Zweifel“',
  '„Kleiner Jürgen“',
];

const EYE_COLORS: string[] = [
  'braun',
  'blau',
  'grau',
  'grün',
  'haselnussfarben',
  'grau-blau',
];

const PRIOR_CONVICTIONS: string[] = [
  'Körperverletzung § 224 StGB',
  'Einbruchdiebstahl § 244 StGB',
  'Trunkenheit im Verkehr § 316 StGB',
  'Waffenbesitz § 53 WaffG',
  'Betrug § 263 StGB',
];

function formatSignalement(
  scars: string[],
  tattoos: string[],
  aliases: string[],
  eyeColor: string,
  height: string,
  priorConvictions: string[]
): string {
  const lines: string[] = [
    'SIGNALMENT / TÄTERPROFIL',
    '',
    `Augenfarbe: ${eyeColor}`,
    `Körpergröße: ${height}`,
    '',
    'NARBEN:',
    ...scars.map((s) => `  · ${s}`),
    '',
    'TÄTOWIERUNGEN:',
    ...tattoos.map((t) => `  · ${t}`),
    '',
    'DECKNAMEN:',
    ...aliases.map((a) => `  · ${a}`),
    '',
    'VORSTRAFEN:',
    ...priorConvictions.map((p) => `  · ${p}`),
  ];
  return lines.join('\n');
}

export function buildSignalement(seed: number): SignalementResult {
  const rng = createSeededRandom(hashString(`signalement:${seed}`));

  const scarCount = 1 + Math.floor(rng() * 2);
  const usedScars = new Set<string>();
  const scars: string[] = [];
  let guard = 0;
  while (scarCount > scars.length && guard < 100) {
    guard++;
    const s = pick(SCARS, rng);
    if (!usedScars.has(s)) {
      usedScars.add(s);
      scars.push(s);
    }
  }

  const tattooCount = 1 + Math.floor(rng() * 2);
  const usedTattoos = new Set<string>();
  const tattoos: string[] = [];
  guard = 0;
  while (tattooCount > tattoos.length && guard < 100) {
    guard++;
    const t = pick(TATTOOS, rng);
    if (!usedTattoos.has(t)) {
      usedTattoos.add(t);
      tattoos.push(t);
    }
  }

  const aliasCount = 1 + Math.floor(rng() * 3);
  const usedAliases = new Set<string>();
  const aliases: string[] = [];
  guard = 0;
  while (aliasCount > aliases.length && guard < 100) {
    guard++;
    const a = pick(ALIASES, rng);
    if (!usedAliases.has(a)) {
      usedAliases.add(a);
      aliases.push(a);
    }
  }

  const convictionCount = 1 + Math.floor(rng() * 4);
  const usedConvictions = new Set<string>();
  const priorConvictions: string[] = [];
  guard = 0;
  while (convictionCount > priorConvictions.length && guard < 100) {
    guard++;
    const c = pick(PRIOR_CONVICTIONS, rng);
    if (!usedConvictions.has(c)) {
      usedConvictions.add(c);
      priorConvictions.push(c);
    }
  }

  const eyeColor = pick(EYE_COLORS, rng);
  const height = `${155 + Math.floor(rng() * 40)} cm`;

  const description = formatSignalement(
    scars,
    tattoos,
    aliases,
    eyeColor,
    height,
    priorConvictions
  );

  return { scars, tattoos, aliases, eyeColor, height, priorConvictions, description };
}

// ---------------------------------------------------------------------------
// Sample-Factory-Funktionen
// ---------------------------------------------------------------------------

export function createSampleMugshotPlate(): MugshotPlateResult {
  return buildMugshotPlate(
    {
      prisonerNumber: 'X-00427',
      name: 'Maximilian Graf',
      precinct: '1. Bezirk',
      date: '14.10.2026',
      unitSystem: 'metric',
    },
    42
  );
}

export function createSampleFingerprintCard(): FingerprintCardResult {
  return buildFingerprintCard(42);
}
