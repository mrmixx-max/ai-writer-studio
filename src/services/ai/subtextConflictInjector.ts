// Subtext- & Konflikt-Injektor (WP 60.2)
//
// In guten Romanen sagen Figuren fast nie die reine Wahrheit. Dieses Modul
// verwandelt platte Dialoge in doppeldeutige Aussagen — mit verdeckter Agenda,
// zögernden Satzabbrüchen und verräterischer Körpersprache.
//
// Drei deterministische Werkzeuge:
//
//   1. injectSubtext       — Dialog + Agenda → doppeldeutiger Dialog
//   2. generateMicroReaction — verräterische Körpersprache je Geheimnis
//   3. analyzeSubtextDensity — Subtext-Anteil eines Dialogs messen
//
// Design-Regeln (analog proseExpander / polyphonicDialogueGenerator):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - Gleicher Input → gleicher Output (FNV-1a + mulberry32).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Verdeckte Agenda einer Figur. */
export type HiddenAgenda =
  | 'knows-lie'
  | 'secret-love'
  | 'jealousy'
  | 'guilt'
  | 'distrust';

/** Ein Dialogbeitrag. */
export interface DialogueLine {
  /** Sprecher. */
  speaker: string;
  /** Gesprochener Text. */
  text: string;
}

/** Optionen für die Subtext-Injektion. */
export interface SubtextOptions {
  /** Verdeckte Agenda. Default: 'knows-lie'. */
  agenda?: HiddenAgenda;
  /** Figur mit dem Geheimnis. */
  carrier?: string;
  /** Figur, vor der es verborgen wird. */
  target?: string;
}

/** Ein angereicherter Dialogbeitrag. */
export interface SubtextLine {
  /** Sprecher. */
  speaker: string;
  /** Ursprünglicher Text. */
  original: string;
  /** Text mit Subtext. */
  text: string;
  /** Verräterische Körpersprache. */
  reaction?: string;
  /** true, wenn Subtext eingefügt wurde. */
  hasSubtext: boolean;
}

/** Ergebnis der Subtext-Injektion. */
export interface SubtextDialogue {
  /** Die angereicherten Beiträge. */
  lines: SubtextLine[];
  /** Formatierter Dialogtext. */
  text: string;
  /** Verwendete Agenda. */
  agenda: HiddenAgenda;
  /** Menschenlesbarer Agenda-Name. */
  agendaLabel: string;
  /** Anzahl angereicherter Beiträge. */
  injectedCount: number;
  /** Wortzahl. */
  wordCount: number;
}

/** Ergebnis der Subtext-Dichte-Analyse. */
export interface SubtextDensity {
  /** Anteil der Beiträge mit Subtext-Markern (0–1). */
  density: number;
  /** Gefundene Subtext-Marker. */
  markers: string[];
  /** Anzahl untersuchter Beiträge. */
  lineCount: number;
  /** Bewertung: ist genug Subtext vorhanden? */
  sufficient: boolean;
}

// ---------------------------------------------------------------------------
// Deterministischer Zufall
// ---------------------------------------------------------------------------

/** FNV-1a-32-Hash einer Zeichenkette → deterministischer Seed. */
function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32-PRNG: schnell, deterministisch, Werte in [0, 1). */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length) % items.length];
}

// ---------------------------------------------------------------------------
// Agenda-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Agenda-Namen. */
export const AGENDA_LABELS: Record<HiddenAgenda, string> = {
  'knows-lie': 'Weiß von der Lüge',
  'secret-love': 'Heimliche Liebe',
  jealousy: 'Eifersucht',
  guilt: 'Geheime Schuld',
  distrust: 'Misstrauen',
};

