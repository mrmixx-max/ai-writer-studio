// blurbStudio.ts — Marketing-Studio: Klappentext- & Pitch-Labor.
// Lokal, deterministisch, keine LLM-Aufrufe. Defensive Fallbacks.

export type BlurbFormula =
  | "hook-trouble-choice"
  | "meet-cute-obstacle-climax"
  | "world-threat-hero";

export interface BlurbInput {
  title: string;
  genre: string;
  protagonist: string;
  conflict: string;
  stakes: string;
}

export interface QuoteCardOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  textColor?: string;
  font?: string;
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function safe(value: string | undefined | null, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function capitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// ---------------------------------------------------------------------------
// 1. generateBlurb
// ---------------------------------------------------------------------------

const GENRE_HOOKS: Record<string, string> = {
  krimi: "Ein Mord. Ein Verdächtiger. Eine Wahrheit, die niemand sehen will.",
  thriller: "Eine Verschwörung. Ein Countdown. Ein Mann, der allein dagegen steht.",
  fantasy: "Eine verborgene Welt. Eine uralte Prophezeiung. Eine Wahl, die alles verändert.",
  "science-fiction": "Eine Zukunft, die niemand wollte. Ein Geheimnis, das die Menschheit bedroht.",
  romantik: "Zwei Menschen. Ein Zufall. Eine Liebe, die nicht sein dürfte.",
  horror: "Ein Ort, an dem die Dunkelheit lebt. Ein Geist, der nicht ruhen lässt.",
  historisch: "Eine Epoche im Wandel. Eine Entscheidung, die Geschichte schreibt.",
  dystopie: "Eine Gesellschaft ohne Freiheit. Ein Funke Hoffnung, der alles aufs Spiel setzt.",
  default: "Eine Geschichte, die unter die Haut geht. Ein Konflikt, der keine Gnade kennt.",
};

const GENRE_MEET_CUTE: Record<string, string> = {
  krimi: "Sie treffen sich an einem Tatort — sie als Ermittlerin, er als Zeuge.",
  thriller: "Ein Blick in der Menge. Ein Lächeln. Und plötzlich läuft die Zeit ab.",
  fantasy: "Sie finden sich in einer Bibliothek voller verbotener Bücher.",
  "science-fiction": "Ein Fehler im System bringt sie zusammen — auf der falschen Seite der Mauer.",
  romantik: "Ein verlorener Brief. Ein fremder Name. Ein Schicksal, das sie zusammenführt.",
  horror: "Sie teilen sich eine Nacht in einem Haus, das keine Gäste mehr entlässt.",
  historisch: "Ein Blick über den Platz. Ein Lächeln im Schein der Laternen.",
  dystopie: "Sie finden sich in einer Warteschlange — beide mit demselben Geheimnis.",
  default: "Ein Zufall. Ein Blick. Und nichts ist mehr, wie es war.",
};

const GENRE_CLIMAX: Record<string, string> = {
  krimi: "In der letzten Stunde kommt die Wahrheit ans Licht — und sie ist tödlicher, als jeder dachte.",
  thriller: "Der Countdown läuft. Der Feind ist näher als je. Und der einzige Ausweg ist ein Risiko.",
  fantasy: "Die Schlacht ist verloren — doch ein Funke Hoffnung bleibt. Ein letzter Kampf beginnt.",
  "science-fiction": "Die Menschheit steht am Abgrund. Eine Entscheidung bleibt — und sie fällt jetzt.",
  romantik: "Die Wahrheit kommt ans Licht. Doch die Liebe ist stärker als jedes Geheimnis.",
  horror: "Die Dunkelheit wird schwächer — doch der Preis für das Überleben ist hoch.",
  historisch: "Die Geschichte ist geschrieben — doch ein einziger Moment kann sie noch verändern.",
  dystopie: "Der Funke Hoffnung wird zur Flamme. Und die Flamme verändert alles.",
  default: "Der Höhepunkt ist erreicht — und nichts bleibt, wie es war.",
};

/**
 * Generiert einen Klappentext nach bewährten Formeln.
 * Defensive Fallbacks bei fehlenden Daten.
 */
export function generateBlurb(formula: BlurbFormula, input: BlurbInput): string {
  const title = safe(input.title, "Unbekannter Titel");
  const genre = safe(input.genre, "default").toLowerCase();
  const protagonist = safe(input.protagonist, "Eine unvergessliche Hauptfigur");
  const conflict = safe(input.conflict, "Ein Konflikt, der keine Gnade kennt");
  const stakes = safe(input.stakes, "Alles steht auf dem Spiel");

  const hook = GENRE_HOOKS[genre] ?? GENRE_HOOKS.default;
  const meetCute = GENRE_MEET_CUTE[genre] ?? GENRE_MEET_CUTE.default;
  const climax = GENRE_CLIMAX[genre] ?? GENRE_CLIMAX.default;

  switch (formula) {
    case "hook-trouble-choice":
      return [
        hook,
        "",
        `${capitalize(protagonist)} — ${conflict}.`,
        "",
        `Doch die Wahl ist klar: ${stakes}.`,
        "",
        truncate(`„${title}" ist ein ${genre === "default" ? "fesselndes" : genre}-Erlebnis, das Sie nicht mehr loslässt.`, 120),
      ].join("\n");

    case "meet-cute-obstacle-climax":
      return [
        meetCute,
        "",
        `${capitalize(protagonist)} — ${conflict}.`,
        "",
        `Doch der Weg ist geprägt von Hindernissen. Und dann kommt der Moment, der alles verändert: ${stakes}.`,
        "",
        truncate(`„${title}" — ${climax}`, 120),
      ].join("\n");

    case "world-threat-hero":
      return [
        `Die Welt, wie wir sie kennen, ist bedroht.`,
        "",
        `${capitalize(protagonist)} — ${conflict}.`,
        "",
        `Doch in der Dunkelheit gibt es einen Funken Hoffnung: ${stakes}.`,
        "",
        truncate(`„${title}" — ${climax}`, 120),
      ].join("\n");

    default:
      // Defensiver Fallback für unbekannte Formeln
      return [
        hook,
        "",
        `${capitalize(protagonist)} — ${conflict}.`,
        "",
        `Doch die Wahl ist klar: ${stakes}.`,
        "",
        truncate(`„${title}" ist ein ${genre === "default" ? "fesselndes" : genre}-Erlebnis, das Sie nicht mehr loslässt.`, 120),
      ].join("\n");
  }
}

// ---------------------------------------------------------------------------
// 2. analyzeKdpKeywords
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "eines", "einem", "einen",
  "und", "oder", "aber", "denn", "weil", "wenn", "als", "wie", "so", "auch", "noch", "nur",
  "schon", "immer", "nie", "sehr", "mehr", "viel", "wenig", "ganz", "gar", "doch", "ja",
  "nein", "nicht", "kein", "keine", "keiner", "keines", "keinem", "keinen", "ist", "sind",
  "war", "waren", "wird", "werden", "wurde", "wurden", "hat", "haben", "hatte", "hatten",
  "kann", "können", "konnte", "konnten", "muss", "müssen", "musste", "mussten", "soll",
  "sollen", "sollte", "sollten", "will", "wollen", "wollte", "wollten", "darf", "dürfen",
  "durfte", "durften", "mag", "mögen", "mochte", "mochten", "im", "am", "an", "auf", "aus",
  "bei", "mit", "nach", "seit", "von", "zu", "zum", "zur", "über", "unter", "vor", "hinter",
  "neben", "zwischen", "durch", "für", "gegen", "ohne", "um", "bis", "entlang", "wegen",
  "trotz", "während", "statt", "anstatt", "außer", "innerhalb", "außerhalb", "dieser",
  "diese", "dieses", "diesen", "diesem", "jener", "jene", "jenes", "jenen", "jenem", "welcher",
  "welche", "welches", "welchen", "welchem", "wer", "was", "wo", "wann", "warum", "wie",
  "wer", "wen", "wem", "wessen", "ich", "du", "er", "sie", "es", "wir", "ihr", "sie",
  "mich", "dich", "ihn", "uns", "euch", "ihnen", "mir", "dir", "ihm", "uns", "euch", "ihnen",
  "mein", "dein", "sein", "ihr", "unser", "euer", "ihr", "meine", "deine", "seine", "ihre",
  "unsere", "eure", "ihre", "meinen", "deinen", "seinen", "ihren", "unsere", "eure", "ihre",
  "meinem", "deinem", "seinem", "ihrem", "unserem", "eurem", "ihrem", "meiner", "deiner",
  "seiner", "ihrer", "unserer", "eurer", "ihrer", "sich", "einander", "man", "jemand",
  "niemand", "etwas", "nichts", "alles", "vieles", "weniges", "jeder", "jede", "jedes",
  "jeden", "jedem", "alle", "aller", "alles", "allen", "allem", "viele", "vieler",
  "vieles", "vielen", "vielem", "wenige", "weniger", "weniges", "wenigen", "wenigem",
  "mehrere", "mehrerer", "mehreres", "mehreren", "mehrere", "andere", "anderer", "anderes",
  "anderen", "anderem", "andere", "selbe", "selber", "selbes", "selben", "selbem",
  "selbe", "gleiche", "gleicher", "gleiches", "gleichen", "gleichem", "gleiche",
  "solche", "solcher", "solches", "solchen", "solchem", "solche", "derjenige",
  "diejenige", "dasjenige", "denjenigen", "demjenigen", "desjenigen", "dieselbe",
  "dasselbe", "denselben", "demselben", "desselben", "derjenige", "diejenige",
  "dasjenige", "denjenigen", "demjenigen", "desjenigen", "dieselbe", "dasselbe",
  "denselben", "demselben", "desselben", "sowie", "sowohl", "als", "weder", "entweder",
  "beide", "beider", "beides", "beiden", "beidem", "beide", "mehrere", "mehrerer",
  "mehreres", "mehreren", "mehrere", "etliche", "etlicher", "etliches", "etlichen",
  "etlichem", "etliche", "manche", "mancher", "manches", "manchen", "manchem",
  "manche", "wenige", "weniger", "weniges", "wenigen", "wenigem", "wenige", "viele",
  "vieler", "vieles", "vielen", "vielem", "viele", "andere", "anderer", "anderes",
  "anderen", "anderem", "andere", "selbe", "selber", "selbes", "selben", "selbem",
  "selbe", "gleiche", "gleicher", "gleiches", "gleichen", "gleichem", "gleiche",
  "solche", "solcher", "solches", "solchen", "solchem", "solche", "derjenige",
  "diejenige", "dasjenige", "denjenigen", "demjenigen", "desjenigen", "dieselbe",
  "dasselbe", "denselben", "demselben", "desselben", "derjenige", "diejenige",
  "dasjenige", "denjenigen", "demjenigen", "desjenigen", "dieselbe", "dasselbe",
  "denselben", "demselben", "desselben", "sowie", "sowohl", "als", "weder",
  "entweder", "beide", "beider", "beides", "beiden", "beidem", "beide",
]);

