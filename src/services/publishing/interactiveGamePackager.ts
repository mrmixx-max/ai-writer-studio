// Master Solo-Spielbuch- & Webgame-Packager (WP 69.2)
//
// Zerlegt eine Geschichte in nummerierte Abschnitte (1–400), mischt sie
// deterministisch durch und passt alle Verweise automatisch an, damit der Leser
// beim Umblättern nicht gespoilert wird. Erzeugt zusätzlich ein druckfertiges
// A5-PDF, ein Standalone-Webgame-HTML und ein itch.io-ZIP.
//
// Eingabeformat (eine Sektion je Abschnitt):
//
//   # Der Wald
//   Du stehst am Rand des Waldes.
//   -> Fliehen | Lichtung
//   -> Kämpfen | Kampf
//
// Design-Regeln (analog narrativeStateMachine):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - KEINE node:-Module — ZIP wird ohne Kompression als STORE-Archiv gebaut,
//     damit keine externen Abhängigkeiten nötig sind.
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Ein Abschnitt des Spielbuchs. */
export interface GamebookSection {
  /** Original-Nummer (Reihenfolge der Eingabe, 1-basiert). */
  originalNumber: number;
  /** Titel. */
  title: string;
  /** Fließtext. */
  body: string;
  /** Ausgehende Verweise. */
  links: Array<{ label: string; targetTitle: string }>;
  /** Zugewiesene Nummer nach dem Scrambler. */
  scrambledNumber: number;
  /** Ziel-Nummern nach dem Scrambler (aufgelöst). */
  scrambledTargets: number[];
}

/** Ergebnis des Scramblers. */
export interface ScrambledGamebook {
  /** Titel des Spielbuchs. */
  title: string;
  /** Alle Abschnitte in Scrambler-Reihenfolge (nach `scrambledNumber`). */
  sections: GamebookSection[];
  /** Anzahl Abschnitte. */
  sectionCount: number;
  /** Anzahl Verweise. */
  linkCount: number;
  /** Verwendeter Seed. */
  seed: number;
  /** Verweise auf unbekannte Titel. */
  brokenLinks: string[];
}

/** Würfeltabelle. */
export interface DiceTable {
  /** Bezeichnung. */
  label: string;
  /** Zeilen der Tabelle. */
  rows: Array<{ roll: string; result: string }>;
}

/** Ergebnis der Spielbuch-Prüfung. */
export interface GamebookValidation {
  /** true, wenn keine Fehler gefunden wurden. */
  valid: boolean;
  /** Fehler. */
  errors: string[];
  /** Warnungen. */
  warnings: string[];
  /** Abschnitte ohne Ausgang (keine Verweise, kein Endabschnitt). */
  deadEnds: number[];
  /** Unerreichbare Abschnitte (niemand verweist darauf). */
  unreachable: number[];
}

// ---------------------------------------------------------------------------
// Deterministischer Zufall
// ---------------------------------------------------------------------------

/** FNV-1a-32-Hash einer Zeichenkette → deterministischer Seed. */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32-PRNG: schnell, deterministisch, Werte in [0, 1). */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates-Shuffle mit deterministischem PRNG.
 *
 * Gibt ein neues Array zurück; die Eingabe wird nie mutiert.
 */
export function shuffleDeterministic<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rand = createSeededRandom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Text defensiv normalisieren. */
function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

/**
 * Normalisiert einen Abschnitts-Bezug für den toleranten Vergleich.
 *
 * Entfernt führende Artikel, damit „Lichtung" auf „Die Lichtung" passt.
 */
