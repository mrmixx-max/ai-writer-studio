// Scene Breakdown (Sprint 27, Agent 1): Szenen-Erkennung, -Analyse und -Struktur.
// Lokal, kein LLM nötig, deterministisch.

export interface Scene {
  id: string;
  title: string;
  heading: string;
  startLine: number;
  endLine: number;
  characters: string[];
  location: string;
  timeOfDay: string;
  mood: string;
  conflict: string;
  dialogue: number;
  action: number;
  description: number;
  wordCount: number;
}

export interface SceneBreakdown {
  scenes: Scene[];
  totalScenes: number;
  averageSceneLength: number;
  locations: string[];
  characters: string[];
  moodDistribution: Record<string, number>;
  pacing: string;
  timeDistribution: { day: number; night: number; dawn: number; dusk: number };
}

let sceneCounter = 0;
function nextId(): string {
  sceneCounter += 1;
  return `scene-${Date.now().toString(36)}-${sceneCounter}`;
}

/** Mindestlänge eines Textblocks, damit er als Szene zählt. */
const MIN_SCENE_CHARS = 10;

function isMarkdownHeading(line: string): boolean {
  return /^#{1,3}\s+/.test(line);
}

function isScreenplayHeading(line: string): boolean {
  return /^(INT|EXT)\s*[.\-–—:]\s*.+/i.test(line);
}

/**
 * Totale in Versalien (Kapitel-Titel). Braucht Mindestlänge + Trennzeichen,
 * damit Figuren-Cues wie "ANNA"/"PETER" nicht als Szenen splitten.
 */
