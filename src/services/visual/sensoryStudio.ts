// Sensorisches Szenen- & Moodboard-Studio (WP 23.1).
// Lokal, kein LLM nötig, deterministisch.
//
// Aus einer Szenen-/Schauplatzbeschreibung werden drei Dinge abgeleitet:
//   1. generateSensoryCompass  -> konkrete Anker für Geruch, Licht, Haptik + Temperatur
//   2. extractColorPalette     -> harmonisches Hex-Farbschema aus dem Schauplatz
//   3. generateMoodboard       -> visuelle Referenzen (Farben + Sensorik + Keywords)
//
// Alle Ableitungen sind rein regelbasiert (Keyword-Profile + HSL-Farbharmonie),
// damit identische Eingaben immer identische Ergebnisse liefern. Fehlende oder
// unbrauchbare Eingaben fallen auf einen neutralen Standard zurück.

export interface SensoryCompass {
  smell: string[];
  light: string[];
  haptik: string[];
  temperature: string;
}

export interface ColorPalette {
  primary: string[];
  secondary: string[];
  accent: string[];
}

export interface Moodboard {
  colors: ColorPalette;
  sensory: SensoryCompass;
  keywords: string[];
}

/** Obergrenzen, damit die Ausgabe bei langen Texten nicht ausufert. */
const MAX_SMELL = 6;
const MAX_LIGHT = 5;
const MAX_HAPTIKS = 6;
const MAX_KEYWORDS = 12;

interface SettingProfile {
  id: string;
  /** Anzeigename für Keywords/Moodboard. */
  label: string;
  /** Wortstämme; Treffer am Wortanfang (auch in Komposita wie "Waldrand"). */
  keywords: string[];
  smell: string[];
  light: string[];
  haptik: string[];
  temperature: string;
  /** Basiston (0–360), Sättigung und Helligkeit (0–100) für die Palette. */
  hue: number;
  saturation: number;
  lightness: number;
}