/**
 * Extrahiert 7 Amazon-Suchschlagworte aus einem Text.
 * Stopwörter werden entfernt, Wörter nach Häufigkeit sortiert.
 * Defensiver Fallback bei leerem Text.
 */
export function analyzeKdpKeywords(text: string): string[] {
  const safeText = safe(text, "");
  if (safeText.length === 0) {
    return ["bestseller", "buch", "lesen", "geschichte", "roman", "autor", "empfehlung"];
  }

  // Tokenisiere: Kleinbuchstaben, nur Buchstaben und Umlaube
  const tokens = safeText
    .toLowerCase()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));

  if (tokens.length === 0) {
    return ["bestseller", "buch", "lesen", "geschichte", "roman", "autor", "empfehlung"];
  }

  // Zähle Häufigkeit
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  // Sortiere nach Häufigkeit (absteigend), dann alphabetisch
  const sorted = [...freq.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });

  // Nimm die Top 7
  const keywords = sorted.slice(0, 7).map(([word]) => word);

  // Fallback: fülle auf, wenn weniger als 7 Keywords gefunden wurden
  const fallbacks = ["bestseller", "buch", "lesen", "geschichte", "roman", "autor", "empfehlung"];
  for (const fb of fallbacks) {
    if (keywords.length >= 7) break;
    if (!keywords.includes(fb)) {
      keywords.push(fb);
    }
  }

  return keywords.slice(0, 7);
}

