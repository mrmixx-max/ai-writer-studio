// filmAndForeignRightsPitch.ts — Film-, TV- & Auslandsrechte-Pitch-Deck.
//
// Meilenstein 61.0 (v7.3.0)
//
// Erzeugt ein Verwertungs-Dossier für die Adaption eines Manuskripts
// (Film/TV/Streaming), einen Auslandsrechte-Leitfaden (Territorien,
// Co-Agenten, Übersetzungsrechte, Vorschüsse) sowie einen druckfertigen
// PDF-Pitch (A4). Alle Zufallsoperationen laufen deterministisch über
// createSeededRandom mit hashString als Seed-Quelle.
// Keine Node-Module — vollständig browser-kompatibel.

// ---------------------------------------------------------------------------
// PRIMITIVE: Hash & Zufall (FNV-1a + mulberry32)
// ---------------------------------------------------------------------------

/** FNV-1a (32-Bit). Deterministisch, browser-kompatibel, keine Node-Abhängigkeiten. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32-PRNG. Liefert gleichmäßig verteilte Zahlen im Intervall [0, 1). */
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

/** Wählt ein zufälliges Element aus einem nicht-leeren Array. Wirft bei leerem Array. */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Leeres Array — pick() nicht möglich");
  return arr[Math.floor(rng() * arr.length)];
}