// Reihenfolge = Priorität: spezifischere Schauplätze zuerst, generische zuletzt.
const SETTING_PROFILES: SettingProfile[] = [
  {
    id: "krankenhaus",
    label: "Krankenhaus",
    keywords: ["krankenhaus", "klinik", "op-saal", "intensivstation", "station"],
    smell: ["Desinfektionsmittel", "sterile, kalte Luft", "schwacher Hauch von Latex"],
    light: ["grelles Neonlicht ohne Schatten", "blasses, klinisch weißes Licht", "flackernde Leuchtstoffröhren"],
    haptik: ["kühles Metall der Liege", "raue Papierlaken", "gummiartiger Handschuh an der Haut"],
    temperature: "kühl und steril",
    hue: 170,
    saturation: 24,
    lightness: 62,
  },
  {
    id: "kirche",
    label: "Kirche",
    keywords: ["kirche", "kapelle", "dom", "kathedrale", "altar"],
    smell: ["Weihrauch", "kaltes Wachs", "alter, feuchter Stein"],
    light: ["buntes Licht aus Glasfenstern", "dämmrige Stille zwischen Kerzen", "ein schmaler Lichtstrahl im Halbdunkel"],
    haptik: ["glatt poliertes Kirchengestühl", "kaltes Gestein der Säulen", "rauer Stoff des Beichtvorhangs"],
    temperature: "kühl und still",
    hue: 268,
    saturation: 38,
    lightness: 44,
  },
  {
    id: "keller",
    label: "Keller",
    keywords: ["keller", "gewölbe", "bunker", "verlies", "gruft"],
    smell: ["Moder", "feuchter Stein", "abgestandene Luft"],
    light: ["spärliches Licht einer nackten Glühbirne", "flackernde Schatten an den Wänden", "kaum Licht, nur Konturen"],
    haptik: ["klamme Kälte der Mauern", "Spinnweben im Gesicht", "rutschiger Boden unter den Sohlen"],
    temperature: "kalt und klamm",
    hue: 25,
    saturation: 30,
    lightness: 26,
  },
  {
    id: "bibliothek",
    label: "Bibliothek",
    keywords: ["bibliothek", "archiv", "lesesaal", "bücherregal", "antiquariat"],
    smell: ["altes Papier", "Leder und Staub", "schwacher Klebstoffgeruch"],
    light: ["warmes, gedämpftes Leselicht", "Staub im schrägen Sonnenstrahl", "kleine Lichtinseln auf den Tischen"],
    haptik: ["raues Papier", "glatter Ledereinband", "körniger Buchrücken"],
    temperature: "ruhig und leicht kühl",
    hue: 35,
    saturation: 42,
    lightness: 48,
  },
  {
    id: "bar",
    label: "Bar",
    keywords: ["bar", "kneipe", "pub", "taverne", "tresen"],
    smell: ["Alkohol", "kaltes Bier", "abgestandener Rauch"],
    light: ["dämmriges warmes Licht", "Neonreklame an der Wand", "Lichtsplitter auf Flaschen"],
    haptik: ["klebriger Tresen", "kaltes Glas in der Hand", "abgewetztes Lederpolster"],
    temperature: "warm und stickig",
    hue: 14,
    saturation: 55,
    lightness: 40,
  },
  {
    id: "kueche",
    label: "Küche",
    keywords: ["küche", "kueche", "herd", "koch", "backstube"],
    smell: ["Gewürze", "geröstete Zwiebeln", "frischer Kaffee"],
    light: ["warmes Licht über der Arbeitsfläche", "Dampf im Lampenschein", "goldener Schein des Ofens"],
    haptik: ["warmes Porzellan", "klebrige Arbeitsfläche", "rauer Topfgriff"],
    temperature: "warm und würzig",
    hue: 28,
    saturation: 60,
    lightness: 52,
  },
  {
    id: "wald",
    label: "Wald",
    keywords: ["wald", "forst", "lichtung", "unterholz", "baum", "tanne"],
    smell: ["Moos", "Harz", "feuchte Erde"],
    light: ["gedämpftes grünes Licht", "Lichtflecken durch das Blätterdach", "lange Schatten zwischen Stämmen"],
    haptik: ["raue Rinde", "weicher Waldboden", "kühle Blätter im Nacken"],
    temperature: "kühl und feucht",
    hue: 112,
    saturation: 34,
    lightness: 38,
  },
  {
    id: "meer",
    label: "Meer",
    keywords: ["meer", "ozean", "strand", "küste", "kueste", "hafen", "brandung", "seeufer"],
    smell: ["Salz", "Tang", "feuchter Wind"],
    light: ["gleißendes Sonnenlicht auf dem Wasser", "silbrige Spiegelung der Wellen", "weites, offenes Licht"],
    haptik: ["feiner Sand", "salzige, feuchte Luft", "kühle Gischt auf der Haut"],
    temperature: "warm und salzig",
    hue: 196,
    saturation: 48,
    lightness: 52,
  },
  {
    id: "wueste",
    label: "Wüste",
    keywords: ["wüste", "wueste", "düne", "duene", "oase", "steppe"],
    smell: ["trockener Staub", "heiße Luft", "ferner Rauch"],
    light: ["grelles, flimmerndes Licht", "harte Schatten ohne Übergang", "blendende Helligkeit am Horizont"],
    haptik: ["feiner heißer Sand", "rissige Haut", "ausgedörrter Stoff"],
    temperature: "heiß und trocken",
    hue: 40,
    saturation: 58,
    lightness: 60,
  },
  {
    id: "berg",
    label: "Berge",
    keywords: ["berg", "gipfel", "alpen", "schlucht", "fels"],
    smell: ["dünne, klare Höhenluft", "kalter Fels", "fernes Gras"],
    light: ["grelles, hartes Höhenlicht", "weite Fernsicht in Blau", "scharfe Schatten im Geröll"],
    haptik: ["rauer Fels", "scharfer Wind im Gesicht", "kiesiger Pfad"],
    temperature: "kalt und klar",
    hue: 214,
    saturation: 30,
    lightness: 56,
  },
  {
    id: "garten",
    label: "Garten",
    keywords: ["garten", "park", "wiese", "blumen", "gewächshaus", "gewaechshaus"],
    smell: ["feuchtes Gras", "Blüten", "Erde nach dem Gießen"],
    light: ["weiches Tageslicht", "Sonne durch Laub", "warme Abendstimmung"],
    haptik: ["weicher Rasen", "rauer Blütenstängel", "feuchte Erde an den Fingern"],
    temperature: "mild und feucht",
    hue: 96,
    saturation: 44,
    lightness: 50,
  },
  {
    id: "sommer",
    label: "Sommer",
    keywords: ["sommer", "hitze", "sonnenbrand", "grill", "urlaub", "badetag"],
    smell: ["Sonnencreme", "Heu", "Grillrauch"],
    light: ["grelles, warmes Licht", "flirrende Hitze über dem Boden", "lange, goldene Abendstunden"],
    haptik: ["heiße Haut", "klebriger Schweiß", "warmer Wind"],
    temperature: "heiß und schwül",
    hue: 46,
    saturation: 66,
    lightness: 58,
  },
  {
    id: "winter",
    label: "Winter",
    keywords: ["winter", "schnee", "frost", "eis", "schneesturm"],
    smell: ["klare, beißende Kälte", "Rauch aus Kaminen", "schneefreie, trockene Luft"],
    light: ["grelles, weißes Streulicht", "bläulicher Schatten auf Schnee", "flache, fahle Wintersonne"],
    haptik: ["knirschender Schnee", "beißen der Kälte an den Fingern", "steifer, gefrorener Stoff"],
    temperature: "eiskalt",
    hue: 202,
    saturation: 28,
    lightness: 72,
  },
  {
    id: "regen",
    label: "Regen",
    keywords: ["regen", "gewitter", "schauer", "nass", "pfütze", "pfuetze"],
    smell: ["Petrichor", "nasse Erde", "feuchter Asphalt"],
    light: ["graues, diffuses Licht", "verschwommene Konturen im Dunst", "kalte Reflexe in Pfützen"],
    haptik: ["durchnässter Stoff", "Tropfen im Nacken", "rutschiges Pflaster"],
    temperature: "kühl und feucht",
    hue: 206,
    saturation: 22,
    lightness: 44,
  },
  {
    id: "nacht",
    label: "Nacht",
    keywords: ["nacht", "mitternacht", "dunkelheit", "mond", "stern"],
    smell: ["kühle Nachtluft", "ferner Rauch", "nasses Gras"],
    light: ["fahles Mondlicht", "Neonreste am Horizont", "tiefe Schatten, kaum Konturen"],
    haptik: ["Gänsehaut", "kühler Wind", "feuchter Boden"],
    temperature: "kalt",
    hue: 250,
    saturation: 32,
    lightness: 34,
  },
  {
    id: "stadt",
    label: "Stadt",
    keywords: ["stadt", "straße", "strasse", "gasse", "kreuzung", "metro", "u-bahn", "hochhaus"],
    smell: ["Abgase", "heißer Asphalt", "frittiertes Essen vom Imbiss"],
    light: ["Neon und Leuchtreklamen", "gelbe Laternenkreise", "Licht aus erleuchteten Fenstern"],
    haptik: ["rauer Beton", "glatte Glasfront", "rüttelndes Metall der Bahn"],
    temperature: "warm und stickig",
    hue: 222,
    saturation: 26,
    lightness: 46,
  },
  {
    id: "buero",
    label: "Büro",
    keywords: ["büro", "buero", "konferenz", "großraum", "grossraum", "schreibtisch"],
    smell: ["Kaffee", "Papier", "warmes Plastik der Geräte"],
    light: ["gleichmäßiges Neonlicht", "kaltes Bildschirmleuchten", "Licht durch Jalousien"],
    haptik: ["glatte Tastatur", "kühler Schreibtisch", "rauer Teppichboden"],
    temperature: "klimatisiert und trocken",
    hue: 210,
    saturation: 20,
    lightness: 54,
  },
];

