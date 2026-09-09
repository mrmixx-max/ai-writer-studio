// Emotional Arc Engine (Sprint 26, Agent 6): Emotionale Handlungskurve.
// Lokal, kein LLM nötig, deterministisch.

export interface EmotionalPoint {
  position: number; // 0-100% der Geschichte
  emotion: string;
  intensity: number; // 0-100
}

export interface EmotionalArc {
  points: EmotionalPoint[];
  dominantEmotion: string;
  averageIntensity: number;
  arcType: "rise" | "fall" | "wave" | "flat";
  suggestions: string[];
}

const EMOTION_KEYWORDS: Record<string, string[]> = {
  freude: ["freude", "glück", "lächeln", "strahlen", "jubeln", "froh", "heiter", "fröhlich", "selig", "beglückt"],
  trauer: ["trauer", "weinen", "schmerz", "verlust", "traurig", "kummer", "leid", "schwermut", "gram", "pein"],
  wut: ["wut", "zorn", "wütend", "zornig", "groll", "hass", "empörung", "rasch", "furie", "toben"],
  angst: ["angst", "furcht", "ängstlich", "furchtbar", "panik", "schrecken", "grauen", "zittern", "bang", "bange"],
  liebe: ["liebe", "lieben", "herz", "zärtlichkeit", "zuneigung", "hingabe", "verliebt", "schatz", "herzlich", "warm"],
  hoffnung: ["hoffnung", "hoffnungsvoll", "vertrauen", "zuversicht", "optimismus", "glauben", "wünschen", "erhoffen", "ahnen", "mut"],
  hass: ["hass", "verachten", "feindselig", "böswillig", "rachsucht", "missgunst", "neid", "groll", "abneugen", "verachtung"],
  verzweiflung: ["verzweiflung", "verzweifelt", "ausweglos", "hoffnungslos", "resignation", "kapitulation", "endlos", "tief", "abgrund", "nichts"],
  überraschung: ["überraschung", "überrascht", "erstaunt", "verwirrt", "unerwartet", "plötzlich", "unerhört", "schock", "fassungslos", "blitz"],
  ekel: ["ekel", "eklig", "abstoßend", "widerlich", "grausam", "abscheulich", "widerwärtig", "übel", "brechen", "stauchen"],
};

const EMOTION_COLORS: Record<string, string> = {
  freude: "#ffd700",
  trauer: "#4169e1",
  wut: "#ff4444",
  angst: "#800080",
  lieue: "#ff69b4",
  hoffnung: "#44ff88",
  hass: "#8b0000",
  verzweiflung: "#333333",
  überraschur: "#ffaa00",
  ekel: "#556b2f",
};

/**
 * Analysiert die emotionale Kurve eines Textes.
 */
export function analyzeEmotionalArc(text: string): EmotionalArc {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      points: [],
      dominantEmotion: "neutral",
      averageIntensity: 0,
      arcType: "flat",
      suggestions: ["Text ist leer"],
    };
  }
  const sentences = trimmed.split(/(?<=[.!?])\s+/);

  const points: EmotionalPoint[] = [];
  const emotionCounts = new Map<string, number>();
  let totalIntensity = 0;

  // Analysiere jeden Satz
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].toLowerCase();
    let maxIntensity = 0;
    let dominantEmotion = "neutral";

    for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
      let count = 0;
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        const matches = sentence.match(regex);
        if (matches) count += matches.length;
      }
      if (count > 0) {
        emotionCounts.set(emotion, (emotionCounts.get(emotion) ?? 0) + count);
        const intensity = Math.min(100, count * 25);
        if (intensity > maxIntensity) {
          maxIntensity = intensity;
          dominantEmotion = emotion;
        }
      }
    }

    points.push({
      position: Math.round((i / sentences.length) * 100),
      emotion: dominantEmotion,
      intensity: maxIntensity,
    });

    totalIntensity += maxIntensity;
  }

  // Finde dominante Emotion
  let dominantEmotion = "neutral";
  let maxCount = 0;
  for (const [emotion, count] of emotionCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantEmotion = emotion;
    }
  }

  // Bestimme Kurventyp
  const arcType = determineArcType(points);
  const averageIntensity = Math.round(totalIntensity / sentences.length);

  // Generiere Vorschläge
  const suggestions = generateSuggestions(points, arcType, averageIntensity);

  return {
    points,
    dominantEmotion,
    averageIntensity,
    arcType,
    suggestions,
  };
}