/** Körpersprache je Agenda (verräterische Mikro-Reaktionen). */
const AGENDA_REACTIONS: Record<HiddenAgenda, readonly string[]> = {
  'knows-lie': [
    'Ein Blick, der eine Sekunde zu lang auf dem Mund blieb',
    'Die Kiefer spannte sich an, bevor das Lächeln kam',
    'Die Hand schloss sich langsam um das Glas',
    'Ein Atemzug, der zu tief ausfiel',
  ],
  'secret-love': [
    'Der Blick wanderte zur Seite und fand einen Grund, dort zu bleiben',
    'Ein Lächeln, das nichts mit dem Gesagten zu tun hatte',
    'Die Finger strichen über den Rand der Tasse',
    'Der Name wurde vermieden, und alle merkten es',
  ],
  jealousy: [
    'Die Stimme blieb ruhig, und die Ruhe war das Problem',
    'Ein Ticken, das niemand sonst hörte',
    'Die Schultern drehten sich weg, kaum merklich',
    'Die Antwort kam eine Spur zu schnell',
  ],
  guilt: [
    'Die Hände suchten eine Beschäftigung, die es nicht gab',
    'Ein Nervöses Spielen mit dem Ring',
    'Der Blick senkte sich, als hätte der Boden etwas zu sagen',
    'Die Spannung im Nacken war sichtbar, wenn man hinsah',
  ],
  distrust: [
    'Die Sitzposition verschob sich um Zentimeter nach hinten',
    'Der Blick blieb an der Tür hängen',
    'Die Arme verschränkten sich, ohne dass es jemand bemerkte',
    'Ein Nicken, das keine Zustimmung war',
  ],
};

/** Doppeldeutige Umformulierungen je Agenda. {text} wird ersetzt. */
const AGENDA_REWRITES: Record<HiddenAgenda, readonly string[]> = {
  'knows-lie': [
    '„{text}" — und die Betonung lag auf dem falschen Wort',
    '„{text}" Es klang wie Zustimmung und war keine',
    '„{text}" Die Pause danach war länger als nötig',
  ],
  'secret-love': [
    '„{text}" Und dann, leiser: „… ja."',
    '„{text}" Der Satz endete dort, wo er hätte weitergehen müssen',
    '„{text}" Ein Lächeln, das zu schnell verging',
  ],
  jealousy: [
    '„{text}" Die Antwort kam glatt und ohne Wärme',
    '„{text}" Und ein Nachsatz, der nicht nötig gewesen wäre',
    '„{text}" — freundlich genug, um nicht aufzufallen',
  ],
  guilt: [
    '„{text}" Die Stimme wurde eine Spur zu leise',
    '„{text}" Ein Satz, der sich selbst unterbrach',
    '„{text}" Und ein Abwenden, das niemand hätte benennen können',
  ],
  distrust: [
    '„{text}" Höflich, gemessen, und völlig ohne Überzeugung',
    '„{text}" Der Blick blieb an der Tür',
    '„{text}" Eine Bestätigung, die eine Frage blieb',
  ],
};

/** Subtext-Marker für die Dichte-Analyse. */
const SUBTEXT_MARKERS: readonly string[] = [
  'zu schnell', 'zu leise', 'zu spät', 'zu lang', 'kaum merklich',
  'ohne dass', 'und dann', 'leiser', 'pause', 'blick', 'spannte',
  'senkte', 'verschränkten', 'zurück', 'abwandte', 'schwieg',
];

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Agenda defensiv prüfen. */
function normalizeAgenda(value: unknown): HiddenAgenda {
  const all: HiddenAgenda[] = ['knows-lie', 'secret-love', 'jealousy', 'guilt', 'distrust'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as HiddenAgenda)
    : 'knows-lie';
}

/** Dialog defensiv normalisieren. */
function normalizeDialogue(lines: unknown): DialogueLine[] {
  if (!Array.isArray(lines)) return [];
  return lines
    .filter(
      (l): l is DialogueLine =>
        !!l && typeof l === 'object' && typeof (l as DialogueLine).speaker === 'string',
    )
    .map((l) => ({
      speaker: l.speaker.trim(),
      text: typeof l.text === 'string' ? l.text.trim() : '',
    }))
    .filter((l) => l.speaker.length > 0 && l.text.length > 0);
}

/** Wortzahl. */
function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter((w) => w.length > 0).length;
}

/** Anführungszeichen und Satzzeichen aus dem Textkern entfernen. */
function stripQuotes(text: string): string {
  return text.replace(/^[„"«]+/, '').replace(/[“"»]+$/, '').replace(/[.!?]+$/, '').trim();
}

// ---------------------------------------------------------------------------
// 1) Subtext-Injektion
// ---------------------------------------------------------------------------

