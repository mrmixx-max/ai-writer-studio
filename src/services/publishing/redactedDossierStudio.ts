/**
 * redactedDossierStudio.ts — Dienstleistung für redigierte Dossiers und
 * Zensur-Inschriften im Stil von Conspiracy / politischen Thrillern.
 *
 * Meilenstein 57.0 (v6.9.0)
 *
 * Alle Zufallsoperationen laufen ausschließlich über
 * {@link createSeededRandom} mit {@link hashString} als Seed-Quelle,
 * damit dieselben Eingaben stets dieselben Ausgaben liefern (deterministisch).
 */

// ---------------------------------------------------------------------------
// PRIMITIVE: Hash & Zufall
// ---------------------------------------------------------------------------

/**
 * FNV-1a (32-Bit). Liefert einen unsigned 32-Bit-Hash zurück.
 * Deterministisch, browser-kompatibel, keine Node-Abhängigkeiten.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV-Prime 16777619, Multiplikation mit Overflow-Schutz
    hash = Math.imul(hash, 0x01000193);
  }
  // Unsigned 32-Bit erzwingen
  return hash >>> 0;
}

/**
 * mulberry32-PRNG. Erzeugt aus einem Seed eine Funktion,
 * die gleichmäßig verteilte Zahlen im Intervall [0, 1) liefert.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// KONSTANTEN
// ---------------------------------------------------------------------------

/** Behördenzuordnung zur jeweiligen Klassifizierung. */
const AGENCY_MAP: Readonly<Record<string, string>> = {
  "TOP SECRET / EYES ONLY": "CIA — Central Intelligence Agency",
  "BND STRENG GEHEIM": "BND — Bundesnachrichtendienst",
  "KGB СОВЕРШЕННО СЕКРЕТНО": "KGB — Komitet gosudarstvennoy bezopasnosti",
  DECLASSIFIED: "FOIA — Freedom of Information Act",
};

/** Beschreibende Sätze für die Notizen in der Dossier-Exportroutine. */
const DOSSIER_NOTES: readonly string[] = [
  "Dossier enthält redigierte Passagen nach amtlicher Prüfung.",
  "Schwärzungen wurden durch zuständige Stelle veranlasst.",
  "Verteilung nur an berechtigte Empfänger (Need-to-Know).",
  "Archivierung nach gesetzlichen Aufbewahrungsfristen erforderlich.",
  "Diese Unterlieferung ersetzt keine gerichtliche Entscheidung.",
];

// ---------------------------------------------------------------------------
// HILFSFUNKTIONEN
// ---------------------------------------------------------------------------

/**
 * Ermittelt das aktuelle Datum als ISO-String (YYYY-MM-DD).
 * Nutzt `Date` — keine Node-spezifischen APIs.
 */
function currentDateISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Formatiert eine Zufallszahl als sechsstelliges numerisches Etikett.
 */
function formatNumber(value: number, length = 6): string {
  return String(Math.abs(Math.floor(value))).padStart(length, "0").slice(-length);
}

// ---------------------------------------------------------------------------
// EXPORT: redactText — Interaktiver Schwärzungs-Stift
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine Schwärzung des Eingabetextes: zufällige Wörter werden
 * durch schwarze Balken (██████) ersetzt. Die Anzahl der Schwärzungen
 * richtet sich nach dem angegebenen Redaktionsverhältnis.
 *
 * @param text          Der zu redigierende Text.
 * @param redactionRatio Anteil der zu schwärzenden Wörter (0–1).
 * @param seed          Seed für reproduzierbare Ergebnisse.
 * @returns Objekt mit redigiertem Text, Zählung und Klassifizierung.
 */
export function redactText(
  text: string,
  redactionRatio: number = 0.3,
  seed: number
): {
  redactedText: string;
  redactionCount: number;
  redactionRatio: number;
  classification: string;
} {
  const rng = createSeededRandom(hashString("redact:" + seed));
  const words = text.split(/(\s+)/); // Leerzeichen als separate Tokens
  const meaningful = words.filter((w) => /\w/.test(w));
  const targetCount = Math.max(0, Math.round(meaningful.length * redactionRatio));

  // Indizes der zu schwärzenden Wörter zufällig bestimmen
  const indices = new Set<number>();
  while (indices.size < targetCount) {
    indices.add(Math.floor(rng() * meaningful.length));
  }

  const blocks = "██████";
  const result: string[] = [];
  let meaningfulIndex = 0;
  let redactionCount = 0;

  for (const token of words) {
    if (/\w/.test(token)) {
      if (indices.has(meaningfulIndex)) {
        result.push(blocks);
        redactionCount++;
      } else {
        result.push(token);
      }
      meaningfulIndex++;
    } else {
      result.push(token);
    }
  }

  const classification =
    redactionRatio >= 0.6
      ? "KGB СОВЕРШЕННО СЕКРЕТНО"
      : redactionRatio >= 0.4
        ? "TOP SECRET / EYES ONLY"
        : redactionRatio >= 0.2
          ? "BND STRENG GEHEIM"
          : "DECLASSIFIED";

  return {
    redactedText: result.join(""),
    redactionCount,
    redactionRatio,
    classification,
  };
}