/** Neutraler Fallback, wenn nichts erkannt wird oder die Eingabe leer ist. */
const DEFAULT_PROFILE: SettingProfile = {
  id: "neutral",
  label: "Neutral",
  keywords: [],
  smell: ["neutrale Raumluft", "schwacher Staubgeruch", "kaum wahrnehmbarer Eigengeruch"],
  light: ["gleichmäßiges, weiches Licht", "keine harten Schatten", "gedämpfte Helligkeit"],
  haptik: ["glatte, kühle Oberflächen", "leichter Luftzug", "neutraler Untergrund"],
  temperature: "unbestimmt, mild",
  hue: 210,
  saturation: 12,
  lightness: 52,
};

const DEFAULT_COMPASS: SensoryCompass = {
  smell: [...DEFAULT_PROFILE.smell],
  light: [...DEFAULT_PROFILE.light],
  haptik: [...DEFAULT_PROFILE.haptik],
  temperature: DEFAULT_PROFILE.temperature,
};

const DEFAULT_PALETTE: ColorPalette = buildPalette(DEFAULT_PROFILE);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Treffer am Wortanfang (deckt Komposita wie "Waldrand" mit ab). */
function matchKeyword(text: string, keyword: string): boolean {
  if (!keyword) return false;
  const re = new RegExp(`(^|[^a-zäöüß0-9])${escapeRegExp(keyword)}`, "i");
  return re.test(text);
}