// ---------------------------------------------------------------------------
// 3. generateQuoteCard
// ---------------------------------------------------------------------------

/**
 * Generiert eine Social-Media-Quote-Card als SVG.
 * Defensive Fallbacks bei fehlenden Optionen.
 */
export function generateQuoteCard(text: string, options: QuoteCardOptions): string {
  const safeText = safe(text, "„Ein gutes Buch ist ein Freund, der nie geht.\"");
  const width = options.width && options.width > 0 ? options.width : 800;
  const height = options.height && options.height > 0 ? options.height : 400;
  const backgroundColor = safe(options.backgroundColor, "#1a1a2e");
  const textColor = safe(options.textColor, "#ffffff");
  const font = safe(options.font, "Georgia, serif");

  // Escape SVG-spezielle Zeichen
  const escapedText = safeText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  // Text auf mehrere Zeilen aufteilen (max ~60 Zeichen pro Zeile)
  const words = escapedText.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    if ((currentLine + " " + word).trim().length > 60) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = (currentLine + " " + word).trim();
    }
  }
  if (currentLine) lines.push(currentLine);

  // SVG-Text-Elemente
  const lineHeight = 32;
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
  const textElements = lines
    .map(
      (line, i) =>
        `  <text x="${width / 2}" y="${startY + i * lineHeight}" font-family="${font}" font-size="24" fill="${textColor}" text-anchor="middle">${line}</text>`
    )
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${backgroundColor}" rx="16"/>
${textElements}
</svg>`;
}