// ---------------------------------------------------------------------------
// EXPORT: generateOfficialStamp — Offizieller Dienst-Stempel (SVG)
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen offiziellen Dienst-Stempel als Inline-SVG.
 * Der Stempel enthält einen Kreis-Rahmen, Klassifizierungs- und
 * Behördennamen sowie das aktuelle Datum. Farben werden ausschließlich
 * über Design-Tokens (CSS-Variablen) gesetzt — keine Hardcoding von Hex-Werten.
 *
 * @param classification Klassifizierungsstufe.
 * @param seed           Seed für reproduzierbare Ergebnisse.
 * @returns SVG-Metadaten und -Markup.
 */
export function generateOfficialStamp(
  classification: string,
  seed: number
): {
  svg: string;
  classification: string;
  agency: string;
  date: string;
  description: string;
} {
  const rng = createSeededRandom(hashString("stamp:" + seed));
  const date = currentDateISO();
  const agency = AGENCY_MAP[classification] ?? "Unbekannte Behörde";
  const rotation = (rng() * 8 - 4).toFixed(1); // −4° bis +4°
  const reference = formatNumber(Math.floor(rng() * 1_000_000));

  // Design-Tokens statt Hex-Farben — ausschließlich CSS-Variablen
  const inkColor = "var(--color-text-primary)";
  const accentColor = "var(--color-accent-danger)";
  const borderColor = "var(--color-border-strong)";
  const bgColor = "var(--color-surface-raised)";

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300" role="img" aria-label="Offizieller Dienst-Stempel: ${classification}">`,
    `  <defs>`,
    `    <style>`,
    `      .stamp-frame { fill: none; stroke: ${borderColor}; stroke-width: 4; }`,
    `      .stamp-accent { fill: none; stroke: ${accentColor}; stroke-width: 1.5; }`,
    `      .stamp-text { font-family: var(--font-mono, monospace); font-size: 11px; fill: ${inkColor}; text-anchor: middle; }`,
    `      .stamp-classification { font-family: var(--font-mono, monospace); font-size: 13px; font-weight: bold; fill: ${accentColor}; text-anchor: middle; }`,
    `      .stamp-agency { font-family: var(--font-mono, monospace); font-size: 9px; fill: ${inkColor}; text-anchor: middle; }`,
    `    </style>`,
    `  </defs>`,
    `  <rect width="300" height="300" fill="${bgColor}" />`,
    `  <g transform="rotate(${rotation} 150 150)">`,
    `    <circle class="stamp-frame" cx="150" cy="150" r="140" />`,
    `    <circle class="stamp-accent" cx="150" cy="150" r="128" />`,
    `    <circle class="stamp-accent" cx="150" cy="150" r="118" />`,
    `    <text class="stamp-classification" x="150" y="100">${escapeXml(classification)}</text>`,
    `    <text class="stamp-text" x="150" y="125">amtliche Beglaubigung</text>`,
    `    <line class="stamp-accent" x1="40" y1="145" x2="260" y2="145" />`,
    `    <text class="stamp-agency" x="150" y="170">${escapeXml(agency)}</text>`,
    `    <text class="stamp-text" x="150" y="190">Datum: ${date}</text>`,
    `    <text class="stamp-text" x="150" y="210">Ref.-Nr.: ${reference}</text>`,
    `    <text class="stamp-agency" x="150" y="260">★ vertraulich ★</text>`,
    `  </g>`,
    `</svg>`,
  ].join("\n");

  return {
    svg,
    classification,
    agency,
    date,
    description: `Offizieller Dienst-Stempel der ${agency} mit Klassifizierung „${classification}“, datiert auf ${date}.`,
  };
}

