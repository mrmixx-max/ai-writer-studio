// Genre Analyzer (Sprint 27, Agent 6): Genre-Erkennung und -Analyse.
// Lokal, kein LLM nötig, deterministisch.

export interface GenreScore {
  genre: string;
  score: number;
  keywords: string[];
}

export interface GenreAnalysis {
  primaryGenre: string;
  secondaryGenre: string;
  scores: GenreScore[];
  audience: string;
  tone: string;
  pacing: string;
  suggestions: string[];
}

const GENRE_KEYWORDS: Record<string, string[]> = {
  "Krimi": ["mord", "täter", "opfer", "spur", "beweis", "verdächtig", "polizei", "detektiv", "leiche", "waffe", "tatort", "zeuge", "alibi", "motiv", "verhör", "ermittlung", "fall", "aufklären", "überführen", "schuld"],
  "Thriller": ["spannung", "gefahr", "verfolgung", "zeit", "countdown", "explosion", "bombe", "attentat", "verschwörung", "agent", "geheim", "dringend", "rennen", "fiehen", "kämpfen", "überleben", "todesfolge", "bedrohung", "erpressung", "kidnapping"],
  "Horror": ["angst", "blut", "dunkel", "nacht", "schrei", "leiche", "monster", "dämon", "besessen", "verflucht", "grab", "tot", "schatten", "flüstern", "kreischen", "blutig", "grusel", "gräuel", "entsetzlich", "schrecken"],
  "Romantik": ["liebe", "kuss", "herz", "umarmung", "zärtlichkeit", "verliebt", "date", "knistern", "flirten", "romanze", "partner", "ehe", "hochzeit", "treue", "leidenschaft", "sehnsucht", "zusammen", "küssen", "lieben", "herzschlag"],
  "Fantasy": ["magie", "zauber", "drache", "elf", "zwerg", "schwert", "burg", "königreich", "hexe", "ritter", "quest", "prophezeiung", "schwert", "schild", "fluch", "beschwörung", "drache", "einhorn", "fee", "werewolf", "vampir"],
  "Science-Fiction": ["raumschiff", "planet", "zukunft", "technologie", "ki", "roboter", "galaxie", "dimension", "zeitmaschine", "strahlen", "laser", "cyborg", "klon", "außerirdisch", "ufo", "antimaterie", "schwarzes Loch", "wurmhole", "hyperraum", "terraform"],
  "Historisch": ["krieg", "kaiser", "könig", "schloss", "ritter", "mittelalter", "antik", "römisch", "griechisch", "vikinger", "pharao", "königreich", "thron", "schwert", "burg", "harnisch", "lanze", "festung", "schlacht", "chronik"],
  "Humor": ["lache", "witz", "komisch", "lustig", "humor", "spaß", "albern", "ulkig", "scherz", "pointe", "satire", "irony", "sarkasmus", "parodie", "slapstick", "gag", "schwank", "farce", "klamauk", "ulk"],
  "Drama": ["konflikt", "krise", "entscheidung", "schicksal", "tragik", "verzweiflung", "opfer", "widrigkeit", "belastung", "beziehung", "ehe", "familie", "verrat", "gebung", "wiedervereinigung", "abschied", "verlust", "trauer", "hoffnung", "vergebung"],
  "Abenteuer": ["reise", "entdeckung", "schatz", "expedition", "dschungel", "wüste", "berg", "insel", "schiff", "seefahrer", "pirat", "forscher", "abenteuer", "risiko", "gefahr", "überleben", "wildnis", "unbekannt", "horizont", "neuland"],
};

const GENRE_AUDIENCE: Record<string, string> = {
  "Krimi": "Erwachsene",
  "Thriller": "Erwachsene",
  "Horror": "Jugendliche & Erwachsene",
  "Romantik": "Jugendliche & Erwachsene",
  "Fantasy": "Jugendliche & Erwachsene",
  "Science-Fiction": "Jugendliche & Erwachsene",
  "Historisch": "Erwachsene",
  "Humor": "Alle Altersgruppen",
  "Drama": "Erwachsene",
  "Abenteuer": "Jugendliche & Erwachsene",
};

const GENRE_TONE: Record<string, string> = {
  "Krimi": "Düster",
  "Thriller": "Spannungsgeladen",
  "Horror": "Bedrohlich",
  "Romantik": "Warm",
  "Fantasy": "Mystisch",
  "Science-Fiction": "Zukunftsorientiert",
  "Historisch": "Episch",
  "Humor": "Leicht",
  "Drama": "Emotional",
  "Abenteuer": "Aufregend",
};

const GENRE_PACING: Record<string, string> = {
  "Krimi": "Mittel",
  "Thriller": "Schnell",
  "Horror": "Variabel",
  "Romantik": "Langsam",
  "Fantasy": "Episch",
  "Science-Fiction": "Variabel",
  "Historisch": "Episch",
  "Humor": "Schnell",
  "Drama": "Langsam",
  "Abenteuer": "Schnell",
};

/**
 * Erkennt das Genre eines Textes.
 */
export function analyzeGenre(text: string): GenreAnalysis {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount === 0) {
    return {
      primaryGenre: "Unbekannt",
      secondaryGenre: "Unbekannt",
      scores: [],
      audience: "Unbekannt",
      tone: "Unbekannt",
      pacing: "Unbekannt",
      suggestions: ["Text ist leer"],
    };
  }

  const scores: GenreScore[] = [];
  
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    let count = 0;
    const foundKeywords: string[] = [];
    
    for (const keyword of keywords) {
      const matches = lowerText.match(new RegExp(`\\b${keyword}`, "g"));
      if (matches) {
        count += matches.length;
        foundKeywords.push(keyword);
      }
    }
    
    const score = wordCount > 0 ? (count / wordCount) * 100 : 0;
    scores.push({
      genre,
      score: Math.round(score * 100) / 100,
      keywords: foundKeywords.slice(0, 5),
    });
  }

  const sortedScores = scores.sort((a, b) => b.score - a.score);
  const primaryGenre = sortedScores[0]?.genre ?? "Unbekannt";
  const secondaryGenre = sortedScores[1]?.genre ?? "Unbekannt";

  const suggestions: string[] = [];
  if (sortedScores[0]?.score === 0) {
    suggestions.push("Keine generspezifischen Wörter gefunden — mehr Schlüsselwörter verwenden");
  }
  if (sortedScores[0]?.score > 0 && sortedScores[0].score < 2) {
    suggestions.push(`Mehr ${primaryGenre}-typische Wörter für stärkere Genre-Signale`);
  }
  if (sortedScores.length > 1 && sortedScores[0].score - sortedScores[1].score < 1) {
    suggestions.push(`Genre-Wechsel zwischen ${primaryGenre} und ${secondaryGenre} beachten`);
  }
  if (suggestions.length === 0) {
    suggestions.push(`Klares ${primaryGenre}-Genre erkannt — beibehalten`);
  }

  return {
    primaryGenre,
    secondaryGenre,
    scores: sortedScores,
    audience: GENRE_AUDIENCE[primaryGenre] ?? "Allgemein",
    tone: GENRE_TONE[primaryGenre] ?? "Neutral",
    pacing: GENRE_PACING[primaryGenre] ?? "Mittel",
    suggestions,
  };
}
