// espionageTradecraftEngine (WP 118.1)
// Spionagetradecraft- & Totbriefkasten-Topografie-Engine für kalter-Krieg-Spionageworldbuilding.
// Vier Tradecraft-Operationen, paranoia-dichte Prosa, Dead-Drop-Topografie.
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
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) throw new Error('Empty array');
  return arr[Math.floor(rng() * arr.length)];
}

export type TradecraftOperationId =
  | 'deadDrop'
  | 'brushPass'
  | 'dryCleaning'
  | 'compromisedSafehouse';

export interface TradecraftOperation {
  id: TradecraftOperationId;
  name: string;
  description: string;
  riskLevel: number;
  steps: string[];
}

export const TRADECRAFT_OPERATIONS: TradecraftOperation[] = [
  {
    id: 'deadDrop',
    name: 'Toter Briefkasten',
    description:
      'Stiller Materialtransfer an einem vorab abgestimmten Versteck. Kein Kontakt zwischen den Agenten, nur ein unauffälliges Kreidezeichen an einer Laterne signalisiert, dass die Nachricht liegt.',
    riskLevel: 6,
    steps: [
      'Kreidezeichen an der Laterne prüfen, ohne direkt hinzutreten',
      'Geplante Route in den Spiegel werfen, Schritte im Rückspiegel zählen',
      'Versteck ohne Hinhören betreten, Material mit linkem Handrücken freilegen',
      'Entnahmerückstand verschließen, Umgebung unverändert hinterlassen',
      'Gegenrichtung abwandern, nie denselben Weg zurücklaufen',
    ],
  },
  {
    id: 'brushPass',
    name: 'Flüchtiger Kontakt',
    description:
      'Sekundenlanger gehender Materialübergabe zwischen zwei Passanten. Zwei Blicke, ein Objekt, keine Worte – ein Handgriff, der aussieht wie ein Verbeugen.',
    riskLevel: 3,
    steps: [
      'Treffpunkt zwei Mal vorab ohne Zeichen passieren',
      'Übergabeseite vom Verkehr wegrichten, Rücken zur Mauer',
      'Begegnung als Zufall inszenieren, Oberfläche nach innen drehen',
      'Objekt in Handflächen gleiten lassen, Hände sofort öffnen',
      'Entgegengesetzt weitergehen, keinen Blick zurück',
    ],
  },
  {
    id: 'dryCleaning',
    name: 'Beschattungs-Abwehrmarsch',
    description:
      'Verlorene Beschattung durch Absichtslosigkeit abgeschüttelt. Ein Marsch durch Boulevards, die wie ein Routineabend aussehen, nur die Route kennt jede Antenne der Gegenseite.',
    riskLevel: 4,
    steps: [
      'Verfolger bewusst sichtbar werden lassen, ohne Tempo zu ändern',
      'Kino oder Kneipe betreten, Hinterausgang oder Garderobe nutzen',
      'Wechselgeschäft oder Doppelschleife auf der anderen Straßenseite',
      'Zwei Stationen in die U-Bahn, im letzten Moment aussteigen',
      'Beschattung erst nach drei Richtungswechseln als verloren buchen',
    ],
  },
  {
    id: 'compromisedSafehouse',
    name: 'Kompromittiertes Safehouse',
    description:
      'Flucht aus einem Ort, dessen Adresse in fremden Akten steht. Alles bleibt, nur der Agent geht – und er geht den längsten Weg, den noch niemand beschreibt.',
    riskLevel: 9,
    steps: [
      'Flucht nur mit dem Nötigsten: Papiere verbrennen, Bargeld und Amt',
      'Nachts aus dem Keller oder über das Hinterzimmer, nie die Tür',
      'Anonyme Unterkunft erst nach 48 Stunden suchen, bar bezahlen',
      'Kontakt zur Station nur noch über Totbriefkasten und Zeitunginserat',
      'Aussehen ändern: Jacke, Mütze, Schuhwerk, Gang – alles neu',
    ],
  },
];

export interface DeadDropTopography {
  location: string;
  method: string;
  concealment: string;
  retrievalSignal: string;
  riskLevel: number;
}

const DEAD_DROP_LOCATIONS = [
  'Parkmauer',
  'Brückengeländer',
  'U-Bahn-Bahnsteig',
  'Bücherregal',
] as const;