/** Normalisiert die Eingabe defensiv auf einen sicheren, kleingeschriebenen String. */
function normalizeInput(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().toLowerCase();
}

/** Alle passenden Profile in Prioritätsreihenfolge. */
function matchProfiles(text: string): SettingProfile[] {
  if (!text) return [];
  return SETTING_PROFILES.filter((profile) =>
    profile.keywords.some((keyword) => matchKeyword(text, keyword)),
  );
}

function unionLimited(lists: string[][], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of lists) {
    for (const entry of list) {
      if (!entry || seen.has(entry)) continue;
      seen.add(entry);
      result.push(entry);
      if (result.length >= limit) return result;
    }
  }
  return result;
}

/**
 * Sensorischer Kompass für eine Szene.
 * Erkennt Schauplätze anhand von Schlüsselwörtern und mischt deren Anker;
 * ohne Treffer greift der neutrale Standard.
 */
export function generateSensoryCompass(sceneDescription: string): SensoryCompass {
  const text = normalizeInput(sceneDescription);
  const profiles = matchProfiles(text);

  if (profiles.length === 0) {
    return {
      smell: [...DEFAULT_COMPASS.smell],
      light: [...DEFAULT_COMPASS.light],
      haptik: [...DEFAULT_COMPASS.haptik],
      temperature: DEFAULT_COMPASS.temperature,
    };
  }

  const smell = unionLimited(profiles.map((p) => p.smell), MAX_SMELL);
  const light = unionLimited(profiles.map((p) => p.light), MAX_LIGHT);
  const haptik = unionLimited(profiles.map((p) => p.haptik), MAX_HAPTIKS);

  // Temperatur des spezifischsten Treffers (erste Priorität).
  const temperature = profiles[0].temperature;

  return {
    smell: smell.length > 0 ? smell : [...DEFAULT_COMPASS.smell],
    light: light.length > 0 ? light : [...DEFAULT_COMPASS.light],
    haptik: haptik.length > 0 ? haptik : [...DEFAULT_COMPASS.haptik],
    temperature: temperature || DEFAULT_COMPASS.temperature,
  };
}

