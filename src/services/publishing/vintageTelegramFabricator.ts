// vintageTelegramFabricator.ts — Historischer Telegramm- & Telex-Fabrikator
// Meilenstein 62.0 (v7.4.0), WP 128.1
//
// Enthält:
//  - Vier Epochen-Formulare (Western Union, Seekabel-Depesche,
//    Militärtelegramm, Kalter-Krieg-Telex) mit Kopftext und Papierton.
//  - Fabrikator für aufgeklebte Fernschreiber-Bänder: die Wörter der Depesche
//    werden als einzelne Papierstreifen ausgeschnitten und schief aufgeklebt.
//  - Dringlichkeits- und Stempel-Generator inkl. Morse-Kopfzeile.
//  - Druckfertiger 300-DPI-SVG-Export (printReady) für die Werkstatt.
//
// Deterministisch: FNV-1a + mulberry32. Ausschließlich Design-Tokens
// (var(--…)) und currentColor, keine Hex-Farben. Keine Node-Module,
// browserkompatibel. Alle Zufallsoperationen laufen über
// createSeededRandom mit hashString als Seed-Quelle.

// ---------------------------------------------------------------------------
// PRIMITIVE: Hash & Zufall
// ---------------------------------------------------------------------------

/** FNV-1a (32-Bit). Liefert einen unsigned 32-Bit-Hash zurück. */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // FNV-Prime 16777619, Multiplikation mit Overflow-Schutz
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * mulberry32-PRNG. Erzeugt aus einem Seed eine Funktion, die gleichmäßig
 * verteilte Zahlen im Intervall [0, 1) liefert.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function (): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wählt ein Element deterministisch; wirft bei leerem Array. */
function pick<T>(arr: readonly T[], rng: () => number): T {
  if (!arr || arr.length === 0) throw new Error("pick: leeres Array");
  const idx = Math.min(Math.floor(rng() * arr.length), arr.length - 1);
  return arr[idx];
}

// ---------------------------------------------------------------------------
// HILFSFUNKTIONEN
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Escapt XML-Sonderzeichen für sicheres Einbetten in SVG. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ---------------------------------------------------------------------------
// EPOCHE 1 — Vier historische Telegramm-Formulare
// ---------------------------------------------------------------------------

export interface TelegramEra {
  id: string;
  name: string;
  year: number;
  description: string;
  headerText: string;
  paperTone: string;
}

export const TELEGRAM_ERAS = [
  {
    id: "westernUnion",
    name: "Viktorianisches Western Union",
    year: 1890,
    description:
      "Viktorianisches Western-Union-Formular von 1890: kräftiges Elfenbein-Papier, " +
      "gedruckter Firmenkopf „WESTERN UNION TELEGRAPH COMPANY“ und die klassische " +
      "Zehn-Wort-Gebühr des Telegraphenzeitalters.",
    headerText: "WESTERN UNION TELEGRAPH COMPANY",
    paperTone: "var(--paper-vintage)",
  },
  {
    id: "submarineCable",
    name: "Seekabel-Depesche",
    year: 1914,
    description:
      "Seekabel-Depesche von 1914: dünnes, grünlich getöntes Kabelpapier mit " +
      "Marconi-Vermerk — teure Wörter wurden vor der Aufgabe im Code-Buch " +
      "verschlüsselt, um Kabelgebühren zu sparen.",
    headerText: "EASTERN TELEGRAPH COMPANY — CABLEGRAM",
    paperTone: "var(--paper-cable)",
  },
  {
    id: "military",
    name: "Militärtelegramm",
    year: 1944,
    description:
      "Militärtelegramm von 1944: grobes Kraftpapier mit Stempelzeile und " +
      "Zensurvermerk. Der Nachrichtentext wurde zuvor in Buchstabengruppen " +
      "zerlegt und mit dem Einmal-Schlüssel verschlüsselt.",
    headerText: "WAR DEPARTMENT — TELEGRAM",
    paperTone: "var(--paper-kraft)",
  },
  {
    id: "coldWarTelex",
    name: "Kalter-Krieg-Telex-Streifen",
    year: 1975,
    description:
      "Kalter-Krieg-Telex von 1975: endloser Fernschreiberstreifen mit " +
      "Lochrändern, in Buchstaben-Großschrift gesetzt und auf Formularträger " +
      "geklebt — das Arbeitspferd der Nachrichtendienste.",
    headerText: "TELEX — GOVERNMENT CIRCUIT",
    paperTone: "var(--paper-telex)",
  },
] as const satisfies readonly TelegramEra[];

export function getTelegramEra(id: string): TelegramEra | undefined {
  return TELEGRAM_ERAS.find((era) => era.id === id);
}