function normalizeRef(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/^(der|die|das|den|dem|des|ein|eine|einer|eines|einem|einen)\s+/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Parst die Abschnitts-Eingabe. */
function parseSections(prose: string): Array<Omit<GamebookSection, 'scrambledNumber' | 'scrambledTargets'>> {
  const raw = typeof prose === 'string' ? prose : '';
  const blocks = raw
    .split(/^\s*---\s*$/m)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  return blocks.map((block, i) => {
    const links: Array<{ label: string; targetTitle: string }> = [];
    const bodyLines: string[] = [];
    let title = `Abschnitt ${i + 1}`;

    for (const rawLine of block.split('\n')) {
      const line = rawLine.trim();
      if (line.length === 0) continue;

      // -> Label | Ziel
      const link = line.match(/^->\s*(.+?)\s*\|\s*(.+)$/);
      if (link) {
        links.push({ label: link[1].trim(), targetTitle: link[2].trim() });
        continue;
      }

      // # Titel
      const heading = line.match(/^#+\s*(.+)$/);
      if (heading) {
        title = heading[1].trim();
        continue;
      }

      bodyLines.push(line);
    }

    return { originalNumber: i + 1, title, body: bodyLines.join('\n'), links };
  });
}

// ---------------------------------------------------------------------------
// 1) Paragraphen-Scrambler
// ---------------------------------------------------------------------------

/**
 * Zerlegt eine Geschichte in nummerierte Abschnitte und mischt sie durch.
 *
 * Alle Verweise werden auf die neuen Nummern umgeschrieben. Abschnitt 1 bleibt
 * immer der Einstieg (Nummer 1), damit der Leser weiß, wo er beginnt — die
 * übrigen werden gemischt.
 *
 * Defensiv: ohne Seed wird ein Seed aus dem Inhalt abgeleitet (deterministisch).
 */
export function scrambleGamebook(
  prose: string,
  title?: string,
  seed?: number,
): ScrambledGamebook {
  const safeTitle = normalizeText(title, 'Das Spielbuch');
  const parsed = parseSections(prose);

  const effectiveSeed =
    typeof seed === 'number' && Number.isFinite(seed)
      ? seed >>> 0
      : hashString(`${safeTitle}#${prose}`);

  if (parsed.length === 0) {
    return {
      title: safeTitle,
      sections: [],
      sectionCount: 0,
      linkCount: 0,
      seed: effectiveSeed,
      brokenLinks: [],
    };
  }

  // Einstieg (Abschnitt 1) bleibt Nummer 1; der Rest wird gemischt.
  const rest = parsed.slice(1);
  const shuffledRest = shuffleDeterministic(rest, effectiveSeed);
  const ordered = [parsed[0], ...shuffledRest];

  // Neue Nummern zuweisen.
  const numberByTitle = new Map<string, number>();
  const numberByNormalized = new Map<string, number | null>();
  ordered.forEach((s, i) => {
    // Erster Titel gewinnt bei Duplikaten (deterministisch).
    if (!numberByTitle.has(s.title)) numberByTitle.set(s.title, i + 1);

    // Normalisierter Index für die tolerante Auflösung (Artikel-tolerant).
    const norm = normalizeRef(s.title);
    if (norm.length > 0) {
      if (!numberByNormalized.has(norm)) {
        numberByNormalized.set(norm, i + 1);
      } else if (numberByNormalized.get(norm) !== i + 1) {
        // Mehrdeutig → lieber melden als raten.
        numberByNormalized.set(norm, null);
      }
    }
  });

  /** Löst einen Verweis-Titel auf eine Abschnittsnummer auf. */
  const resolve = (title: string): number | undefined => {
    const exact = numberByTitle.get(title);
    if (exact !== undefined) return exact;
    const norm = normalizeRef(title);
    const viaNorm = numberByNormalized.get(norm);
    if (typeof viaNorm === 'number') return viaNorm;
    // Teilstring nur bei eindeutigem Treffer.
    const candidates = ordered
      .map((s, i) => ({ n: i + 1, norm: normalizeRef(s.title) }))
      .filter((c) => c.norm.length > 0 && norm.length > 0 && (c.norm.includes(norm) || norm.includes(c.norm)));
    return candidates.length === 1 ? candidates[0].n : undefined;
  };

  const brokenLinks: string[] = [];

  const sections: GamebookSection[] = ordered.map((s, i) => {
    const scrambledTargets: number[] = [];
    for (const link of s.links) {
      const target = resolve(link.targetTitle);
      if (target === undefined) {
        brokenLinks.push(`${s.title}: „${link.label}" → „${link.targetTitle}"`);
      } else {
        scrambledTargets.push(target);
      }
    }
    return {
      ...s,
      scrambledNumber: i + 1,
      scrambledTargets,
    };
  });

  return {
    title: safeTitle,
    sections,
    sectionCount: sections.length,
    linkCount: sections.reduce((sum, s) => sum + s.links.length, 0),
    seed: effectiveSeed,
    brokenLinks,
  };
}

// ---------------------------------------------------------------------------
// 2) Spielbuch-Prüfung
// ---------------------------------------------------------------------------

/**
 * Prüft ein Spielbuch auf Sackgassen und unerreichbare Abschnitte.
 *
 * Zwei mathematische Zusagen (Briefing): jedes Ende muss erreichbar sein, und
 * es darf keinen Abschnitt geben, von dem aus kein Ende mehr erreichbar ist
 * (eine Schleife ohne Fortschritt).
 *
 * Defensiv: ein leeres Spielbuch meldet `valid: false`.
 */
export function validateGamebook(
  book: ScrambledGamebook | null | undefined,
): GamebookValidation {
  if (!book || !Array.isArray(book.sections) || book.sections.length === 0) {
    return { valid: false, errors: ['Das Spielbuch enthält keine Abschnitte.'], warnings: [], deadEnds: [], unreachable: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  const byNumber = new Map(book.sections.map((s) => [s.scrambledNumber, s]));

  // Enden = Abschnitte ohne ausgehenden Verweis.
  const endings = new Set(
    book.sections.filter((s) => s.links.length === 0).map((s) => s.scrambledNumber),
  );

  // 1) Vorwärts-Erreichbarkeit ab Abschnitt 1.
  const reachable = new Set<number>();
  const forwardQueue: number[] = [];
  if (byNumber.has(1)) {
    reachable.add(1);
    forwardQueue.push(1);
  }
  while (forwardQueue.length > 0) {
    const current = byNumber.get(forwardQueue.shift() as number);
    if (!current) continue;
    for (const target of current.scrambledTargets) {
      if (byNumber.has(target) && !reachable.has(target)) {
        reachable.add(target);
        forwardQueue.push(target);
      }
    }
  }

  // 2) Rückwärts-Erreichbarkeit: welche Abschnitte können ein Ende erreichen?
  const canReachEnding = new Set<number>(endings);
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of book.sections) {
      if (canReachEnding.has(s.scrambledNumber)) continue;
      if (s.scrambledTargets.some((t) => canReachEnding.has(t))) {
        canReachEnding.add(s.scrambledNumber);
        changed = true;
      }
    }
  }

  // Ein Ende, das niemand erreicht, ist ein Fehler.
  const unreachableEndings = [...endings].filter((n) => !reachable.has(n)).sort((a, b) => a - b);

  // Ein erreichbarer Nicht-Ende-Abschnitt, von dem aus kein Ende erreichbar ist
  // → der Leser hängt in einer Schleife ohne Fortschritt fest.
  const deadEnds = book.sections
    .filter((s) => reachable.has(s.scrambledNumber) && !endings.has(s.scrambledNumber) && !canReachEnding.has(s.scrambledNumber))
    .map((s) => s.scrambledNumber)
    .sort((a, b) => a - b);

  const unreachable = book.sections
    .filter((s) => !reachable.has(s.scrambledNumber))
    .map((s) => s.scrambledNumber)
    .sort((a, b) => a - b);

  if (book.brokenLinks.length > 0) {
    errors.push(`${book.brokenLinks.length} Verweis(e) zeigen auf unbekannte Abschnitte.`);
  }
  if (unreachableEndings.length > 0) {
    errors.push(`${unreachableEndings.length} Ende(n) sind nicht erreichbar.`);
  }
  if (deadEnds.length > 0) {
    errors.push(`${deadEnds.length} Abschnitt(e) führen in eine Schleife ohne Ende.`);
  }
  if (unreachable.length > 0) {
    warnings.push(`${unreachable.length} Abschnitt(e) sind von keinem anderen erreichbar.`);
  }
  if (endings.size === 0) {
    warnings.push('Das Spielbuch hat kein Ende (kein Abschnitt ohne Ausgang).');
  }

  return { valid: errors.length === 0, errors, warnings, deadEnds, unreachable };
}

// ---------------------------------------------------------------------------
// 3) Würfeltabellen
// ---------------------------------------------------------------------------

/** Standard-Würfeltabellen für ein Solo-Spielbuch. */
export function buildDiceTables(): DiceTable[] {
  return [
    {
      label: 'Kampftabelle (2W6)',
      rows: [
        { roll: '2–4', result: 'Schwerer Treffer — 4 Lebenspunkte verlieren' },
        { roll: '5–7', result: 'Treffer — 2 Lebenspunkte verlieren' },
        { roll: '8–9', result: 'Pariert — kein Schaden' },
        { roll: '10–12', result: 'Konter — Gegner verliert 3 Lebenspunkte' },
      ],
    },
    {
      label: 'Fertigkeitenprobe (1W6)',
      rows: [
        { roll: '1', result: 'Kritischer Fehlschlag' },
        { roll: '2–3', result: 'Fehlschlag' },
        { roll: '4–5', result: 'Erfolg' },
        { roll: '6', result: 'Kritischer Erfolg' },
      ],
    },
    {
      label: 'Beute (1W6)',
      rows: [
        { roll: '1–2', result: 'Nichts' },
        { roll: '3–4', result: '5 Goldmünzen' },
        { roll: '5', result: 'Heiltrank' },
        { roll: '6', result: 'Magischer Gegenstand' },
      ],
    },
  ];
}

/** Charakterbogen als Text. */
export function buildCharacterSheet(): string {
  return [
    '=== CHARAKTERBOGEN ===',
    '',
    'Name: ______________________',
    'Beruf: _____________________',
    '',
    'Geschicklichkeit:  ___ / 12',
    'Ausdauer:         ___ / 24',
    'Glück:            ___ / 12',
    '',
    'AUSRÜSTUNG',
    '  [ ] Schwert          [ ] Schild',
    '  [ ] Seil (15 m)      [ ] Laterne',
    '  [ ] Proviant (3 Tage) [ ] Heiltrank',
    '',
    'Goldmünzen: _______',
    '',
    'NOTIZEN',
    '  _______________________________________',
    '  _______________________________________',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 4) A5-PDF (druckfertig)
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein druckfertiges A5-PDF.
 *
 * A5 in PostScript-Punkten: 419,53 × 595,28.
 *
 * Defensiv: ein leeres Spielbuch liefert ein minimales, valides PDF.
 */
export function buildGamebookPdf(book: ScrambledGamebook | null | undefined): string {
  const title = book?.title ?? 'Spielbuch';
  const sections = book?.sections ?? [];

  const objects: string[] = [];
  const A5_W = '419.53';
  const A5_H = '595.28';

  // Seiteninhalt: ein Abschnitt je Seite.
  const pages: string[] = [];
  if (sections.length === 0) {
    pages.push('BT /F1 14 Tf 40 520 Td (Keine Abschnitte vorhanden.) Tj ET');
  }

  sections.forEach((s) => {
    const lines: string[] = [];
    lines.push(`BT /F1 16 Tf 40 540 Td (${escapePdf(`${s.scrambledNumber}`)}) Tj ET`);
    lines.push(`BT /F1 12 Tf 40 515 Td (${escapePdf(s.title.slice(0, 48))}) Tj ET`);

    // Fließtext in Zeilen zu je 52 Zeichen umbrechen.
    const bodyLines = wrapText(s.body, 52).slice(0, 16);
    bodyLines.forEach((line, i) => {
      lines.push(`BT /F1 10 Tf 40 ${485 - i * 14} Td (${escapePdf(line)}) Tj ET`);
    });

    // Verweise.
    const linkStart = 485 - bodyLines.length * 14 - 12;
    s.links.forEach((link, i) => {
      const target = s.scrambledTargets[i];
      const text = target !== undefined
        ? `${link.label} -> weiter bei ${target}`
        : `${link.label} -> (unbekannt)`;
      lines.push(`BT /F1 10 Tf 40 ${linkStart - i * 14} Td (${escapePdf(text.slice(0, 56))}) Tj ET`);
    });

    pages.push(lines.join('\n'));
  });

  // Objekte aufbauen: 1=Catalog, 2=Pages, 3=Font, dann je Seite Content+Page.
  const pageObjIds: number[] = [];
  let nextId = 4;

  for (const content of pages) {
    const contentId = nextId++;
    const pageId = nextId++;
    objects.push(`${contentId} 0 obj<</Length ${content.length}>>stream\n${content}\nendstream endobj`);
    objects.push(
      `${pageId} 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${A5_W} ${A5_H}]/Contents ${contentId} 0 R/Resources<</Font<</F1 3 0 R>>>>>>endobj`,
    );
    pageObjIds.push(pageId);
  }

  const header = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    `2 0 obj<</Type/Pages/Kids[${pageObjIds.map((id) => `${id} 0 R`).join(' ')}]/Count ${pageObjIds.length}>>endobj`,
    '3 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
  ].join('\n');

  return [
    header,
    objects.join('\n'),
    `% ${title}`,
    'trailer<</Root 1 0 R/Size ' + nextId + '>>',
    '%%EOF',
    '',
  ].join('\n');
}

/** Escaped Sonderzeichen für PDF-Strings. */
function escapePdf(value: string): string {
  return (value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    // Nur ASCII im PDF-String — Umlaute werden transliteriert.
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae')
    .replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^\x20-\x7E]/g, '');
}

/** Bricht Text in Zeilen fester Breite um. */
function wrapText(text: string, width: number): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

// ---------------------------------------------------------------------------
// 5) Standalone-Webgame (HTML + ZIP)
// ---------------------------------------------------------------------------

/** Escaped HTML-Sonderzeichen. */
function escapeHtml(value: string): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Erzeugt ein autarkes, offline lauffähiges HTML5-Game.
 *
 * Keine externen Abhängigkeiten: CSS und JS sind eingebettet, die Abschnitte
 * liegen als JSON im Dokument.
 *
 * Defensiv: ein leeres Spielbuch liefert ein valides, spielbares Minimal-Game.
 */
export function buildWebgameHtml(book: ScrambledGamebook | null | undefined): string {
  const title = book?.title ?? 'Spielbuch';
  const sections = (book?.sections ?? []).map((s) => ({
    n: s.scrambledNumber,
    t: s.title,
    b: s.body,
    l: s.links.map((link, i) => ({
      label: link.label,
      target: s.scrambledTargets[i] ?? null,
    })),
  }));

  const data = JSON.stringify(sections).replace(/</g, '\\u003c');

  return [
    '<!DOCTYPE html>',
    '<html lang="de">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${escapeHtml(title)}</title>`,
    '  <style>',
    '    body { font-family: Georgia, serif; background: #1a1a1a; color: #e8e8e8; margin: 0; padding: 20px; }',
    '    #app { max-width: 640px; margin: 0 auto; }',
    '    h1 { font-size: 1.4em; color: #d4a017; }',
    '    .num { color: #888; font-size: 0.85em; }',
    '    .body { line-height: 1.7; margin: 16px 0; white-space: pre-wrap; }',
    '    button { display: block; width: 100%; text-align: left; margin: 8px 0; padding: 10px 14px;',
    '             background: #2a2a2a; color: #e8e8e8; border: 1px solid #444; border-radius: 4px;',
    '             cursor: pointer; font-family: inherit; font-size: 1em; }',
    '    button:hover { background: #3a3a3a; border-color: #d4a017; }',
    '  </style>',
    '</head>',
    '<body>',
    '<div id="app">',
    `  <h1>${escapeHtml(title)}</h1>`,
    '  <div id="scene"></div>',
    '</div>',
    '  <script type="application/json" id="sections">' + data + '</script>',
    '  <script>',
    '    (function () {',
    '      var sections = JSON.parse(document.getElementById("sections").textContent);',
    '      var byNumber = {};',
    '      sections.forEach(function (s) { byNumber[s.n] = s; });',
    '      function render(n) {',
    '        var s = byNumber[n];',
    '        var el = document.getElementById("scene");',
    '        if (!s) { el.innerHTML = "<p>Abschnitt " + n + " existiert nicht.</p>"; return; }',
    '        var html = "<div class=\\"num\\">Abschnitt " + s.n + "</div>";',
    '        html += "<h2>" + s.t + "</h2>";',
    '        html += "<div class=\\"body\\">" + s.b + "</div>";',
    '        s.l.forEach(function (link, i) {',
    '          if (link.target !== null) {',
    '            html += "<button data-go=\\"" + link.target + "\\">" + link.label + "</button>";',
    '          }',
    '        });',
    '        if (s.l.length === 0) { html += "<p><em>Ende.</em></p>"; }',
    '        el.innerHTML = html;',
    '      }',
    '      document.getElementById("scene").addEventListener("click", function (e) {',
    '        var t = e.target.getAttribute && e.target.getAttribute("data-go");',
    '        if (t) render(parseInt(t, 10));',
    '      });',
    '      render(sections.length > 0 ? sections[0].n : 1);',
    '    })();',
    '  </script>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// 6) ZIP-Erzeugung (STORE, ohne Kompression, ohne Abhängigkeiten)
// ---------------------------------------------------------------------------

/** CRC-32-Tabelle (einmalig berechnet). */
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 einer Byte-Folge. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Ein Eintrag für das ZIP-Archiv. */
export interface ZipEntry {
  /** Dateiname im Archiv. */
  name: string;
  /** Inhalt als Text. */
  content: string;
}

/**
 * Erzeugt ein ZIP-Archiv im STORE-Verfahren (ohne Kompression).
 *
 * Bewusst ohne `zlib`/`node:*`: Das Archiv ist vollständig offline und
 * browser-kompatibel erzeugbar. Für ein Webgame-Bundle reicht STORE völlig.
 */
export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = encoder.encode(entry.content);
    const crc = crc32(dataBytes);

    // Local file header (30 Byte + Name + Daten)
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // Signatur
    lv.setUint16(4, 20, true); // Version
    lv.setUint16(6, 0, true); // Flags
    lv.setUint16(8, 0, true); // Methode: STORE
    lv.setUint16(10, 0, true); // Zeit
    lv.setUint16(12, 0, true); // Datum
    lv.setUint32(14, crc, true); // CRC-32
    lv.setUint32(18, dataBytes.length, true); // komprimiert
    lv.setUint32(22, dataBytes.length, true); // unkomprimiert
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    chunks.push(local, dataBytes);

    // Central directory entry (46 Byte + Name)
    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true); // STORE
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);

    central.push(cd);
    offset += local.length + dataBytes.length;
  }

  const centralStart = offset;
  const centralSize = central.reduce((s, c) => s + c.length, 0);

  // End of central directory (22 Byte)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralStart, true);
  ev.setUint16(20, 0, true);

  const total = chunks.reduce((s, c) => s + c.length, 0) + centralSize + eocd.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  for (const c of central) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(eocd, pos);

  return out;
}