/** HSL -> #rrggbb (kanonisch, deterministisch). */
function hslToHex(hue: number, saturation: number, lightness: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = clamp(saturation, 0, 100) / 100;
  const l = clamp(lightness, 0, 100) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Baut eine harmonische Palette aus einem Profil:
 * primary = Basiston in drei Helligkeiten,
 * secondary = analoger Nachbarton (+40°),
 * accent = Komplementärkontrast (+180°) für Blickfänge.
 */
function buildPalette(profile: SettingProfile): ColorPalette {
  const { hue, saturation, lightness } = profile;
  const sat = clamp(saturation, 8, 80);

  const shade = (offsetHue: number, offsetLight: number, satScale = 1): string =>
    hslToHex(hue + offsetHue, clamp(sat * satScale, 5, 90), clamp(lightness + offsetLight, 8, 92));

  return {
    primary: [shade(0, -20), shade(0, 0), shade(0, 18)],
    secondary: [shade(40, -18), shade(40, 2), shade(40, 20)],
    accent: [shade(180, -6, 1.1), shade(180, 14, 1.1), shade(210, 8, 0.95)],
  };
}

/**
 * Harmonisches Hex-Farbschema aus einer Schauplatzbeschreibung.
 * Nutzt das spezifischste passende Profil; sonst die neutrale Palette.
 */
export function extractColorPalette(sceneDescription: string): ColorPalette {
  const text = normalizeInput(sceneDescription);
  const profiles = matchProfiles(text);

  if (profiles.length === 0) {
    return clonePalette(DEFAULT_PALETTE);
  }

  // Erster Treffer = spezifischster Schauplatz. Sekundärton des zweiten
  // Treffers fließt als leichte Nuance ein, damit Mischszenen nicht identisch
  // zur Einzelszene wirken — bleibt aber deterministisch.
  const base = buildPalette(profiles[0]);
  if (profiles.length === 1) {
    return base;
  }

  const second = profiles[1];
  const blend = hslToHex(second.hue, clamp(second.saturation, 8, 80), clamp(second.lightness, 20, 80));
  return {
    primary: base.primary,
    secondary: [base.secondary[0], base.secondary[1], blend],
    accent: base.accent,
  };
}

function clonePalette(palette: ColorPalette): ColorPalette {
  return {
    primary: [...palette.primary],
    secondary: [...palette.secondary],
    accent: [...palette.accent],
  };
}

const STOPWORDS = new Set<string>([
  "aber", "alle", "allem", "allen", "aller", "alles", "also", "andere", "anderen", "auch",
  "auf", "aus", "bei", "beim", "bin", "bis", "bist", "dann", "das", "dass", "dem", "den",
  "denn", "der", "des", "dessen", "dich", "die", "dies", "diese", "diesem", "diesen",
  "dieser", "dieses", "doch", "dort", "durch", "ein", "eine", "einem", "einen", "einer",
  "eines", "etwas", "für", "fuer", "gegen", "gewesen", "hat", "hatte", "haben", "hier",
  "hin", "hinter", "ich", "ihm", "ihn", "ihnen", "ihr", "ihre", "im", "in", "indem",
  "ins", "ist", "jede", "jedem", "jeden", "jeder", "jedes", "jener", "jetzt", "kann",
  "kein", "keine", "mit", "muss", "nach", "nicht", "nichts", "noch", "nun", "nur", "ob",
  "oder", "ohne", "sehr", "sein", "seine", "seinem", "seinen", "seiner", "seit", "sich",
  "sie", "sind", "so", "solche", "soll", "um", "und", "uns", "unter", "vom", "von", "vor",
  "war", "waren", "was", "weil", "welche", "wenn", "wer", "werden", "wie", "wieder",
  "will", "wir", "wird", "wo", "wohl", "zu", "zum", "zur", "über", "ueber", "am", "an",
]);

/** Zerlegt die Beschreibung in aussagekräftige, deduplizierte Keywords. */
function extractKeywords(text: string, profiles: SettingProfile[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  // Erkannte Schauplätze zuerst (visuelle Leitbegriffe).
  for (const profile of profiles) {
    if (profile.id === "neutral") continue;
    if (seen.has(profile.id)) continue;
    seen.add(profile.id);
    result.push(profile.id);
    if (result.length >= MAX_KEYWORDS) return result;
  }

  // Dann inhaltstragende Wörter aus dem Text.
  const tokens = text
    .replace(/[^a-zäöüß0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);

  for (const token of tokens) {
    if (token.length < 4) continue;
    if (STOPWORDS.has(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    result.push(token);
    if (result.length >= MAX_KEYWORDS) break;
  }

  return result;
}

/**
 * Moodboard: pinnt Farben, Sensorik und visuelle Keywords an ein Kapitel.
 * Fasst die beiden anderen Ableitungen zusammen.
 */
export function generateMoodboard(sceneDescription: string): Moodboard {
  const text = normalizeInput(sceneDescription);
  const profiles = matchProfiles(text);

  return {
    colors: extractColorPalette(sceneDescription),
    sensory: generateSensoryCompass(sceneDescription),
    keywords: extractKeywords(text, profiles),
  };
}
