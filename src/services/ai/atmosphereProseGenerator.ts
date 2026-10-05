// Atmosphärischer Schauplatz- & Sensorik-Generator (WP 55.1)
//
// Erzeugt stimmungsvolle Schauplatz-Einstiege mit erzwungener sensorischer
// Verankerung (mindestens 4 der 5 Sinne) und Übergangspassagen.
//
// Drei deterministische Werkzeuge:
//
//   1. generateAtmosphere  — Schauplatz → World-Painting-Text
//   2. checkSensoryCoverage — welche der 5 Sinne der Text bedient
//   3. generateTransition   — Übergangspassage zwischen zwei Szenen
//
// Design-Regeln (analog proseExpander):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Die fünf Sinne. */
export type Sense = 'sight' | 'sound' | 'smell' | 'taste' | 'touch';

/** Grundstimmung eines Schauplatzes. */
export type Mood = 'threatening' | 'melancholic' | 'sublime' | 'claustrophobic' | 'serene';

/** Tageszeit. */
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

/** Wetterlage. */
export type Weather = 'clear' | 'rain' | 'fog' | 'storm' | 'snow' | 'heat';

/** Eingabe für den Schauplatz-Generator. */
export interface SceneInput {
  /** Ortsname, z. B. „Hafenkai". */
  location?: string;
  /** Grundstimmung. Default: 'serene'. */
  mood?: Mood;
  /** Tageszeit. Default: 'day'. */
  timeOfDay?: TimeOfDay;
  /** Wetter. Default: 'clear'. */
  weather?: Weather;
}

/** Ergebnis der Schauplatz-Erzeugung. */
export interface AtmosphereResult {
  /** Der erzeugte Text. */
  text: string;
  /** Bediente Sinne. */
  senses: Sense[];
  /** Anzahl bedienter Sinne (Ziel: ≥ 4). */
  senseCount: number;
  /** Verwendete Stimmung. */
  mood: Mood;
  /** Wortzahl. */
  wordCount: number;
}

/** Sensorische Abdeckung eines vorhandenen Texts. */
export interface SensoryCoverage {
  /** Erkannte Sinne. */
  senses: Sense[];
  /** Anzahl erkannter Sinne. */
  senseCount: number;
  /** Fehlende Sinne. */
  missing: Sense[];
  /** true, wenn mindestens 4 Sinne bedient sind. */
  meetsTarget: boolean;
}

/** Optionen für die Übergangspassage. */
export interface TransitionOptions {
  /** Zeitsprung, z. B. „drei Tage später". */
  timeSkip?: string;
  /** Zielstimmung. */
  mood?: Mood;
  /** Ort der Folgeszene. */
  toLocation?: string;
}

// ---------------------------------------------------------------------------
// Deterministischer Zufall
// ---------------------------------------------------------------------------

/** FNV-1a-32-Hash einer Zeichenkette → deterministischer Seed. */
function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32-PRNG: schnell, deterministisch, Werte in [0, 1). */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

// ---------------------------------------------------------------------------
// Sensorische Bausteine je Stimmung
// ---------------------------------------------------------------------------

