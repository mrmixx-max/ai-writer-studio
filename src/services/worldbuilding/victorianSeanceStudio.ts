// VictorianSeanceStudio (WP 116.2, Meilenstein 56.0 / v6.8.0)
// Viktorianisches Séance- & Spiritismus-Studio für Gothic-Horror-Fiktion.
// Séance-Apparaturen, übernatürliche Phänomene und automatisches Geister-Schreiben.
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
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// WP 116.2 — Séance-Apparaturen
// ---------------------------------------------------------------------------

export type SeanceApparatusId =
  | "planchette"
  | "slateWriting"
  | "spiritTrumpet"
  | "tranceState";

export interface SeanceApparatus {
  id: SeanceApparatusId;
  name: string;
  description: string;
  era: "victorian";
  /** Historische Echtheit von 0 (reine Erfindung) bis 1 (gut belegt). */
  authenticity: number;
}

/** Die vier viktorianischen Séance-Apparaturen. */
export const SEANCE_APPARATUS: readonly SeanceApparatus[] = [
  {
    id: "planchette",
    name: "Planchette / Hexenbrett",
    description:
      "Ein kleines, herzförmiges Hölzchen auf zwei Rollen, in dessen Kerbe ein Bleistift steckt. Legen die Teilnehmer die Finger auf, zieht die Planchette von selbst über das Papier und schreibt Botschaften, die keiner der Anwesenden bewusst geführt hat.",
    era: "victorian",
    authenticity: 0.85,
  },
  {
    id: "slateWriting",
    name: "Schiefertafel-Schreiben",
    description:
      "Zwei zusammengebundene Schiefertafeln, zwischen die ein Stück Kreide gelegt wird. Nach dem Gebet öffnet man die Tafeln, und auf dem Schiefer steht eine Antwort — angeblich von Geisterhand, während die Hände der Medien sichtbar ruhten.",
    era: "victorian",
    authenticity: 0.8,
  },
  {
    id: "spiritTrumpet",
    name: "Geistertuba",
    description:
      "Ein leichter Blech- oder Pappkegel, der in der Mitte des Tisches aufgerichtet wird. Aus ihm soll die Stimme der Toten sprechen, während das Medium in Trance liegt und der Trichter sich im verdunkelten Raum von selbst hebt und neigt.",
    era: "victorian",
    authenticity: 0.72,
  },
  {
    id: "tranceState",
    name: "Trance-Zustände",
    description:
      "Das Medium fällt in einen tiefen, hypnotischen Zustand, in dem angeblich ein fremdes Wesen von seiner Stimme Besitz ergreift. Die Kontrolle über Körper und Sprache entgleitet, während sich die Persönlichkeit vollständig zu wandeln scheint.",
    era: "victorian",
    authenticity: 0.68,
  },
];

export function getSeanceApparatus(id: SeanceApparatusId): SeanceApparatus | undefined {
  return SEANCE_APPARATUS.find((a) => a.id === id);
}

// ---------------------------------------------------------------------------
// WP 116.2 — Übernatürliche Phänomene
// ---------------------------------------------------------------------------

export type PhenomenaType =
  | "coldSpot"
  | "gasLampFlicker"
  | "wallKnocking"
  | "temperatureDrop";

export interface SupernaturalPhenomenon {
  type: PhenomenaType;
  description: string;
  /** Intensität von 0 (kaum spürbar) bis 10 (unerträglich). */
  intensity: number;
}

export interface SupernaturalPhenomenaResult {
  phenomena: SupernaturalPhenomenon[];
  summary: string;
}