/** Wählt `count` eindeutige Elemente aus einem Array (Reihenfolge zufällig). */
function pickUnique<T>(arr: readonly T[], count: number, rng: () => number): T[] {
  const pool = [...arr];
  const chosen: T[] = [];
  const total = Math.max(0, Math.min(count, pool.length));
  while (chosen.length < total) {
    const idx = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// TYPEN
// ---------------------------------------------------------------------------

/** Ein minimales Rechte-Projekt (Titel + Genre + optionale Logline). */
export interface RightsProject {
  title: string;
  genre: string;
  logline?: string;
}

/** Ein Casting-Vorschlag. */
export interface CastingSuggestion {
  role: string;
  actorType: string;
  description: string;
}

/** Film-/TV-Verwertungs-Dossier (1-Seiter). */
export interface FilmRightsDossier {
  logline: string;
  marketComparison: string;
  castingSuggestions: CastingSuggestion[];
  tonalReference: string;
  seriesPotential: string;
  onePageText: string;
}

/** Ein Auslands-Territorium. */
export interface TerritoryEntry {
  territory: string;
  language: string;
  marketTrend: string;
  pitchAngle: string;
}

/** Auslandsrechte-Leitfaden. */
export interface ForeignRightsGuide {
  territories: TerritoryEntry[];
  salesData: string;
  fairStrategy: string;
}

/** Eine Sektion des PDF-Pitch. */
export interface PdfSection {
  heading: string;
  body: string;
}

/** Druckfertiges PDF-Ergebnis. */
export interface RightsPitchPdf {
  title: string;
  sections: PdfSection[];
  pageCount: number;
  printReady: boolean;
  svgPreview: string;
}

// ---------------------------------------------------------------------------
// KONSTANTEN
// ---------------------------------------------------------------------------

const LOGLINE_TEMPLATES: readonly string[] = [
  "Eine junge Archäologin entdeckt ein uraltes Artefakt, das die Grenze zwischen Leben und Tod auflöst — und muss sich entscheiden, welche Wahrheit die Welt vertragen kann.",
  "In einer dystopischen Stadt, in der Erinnerungen gehandelt werden, stößt ein Dieb auf eine Erinnerung, die ihn um sein eigenes Leben bringen wird.",
  "Zwei Fremde treffen sich in einem Zug, der niemals ankommt — und entdecken, dass ihre Leben auf mysteriöse Weise miteinander verbunden sind.",
  "Eine alleinerziehende Mutter kämpft in einer Welt, in der Träume als Währung gelten, um ihre Tochter vor dem Verkauf ihrer letzten Träume zu bewahren.",
  "Ein pensionierter Detective wird in einen letzten Fall hineingezogen, der ihn mit seiner eigenen Vergangenheit konfrontiert — und die Wahrheit ist grausamer als jedes Verbrechen, das er je gelöst hat.",
];

const MARKET_COMPARISONS: readonly string[] = [
  "„Dark“ trifft „Stranger Things“ — zeitlose Rätsel-Erzählung mit emotionaler Tiefe.",
  "„Babylon Berlin“ trifft „The Crown“ — historisches Drama mit modernem Pacing.",
  "„Parasite“ trifft „Get Out“ — gesellschaftskritischer Thriller mit genreübergreifendem Appeal.",
  "„The Handmaid's Tale“ trifft „Black Mirror“ — dystopische Vision mit starkem Frauencharakter.",
  "„Inception“ trifft „The Matrix“ — hochkonzeptueller Sci-Fi mit Herz und Humor.",
];

const CASTING_POOL: readonly CastingSuggestion[] = [
  { role: "Hauptfigur (Protagonist)", actorType: "Aufstrebendes Talent (25–35)", description: "Charismatisch, vielschichtig, trägt die emotionale Last der Geschichte." },
  { role: "Antagonist", actorType: "Etablierter Charakterdarsteller", description: "Magnetisch, unberechenbar, verleiht dem Gegenpol Tiefe und Glaubwürdigkeit." },
  { role: "Nebengegenspiel (Mentor)", actorType: "Preisgekrönter Senior-Darsteller", description: "Weise, geheimnisvoll, verbindet die Handlung mit emotionaler Weisheit." },
  { role: "Nebengegenspiel (Verbündete)", actorType: "Vielseitiger Serien-Darsteller", description: "Loyal, humorvoll, bietet Kontrast und Entlastung in intensiven Szenen." },
  { role: "Nebengegenspiel (Liebesinteresse)", actorType: "International bekanntes Gesicht", description: "Chemisch, authentisch, verstärkt die romantische und emotionale Ebene." },
];

const TONAL_REFERENCES: readonly string[] = [
  "Visuell: „Blade Runner 2049“ — neongetriebene Atmosphäre, aber mit warmer Farbpalette.",
  "Ton: „Arrival“ — langsame, bedächtige Erzählweise mit emotionaler Explosion im Finale.",
  "Stimmung: „The Grand Budapest Hotel“ — verspielte Eleganz mit unterschwelliger Melancholie.",
  "Ästhetik: „Mad Max: Fury Road“ — rohe, kinetische Energie mit klarer emotionaler Linie.",
  "Referenz: „Eternal Sunshine of the Spotless Mind“ — surreale Poesie im Dienst einer Liebesgeschichte.",
];

const SERIES_POTENTIALS: readonly string[] = [
  "Begrenzte Serie (6 Episoden): Jede Episode enthüllt eine neue Schichte des Rätsels, Staffel-Arc mit offenem Finale für potenzielle Fortsetzung.",
  "Anthologie-Format: Jede Staffel erzählt eine eigenständige Geschichte innerhalb der gleichen Welt — ideal für Streaming-Plattformen.",
  "TV-Mehrteiler (3 × 90 Min.): Klassische Struktur mit klaren Cliffhangers, geeignet für öffentlich-rechtliche Sender.",
  "Streaming-Feature mit Franchise-Potenzial: Der Film legt den Grundstein für ein Universum, das in Spin-offs weitererzählt werden kann.",
];

const TERRITORY_POOL: readonly TerritoryEntry[] = [
  { territory: "Deutschland", language: "Deutsch", marketTrend: "Größter Buchmarkt Europas, hohe Adaptionsbereitschaft für TV und Streaming.", pitchAngle: "Förderfähig (FFA, DFFF), starke Co-Produktionskultur, ZDF/ARD als Erstkäufer." },
  { territory: "Spanien", language: "Spanisch", marketTrend: "Brücke zum LATAM-Raum, wachsender Streaming-Markt (Movistar+, Netflix).", pitchAngle: "Gemeinsame Sprachrechte mit Lateinamerika bündelbar, hohe Nachfrage nach Drama-Serien." },
  { territory: "Frankreich", language: "Französisch", marketTrend: "Preisgebundene Buchpreise, starker literarischer Feuilleton-Einfluss.", pitchAngle: "CNC-Förderung für Adaptionen, starke Festival-Präsenz (Cannes, Annecy)." },
  { territory: "Japan", language: "Japanisch", marketTrend: "Hohe Lizenzdisziplin, starke Manga-/Adaptionsnähe, wachsender Anime-Markt.", pitchAngle: "The English Agency als Co-Agent, hohe Nachfrage nach internationalen Thrillern und Dramen." },
  { territory: "USA", language: "Englisch", marketTrend: "Größter Einzelmarkt, Studios kaufen Welt- oder US-Rechte.", pitchAngle: "Weltvertrieb über Major-Studios oder Streaming-Plattformen, hohe Vorschüsse möglich." },
  { territory: "UK", language: "Englisch", marketTrend: "Starker Hörbuch- und Taschenbuchmarkt, hohe Bibliotheksnachfrage.", pitchAngle: "BBC/ITV als potenzielle Co-Produzenten, starke Literaturverfilmungs-Tradition." },
];

const SALES_DATA_TEMPLATES: readonly string[] = [
  "Geschätzter Marktwert: 50.000–150.000 € je Territorium (abhängig von Marktgröße und Auflage).",
  "Vorschussrahmen: 10.000–50.000 € je Territorium, Rückvergütung nach 24 Monaten.",
  "Gesamtpotenzial: 200.000–500.000 € über alle Territorien hinweg (konservativ geschätzt).",
];

const FAIR_STRATEGIES: readonly string[] = [
  "Frankfurter Buchmesse: Direkter Kontakt zu Co-Agenten, Pitch-Sessions, Rechte-Markt.",
  "London Book Fair: Fokus auf englischsprachige Territorien, Hörbuch- und TV-Rechte.",
  "Bologna Children's Book Fair: Spezialisiert auf Kinder- und YA-Rechte, Illustration und Adaption.",
  "Leipziger Buchmesse: Germanischer Raum, Literaturverfilmung, regionale Förderung.",
];

// ---------------------------------------------------------------------------
// EXPORT: buildFilmRightsDossier
// ---------------------------------------------------------------------------

/**
 * Baut ein Film-/TV-Verwertungs-Dossier (1-Seiter) für ein Projekt.
 *
 * @param project Titel, Genre und optionale Logline des Projekts.
 * @param seed    Seed für reproduzierbare Ergebnisse.
 */
export function buildFilmRightsDossier(project: RightsProject, seed: number): FilmRightsDossier {
  const title = project.title || "Ohne Titel";
  const genre = project.genre || "Drama";
  const rng = createSeededRandom(hashString(`film:${title}:${genre}:${seed}`));

  const logline = project.logline || pick(LOGLINE_TEMPLATES, rng);
  const marketComparison = pick(MARKET_COMPARISONS, rng);
  const castingSuggestions = pickUnique(CASTING_POOL, 3, rng);
  const tonalReference = pick(TONAL_REFERENCES, rng);
  const seriesPotential = pick(SERIES_POTENTIALS, rng);

  const onePageText = [
    `Titel: ${title}`,
    `Genre: ${genre}`,
    ``,
    `LOGLINE:`,
    logline,
    ``,
    `MARKTVERGLEICH:`,
    marketComparison,
    ``,
    `CASTING:`,
    ...castingSuggestions.map((c) => `• ${c.role} — ${c.actorType}: ${c.description}`),
    ``,
    `TONALE REFERENZ:`,
    tonalReference,
    ``,
    `SERIENPOTENZIAL:`,
    seriesPotential,
  ].join("\n");

  return {
    logline,
    marketComparison,
    castingSuggestions,
    tonalReference,
    seriesPotential,
    onePageText,
  };
}

// ---------------------------------------------------------------------------
// EXPORT: buildForeignRightsGuide
// ---------------------------------------------------------------------------

/**
 * Baut einen Auslandsrechte-Leitfaden für ein Projekt.
 *
 * @param project Titel und Genre des Projekts.
 * @param seed    Seed für reproduzierbare Ergebnisse.
 */
export function buildForeignRightsGuide(project: RightsProject, seed: number): ForeignRightsGuide {
  const title = project.title || "Ohne Titel";
  const genre = project.genre || "Drama";
  const rng = createSeededRandom(hashString(`foreign:${title}:${genre}:${seed}`));

  const territories = pickUnique(TERRITORY_POOL, TERRITORY_POOL.length, rng);
  const salesData = pick(SALES_DATA_TEMPLATES, rng);
  const fairStrategy = pick(FAIR_STRATEGIES, rng);

  return {
    territories,
    salesData,
    fairStrategy,
  };
}

// ---------------------------------------------------------------------------
// EXPORT: generateRightsPitchPdf
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen druckfertigen PDF-Pitch (A4) aus Dossier und Auslands-Leitfaden.
 *
 * @param project Titel und Genre des Projekts.
 * @param seed    Seed für reproduzierbare Ergebnisse.
 */
export function generateRightsPitchPdf(project: RightsProject, seed: number): RightsPitchPdf {
  const title = project.title || "Ohne Titel";
  const genre = project.genre || "Drama";

  const dossier = buildFilmRightsDossier(project, seed);
  const guide = buildForeignRightsGuide(project, seed);

  const sections: PdfSection[] = [
    {
      heading: "Logline",
      body: dossier.logline,
    },
    {
      heading: "Marktvergleich",
      body: dossier.marketComparison,
    },
    {
      heading: "Casting-Vorschläge",
      body: dossier.castingSuggestions.map((c) => `${c.role} (${c.actorType}): ${c.description}`).join("\n"),
    },
    {
      heading: "Tonale Referenz",
      body: dossier.tonalReference,
    },
    {
      heading: "Serienpotenzial",
      body: dossier.seriesPotential,
    },
    {
      heading: "Auslandsrechte — Territorien",
      body: guide.territories.map((t) => `${t.territory} (${t.language}): ${t.marketTrend}`).join("\n"),
    },
    {
      heading: "Verkaufsdaten",
      body: guide.salesData,
    },
    {
      heading: "Messen-Strategie",
      body: guide.fairStrategy,
    },
  ];

  const svgPreview = buildSvgPreview(title, genre, sections);

  return {
    title,
    sections,
    pageCount: 1,
    printReady: true,
    svgPreview,
  };
}

// ---------------------------------------------------------------------------
// EXPORT: Factory-Funktionen
// ---------------------------------------------------------------------------

/** Liefert ein Beispiel-Rechte-Projekt für Demo-Zwecke. */
export function createSampleRightsProject(): RightsProject {
  return { title: "Das Zwölfgestirn", genre: "Fantasy-Thriller" };
}

/** Liefert ein vollständiges Beispiel-Film-Dossier für Demo-Zwecke. */
export function createSampleDossier(): FilmRightsDossier {
  return buildFilmRightsDossier(createSampleRightsProject(), 42);
}

// ---------------------------------------------------------------------------
// INTERNE HILFSFUNKTIONEN (SVG)
// ---------------------------------------------------------------------------

/** Baut eine elegante 1-Seiten-Dossier-Vorschau als SVG-String. */
function buildSvgPreview(title: string, genre: string, sections: PdfSection[]): string {
  const W = 595;
  const H = 842;
  const margin = 40;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="#faf8f5"/>`,
    `<rect x="0" y="0" width="${W}" height="60" fill="#1a1a2e"/>`,
    `<text x="${margin}" y="38" font-family="Georgia, serif" font-size="20" fill="#ffffff" font-weight="bold">${escapeXml(title)}</text>`,
    `<text x="${W - margin}" y="38" font-family="Georgia, serif" font-size="12" fill="#cccccc" text-anchor="end">${escapeXml(genre)}</text>`,
  ];

  let y = 90;
  for (const section of sections) {
    parts.push(`<text x="${margin}" y="${y}" font-family="Georgia, serif" font-size="13" fill="#1a1a2e" font-weight="bold">${escapeXml(section.heading)}</text>`);
    y += 18;
    const bodyLines = wrapText(section.body, 80);
    for (const line of bodyLines) {
      parts.push(`<text x="${margin}" y="${y}" font-family="Georgia, serif" font-size="10" fill="#333333">${escapeXml(line)}</text>`);
      y += 14;
    }
    y += 10;
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

/** Bricht Text in Zeilen fester Breite um. */
function wrapText(text: string, width: number): string[] {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current = "";
  for (const w of words) {
    if (current.length === 0) {
      current = w;
    } else if ((current + " " + w).length <= width) {
      current += " " + w;
    } else {
      out.push(current);
      current = w;
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

/** Escaped XML-Sonderzeichen für SVG-Text. */
function escapeXml(value: string): string {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