const DEAD_DROP_METHODS = [
  'Filmrolle in gelöstem Mauerwerk',
  'Hohlkasten unter Brückenplatte',
  'Befestigter Umschlag im Schaffnerschrank',
  'Hohlrümmer in einem ungelesenen Buch',
  'Metallkapsel im Laternenpfahl',
  'Getarnt als Parkbank-Schraubbolzen',
] as const;

const DEAD_DROP_CONCEALMENTS = [
  'Von Vogelkot und Streuung verdeckt, unauffällig für Passanten',
  'Unter einer lose sitzenden Platte vergraben, sichtbar nur mit zwei Fingern',
  'Zwischen alten Fahrkarten und Fahrtipps versteckt, Handschrift getäuscht',
  'Im untersten Fach hinter Schmutz und Staub, zwischen Werbung und Zeitung',
  'Klemmt unter einer Bank, befestigt mit Kaugummi und Geduld',
] as const;

const DEAD_DROP_RETRIEVAL_SIGNALS = [
  'Kreidezeichen an der Laterne am Abend',
  'Zeitung mit gefalteter Ecke auf der Parkbank',
  ' Umschlag mit blauem Streifen im Briefkasten der Haltestelle',
  ' Buch mit rotem Lesezeichen im Bücherregal der Station',
  ' Ausgelegter Fahrplan auf dem Schalter, falsche Linie markiert',
] as const;

export function generateTradecraftProse(operationId: string, seed: number): string {
  const rng = createSeededRandom(hashString(`${operationId}:${seed}`));
  const operation = TRADECRAFT_OPERATIONS.find((op) => op.id === operationId) ?? TRADECRAFT_OPERATIONS[0];
  const atmosphere = pick(ATMOSPHERE_FRAGMENTS, rng);
  const street = pick(STREET_FRAGMENTS, rng);
  const paranoia = pick(PARANOIA_FRAGMENTS, rng);
  const signal = pick(DEAD_DROP_RETRIEVAL_SIGNALS, rng);
  const method = pick(DEAD_DROP_METHODS, rng);
  return [
    `${operation.name}: ${operation.description}`,
    street,
    atmosphere,
    paranoia,
    `Der Transfer läuft über ${pick(DEAD_DROP_LOCATIONS, rng)} – ${method}.`,
    `${signal}.`,
  ].join(' ');
}

const ATMOSPHERE_FRAGMENTS = [
  'Nasser Asphalt im geteilten Berlin spiegelt das Licht der Laterne, der Mond liegt wie Pulver auf den Dächern.',
  'Dieseldunst hängt über der Straße, und in der Bahnhofsuhrtickt die Zeit wie ein Herz, das zu schnell schlägt.',
] as const;

const STREET_FRAGMENTS = [
  'Die Schritte im Rückspiegel gehören einer Gestalt, die sich nicht umdrehen darf.',
  'Kreidezeichen an Laternen markieren den Weg, den nur derjenige kennt, der ihn jemals gegangen ist.',
  'Jede Tür, die sich hinter dir schließt, ist eine Frage, die niemand beantworten will.',
  'Ein zweiter Schatten gleicht deinem Schatten, bis der Schatten allein weitergeht.',
] as const;

const PARANOIA_FRAGMENTS = [
  'Wenn der Briefkasten drei Tage lang still bleibt, ist das Schweigen die schlimmste Nachricht.',
  'Beschattung riecht nach Schmiermittel und nach Regen, der fällt, bevor die Tür zugeht.',
  'Ein Agent lernt die Geduld der Dinge: von Schraubbolzen, von Büchern, von Wänden.',
  'Wer den falschen Zug nimmt, entkommt nicht – er verlässt nur die Beobachtung, die ihn kennt.',
] as const;

export function generateDeadDropTopography(seed: number): DeadDropTopography {
  const rng = createSeededRandom(hashString(`deadDropTopography:${seed}`));
  return {
    location: pick(DEAD_DROP_LOCATIONS, rng),
    method: pick(DEAD_DROP_METHODS, rng),
    concealment: pick(DEAD_DROP_CONCEALMENTS, rng),
    retrievalSignal: pick(DEAD_DROP_RETRIEVAL_SIGNALS, rng),
    riskLevel: 2 + Math.floor(rng() * 7),
  };
}

export function createSampleTradecraftOperation(): TradecraftOperation {
  return TRADECRAFT_OPERATIONS[0];
}

export function createSampleDeadDrop(): DeadDropTopography {
  return generateDeadDropTopography(0);
}