// ---------------------------------------------------------------------------
// DRINGLICHKEITS- & STEMPEL-POOLS
// ---------------------------------------------------------------------------

const URGENCY_POOL: readonly string[] = [
  "URGENT - PRIORITY 1",
  "CABLEGRAM VIA MARCONI",
  "RUSH - ALL STATIONS",
  "EXPEDITE - NIGHT DESK",
  "MOST IMMEDIATE",
  "CONFIDENTIAL WIRE",
];

const ERA_URGENCY: Readonly<Record<string, readonly string[]>> = {
  westernUnion: ["RUSH - ALL STATIONS", "URGENT - PRIORITY 1", "EXPEDITE - NIGHT DESK"],
  submarineCable: ["CABLEGRAM VIA MARCONI", "URGENT - PRIORITY 1", "MOST IMMEDIATE"],
  military: ["MOST IMMEDIATE", "URGENT - PRIORITY 1", "FLASH - SECRET"],
  coldWarTelex: ["TELEX - IMMEDIATE", "URGENT - PRIORITY 1", "CONFIDENTIAL WIRE"],
};

const STAMP_POOL: Readonly<Record<string, readonly string[]>> = {
  westernUnion: ["RECEIVED", "PAID", "COLLECT", "NIGHT LETTER", "W.U. TEL. CO."],
  submarineCable: ["VIA MARCONI", "CABLE", "DEFERRED", "CODE BOOK", "RECEIVED"],
  military: ["SECRET", "PRIORITY", "WAR DEPT.", "CENSORED", "OPERATIONS"],
  coldWarTelex: ["TELEX", "SECRET", "PRIORITY", "COPY 001", "GOVT CIRCUIT"],
};

const GENERIC_STAMP: readonly string[] = ["RECEIVED", "FILED", "COPY", "URGENT"];

// ---------------------------------------------------------------------------
// MORSE-CODE
// ---------------------------------------------------------------------------

const MORSE_CODE: Readonly<Record<string, string>> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.",
  G: "--.", H: "....", I: "..", J: ".---", K: "-.-", L: ".-..",
  M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.",
  S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
  "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "/": "-..-.",
  "-": "-....-", ":": "---...", ";": "-.-.-.", "@": ".--.-.",
  "(": "-.--.", ")": "-.--.-", "'": ".----.", "=": "-...-",
};

/** Übersetzt Text in Morsecode; Leerzeichen werden zu „/“. */
function morseOf(text: string): string {
  const upper = text.toUpperCase();
  const out: string[] = [];
  for (const ch of upper) {
    if (ch === " ") {
      out.push("/");
      continue;
    }
    const code = MORSE_CODE[ch];
    if (code) out.push(code);
  }
  return out.join(" ");
}

// ---------------------------------------------------------------------------
// WP 128.1.2 — Dringlichkeits- & Stempel-Generator
// ---------------------------------------------------------------------------

export interface UrgencyStamp {
  urgency: string;
  stamps: string[];
  morseHeader: string;
}

/**
 * Erzeugt Dringlichkeitsvermerk, Stempelsatz und Morse-Kopfzeile für eine
 * Epoche. Deterministisch über eraId und seed.
 */
export function generateUrgencyStamp(eraId: string, seed: number): UrgencyStamp {
  const rng = createSeededRandom(hashString(`urgency:${eraId}:${seed}`));
  const urgencyPool = ERA_URGENCY[eraId] ?? URGENCY_POOL;
  const urgency = pick(urgencyPool, rng);

  const stampPool = STAMP_POOL[eraId] ?? GENERIC_STAMP;
  const count = 2 + Math.floor(rng() * 3); // 2 bis 4 Stempel
  const stamps: string[] = [];
  for (let i = 0; i < count; i++) {
    stamps.push(pick(stampPool, rng));
  }

  return {
    urgency,
    stamps,
    morseHeader: morseOf(urgency),
  };
}

// ---------------------------------------------------------------------------
// WP 128.1.1 — Aufgeklebte Fernschreiber-Bänder
// ---------------------------------------------------------------------------

export interface TelegramInput {
  recipient: string;
  sender: string;
  message: string;
  eraId: string;
}

export interface TelegramFabrication {
  era: string;
  header: string;
  body: string;
  strips: string[];
  urgency: string;
  stamps: string[];
  morsecode: string;
  svg: string;
}

interface StripCell {
  word: string;
  x: number;
  w: number;
}