/** Textbausteine je Sinn und Stimmung. */
const SENSE_BANK: Record<Sense, Record<Mood, readonly string[]>> = {
  sight: {
    threatening: [
      'Schatten schnitten sich wie Klingen über den Boden',
      'Ein einzelnes Licht brannte zu hell und zu still',
      'Bewegung am Rand des Blickfelds, dann nichts',
    ],
    melancholic: [
      'Das Licht fiel grau und ohne Wärme durch die Scheiben',
      'Verblasste Farbe lag über allem wie ein alter Film',
      'Der Horizont verschwamm in einem Nichts aus Grau',
    ],
    sublime: [
      'Das Licht brach sich in tausend Scherben über dem Wasser',
      'Die Weite dehnte sich, bis der Blick sie nicht mehr fasste',
      'Ein Farbspiel, das keine Kamera je einfinge',
    ],
    claustrophobic: [
      'Die Wände standen näher, als sie gestern gestanden hatten',
      'Kein Fenster, nur das eine Viereck Licht',
      'Der Raum endete, wo er begann',
    ],
    serene: [
      'Das Licht lag weich auf den Dächern',
      'Ein gleichmäßiges Grün zog sich bis zum Fluss',
      'Nichts bewegte sich, und das war angenehm',
    ],
  },
  sound: {
    threatening: [
      'Ein Kratzen, das aufhörte, sobald man hinhörte',
      'Irgendwo fiel eine Tür ins Schloss',
      'Ein Ticken, das nicht von einer Uhr kam',
    ],
    melancholic: [
      'Regen trommelte in gleichgültigem Takt',
      'Ferngeräusche drangen dumpf durch die Wände',
      'Ein Radio spielte irgendwo ein Lied zu Ende',
    ],
    sublime: [
      'Der Wind trug einen tiefen Ton durch die Schlucht',
      'Ein fernes Grollen, das mehr im Brustkorb als im Ohr saß',
      'Stille, so vollständig, dass sie selbst ein Geräusch war',
    ],
    claustrophobic: [
      'Der eigene Atem war das lauteste Geräusch',
      'Ein Tropfen fiel in gleichmäßigem Takt',
      'Das Blut rauschte hörbar in den Ohren',
    ],
    serene: [
      'Vogelrufe hingen lose in der Luft',
      'Ein Bach sprach leise mit den Steinen',
      'Blätter raschelten, ohne dass jemand sie berührte',
    ],
  },
  smell: {
    threatening: [
      'Der Geruch von verbranntem Diesel hing in der Luft',
      'Etwas Rotes, Eisenhaltiges lag im Wind',
      'Rauch, der nicht von einem Feuer stammte',
    ],
    melancholic: [
      'Der Geruch von nassem Papier und altem Staub',
      'Kalter Rauch, längst verflogen',
      'Etwas nach Regen und Rost',
    ],
    sublime: [
      'Die Luft schmeckte nach Höhe und dünnem Eis',
      'Harz und Sonnenwärme und weite Wege',
      'Ein Duft, der älter war als der Wald',
    ],
    claustrophobic: [
      'Muffige Luft, die nicht wusste, wann sie zuletzt getauscht worden war',
      'Der Geruch von Schweiß und geschlossenem Raum',
      'Feuchter Putz und etwas Süßliches darunter',
    ],
    serene: [
      'Frisches Gras und warme Erde',
      'Etwas nach Heu und Spätsommer',
      'Der Duft von Regen, der noch nicht gefallen war',
    ],
  },
  taste: {
    threatening: [
      'Der Geschmack von Kupfer lag auf der Zunge',
      'Trockene Kehle, metallisch und eng',
      'Etwas Bitteres stieg aus dem Magen auf',
    ],
    melancholic: [
      'Der Nachgeschmack von kaltem Kaffee',
      'Salzig, ob vom Meer oder von etwas anderem',
      'Etwas Papierenes, Trockenes im Mund',
    ],
    sublime: [
      'Eiswasser und dünne Luft auf der Zunge',
      'Der Geschmack von Metall, das man lange hält',
      'Etwas Klares, fast Geschmackloses, das alles andere übertönte',
    ],
    claustrophobic: [
      'Der eigene Atem schmeckte flach und warm',
      'Bitter, wie zu lange gewartet',
      'Etwas Staubiges legte sich auf die Zunge',
    ],
    serene: [
      'Der Geschmack von Honig und kaltem Tee',
      'Etwas Süßes, kaum mehr als eine Ahnung',
      'Regenwasser, klar und ein wenig nach Stein',
    ],
  },
  touch: {
    threatening: [
      'Ein eisiger Wind pfiff durch die Ritzen',
      'Die Luft war kalt genug, um die Finger steif zu machen',
      'Etwas streifte die Schulter, und es war niemand da',
    ],
    melancholic: [
      'Die Kälte kroch durch den Mantel bis auf die Haut',
      'Feuchtigkeit legte sich auf die Wangen',
      'Der Boden war kalt durch die Schuhsohlen',
    ],
    sublime: [
      'Der Wind drückte gegen die Brust, als wollte er schieben',
      'Kälte und Wärme wechselten einander in Sekunden ab',
      'Gischt brannte kalt auf der Haut',
    ],
    claustrophobic: [
      'Die Luft stand warm und schwer im Raum',
      'Der Kragen saß zu eng am Hals',
      'Jede Bewegung stieß irgendwo an',
    ],
    serene: [
      'Sonne lag warm auf dem Handrücken',
      'Ein leichter Wind strich über die Stirn',
      'Weiches Moos gab unter den Sohlen nach',
    ],
  },
};

