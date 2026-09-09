// Tension Curve (Sprint 28, Agent 2): Spannungskurve analysieren.
// Lokal, kein LLM nötig, deterministisch.

export interface TensionPoint {
  position: number; // 0-100%
  tension: number; // 0-100
  event: string;
}

export interface TensionCurve {
  points: TensionPoint[];
  peak: number;
  valley: number;
  average: number;
  arcType: "rising" | "falling" | "wave" | "flat";
  climax: number;
  suggestions: string[];
}

const TENSION_KEYWORDS: Record<string, number> = {
  explodieren: 90, bombe: 85, töten: 95, mord: 90, kampf: 80, schießen: 85,
  verfolgung: 75, fliehen: 70, gefahr: 75, angst: 65, panik: 80, schrei: 70,
  blut: 75, leiche: 85, waffe: 70, attentat: 85, verschwinden: 60, rätsel: 50,
  geheimnis: 55, enttäuschen: 45, verlieren: 50, kummer: 55, trauer: 60,
  liebe: 30, freude: 25, hoffnung: 35, frieden: 20, lachen: 25, umarmung: 30,
  triumph: 40, sieg: 35, rettung: 45, entkommen: 50, überleben: 55,
};

/**
 * Analysiert die Spannungskurve eines Textes.
 */
export function analyzeTensionCurve(text: string): TensionCurve {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) {
    return { points: [], peak: 0, valley: 0, average: 0, arcType: "flat", climax: 0, suggestions: ["Text ist leer"] };
  }

  const points: TensionPoint[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].toLowerCase();
    let tension = 30;
    for (const [keyword, value] of Object.entries(TENSION_KEYWORDS)) {
      if (sentence.includes(keyword)) tension = Math.max(tension, value);
    }
    points.push({ position: Math.round((i / sentences.length) * 100), tension, event: sentences[i].slice(0, 50) });
  }

  const peak = Math.max(...points.map((p) => p.tension));
  const valley = Math.min(...points.map((p) => p.tension));
  const average = Math.round(points.reduce((s, p) => s + p.tension, 0) / points.length);
  const climax = points.findIndex((p) => p.tension === peak);

  let arcType: TensionCurve["arcType"] = "flat";
  const firstThird = points.slice(0, Math.floor(points.length / 3));
  const lastThird = points.slice(Math.floor((points.length * 2) / 3));
  const avgStart = firstThird.reduce((s, p) => s + p.tension, 0) / Math.max(1, firstThird.length);
  const avgEnd = lastThird.reduce((s, p) => s + p.tension, 0) / Math.max(1, lastThird.length);
  if (avgEnd > avgStart + 15) arcType = "rising";
  else if (avgStart > avgEnd + 15) arcType = "falling";
  else if (peak - valley > 30) arcType = "wave";

  const suggestions: string[] = [];
  if (peak < 60) suggestions.push("Kein klarer Höhepunkt — Spannung steigern");
  if (arcType === "flat") suggestions.push("Spannungskurve flach — mehr Kontraste");
  if (valley > 40) suggestions.push("Wenig Entspannung — ruhige Momente einbauen");

  return { points, peak, valley, average, arcType, climax, suggestions };
}