function renderTelegramSvg(params: {
  era: TelegramEra;
  recipient: string;
  sender: string;
  strips: string[];
  urgency: string;
  stamps: string[];
  morsecode: string;
  rng: () => number;
}): string {
  const width = 620;
  const margin = 28;
  const headerH = 92;
  const infoH = 64;
  const stripH = 34;
  const stripGap = 8;
  const morseH = 40;
  const innerW = width - margin * 2;

  // Bänder in Reihen umbrechen.
  const rows: StripCell[][] = [];
  let current: StripCell[] = [];
  let cursorX = 0;
  for (const word of params.strips) {
    const w = Math.max(30, word.length * 9 + 18);
    if (cursorX + w > innerW && current.length > 0) {
      rows.push(current);
      current = [];
      cursorX = 0;
    }
    current.push({ word, x: cursorX, w });
    cursorX += w + stripGap;
  }
  if (current.length > 0) rows.push(current);

  const stripsTop = headerH + infoH + 16;
  const stripsH = rows.length * (stripH + stripGap);
  const height = Math.max(420, stripsTop + stripsH + morseH + margin);

  const parts: string[] = [];

  // Papier und Außenrahmen.
  parts.push(`<rect x="0" y="0" width="${width}" height="${height}" style="fill: ${params.era.paperTone}" />`);
  parts.push(
    `<rect x="${margin / 2}" y="${margin / 2}" width="${width - margin}" height="${height - margin}" style="fill: none; stroke: currentColor" stroke-width="1.2" opacity="0.55" />`
  );

  // Kopfzeile.
  parts.push(
    `<rect x="${margin / 2}" y="${margin / 2}" width="${width - margin}" height="${headerH}" style="fill: none; stroke: currentColor" stroke-width="1" opacity="0.5" />`
  );
  parts.push(
    `<text x="${width / 2}" y="${margin / 2 + 38}" text-anchor="middle" style="fill: currentColor; font-family: var(--font-mono, monospace); font-weight: bold; letter-spacing: 2px" font-size="20">${escapeXml(params.era.headerText)}</text>`
  );
  parts.push(
    `<text x="${width / 2}" y="${margin / 2 + 60}" text-anchor="middle" style="fill: currentColor; font-family: var(--font-mono, monospace)" font-size="11" opacity="0.75">${escapeXml(params.era.name)} · ${params.era.year}</text>`
  );

  // Dringlichkeit oben rechts.
  parts.push(
    `<text x="${width - margin - 8}" y="${margin / 2 + 74}" text-anchor="end" style="fill: currentColor; font-family: var(--font-mono, monospace); font-weight: bold" font-size="12">${escapeXml(params.urgency)}</text>`
  );

  // Empfänger / Absender.
  const infoY = margin / 2 + headerH;
  parts.push(
    `<line x1="${margin / 2}" y1="${infoY}" x2="${width - margin / 2}" y2="${infoY}" style="stroke: currentColor" stroke-width="0.8" opacity="0.4" />`
  );
  parts.push(
    `<text x="${margin}" y="${infoY + 22}" style="fill: currentColor; font-family: var(--font-mono, monospace)" font-size="12">AN: ${escapeXml(params.recipient)}</text>`
  );
  parts.push(
    `<text x="${margin}" y="${infoY + 44}" style="fill: currentColor; font-family: var(--font-mono, monospace)" font-size="12">VON: ${escapeXml(params.sender)}</text>`
  );

  // Stempel rechts unterhalb der Dringlichkeit.
  let stampX = width - margin - 10;
  for (const stamp of params.stamps) {
    const rot = (params.rng() * 8 - 4).toFixed(1);
    const boxW = Math.max(64, stamp.length * 8 + 20);
    parts.push(
      `<g transform="translate(${round2(stampX - boxW)} ${infoY + 14}) rotate(${rot})">` +
        `<rect x="0" y="0" width="${boxW}" height="24" rx="3" style="fill: none; stroke: currentColor" stroke-width="1.4" opacity="0.8" />` +
        `<text x="${boxW / 2}" y="16" text-anchor="middle" style="fill: currentColor; font-family: var(--font-mono, monospace); font-weight: bold; letter-spacing: 1px" font-size="10" opacity="0.9">${escapeXml(stamp)}</text>` +
        `</g>`
    );
    stampX -= boxW + 12;
  }

  // Aufgeklebte Fernschreiber-Bänder.
  let y = stripsTop;
  for (const row of rows) {
    for (const strip of row) {
      const rot = (params.rng() * 3 - 1.5).toFixed(1);
      const x = margin + strip.x;
      parts.push(
        `<g transform="translate(${round2(x)} ${round2(y)}) rotate(${rot})">` +
          `<rect x="0" y="0" width="${strip.w}" height="${stripH - 8}" rx="2" style="fill: none; stroke: currentColor" stroke-width="1.1" opacity="0.85" />` +
          `<line x1="0" y1="${stripH - 8}" x2="${strip.w}" y2="${stripH - 8}" stroke-dasharray="3 3" style="stroke: currentColor" stroke-width="0.8" opacity="0.5" />` +
          `<text x="${strip.w / 2}" y="18" text-anchor="middle" style="fill: currentColor; font-family: var(--font-mono, monospace)" font-size="13">${escapeXml(strip.word)}</text>` +
          `</g>`
      );
    }
    y += stripH + stripGap;
  }

  // Morsezeile am Fuß.
  const morseY = height - margin - 8;
  parts.push(
    `<line x1="${margin}" y1="${morseY - 22}" x2="${width - margin}" y2="${morseY - 22}" style="stroke: currentColor" stroke-width="0.8" opacity="0.4" />`
  );
  parts.push(
    `<text x="${margin}" y="${morseY}" style="fill: currentColor; font-family: var(--font-mono, monospace); letter-spacing: 1px" font-size="10" opacity="0.85">MORSE: ${escapeXml(params.morsecode)}</text>`
  );

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Historisches Telegramm">\n` +
    `  ${parts.join("\n  ")}\n` +
    `</svg>`
  );
}

