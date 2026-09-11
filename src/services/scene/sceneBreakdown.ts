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

/**
 * Erkennt Szenen anhand von Trennzeilen, Überschrifzen oder Absätzen.
 */
export function detectScenes(text: string): Scene[] {
  const lines = text.split("\n");
  const scenes: Scene[] = [];
  let currentStart = 0;
  let currentTitle = "Unbenannte Szene";
  let sceneIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Szene erkennen: Überschrift, Trennlinie, oder doppelter Absatz
    const isHeading = /^#{1,3}\s+/.test(line) || /^[A-ZÄÖÜ][A-ZÄÖÜ\s]+$/.test(line);
    const isDivider = /^(---|\*\*\*|___|===)$/.test(line);
    const isEmpty = line === "";
    const prevEmpty = i > 0 && lines[i - 1].trim() === "";

    if ((isHeading || isDivider) && i > currentStart) {
      const sceneText = lines.slice(currentStart, i).join("\n");
      if (sceneText.trim().length > 20) {
        scenes.push(createScene(sceneText, currentStart, i - 1, currentTitle, sceneIndex));
        sceneIndex++;
      }
      currentTitle = isHeading ? line.replace(/^#+\s*/, "") : `Szene ${sceneIndex + 1}`;
      currentStart = i + 1;
    } else if (isEmpty && prevEmpty && i > currentStart + 2) {
      const sceneText = lines.slice(currentStart, i).join("\n");
      if (sceneText.trim().length > 20) {
        scenes.push(createScene(sceneText, currentStart, i - 1, currentTitle, sceneIndex));
        sceneIndex++;
      }
      currentTitle = `Szene ${sceneIndex + 1}`;
      currentStart = i + 1;
    }
  }

  // Letzte Szene
  if (currentStart < lines.length) {
    const sceneText = lines.slice(currentStart).join("\n");
    if (sceneText.trim().length > 20) {
      scenes.push(createScene(sceneText, currentStart, lines.length - 1, currentTitle, sceneIndex));
    }
  }

  return scenes;
}

function createScene(text: string, start: number, end: number, title: string | number, index: number): Scene {
  const words = text.split(/\s+/).filter(Boolean);
  const characters = extractCharacters(text);
  const location = extractLocation(text);
  const timeOfDay = extractTimeOfDay(text);
  const mood = extractMood(text);

  return {
    id: nextId(),
    title: typeof title === "string" ? title : `Szene ${index + 1}`,
    heading: typeof title === "string" ? title : `Szene ${index + 1}`,
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
    timeDistribution: { day: 0, night: 0, dawn: 0, dusk: 0 },
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
    timeDistribution: { day: 0, night: 0, dawn: 0, dusk: 0 },
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
  const header = "ID,Title,StartLine,EndLine,Characters,Location,TimeOfDay,Mood,WordCount";
  const rows = scenes.map((s) =>
    [s.id, s.title, s.startLine, s.endLine, s.characters.join(";"), s.location, s.timeOfDay, s.mood, s.wordCount].join(",")
  );
  return [header, ...rows].join("\n");
}