/** Stimmungs-Charakterisierung (erster Satz). */
const MOOD_OPENERS: Record<Mood, readonly string[]> = {
  threatening: [
    'Etwas an diesem Ort war falsch',
    'Der Ort wartete, und er wartete nicht freundlich',
    'Hierher kam man nicht zufällig',
  ],
  melancholic: [
    'Der Ort hatte schon bessere Tage gesehen',
    'Alles hier erinnerte an etwas, das nicht mehr da war',
    'Der Ort trug seine Vergangenheit offen',
  ],
  sublime: [
    'Der Ort machte den Menschen klein und das war richtig so',
    'Hier war die Welt größer als jeder Gedanke daran',
    'Der Ort brauchte keinen Betrachter, um zu wirken',
  ],
  claustrophobic: [
    'Der Ort hatte keine Tür, die man freiwillig benutzte',
    'Platz war hier kein Konzept, sondern ein Mangel',
    'Der Ort schloss sich hinter jedem Schritt ein Stück weiter',
  ],
  serene: [
    'Der Ort tat nichts und verlangte nichts',
    'Hier durfte man einfach stehen',
    'Der Ort war so, wie er war, und das genügte',
  ],
};

/** Tageszeit-Bausteine. */
const TIME_BAUSTEINE: Record<TimeOfDay, string> = {
  dawn: 'Die Dämmerung machte alles vorläufig',
  day: 'Der Tag stand hoch und offen',
  dusk: 'Das Licht zog sich zurück, wie es das immer tat',
  night: 'Die Nacht hatte den Ort übernommen',
};

/** Wetter-Bausteine. */
const WEATHER_BAUSTEINE: Record<Weather, string> = {
  clear: 'Kein Wölkchen trübte den Blick',
  rain: 'Der Regen fiel schräg und ohne Pause',
  fog: 'Der Nebel nahm die Konturen mit',
  storm: 'Der Sturm drückte gegen alles, was standhielt',
  snow: 'Schnee dämpfte jeden Schritt zu einem Flüstern',
  heat: 'Die Hitze stand im Raum wie eine unsichtbare Wand',
};

