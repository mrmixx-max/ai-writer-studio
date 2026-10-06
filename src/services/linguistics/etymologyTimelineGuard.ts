// EtymologyTimelineGuard (WP 76.2)
//
// Prüft historische Texte auf anachronistische Begriffe und schlägt
// zeitgenössische Alternativen vor. Deterministisch: FNV-1a + mulberry32.
// Keine Node-Module.

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

/** Historische Epoche. */
export type Epoch = "medieval" | "renaissance" | "baroque" | "enlightenment" | "victorian" | "1920s";

/** Ein anachronistischer Begriff. */
export interface Anachronism {
  word: string;
  firstAttested: number;
  epoch: Epoch;
  suggestion: string;
}

/** Ein Epochen-Label. */
export const EPOCH_LABELS: Record<Epoch, string> = {
  medieval: "Mittelalter (500-1500)",
  renaissance: "Renaissance (1400-1600)",
  baroque: "Barock (1600-1750)",
  enlightenment: "Aufklärung (1700-1800)",
  victorian: "Viktorianisch (1837-1901)",
  "1920s": "1920er Jahre (1920-1929)",
};

/** Anachronismen-Datenbank. */
export const ANACHRONISMS: Anachronism[] = [
  { word: "sabotage", firstAttested: 1910, epoch: "medieval", suggestion: "Sabotage (frühestens 19. Jh.)" },
  { word: "nervenzusammenbruch", firstAttested: 1860, epoch: "medieval", suggestion: "Erschöpfung, Krankheit" },
  { word: "telefon", firstAttested: 1876, epoch: "medieval", suggestion: "Brief, Bote" },
  { word: "auto", firstAttested: 1886, epoch: "medieval", suggestion: "Wagen, Kutsche" },
  { word: "computer", firstAttested: 1940, epoch: "medieval", suggestion: "Rechenmeister" },
  { word: "demokratie", firstAttested: 1700, epoch: "medieval", suggestion: "Ratsversammlung" },
  { word: "industrie", firstAttested: 1750, epoch: "medieval", suggestion: "Handwerk" },
  { word: "proletariat", firstAttested: 1840, epoch: "medieval", suggestion: "Gesinde, Leibeigene" },
  { word: "kapitalismus", firstAttested: 1850, epoch: "medieval", suggestion: "Handel, Tausch" },
  { word: "sozialismus", firstAttested: 1830, epoch: "medieval", suggestion: "Gemeinschaft" },
  { word: "bürger", firstAttested: 1200, epoch: "medieval", suggestion: "Bürger (städtisch)" },
  { word: "revolution", firstAttested: 1400, epoch: "medieval", suggestion: "Aufruhr, Empörung" },
  { word: "nation", firstAttested: 1600, epoch: "medieval", suggestion: "Volk, Stamm" },
  { word: "grenze", firstAttested: 1200, epoch: "medieval", suggestion: "Mark, Grenzstein" },
  { word: "post", firstAttested: 1500, epoch: "medieval", suggestion: "Bote, Kurier" },
  { word: "zeitung", firstAttested: 1600, epoch: "medieval", suggestion: "Flugblatt, Zettel" },
  { word: "roman", firstAttested: 1600, epoch: "medieval", suggestion: "Märchen, Sage" },
  { word: "theater", firstAttested: 1500, epoch: "medieval", suggestion: "Spiel, Mummenschanz" },
  { word: "musik", firstAttested: 1200, epoch: "medieval", suggestion: "Gesang, Spiel" },
];

/** Scannt einen Text nach Anachronismen. */
export function scanForAnachronisms(text: string, epoch: Epoch): Anachronism[] {
  const found: Anachronism[] = [];
  const lowerText = text.toLowerCase();

  for (const anach of ANACHRONISMS) {
    if (lowerText.includes(anach.word.toLowerCase())) {
      // Prüfe, ob der Begriff nach der Epoche erstmals belegt wurde
      const epochStart = getEpochStart(epoch);
      if (anach.firstAttested > epochStart) {
        found.push(anach);
      }
    }
  }

  return found;
}

/** Gibt das Startjahr einer Epoche zurück. */
export function getEpochStart(epoch: Epoch): number {
  const starts: Record<Epoch, number> = {
    medieval: 500,
    renaissance: 1400,
    baroque: 1600,
    enlightenment: 1700,
    victorian: 1837,
    "1920s": 1920,
  };
  return starts[epoch];
}

/** Gibt das Endjahr einer Epoche zurück. */
export function getEpochEnd(epoch: Epoch): number {
  const ends: Record<Epoch, number> = {
    medieval: 1500,
    renaissance: 1600,
    baroque: 1750,
    enlightenment: 1800,
    victorian: 1901,
    "1920s": 1929,
  };
  return ends[epoch];
}

/** Schlägt ein historisches Synonym vor. */
export function suggestSynonym(word: string): string {
  const suggestions: Record<string, string> = {
    sabotage: "Sabotage (frühestens 19. Jh.)",
    nervenzusammenbruch: "Erschöpfung, Krankheit",
    telefon: "Brief, Bote",
    auto: "Wagen, Kutsche",
    computer: "Rechenmeister",
    demokratie: "Ratsversammlung",
    industrie: "Handwerk",
    proletariat: "Gesinde, Leibeigene",
    kapitalismus: "Handel, Tausch",
    sozialismus: "Gemeinschaft",
  };
  return suggestions[word.toLowerCase()] || "Kein Synonym gefunden";
}

/** Formatiert einen Anachronismen-Bericht. */
export function formatAnachronismReport(anachronisms: Anachronism[], epoch: Epoch): string {
  const lines: string[] = [];
  lines.push(`=== ETYMOLOGIE-WÄCHTER: ${EPOCH_LABELS[epoch]} ===`);
  lines.push("");
  if (anachronisms.length === 0) {
    lines.push("Keine Anachronismen gefunden.");
  } else {
    lines.push(`${anachronisms.length} Anachronismen gefunden:`);
    for (const a of anachronisms) {
      lines.push(`  "${a.word}" (erstmals belegt: ${a.firstAttested}) → ${a.suggestion}`);
    }
  }
  return lines.join("\n");
}

/** Erstellt einen Beispiel-Bericht. */
export function createSampleReport(): string {
  const text = "Der Ritter nahm das Telefon und fuhr mit dem Auto zum Schloss.";
  const anachronisms = scanForAnachronisms(text, "medieval");
  return formatAnachronismReport(anachronisms, "medieval");
}