/** Beschreibungs-Bausteine je Phänomen-Art. */
const PHENOMENA_TEMPLATES: Record<PhenomenaType, string[]> = {
  coldSpot: [
    "Ein eisiger Fleck hängt mitten im Raum, so kalt, dass der Atem der Anwesenden zu weißem Dunst gerinnt.",
    "Über dem Séance-Tisch liegt eine Kälte wie aus einem offenen Grab, obwohl im Kamin noch Feuer brennt.",
    "Ein scharf umrissener Kältepol wandert langsam über die Dielen, und wo er verweilt, beschlägt selbst Metall.",
    "Die Luft wird plötzlich klirrend kalt, als sei der Winter selbst hereingelassen worden.",
  ],
  gasLampFlicker: [
    "Die Gaslampe an der Wand flackert auf, als hätte jemand den Hahn aufgedreht, und verlöscht bis auf einen blauen Stich.",
    "Sämtliche Gaslampen im Salon neigen sich gleichzeitig und drohen zu verlöschen, ohne dass Zugluft sie berührt.",
    "Die Flamme der Lampe zuckt in einem Rhythmus, der keinem Wind gehorcht, und wirft tanzende Schatten an die Decke.",
    "Das Gaslicht erlischt von selbst, einen Augenblick bevor die erste Klopfantwort an der Wand ertönt.",
  ],
  wallKnocking: [
    "An der getäfelten Wand ertönen drei Klopfer, gleichmäßig wie ein Antwortzeichen aus dem Jenseits.",
    "Ein dumpfes Klopfen wandert hinter der Tapete entlang, als ginge etwas mit den Knöcheln durch den Hohlraum.",
    "Klopfzeichen antworten aus der Wand, kaum lauter als ein Fingertippen, aber unmissverständlich geordnet.",
    "Aus dem Mauerwerk schlägt ein einzelner, schwerer Schlag, dass der Kerzenleuchter erzittert.",
  ],
  temperatureDrop: [
    "Die Temperatur des Raumes stürzt binnen Sekunden ab, und der Schweiß auf den Stirnen der Teilnehmer gefriert.",
    "Ein jäher Temperatursturz lässt die Fensterscheiben von innen beschlagen und die Gläser auf dem Tisch bereifen.",
    "Die Wärme weicht aus dem Zimmer wie das Blut aus einem Gesicht, und die Hände der Teilnehmer erstarren.",
    "Mitten in der Anrufung fällt die Temperatur, bis der Atem steht und jeder Herzschlag schwer wird.",
  ],
};

const PHENOMENA_LABELS: Record<PhenomenaType, string> = {
  coldSpot: "Kältefleck",
  gasLampFlicker: "verlöschende Gaslampe",
  wallKnocking: "Klopfzeichen an der Wand",
  temperatureDrop: "Temperatursturz",
};

const PHENOMENA_TYPES: PhenomenaType[] = [
  "coldSpot",
  "gasLampFlicker",
  "wallKnocking",
  "temperatureDrop",
];

export function generateSupernaturalPhenomena(seed: number): SupernaturalPhenomenaResult {
  const rng = createSeededRandom(hashString(`phenomena:${seed}`));

  // 2 bis 4 Phänomene, jeweils ohne Wiederholung der Art.
  const count = 2 + Math.floor(rng() * 3);

  const types: PhenomenaType[] = [];
  const seen = new Set<PhenomenaType>();
  let guard = 0;
  while (types.length < count && guard < 200) {
    guard++;
    const t = pick(PHENOMENA_TYPES, rng);
    if (seen.has(t)) continue;
    seen.add(t);
    types.push(t);
  }

  const phenomena: SupernaturalPhenomenon[] = types.map((type) => {
    const description = pick(PHENOMENA_TEMPLATES[type], rng);
    const intensity = Math.max(1, Math.min(10, 2 + Math.floor(rng() * 9)));
    return { type, description, intensity };
  });

  // Zusammenfassung: dominierendes Phänomen + Gesamtstimmung.
  const dominant = phenomena.reduce(
    (best, p) => (p.intensity > best.intensity ? p : best),
    phenomena[0]
  );
  const avg = phenomena.reduce((s, p) => s + p.intensity, 0) / phenomena.length;
  const mood = avg >= 7 ? "die Gegenwart ist übermächtig" : avg >= 4 ? "die Luft ist geladen" : "etwas rührt sich kaum merklich";

  const summary =
    `Während der Séance manifestieren sich ${phenomena.length} Phänomene. ` +
    `Am stärksten tritt die ${PHENOMENA_LABELS[dominant.type]} hervor (Intensität ${dominant.intensity}/10); ${mood}.`;

  return { phenomena, summary };
}

