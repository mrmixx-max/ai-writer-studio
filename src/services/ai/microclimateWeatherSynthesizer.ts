// Mikroklima- & Sensorik-Wetter-Synthesizer (WP 65.1)
//
// Wetter in großen Romanen ist kein Zufall, sondern seelischer Spiegel und
// physisches Hindernis: lähmende Schwüle vor dem Mord, salziger Küstennebel,
// der in den Lungen brennt.
//
// Drei deterministische Werkzeuge:
//
//   1. synthesizeMicroclimate — 6 extreme Lagen → multisensorische Prosa
//   2. analyzeBarometricPressure — Druck & Körperempfinden
//   3. embedScene — nahtlose Szenen-Einbettung mit allen 5 Sinnen
//
// Design-Regeln (analog atmosphereProseGenerator / doubleEntendreSynthesizer):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Extreme Wetter-Lage. */
export type MicroclimateType =
  | 'swamp-mist'
  | 'thin-air'
  | 'catacomb-heat'
  | 'coastal-fog'
  | 'desert-scorch'
  | 'arctic-wind';

/** Sensorische Modalität. */
export type Sense = 'sight' | 'sound' | 'smell' | 'taste' | 'touch';

/** Sensorischer Eindruck. */
export interface SensoryImpression {
  /** Modalität. */
  sense: Sense;
  /** Beschreibung. */
  description: string;
}

/** Ergebnis der Mikroklima-Synthese. */
export interface MicroclimateScene {
  /** Verwendete Lage. */
  type: MicroclimateType;
  /** Menschenlesbarer Lagen-Name. */
  label: string;
  /** Multisensorische Eindrücke. */
  impressions: SensoryImpression[];
  /** Formatierter Umgebungs-Absatz. */
  prose: string;
  /** Anzahl der aktiven Sinne. */
  senseCount: number;
  /** Barometrischer Druck in hPa. */
  pressureHpa: number;
  /** Körperempfinden. */
  bodyFeeling: string;
}

/** Ergebnis der Druck-Analyse. */
export interface PressureAnalysis {
  /** Druck in hPa. */
  pressureHpa: number;
  /** Kategorie. */
  category: 'low' | 'normal' | 'high';
  /** Körperempfinden. */
  bodyFeeling: string;
  /** Vorahnung. */
  foreboding: string;
}

// ---------------------------------------------------------------------------
// Lagen-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Lagen-Namen. */
export const CLIMATE_LABELS: Record<MicroclimateType, string> = {
  'swamp-mist': 'Sumpfschleier mit Faulgasen',
  'thin-air': 'Dünne Höhenluft mit Herzklopfen',
  'catacomb-heat': 'Stickige Katakombenhitze',
  'coastal-fog': 'Salziger Küstennebel',
  'desert-scorch': 'Wüstenglut mit Spiegelungen',
  'arctic-wind': 'Eisiger Polwind mit Schneegestöber',
};

/** Sensorische Eindrücke je Lage. */
const CLIMATE_IMPRESSIONS: Record<MicroclimateType, readonly SensoryImpression[]> = {
  'swamp-mist': [
    { sense: 'sight', description: 'Graugrüne Schwaden, die knapp über dem Wasser hängen' },
    { sense: 'sound', description: 'Das Plätschern von etwas, das sich unter der Oberfläche bewegt' },
    { sense: 'smell', description: 'Verrottetes Schilf und süßlicher Fauldampf' },
    { sense: 'taste', description: 'Ein metallischer Beigeschmack im Rachen' },
    { sense: 'touch', description: 'Klebrige Feuchtigkeit auf der Haut, die nicht abtrocknet' },
  ],
  'thin-air': [
    { sense: 'sight', description: 'Verschwommene Konturen, als sähe man durch Wasser' },
    { sense: 'sound', description: 'Die eigene Atmung, zu laut, zu schnell' },
    { sense: 'smell', description: 'Kalter, duchdringender Geruch von Schiefer' },
    { sense: 'taste', description: 'Trockenheit im Mund, als hätte man Staub geschluckt' },
    { sense: 'touch', description: 'Kribbeln in den Fingerspitzen, Herzklopfen in den Schläfen' },
  ],
  'catacomb-heat': [
    { sense: 'sight', description: 'Flackernde Fackelwindungen, die Schatten an die Wände werfen' },
    { sense: 'sound', description: 'Das Echo von Schritten, die nicht die eigenen sind' },
    { sense: 'smell', description: 'Staub, altes Holz und etwas Süßliches, das nicht gut ist' },
    { sense: 'taste', description: 'Schweiß, der die Lippen salzig macht' },
    { sense: 'touch', description: 'Drückende Hitze, die den Atem raubt' },
  ],
  'coastal-fog': [
    { sense: 'sight', description: 'Alles in Grautöne getaucht, Sichtweite zehn Schritte' },
    { sense: 'sound', description: 'Das Rauschen der Wellen, gedämpft wie durch Watte' },
    { sense: 'smell', description: 'Salz, Tang und der scharfe Geruch von Jod' },
    { sense: 'taste', description: 'Salz auf den Lippen, der Geschmack von Tränen' },
    { sense: 'touch', description: 'Feuchte Kälte, die in die Knochen kriecht' },
  ],
  'desert-scorch': [
    { sense: 'sight', description: 'Hitzeflimmern über dem Sand, Spiegelungen in der Ferne' },
    { sense: 'sound', description: 'Die Stille, die lauter ist als jeder Lärm' },
    { sense: 'smell', description: 'Heißer Staub und das scharfe Aroma von Sonnenbrand' },
    { sense: 'taste', description: 'Sand zwischen den Zähnen, trockener als Staub' },
    { sense: 'touch', description: 'Brennende Hitze auf der Haut, die sofort verdunstet' },
  ],
  'arctic-wind': [
    { sense: 'sight', description: 'Schneegestöber, das die Welt in Weiß hüllt' },
    { sense: 'sound', description: 'Das Heulen des Windes, das alles andere verschluckt' },
    { sense: 'smell', description: 'Kalter, metallischer Geruch von Schnee und Eis' },
    { sense: 'taste', description: 'Eisige Kälte im Mund, als kaue man Schnee' },
    { sense: 'touch', description: 'Brennende Kälte in den Fingern, Taubheit in den Zehen' },
  ],
};