// ---------------------------------------------------------------------------
// EXPORT: buildDossierExport — Schreibmaschinen-Dossier
// ---------------------------------------------------------------------------

/**
 * Baut einen vollständigen Dossier-Export im Schreibmaschinen-Stil:
 * Markdown mit Monospace-Schrift, rotigenierten Abschnitten, Stempel und
 * Klassifizierungs-Kopfzeile.
 *
 * @param title          Titel des Dossiers.
 * @param content        Fließtext (wird redigiert).
 * @param classification Klassifizierungsstufe.
 * @param seed           Seed für reproduzierbare Ergebnisse.
 * @returns Markdown, SVG-Stempel, Metadaten und Begleitnotizen.
 */
export function buildDossierExport(
  title: string,
  content: string,
  classification: string,
  seed: number
): {
  markdown: string;
  stamp: { svg: string; classification: string };
  metadata: { pages: number; copies: number; date: string };
  notes: string[];
} {
  const rng = createSeededRandom(hashString("dossier:" + seed));
  const date = currentDateISO();
  const agency = AGENCY_MAP[classification] ?? "Unbekannte Behörde";
  const pages = Math.max(1, Math.ceil(content.length / 1800));
  const copies = Math.floor(rng() * 47) + 3;

  const redacted = redactText(content, 0.35, seed);
  const stamp = generateOfficialStamp(classification, seed);

  const selectedNotes: string[] = [];
  const notePool = [...DOSSIER_NOTES];
  while (selectedNotes.length < 3 && notePool.length > 0) {
    const idx = Math.floor(rng() * notePool.length);
    selectedNotes.push(notePool.splice(idx, 1)[0]);
  }

  const markdown = [
    `# ${title}`,
    ``,
    `> **KLASSIFIZIERUNG: ${classification}**`,
    ``,
    `| Feld      | Wert                              |`,
    `|-----------|-----------------------------------|`,
    `| Behörde   | ${agency}                         |`,
    `| Datum     | ${date}                           |`,
    `| Seiten    | ${pages}                          |`,
    `| Exemplare | ${copies}                         |`,
    `| Redaktion | ${redacted.redactionCount} Schwärzungen (${Math.round(redacted.redactionRatio * 100)} %) |`,
    ``,
    `---`,
    ``,
    redacted.redactedText,
    ``,
    `---`,
    ``,
    `## Stempel`,
    ``,
    stamp.svg,
    ``,
    `## Begleitnotizen`,
    ``,
    ...selectedNotes.map((n) => `- ${n}`),
    ``,
    `*Erstellt am ${date} durch redactedDossierStudio — vertraulich.*`,
  ].join("\n");

  return {
    markdown,
    stamp: { svg: stamp.svg, classification: stamp.classification },
    metadata: { pages, copies, date },
    notes: selectedNotes,
  };
}

// ---------------------------------------------------------------------------
// EXPORT: Factory-Funktionen
// ---------------------------------------------------------------------------

/**
 * Liefert einen Beispieltext mit redigierten Passagen für Demo-Zwecke.
 */
export function createSampleRedactedText(): {
  redactedText: string;
  redactionCount: number;
  redactionRatio: number;
  classification: string;
} {
  const sample =
    "Der Informant, Codename NACHTFALCON, traf sich am 14. März mit einem " +
    "unkontaktierten Offizier der regulären Streitkräfte in einem Parkhaus " +
    "nahe der Hauptverkehrsader. Übergeben wurde ein Mikrofilm, der " +
    "Aufnahmen von Waffenlieferungen an eine nicht genannte Organisation " +
    "enthielt. Der Treffpunkt wurde im Voraus durch Zivilstreifen " +
    "überwacht; die übertragene Datei gilt als authentisch.";

  return redactText(sample, 0.35, 1337);
}

/**
 * Liefert ein vollständiges Beispiel-Dossier für Demo-Zwecke.
 */
export function createSampleDossierExport(): {
  markdown: string;
  stamp: { svg: string; classification: string };
  metadata: { pages: number; copies: number; date: string };
  notes: string[];
} {
  return buildDossierExport(
    "AKTE NACHTFALCON — Lagebericht",
    createSampleRedactedText().redactedText,
    "BND STRENG GEHEIM",
    42
  );
}

// ---------------------------------------------------------------------------
// INTERNE HILFSFUNKTION
// ---------------------------------------------------------------------------

/**
 * Escapt XML-Sonderzeichen für sicheres Einbetten in SVG.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