/**
 * Fabriziert aus einer Depesche ein historisches Telegramm: Formular,
 * Kopftext, Wort-Bänder, Dringlichkeit, Stempel, Morse und SVG.
 * Deterministisch über alle Eingabefelder und den Seed.
 */
export function fabricateTelegram(input: TelegramInput, seed: number): TelegramFabrication {
  const era = getTelegramEra(input?.eraId) ?? TELEGRAM_ERAS[0];
  const recipient = (input?.recipient ?? "").trim() || "UNBEKANNT";
  const sender = (input?.sender ?? "").trim() || "UNBEKANNT";
  const message = (input?.message ?? "").trim() || "KEIN TEXT";

  const rng = createSeededRandom(
    hashString(`telegram:${era.id}:${recipient}:${sender}:${message}:${seed}`)
  );

  const strips = message.split(/\s+/).filter((word) => word.length > 0);
  if (strips.length === 0) strips.push("KEIN TEXT");
  const body = strips.join(" ");

  const stampInfo = generateUrgencyStamp(era.id, seed);
  const morsecode = morseOf(message);

  const svg = renderTelegramSvg({
    era,
    recipient,
    sender,
    strips,
    urgency: stampInfo.urgency,
    stamps: stampInfo.stamps,
    morsecode,
    rng,
  });

  return {
    era: era.id,
    header: era.headerText,
    body,
    strips,
    urgency: stampInfo.urgency,
    stamps: stampInfo.stamps,
    morsecode,
    svg,
  };
}

// ---------------------------------------------------------------------------
// WP 128.1.3 — 300-DPI-Export
// ---------------------------------------------------------------------------

export interface TelegramPdfExport {
  svg: string;
  width: number;
  height: number;
  dpi: number;
  printReady: boolean;
}

/** Liest Breite/Höhe aus dem Wurzel-SVG-Tag. */
function measureSvg(svg: string): { width: number; height: number } {
  const wm = svg.match(/width="(\d+(?:\.\d+)?)"/);
  const hm = svg.match(/height="(\d+(?:\.\d+)?)"/);
  return {
    width: wm ? Number(wm[1]) : 620,
    height: hm ? Number(hm[1]) : 420,
  };
}

/**
 * Erzeugt eine druckfertige Ausgabe: das fabrizierte Telegramm samt
 * Maßangaben. printReady ist nur wahr, wenn die Fläche die Mindestgröße
 * für 300 DPI erreicht.
 */
export function exportTelegramPdf(input: TelegramInput, seed: number): TelegramPdfExport {
  const fabrication = fabricateTelegram(input, seed);
  const dims = measureSvg(fabrication.svg);
  const dpi = 300;
  const printReady = dims.width >= 300 && dims.height >= 300 && dpi >= 300;

  return {
    svg: fabrication.svg,
    width: dims.width,
    height: dims.height,
    dpi,
    printReady,
  };
}

// ---------------------------------------------------------------------------
// BEISPIELFABRIKEN
// ---------------------------------------------------------------------------

/** Liefert die erste Epoche (Viktorianisches Western Union) als Beispiel. */
export function createSampleEra(): TelegramEra {
  return TELEGRAM_ERAS[0];
}

/** Liefert ein vollständiges Beispiel-Telegramm für Demo-Zwecke. */
export function createSampleTelegram(): TelegramFabrication {
  return fabricateTelegram(
    {
      recipient: "Herrn Dr. Arthur Conan Doyle, London",
      sender: "Redaktion, Strand Magazine",
      message: "Manuskript eingetroffen bitte umgehend Freigabe erteilen erwarten Anweisung",
      eraId: "westernUnion",
    },
    42
  );
}