function isCapsHeading(line: string): boolean {
  const t = line.trim();
  return (
    t.length >= 8 &&
    /[\s.\-–—]/.test(t) &&
    /^[A-ZÄÖÜ0-9][A-ZÄÖÜ0-9\s.\-–—,;:!?'"()]+$/.test(t)
  );
}

function isDivider(line: string): boolean {
  return /^(---|\*\*\*|___|===)$/.test(line.trim());
}

function headingTitle(line: string): string | null {
  const t = line.trim();
  if (isMarkdownHeading(t)) return t.replace(/^#+\s*/, "");
  if (isScreenplayHeading(t) || isCapsHeading(t)) return t;
  return null;
}

/**
 * Erkennt Szenen anhand von Headings (Markdown/Drehbuch/Versalien),
 * Trennzeilen oder Absatzgrenzen. Prosa ohne jede Struktur -> keine Szenen.
 */
export function detectScenes(text: string): Scene[] {
  const lines = text.split("\n");
  const scenes: Scene[] = [];
  let sceneIndex = 0;
  let currentStart = 0;
  let currentTitle = "Unbenannte Szene";
  let foundBoundary = false;

  // Struktur-Modus? Sobald Headings/Trennzeilen existieren, gliedern NUR sie —
  // Absätze bleiben in ihrer Szene (sonst stünde jede Dialogzeile allein).
  let structured = false;
  for (const raw of lines) {
    const t = raw.trim();
    if (t === "") continue;
    if (headingTitle(t) !== null || isDivider(t)) {
      structured = true;
      break;
    }
  }

  const pushBlock = (from: number, to: number, title: string): void => {
    if (from > to) return;
    const sceneText = lines.slice(from, to + 1).join("\n");
    if (sceneText.trim().length < MIN_SCENE_CHARS) return;
    scenes.push(createScene(sceneText, from, to, title, sceneIndex));
    sceneIndex++;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "") {
      if (!structured) {
        pushBlock(currentStart, i - 1, currentTitle);
        foundBoundary = true;
        currentStart = i + 1;
      } else {
        // Struktur-Modus: Leerzeile gehört zum Block (start NICHT vorschieben).
        continue;
      }
      continue;
    }
    const heading = headingTitle(line);
    if (heading !== null || isDivider(line)) {
      pushBlock(currentStart, i - 1, currentTitle);
      foundBoundary = true;
      currentTitle = heading ?? `Szene ${sceneIndex + 1}`;
      currentStart = i + 1;
      continue;
    }
  }

  // Restblock gehört nur dazu, wenn der Text überhaupt Struktur hat.
  if (foundBoundary) pushBlock(currentStart, lines.length - 1, currentTitle);
  return scenes;
}

function createScene(text: string, start: number, end: number, title: string | number, index: number): Scene {
  const words = text.split(/\s+/).filter(Boolean);
  const name = typeof title === "string" ? title : `Szene ${index + 1}`;
  // Titel in die Zeit-/Stimmungsprobe einbeziehen (Drehbuch-Headings wie "INT. X - TAG").
  const probe = `${name}\n${text}`;
  const characters = extractCharacters(text);
  const location = extractLocation(text);
  const timeOfDay = extractTimeOfDay(probe);
  const mood = extractMood(text);

  return {
    id: nextId(),
    title: name,
    heading: name,
    startLine: start,
    endLine: end,
    characters,
    location,
    timeOfDay,
    mood,
    conflict: "",
    dialogue: 30,
    action: 40,
    description: 30,
    wordCount: words.length,
  };
}

function extractCharacters(text: string): string[] {
  const names = new Set<string>();
  const capitalized = text.match(/\b[A-ZÄÖÜ][a-zäöüß]{2,}\b/g) ?? [];
  const commonNames = ["Max", "Anna", "Peter", "Maria", "Hans", "Lisa", "Tom", "Emma", "Paul", "Sophie", "Leo", "Mia", "Felix", "Lena", "Jonas", "Marie", "Erik", "Sarah", "Jan", "Laura"];
  
  const exclude = new Set(["Der", "Die", "Das", "Und", "Ist", "Ein", "Eine", "Mit", "Auf", "Für", "Den", "Dem", "Von", "Zu", "Bei", "Als", "Auch", "Noch", "Nach", "Über", "Sich", "Sie", "Er", "Es", "Ich", "Wir", "Ihr", "Was", "Wie", "Wer", "Wo", "Wenn", "Dass", "So", "Dann", "Aber", "Aus", "Wird", "Hat", "Nur", "War", "Kann", "Muss", "Schon", "Vor", "Unter", "Im", "Am", "Um", "An", "Ob", "Bis", "Durch", "Ohne", "Gegen", "Entlang", "Während", "Trotz", "Seit", "Dieser", "Diese", "Dieses", "Jener", "Jene", "Jedes", "Welcher", "Welche", "Welches", "Alle", "Viele", "Wenige", "Einige", "Mehrere", "Solche", "Solches", "Solcher", "Kein", "Keine", "Keines", "Nicht", "Nichts", "Niemand", "Jeder", "Jede", "Man", "Einer", "Einem", "Einen", "Eines", "Seinem", "Seinen", "Seiner", "Seines", "Ihrem", "Ihren", "Ihrer", "Ihres", "Unserem", "Unseren", "Unserer", "Unseres", "Eurem", "Euren", "Eurer", "Eures"]);
  for (const word of capitalized) {
    if (commonNames.includes(word) || (word.length > 3 && !exclude.has(word))) {
      names.add(word);
    }
  }
  return [...names];
}

function extractLocation(text: string): string {
  const locations = ["Haus", "Wald", "Straße", "Zimmer", "Küche", "Schlafzimmer", "Büro", "Schule", "Park", "Café", "Restaurant", "Bahnhof", "Flughafen", "Strand", "Berg", "See", "Fluss", "Garten", "Keller", "Dachboden", "Bibliothek", "Krankenhaus", "Polizei", "Gericht", "Kirche", "Hotel", "Supermarkt", "Kino", "Theater", "Museum", "Stadt", "Dorf", "Land", "Welt", "Universum", "Raum", "Erde", "Mond", "Mars", "Berlin", "München", "Hamburg", "Köln", "Frankfurt", "Wien", "Zürich", "Paris", "London", "Rom", "New York", "Tokio", "Moskau", "Peking", "Sydney", "Kairo", "Mumbai", "Rio", "Mexiko", "Bangkok", "Istanbul", "Amsterdam", "Stockholm", "Oslo", "Kopenhagen", "Helsinki", "Dublin", "Lissabon", "Madrid", "Barcelona", "Mailand", "Venedig", "Florenz", "Neapel", "Athen", "Budapest", "Prag", "Warschau", "Krakau", "Bukarest", "Belgrad", "Sofia", "Zagreb", "Bratislava", "Ljubljana", "Tallinn", "Riga", "Vilnius"];
  const lower = text.toLowerCase();
  for (const loc of locations) {
    if (lower.includes(loc.toLowerCase())) return loc;
  }
  return "Unbekannt";
}

function extractTimeOfDay(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("morgen") || lower.includes("sonnenaufgang") || lower.includes("frühstück") || lower.includes("wecker")) return "Morgen";
  if (lower.includes("mittag") || lower.includes("sonnenschein") || lower.includes("essen")) return "Mittag";
  if (lower.includes("abend") || lower.includes("sonnenuntergang") || lower.includes("dinner") || lower.includes("essen")) return "Abend";
  if (lower.includes("nacht") || lower.includes("mond") || lower.includes("sternen") || lower.includes("schlaf")) return "Nacht";
  if (/\btag\b/.test(lower)) return "Tag";
  if (lower.includes("dämmerung") || lower.includes("zwischen")) return "Dämmerung";
  return "Unbekannt";
}