/** Sinn-Schlüsselwörter für die Erkennung in vorhandenem Text. */
const SENSE_KEYWORDS: Record<Sense, readonly string[]> = {
  sight: ['licht', 'schatten', 'farbe', 'blick', 'sah', 'grau', 'hell', 'dunkel', 'weit', 'wand'],
  sound: ['geräusch', 'hörte', 'ticken', 'regen', 'wind', 'stille', 'atmen', 'raschel', 'klang', 'ruf'],
  smell: ['geruch', 'duft', 'roch', 'rauch', 'luft', 'diesel', 'harz', 'muffig'],
  taste: ['geschmack', 'schmeckte', 'zunge', 'bitter', 'süß', 'salzig', 'metall', 'kehle'],
  touch: ['kalt', 'warm', 'wind', 'haut', 'berührte', 'feucht', 'weich', 'eisig', 'eng', 'drückte'],
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Stimmung defensiv prüfen. */
function normalizeMood(value: unknown): Mood {
  const moods: Mood[] = ['threatening', 'melancholic', 'sublime', 'claustrophobic', 'serene'];
  return typeof value === 'string' && (moods as string[]).includes(value) ? (value as Mood) : 'serene';
}

/** Tageszeit defensiv prüfen. */
function normalizeTime(value: unknown): TimeOfDay {
  const times: TimeOfDay[] = ['dawn', 'day', 'dusk', 'night'];
  return typeof value === 'string' && (times as string[]).includes(value) ? (value as TimeOfDay) : 'day';
}

/** Wetter defensiv prüfen. */
function normalizeWeather(value: unknown): Weather {
  const all: Weather[] = ['clear', 'rain', 'fog', 'storm', 'snow', 'heat'];
  return typeof value === 'string' && (all as string[]).includes(value) ? (value as Weather) : 'clear';
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Satzenden sicherstellen. */
function ensurePeriod(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** Alle fünf Sinne (feste Reihenfolge für deterministische Ausgabe). */
const ALL_SENSES: readonly Sense[] = ['sight', 'sound', 'smell', 'taste', 'touch'];

// ---------------------------------------------------------------------------
// 1) Schauplatz-Erzeugung
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen atmosphärischen Schauplatz-Einstieg.
 *
 * Erzwingt mindestens vier der fünf Sinne: es werden so lange Sinnesbausteine
 * ergänzt, bis das Ziel erreicht ist. Die Auswahl ist deterministisch aus
 * Ort + Stimmung + Tageszeit + Wetter abgeleitet.
 *
 * Defensiv: ungültige Eingaben fallen auf neutrale Werte zurück; ein leerer
 * Ort erzeugt dennoch einen stimmungsvollen Text.
 */
export function generateAtmosphere(input?: SceneInput | null): AtmosphereResult {
  const location =
    input && typeof input.location === 'string' && input.location.trim().length > 0
      ? input.location.trim()
      : 'Der Ort';
  const mood = normalizeMood(input?.mood);
  const timeOfDay = normalizeTime(input?.timeOfDay);
  const weather = normalizeWeather(input?.weather);

  const rand = createSeededRandom(hashString(`${location}#${mood}#${timeOfDay}#${weather}`));

  const sentences: string[] = [];
  const usedSenses = new Set<Sense>();

  // 1. Stimmungs-Einstieg mit Ortsbezug.
  sentences.push(ensurePeriod(`${location}. ${pick(MOOD_OPENERS[mood], rand)}`));

  // 2. Tageszeit und Wetter verankern.
  sentences.push(ensurePeriod(`${TIME_BAUSTEINE[timeOfDay]}, und ${WEATHER_BAUSTEINE[weather].charAt(0).toLowerCase()}${WEATHER_BAUSTEINE[weather].slice(1)}`));

  // 3. Sinne auffüllen, bis mindestens 4 bedient sind.
  const order = [...ALL_SENSES].sort(
    (a, b) => hashString(`${location}${a}`) - hashString(`${location}${b}`),
  );
  for (const sense of order) {
    if (usedSenses.size >= 4) break;
    sentences.push(ensurePeriod(pick(SENSE_BANK[sense][mood], rand)));
    usedSenses.add(sense);
  }

  // 4. Einen fünften Sinn ergänzen, wenn er sich anbietet (nicht erzwungen).
  const remaining = ALL_SENSES.filter((s) => !usedSenses.has(s));
  if (remaining.length > 0 && rand() < 0.6) {
    const extra = remaining[0];
    sentences.push(ensurePeriod(pick(SENSE_BANK[extra][mood], rand)));
    usedSenses.add(extra);
  }

  const text = sentences.join(' ');

  return {
    text,
    senses: ALL_SENSES.filter((s) => usedSenses.has(s)),
    senseCount: usedSenses.size,
    mood,
    wordCount: countWords(text),
  };
}

// ---------------------------------------------------------------------------
// 2) Sensorische Abdeckung
// ---------------------------------------------------------------------------

/**
 * Prüft, welche der fünf Sinne ein Text bedient.
 *
 * `meetsTarget` ist true, sobald mindestens vier Sinne gefunden wurden.
 * Defensiv: leerer Text liefert leere Abdeckung.
 */
export function checkSensoryCoverage(text: unknown): SensoryCoverage {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { senses: [], senseCount: 0, missing: [...ALL_SENSES], meetsTarget: false };
  }

  const lower = text.toLowerCase();
  const senses = ALL_SENSES.filter((sense) =>
    SENSE_KEYWORDS[sense].some((kw) => lower.includes(kw)),
  );
  const missing = ALL_SENSES.filter((s) => !senses.includes(s));

  return {
    senses: [...senses],
    senseCount: senses.length,
    missing,
    meetsTarget: senses.length >= 4,
  };
}

// ---------------------------------------------------------------------------
// 3) Übergangs-Generator
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine stimmungsvolle Übergangspassage.
 *
 * Nutzt den Zeitsprung, wenn angegeben, und bindet die Zielstimmung sowie den
 * Zielort ein. Defensiv: ohne Angaben entsteht ein neutraler Übergang.
 */
export function generateTransition(options?: TransitionOptions | null): string {
  const mood = normalizeMood(options?.mood);
  const timeSkip =
    options && typeof options.timeSkip === 'string' && options.timeSkip.trim().length > 0
      ? options.timeSkip.trim()
      : '';
  const toLocation =
    options && typeof options.toLocation === 'string' && options.toLocation.trim().length > 0
      ? options.toLocation.trim()
      : '';

  const rand = createSeededRandom(hashString(`${timeSkip}#${mood}#${toLocation}`));

  const parts: string[] = [];

  // Zeitsprung als Brücke (Originaltext unverändert übernehmen).
  if (timeSkip) {
    parts.push(ensurePeriod(timeSkip));
  } else {
    parts.push(ensurePeriod(pick(
      ['Die Szene wechselte', 'Ein Schnitt, und die Welt war eine andere', 'Der Übergang kam ohne Vorwarnung'],
      rand,
    )));
  }

  // Stimmungsanker.
  parts.push(ensurePeriod(pick(MOOD_OPENERS[mood], rand)));

  // Zielort einbinden.
  if (toLocation) {
    parts.push(ensurePeriod(`${toLocation} lag vor ihm, als wäre es nie anders gewesen`));
  }

  // Ein Sinnesanker macht den Übergang greifbar.
  parts.push(ensurePeriod(pick(SENSE_BANK.touch[mood], rand)));

  return parts.join(' ');
}