/** Körperempfinden je Lage. */
const BODY_FEELINGS: Record<MicroclimateType, string> = {
  'swamp-mist': 'Lähmende Schwüle, die jeden Atemzug zur Anstrengung macht',
  'thin-air': 'Herzklopfen in den Schläfen, als würde der Körper warnen',
  'catacomb-heat': 'Drückende Enge, die den Atem wie eine Hand um den Hals legt',
  'coastal-fog': 'Feuchte Kälte, die in die Gelenke kriecht und nicht mehr weicht',
  'desert-scorch': 'Brennende Erschöpfung, die jeden Schritt zur Qual macht',
  'arctic-wind': 'Brennende Kälte, die die Sinne betäubt und die Welt verblasst',
};

/** Barometrischer Druck je Lage (hPa). */
const PRESSURE_MAP: Record<MicroclimateType, number> = {
  'swamp-mist': 980,
  'thin-air': 650,
  'catacomb-heat': 1010,
  'coastal-fog': 1005,
  'desert-scorch': 1020,
  'arctic-wind': 990,
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Lage defensiv prüfen. */
function normalizeClimate(value: unknown): MicroclimateType {
  const all: MicroclimateType[] = [
    'swamp-mist',
    'thin-air',
    'catacomb-heat',
    'coastal-fog',
    'desert-scorch',
    'arctic-wind',
  ];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as MicroclimateType)
    : 'swamp-mist';
}

// ---------------------------------------------------------------------------
// 1) Mikroklima-Synthese
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine multisensorische Umgebungs-Szene für eine extreme Wetter-Lage.
 *
 * Defensiv: ohne Angaben wird die Standard-Lage (Sumpfschleier) verwendet.
 */
export function synthesizeMicroclimate(
  type?: MicroclimateType | null,
): MicroclimateScene {
  const climate = normalizeClimate(type);
  const impressions = [...CLIMATE_IMPRESSIONS[climate]];
  const senseCount = impressions.length;

  const prose = impressions
    .map((imp) => imp.description)
    .join('. ');

  return {
    type: climate,
    label: CLIMATE_LABELS[climate],
    impressions,
    prose: `${prose}.`,
    senseCount,
    pressureHpa: PRESSURE_MAP[climate],
    bodyFeeling: BODY_FEELINGS[climate],
  };
}

// ---------------------------------------------------------------------------
// 2) Barometrische Druck-Analyse
// ---------------------------------------------------------------------------

/**
 * Verknüpft den barometrischen Druck mit Körperempfinden und Vorahnung.
 *
 * Defensiv: ohne Angaben wird Normaldruck (1013 hPa) angenommen.
 */
export function analyzeBarometricPressure(
  pressureHpa?: number | null,
  climate?: MicroclimateType | null,
): PressureAnalysis {
  const pressure = typeof pressureHpa === 'number' && Number.isFinite(pressureHpa)
    ? pressureHpa
    : PRESSURE_MAP[normalizeClimate(climate)];

  const category: PressureAnalysis['category'] =
    pressure < 990 ? 'low' : pressure > 1015 ? 'high' : 'normal';

  const bodyFeeling =
    category === 'low'
      ? 'Pochende Schläfen, gereizte Nerven, ein Druck in der Brust'
      : category === 'high'
        ? 'Schwere in den Gliedern, als würde die Luft drücken'
        : 'Ausgewogenes Körperempfinden, keine Auffälligkeiten';

  const foreboding =
    category === 'low'
      ? 'Der fallende Druck kündigt Sturm oder Katastrophe an'
      : category === 'high'
        ? 'Der hohe Druck verspricht Stille — und Stille kann tödlich sein'
        : 'Der Druck ist stabil, aber das kann sich jederzeit ändern';

  return { pressureHpa: pressure, category, bodyFeeling, foreboding };
}

// ---------------------------------------------------------------------------
// 3) Szenen-Einbettung
// ---------------------------------------------------------------------------

/**
 * Bettet eine Umgebungs-Szene nahtlos in einen bestehenden Text ein.
 *
 * Defensiv: ohne Text wird nur die Umgebungs-Szene zurückgegeben.
 */
export function embedScene(
  scene: MicroclimateScene | null | undefined,
  existingText?: string | null,
): string {
  if (!scene || typeof scene.prose !== 'string' || scene.prose.length === 0) {
    return '';
  }

  const text = typeof existingText === 'string' && existingText.trim().length > 0
    ? existingText.trim()
    : '';

  if (!text) {
    return scene.prose;
  }

  return `${text}\n\n${scene.prose}`;
}