function extractMood(text: string): string {
  const lower = text.toLowerCase();
  const moods = [
    { name: "freudig", keywords: ["freude", "glück", "lächeln", "strahlen", "jubeln", "froh", "heiter"] },
    { name: "traurig", keywords: ["trauer", "weinen", "schmerz", "verlust", "traurig", "kummer", "leid"] },
    { name: "ängstlich", keywords: ["angst", "furcht", "ängstlich", "furchtbar", "panik", "schrecken", "zittern"] },
    { name: "wütend", keywords: ["wut", "zorn", "wütend", "zornig", "groll", "hass", "rasch"] },
    { name: "romantisch", keywords: ["liebe", "kuss", "umarmung", "herz", "zärtlichkeit", "verliebt"] },
    { name: "spannend", keywords: ["spannung", "gespannung", "nervosität", "erwartung", "suspense"] },
    { name: "mysteriös", keywords: ["geheimnis", "rätsel", "dunkel", "verborgen", "unbekannt"] },
    { name: "friedlich", keywords: ["ruhe", "frieden", "stille", "entspannung", "harmonie"] },
  ];

  for (const mood of moods) {
    for (const kw of mood.keywords) {
      if (lower.includes(kw)) return mood.name;
    }
  }
  return "neutral";
}

function countTimeDistribution(scenes: Scene[]): { day: number; night: number; dawn: number; dusk: number } {
  const dist = { day: 0, night: 0, dawn: 0, dusk: 0 };
  for (const s of scenes) {
    if (s.timeOfDay === "Tag" || s.timeOfDay === "Morgen" || s.timeOfDay === "Mittag") dist.day++;
    else if (s.timeOfDay === "Nacht") dist.night++;
    else if (s.timeOfDay === "Abend" || s.timeOfDay === "Dämmerung") dist.dusk++;
  }
  return dist;
}

/**
 * Generiert einen Szenen-Bericht.
 */
export function generateSceneBreakdown(text: string): SceneBreakdown {
  const scenes = detectScenes(text);
  const locations = [...new Set(scenes.map((s) => s.location))];
  const characters = [...new Set(scenes.flatMap((s) => s.characters))];
  const avgLength = scenes.length > 0 ? Math.round(scenes.reduce((s, sc) => s + sc.wordCount, 0) / scenes.length) : 0;

  const moodDistribution: Record<string, number> = {};
  for (const scene of scenes) {
    moodDistribution[scene.mood] = (moodDistribution[scene.mood] ?? 0) + 1;
  }

  return {
    scenes,
    totalScenes: scenes.length,
    averageSceneLength: avgLength,
    locations,
    characters,
    moodDistribution,
    pacing: "steady",
    timeDistribution: countTimeDistribution(scenes),
  };
}

export function parseScenes(text: string): Scene[] {
  return detectScenes(text);
}

export function analyzeBreakdown(scenes: Scene[]): SceneBreakdown {
  return generateBreakdownFromScenes(scenes);
}

function generateBreakdownFromScenes(scenes: Scene[]): SceneBreakdown {
  const locations = [...new Set(scenes.map((s) => s.location))];
  const characters = [...new Set(scenes.flatMap((s) => s.characters))];
  const avgLength = scenes.length > 0 ? Math.round(scenes.reduce((s, sc) => s + sc.wordCount, 0) / scenes.length) : 0;
  const moodDistribution: Record<string, number> = {};
  for (const scene of scenes) {
    moodDistribution[scene.mood] = (moodDistribution[scene.mood] ?? 0) + 1;
  }
  return {
    scenes,
    totalScenes: scenes.length,
    averageSceneLength: avgLength,
    locations,
    characters,
    moodDistribution,
    pacing: "steady",
    timeDistribution: countTimeDistribution(scenes),
  };
}

export function suggestImprovements(breakdown: SceneBreakdown): string[] {
  const tips: string[] = [];
  if (breakdown.totalScenes === 0) tips.push("Keine Szenen erkannt. Text in Abschnitte gliedern.");
  if (breakdown.averageSceneLength > 2000) tips.push("Szenen sehr lang — aufteilen für besseres Pacing.");
  if (breakdown.averageSceneLength < 300) tips.push("Sehr kurze Szenen — für Fluss zusammenführen?");
  if (breakdown.locations.length > 10) tips.push("Viele Orte — reduzieren für Fokus?");
  if (breakdown.characters.length > 15) tips.push("Viele Figuren — Kernfigur stärken?");
  return tips;
}

export function exportToCSV(scenes: Scene[]): string {
  const header = "ID,Title,Heading,StartLine,EndLine,Characters,Location,TimeOfDay,Mood,WordCount";
  const rows = scenes.map((s) =>
    [s.id, s.title, s.heading, s.startLine, s.endLine, s.characters.join(";"), s.location, s.timeOfDay, s.mood, s.wordCount].join(",")
  );
  return [header, ...rows].join("\n");
}