/**
 * Bestimmt den Typ der emotionalen Kurve.
 */
function determineArcType(points: EmotionalPoint[]): "rise" | "fall" | "wave" | "flat" {
  if (points.length < 3) return "flat";

  const firstThird = points.slice(0, Math.floor(points.length / 3));
  const lastThird = points.slice(Math.floor((points.length * 2) / 3));

  const avgStart = firstThird.reduce((s, p) => s + p.intensity, 0) / firstThird.length;
  const avgEnd = lastThird.reduce((s, p) => s + p.intensity, 0) / lastThird.length;

  // Prüfe auf Welle
  let directionChanges = 0;
  for (let i = 2; i < points.length; i++) {
    const prev = points[i - 1].intensity - points[i - 2].intensity;
    const curr = points[i].intensity - points[i - 1].intensity;
    if (prev > 0 && curr < 0) directionChanges++;
    if (prev < 0 && curr > 0) directionChanges++;
  }

  if (directionChanges >= 3) return "wave";
  if (avgEnd > avgStart + 15) return "rise";
  if (avgStart > avgEnd + 15) return "fall";
  return "flat";
}

/**
 * Generiert Vorschläge zur Verbesserung der emotionalen Kurve.
 */
function generateSuggestions(
  points: EmotionalPoint[],
  arcType: string,
  avgIntensity: number
): string[] {
  const suggestions: string[] = [];

  if (arcType === "flat") {
    suggestions.push("Die emotionale Kurve ist flach — füge mehr Kontraste hinzu");
  }
  if (avgIntensity < 20) {
    suggestions.push("Die emotionale Intensität ist niedrig — stärkere Begriffe verwenden");
  }
  if (arcType === "fall") {
    suggestions.push("Die Kurve fällt am Ende — für ein befriedigendes Ende sorgen");
  }

  // Prüfe auf fehlende Höhepunkte
  const maxIntensity = Math.max(...points.map((p) => p.intensity));
  if (maxIntensity < 50) {
    suggestions.push("Kein klarer emotionaler Höhepunkt — einen Klimax einbauen");
  }

  // Prüfe auf monotone Emotionen
  const emotions = new Set(points.map((p) => p.emotion));
  if (emotions.size === 1) {
    suggestions.push("Nur eine Emotion — mehr emotionale Vielfalt für Tiefe");
  }

  if (suggestions.length === 0) {
    suggestions.push("Gute emotionale Kurve mit klarem Bogen");
  }

  return suggestions;
}

/**
 * Gibt die Farbe für eine Emotion zurück.
 */
export function getEmotionColor(emotion: string): string {
  return EMOTION_COLORS[emotion] || "#888888";
}

/**
 * Generiert eine ASCII-Darstellung der emotionalen Kurve.
 */
export function generateAsciiArc(arc: EmotionalArc, width = 60, height = 15): string {
  if (arc.points.length === 0) return "Keine Daten";

  const grid: string[][] = Array.from({ length: height }, () => Array(width).fill(" "));

  // Zeichne Kurve
  for (let i = 0; i < arc.points.length; i++) {
    const x = Math.floor((i / arc.points.length) * (width - 1));
    const y = height - 1 - Math.floor((arc.points[i].intensity / 100) * (height - 1));
    if (y >= 0 && y < height && x >= 0 && x < width) {
      grid[y][x] = "█";
    }
  }

  // Beschriftung
  const lines = grid.map((row) => row.join(""));
  lines.push("0%" + " ".repeat(width - 8) + "100%");
  lines.push(`Dominante Emotion: ${arc.dominantEmotion} | Intensität: ${arc.averageIntensity}% | Typ: ${arc.arcType}`);

  return lines.join("\n");
}