/**
 * Reichert einen Dialog mit Subtext an.
 *
 * Nur die Trägerfigur (carrier) erhält umformulierte, doppeldeutige Aussagen —
 * die übrigen Beiträge bleiben unverändert, damit der Subtext nicht auffällt.
 * Etwa jeder zweite Beitrag der Trägerfigur bekommt zusätzlich eine
 * verräterische Körpersprache.
 *
 * Defensiv: leerer/ungültiger Dialog liefert ein leeres Ergebnis.
 */
export function injectSubtext(lines: unknown, options?: SubtextOptions | null): SubtextDialogue {
  const dialogue = normalizeDialogue(lines);
  const agenda = normalizeAgenda(options?.agenda);

  if (dialogue.length === 0) {
    return {
      lines: [],
      text: '',
      agenda,
      agendaLabel: AGENDA_LABELS[agenda],
      injectedCount: 0,
      wordCount: 0,
    };
  }

  // Trägerfigur: explizit benannt oder die erste Figur.
  const carrier =
    typeof options?.carrier === 'string' && options.carrier.trim().length > 0
      ? options.carrier.trim()
      : dialogue[0].speaker;

  const rand = createSeededRandom(
    hashString(`${agenda}#${carrier}#${dialogue.map((l) => l.text).join('|')}`),
  );

  let injectedCount = 0;

  const enriched: SubtextLine[] = dialogue.map((line) => {
    if (line.speaker !== carrier) {
      return {
        speaker: line.speaker,
        original: line.text,
        text: line.text,
        hasSubtext: false,
      };
    }

    const core = stripQuotes(line.text);
    const template = pick(AGENDA_REWRITES[agenda], rand);
    const text = template.replace(/\{text\}/g, core);

    // Etwa jeder zweite Beitrag bekommt Körpersprache.
    const reaction = rand() < 0.6 ? pick(AGENDA_REACTIONS[agenda], rand) : undefined;

    injectedCount++;

    return {
      speaker: line.speaker,
      original: line.text,
      text,
      reaction,
      hasSubtext: true,
    };
  });

  const text = enriched
    .map((l) => {
      const head = `${l.speaker.toUpperCase()}: ${l.text}`;
      return l.reaction ? `${head}\n(${l.reaction}.)` : head;
    })
    .join('\n\n');

  return {
    lines: enriched,
    text,
    agenda,
    agendaLabel: AGENDA_LABELS[agenda],
    injectedCount,
    wordCount: countWords(text),
  };
}

// ---------------------------------------------------------------------------
// 2) Mikro-Reaktion
// ---------------------------------------------------------------------------

/**
 * Liefert eine einzelne verräterische Körpersprache zur Agenda.
 *
 * Defensiv: ungültige Agenda fällt auf `knows-lie` zurück.
 */
export function generateMicroReaction(agenda?: unknown, seedText?: unknown): string {
  const a = normalizeAgenda(agenda);
  const seed = typeof seedText === 'string' ? seedText : '';
  const rand = createSeededRandom(hashString(`${a}#${seed}`));
  return pick(AGENDA_REACTIONS[a], rand);
}

// ---------------------------------------------------------------------------
// 3) Subtext-Dichte
// ---------------------------------------------------------------------------

/**
 * Misst den Subtext-Anteil eines Dialogs.
 *
 * `sufficient` ist true, sobald mindestens ein Drittel der Beiträge einen
 * Subtext-Marker trägt — darunter wirkt der Dialog platt.
 *
 * Defensiv: leerer Text liefert Dichte 0.
 */
export function analyzeSubtextDensity(text: unknown): SubtextDensity {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { density: 0, markers: [], lineCount: 0, sufficient: false };
  }

  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (blocks.length === 0) {
    return { density: 0, markers: [], lineCount: 0, sufficient: false };
  }

  const markers: string[] = [];
  let withSubtext = 0;

  for (const block of blocks) {
    const lower = block.toLowerCase();
    const hits = SUBTEXT_MARKERS.filter((m) => lower.includes(m));
    if (hits.length > 0) {
      withSubtext++;
      markers.push(...hits);
    }
  }

  const density = Math.round((withSubtext / blocks.length) * 10000) / 10000;

  return {
    density,
    markers: [...new Set(markers)],
    lineCount: blocks.length,
    sufficient: density >= 0.33,
  };
}