/**
 * Erzeugt das komplette itch.io-Paket als ZIP-Bytes.
 *
 * Enthält das Spiel, eine README und den Charakterbogen.
 */
export function buildWebgameZip(book: ScrambledGamebook | null | undefined): Uint8Array {
  const title = book?.title ?? 'Spielbuch';
  const entries: ZipEntry[] = [
    { name: 'index.html', content: buildWebgameHtml(book) },
    {
      name: 'README.txt',
      content: [
        `${title}`,
        '='.repeat(title.length),
        '',
        'Ein Solo-Spielbuch, generiert mit AI Writer Studio.',
        '',
        'Spielen: index.html im Browser öffnen — keine Installation nötig.',
        'Auf itch.io: Dieses ZIP als HTML-Game hochladen.',
        '',
        `Abschnitte: ${book?.sectionCount ?? 0}`,
        `Verweise: ${book?.linkCount ?? 0}`,
        `Seed: ${book?.seed ?? 0}`,
        '',
      ].join('\n'),
    },
    { name: 'charakterbogen.txt', content: buildCharacterSheet() },
    {
      name: 'wuerfeltabellen.txt',
      content: buildDiceTables()
        .map((t) => [`=== ${t.label} ===`, ...t.rows.map((r) => `  ${r.roll}: ${r.result}`)].join('\n'))
        .join('\n\n'),
    },
  ];
  return buildZip(entries);
}