// ---------------------------------------------------------------------------
// WP 116.2 — Automatisches Geister-Schreiben
// ---------------------------------------------------------------------------

export type SpiritUrgency = "low" | "medium" | "high";

export interface SpiritWritingResult {
  message: string;
  language: "archaic";
  translation: string;
  urgency: SpiritUrgency;
}

interface SpiritMessageEntry {
  /** Botschaft in archaischem Deutsch (versalien, ohne Punkt). */
  message: string;
  /** Übertragung in heutiges Deutsch. */
  translation: string;
  urgency: SpiritUrgency;
}

/** Katalog von Botschaften, die die Planchette von selbst schreibt. */
const SPIRIT_MESSAGES: SpiritMessageEntry[] = [
  {
    message: "HINTER DER TÄFELUNG WARTET ER",
    translation: "Er wartet hinter der Wandtäfelung.",
    urgency: "high",
  },
  {
    message: "DIE KOMMEN",
    translation: "Sie kommen.",
    urgency: "high",
  },
  {
    message: "FLIEH",
    translation: "Fliehe.",
    urgency: "high",
  },
  {
    message: "LÖSCHET DAS LICHT",
    translation: "Löscht das Licht.",
    urgency: "medium",
  },
  {
    message: "SIE HÖREN EUCH DURCH DIE WAND",
    translation: "Sie hören euch durch die Wand hindurch.",
    urgency: "medium",
  },
  {
    message: "DER KELLER IST NICHT LEER",
    translation: "Der Keller ist nicht leer.",
    urgency: "medium",
  },
  {
    message: "ZÄHLET DIE SCHRITTE",
    translation: "Zählt die Schritte.",
    urgency: "low",
  },
  {
    message: "EIN NAME FEHLT IM STEIN",
    translation: "Ein Name fehlt auf dem Grabstein.",
    urgency: "low",
  },
  {
    message: "FRAGET NICHT NACH DEM HAUS",
    translation: "Fragt nicht nach dem Haus.",
    urgency: "medium",
  },
  {
    message: "WER DIE TAFEL NÄSST, DER STIRBT",
    translation: "Wer die Schiefertafel nass macht, der stirbt.",
    urgency: "high",
  },
];

export function generateSpiritWriting(seed: number): SpiritWritingResult {
  const rng = createSeededRandom(hashString(`spirit:${seed}`));
  const entry = pick(SPIRIT_MESSAGES, rng);
  return {
    message: entry.message,
    language: "archaic",
    translation: entry.translation,
    urgency: entry.urgency,
  };
}

// ---------------------------------------------------------------------------
// Fabrik-Funktionen (Beispiele)
// ---------------------------------------------------------------------------

export interface SeanceSession {
  id: string;
  /** Verwendete Apparaturen. */
  apparatus: SeanceApparatus[];
  phenomena: SupernaturalPhenomenon[];
  summary: string;
  /** Botschaft aus dem automatischen Geister-Schreiben. */
  spiritMessage: SpiritWritingResult;
}

export function createSeanceSession(
  apparatusIds: SeanceApparatusId[],
  seed: number = 42
): SeanceSession {
  const apparatus = apparatusIds
    .map((id) => getSeanceApparatus(id))
    .filter((a): a is SeanceApparatus => Boolean(a));

  const { phenomena, summary } = generateSupernaturalPhenomena(seed);
  const spiritMessage = generateSpiritWriting(seed);

  const id = `SEANCE-${hashString(
    apparatusIds.join(",") + ":" + seed
  )
    .toString(16)
    .padStart(8, "0")
    .toUpperCase()}`;

  return { id, apparatus, phenomena, summary, spiritMessage };
}

export function createSampleSeanceSession(): SeanceSession {
  return createSeanceSession(["planchette", "slateWriting", "tranceState"], 42);
}

export function createSampleSpiritMessage(): SpiritWritingResult {
  return generateSpiritWriting(42);
}
