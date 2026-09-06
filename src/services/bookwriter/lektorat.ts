// Lektorats-Modus (Sprint 11, Agent 2): regelbasierter Style-Pass.
//
// Reine Logik, KEINE Seiteneffekte: kein DB-, kein Netzwerk-Import zur
// Ladezeit. Alle Checks sind deterministisch und offline. Der einzige
// LLM-Pfad ist die injizierbare `CompleteFn` `(prompt) => Promise<string>`
// fuer optionale Umformulierungen (`rephraseWithLlm`, `createOllamaComplete`
// als Produktions-Verdrahtung auf dem bestehenden Ollama-Service via
// Lazy-Import — kein neuer Netzwerk-Code). Tests mocken `complete`.

/** Art eines Lektorats-Befunds. */
export type LektoratFindingType =
  | "repeated_word"
  | "sentence_variance"
  | "passive_voice"
  | "dialogue_tag"
  | "filler_word";

/** Ein einzelner Lektorats-Befund. */
export interface LektoratFinding {
  type: LektoratFindingType;
  /** Kapitel-ID (freier String, z.B. "ch1"). */
  chapterId: string;
  /** Zeichen-Offset im Kapiteltext (Start des Befunds). */
  position: number;
  /** Konkreter Verbesserungsvorschlag (deutsch). */
  suggestion: string;
  /** Begruendung (deutsch, ein Satz). */
  rationale: string;
}

/** Minimaler Kapitel-Input (entkoppelt von GeneratedChapter/OutlineChapter). */
export interface LektoratChapterInput {
  id: string;
  content: string;
}

/** Injizierbare LLM-Funktion — einzige LLM-Schnittstelle dieses Moduls. */
export type CompleteFn = (prompt: string) => Promise<string>;

/** Optionale Analyse-Parameter (alle mit Default). */
export interface LektoratOptions {
  /** Token-Fenster fuer Wortwiederholungen (Default 25). */
  repeatWindow?: number;
  /** Mindest-Wortlaenge fuer Wiederholungs-Checks (Default 4). */
  repeatMinLength?: number;
  /** Satzlaenge (Woerter), ab der ein Satz als verschachtelt gilt (Default 30). */
  longSentenceWords?: number;
  /** Max. Anteil eines einzelnen Dialog-Tags vor Monotonie-Flag (Default 0.6). */
  dialogueTagThreshold?: number;
  /** Mindest-Passivsaetze pro Kapitel fuer Dichte-Flag (Default 3). */
  passiveMinCount?: number;
}

/** Deutsche Fuellwoerter (erweiterbar, exportiert fuer Tests/UI). */
export const FILLER_WORDS: readonly string[] = [
  "eigentlich",
  "irgendwie",
  "quasi",
  "halt",
  "eben",
  "wohl",
  "ziemlich",
  "relativ",
  "gewissermassen",
  "praktisch",
  "sozusagen",
  "irgendwas",
  "sowieso",
  "total",
  "absolut",
];

/** Dialog-Tags (deutsch) fuer den Varianz-Check. */
export const DIALOGUE_TAGS: readonly string[] = [
  "sagte",
  "sagt",
  "meinte",
  "meint",
  "fragte",
  "fragt",
  "antwortete",
  "antwortet",
  "erwiderte",
  "erwidert",
  "rief",
  "ruft",
  "flüsterte",
  "flüstert",
  "murmelte",
  "murmelt",
  "schrie",
  "schreit",
  "brummte",
  "brummt",
  "lachte",
  "seufzte",
  "seufzt",
  "nickte",
  "behauptete",
  "erklärte",
  "erklärt",
  "fügte hinzu",
  "wiederholte",
];

const REPEAT_STOPWORDS = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "einem",
  "einen", "und", "oder", "aber", "denn", "doch", "dass", "weil", "wenn",
  "als", "wie", "auch", "nur", "schon", "noch", "sehr", "hier", "dort",
  "dann", "sich", "sie", "er", "es", "wir", "ihr", "ich", "du", "mit",
  "von", "zu", "zum", "zur", "beim", "nach", "vor", "für", "durch",
  "über", "unter", "auf", "aus", "bei", "ist", "sind", "war", "waren",
  "wird", "haben", "hat", "hatte", "nicht", "kein", "keine", "dieser",
  "diese", "dieses", "jeder", "alle", "eines", "einem", "einen",
]);

/** Zerlegt Text in Saetze (deterministisch, offline). Exportiert fuer Tests. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+(?=[„"«A-ZÄÖÜ0-9])/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Tokenisiert zu Kleinbuchstaben-Woertern (Umlaute-bewahrend). */
function tokenizeWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-zäöüß]+/gu) ?? []).filter((w) => w.length > 0);
}

/** Zaehlt Woerter in einem Satz. */
export function countWords(sentence: string): number {
  return tokenizeWords(sentence).length;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Einzel-Checks (jeweils rein, einzeln testbar).
// ---------------------------------------------------------------------------

/** Wiederholte Woerter in Naehe: gleiches Wort (bestimmter Länge) im Fenster. */
export function checkRepeatedWords(
  chapterId: string,
  text: string,
  opts: LektoratOptions = {},
): LektoratFinding[] {
  const window = opts.repeatWindow ?? 25;
  const minLen = opts.repeatMinLength ?? 4;
  const findings: LektoratFinding[] = [];
  const words = tokenizeWords(text);
  const lastSeen = new Map<string, number>();
  const charCursor: number[] = [];
  let ci = 0;
  const lower = text.toLowerCase();
  for (const w of words) {
    const idx = lower.indexOf(w, ci);
    charCursor.push(idx === -1 ? ci : idx);
    ci = (idx === -1 ? ci : idx) + w.length;
  }
  const reported = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w.length < minLen || REPEAT_STOPWORDS.has(w)) continue;
    const prev = lastSeen.get(w);
    if (prev !== undefined && i - prev <= window && !reported.has(`${w}@${prev}`)) {
      reported.add(`${w}@${prev}`);
      const display = text.slice(charCursor[i], charCursor[i] + w.length) || w;
      findings.push({
        type: "repeated_word",
        chapterId,
        position: charCursor[i],
        suggestion: `Wortwiederholung: „${display}“ steht zweimal im Abstand von ${i - prev} Wörtern — beim zweiten Vorkommen ein Synonym oder Pronomen nutzen.`,
        rationale: `Dasselbe Inhaltswort erscheint zweimal innerhalb von ${window} Wörtern und wirkt repetitiv.`,
      });
    }
    lastSeen.set(w, i);
  }
  return findings;
}

/**
 * Satzlaengen-Varianz: flaggt (a) einzelne Sätze über `longSentenceWords`
 * Wörtern und (b) monotone Folgen von 3+ Sätzen mit fast gleicher Länge.
 */
export function checkSentenceVariance(
  chapterId: string,
  text: string,
  opts: LektoratOptions = {},
): LektoratFinding[] {
  const longAt = opts.longSentenceWords ?? 30;
  const findings: LektoratFinding[] = [];
  const sentences = splitSentences(text);
  if (sentences.length === 0) return findings;
  let offset = 0;
  const lengths = sentences.map((s) => {
    const pos = text.indexOf(s, offset);
    const p = pos === -1 ? offset : pos;
    offset = p + s.length;
    return { sentence: s, words: countWords(s), position: p };
  });
  for (const l of lengths) {
    if (l.words >= longAt) {
      findings.push({
        type: "sentence_variance",
        chapterId,
        position: l.position,
        suggestion: `Sehr langer Satz (${l.words} Wörter) — in zwei kürzere Sätze aufteilen.`,
        rationale: `Sätze über ${longAt} Wörtern erschweren das Lesetempo und gelten als verschachtelt.`,
      });
    }
  }
  // Monotone Folgen: 3+ aufeinanderfolgende Sätze, deren Längen max. 3 auseinanderliegen.
  let runStart = 0;
  for (let i = 1; i <= lengths.length; i++) {
    const continues =
      i < lengths.length &&
      Math.abs(lengths[i].words - lengths[i - 1].words) <= 3;
    if (continues) continue;
    const runLen = i - runStart;
    if (runLen >= 3) {
      const lens = lengths.slice(runStart, i).map((l) => l.words);
      const min = Math.min(...lens);
      const max = Math.max(...lens);
      if (max - min <= 3) {
        findings.push({
          type: "sentence_variance",
          chapterId,
          position: lengths[runStart].position,
          suggestion: `Monotone Satzfolge (${runLen} Sätze à ca. ${lens[0]} Wörter) — Satzlängen bewusst variieren (kurz/lang mischen).`,
          rationale: `Gleichförmige Satzlängen erzeugen einen eintönigen Rhythmus; Varianz erhöht die Lesespannung.`,
        });
      }
    }
    runStart = i;
  }
  return findings;
}

const PASSIVE_PATTERNS: RegExp[] = [
  // "wurde/wurden + Partizip" (wurde geöffnet, wurden gerufen)
  /\bwurd(?:e|en|est)\b[^.!?]{0,60}\b\w+(?:et|t|en)\b/iu,
  // "ist/sind + ... + worden"
  /\b(?:ist|sind|war|waren)\b[^.!?]{0,80}\bworden\b/iu,
  // "wird/werden + ... + Partizip"
  /\bw(?:ird|erden)\b[^.!?]{0,80}\b\w+(?:et|t|en)\b/iu,
];

/**
 * Passiv-Heuristik (deutsch): erkennt Vorgangspassiv-Muster pro Satz.
 * Gibt pro Treffer einen Befund plus (ab `passiveMinCount` Treffern) einen
 * Dichte-Befund am Kapitelanfang (position 0) zurueck.
 */
export function checkPassiveVoice(
  chapterId: string,
  text: string,
  opts: LektoratOptions = {},
): LektoratFinding[] {
  const findings: LektoratFinding[] = [];
  const sentences = splitSentences(text);
  let offset = 0;
  let count = 0;
  for (const s of sentences) {
    const pos = text.indexOf(s, offset);
    const p = pos === -1 ? offset : pos;
    offset = p + s.length;
    if (PASSIVE_PATTERNS.some((re) => re.test(s))) {
      count++;
      findings.push({
        type: "passive_voice",
        chapterId,
        position: p,
        suggestion: `Passivkonstruktion („${s.slice(0, 60)}${s.length > 60 ? "…" : ""}") — wenn möglich ins Aktiv umformulieren (wer handelt?).`,
        rationale: `Häufiges Vorgangspassiv („wurde/wird …") distanziert; Aktivsätze wirken direkter.`,
      });
    }
  }
  const minCount = opts.passiveMinCount ?? 3;
  if (count >= minCount && sentences.length > 0) {
    findings.push({
      type: "passive_voice",
      chapterId,
      position: 0,
      suggestion: `Hohe Passivdichte (${count} von ${sentences.length} Sätzen) — kapitelweit mindestens ${Math.ceil(count / 2)} Passivsätze ins Aktiv überführen.`,
      rationale: `Ab ${minCount} Passivsätzen pro Kapitel leidet die erzählerische Unmittelbarkeit.`,
    });
  }
  return findings;
}

/** Dialog-Tag-Monotonie: ein Tag dominiert über dem Schwellenanteil. */
export function checkDialogueTags(
  chapterId: string,
  text: string,
  opts: LektoratOptions = {},
): LektoratFinding[] {
  const threshold = opts.dialogueTagThreshold ?? 0.6;
  const lower = text.toLowerCase();
  const counts = new Map<string, { count: number; firstPos: number }>();
  let total = 0;
  for (const tag of DIALOGUE_TAGS) {
    const re = new RegExp(`\\b${escapeRegExp(tag)}\\b`, "giu");
    let m: RegExpExecArray | null;
    let c = 0;
    let first = -1;
    while ((m = re.exec(lower)) !== null) {
      if (first === -1) first = m.index;
      c++;
      if (c > 50) break;
    }
    if (c > 0) {
      const key = tag.toLowerCase();
      const prev = counts.get(key);
      if (prev) {
        prev.count += c;
      } else {
        counts.set(key, { count: c, firstPos: first });
      }
      total += c;
    }
  }
  if (total < 3) return [];
  for (const [tag, { count, firstPos }] of counts) {
    if (count / total >= threshold) {
      const alternatives = DIALOGUE_TAGS.filter((t) => t.toLowerCase() !== tag).slice(0, 4);
      return [
        {
          type: "dialogue_tag",
          chapterId,
          position: firstPos,
          suggestion: `Monotoner Dialog-Tag: „${tag}“ steht ${count}× von ${total} Redeeinleitungen — abwechseln, z. B. mit ${alternatives.map((a) => `„${a}“`).join(", ")}.`,
          rationale: `Ein einzelner Dialog-Tag über ${Math.round(threshold * 100)} % Anteil wirkt formelhaft; Variation belebt Dialoge.`,
        },
      ];
    }
  }
  return [];
}

/** Fuellwoerter: jedes Vorkommen aus FILLER_WORDS ergibt einen Befund. */
export function checkFillerWords(
  chapterId: string,
  text: string,
  _opts: LektoratOptions = {},
): LektoratFinding[] {
  const findings: LektoratFinding[] = [];
  for (const filler of FILLER_WORDS) {
    const re = new RegExp(`\\b${escapeRegExp(filler)}\\b`, "giu");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      findings.push({
        type: "filler_word",
        chapterId,
        position: m.index,
        suggestion: `Füllwort „${m[0]}“ — ersatzlos streichen oder präzisieren.`,
        rationale: `Füllwörter („${filler}") schwächen die Aussage, ohne Information zu tragen.`,
      });
      if (findings.length > 200) return findings.sort((a, b) => a.position - b.position);
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return findings.sort((a, b) => a.position - b.position);
}

// ---------------------------------------------------------------------------
// Gesamt-Analyse.
// ---------------------------------------------------------------------------

/** Alle Checks fuer ein Kapitel (nach Position sortiert). */
export function analyzeChapter(
  chapterId: string,
  text: string,
  opts: LektoratOptions = {},
): LektoratFinding[] {
  if (!text || text.trim().length === 0) return [];
  const all = [
    ...checkRepeatedWords(chapterId, text, opts),
    ...checkSentenceVariance(chapterId, text, opts),
    ...checkPassiveVoice(chapterId, text, opts),
    ...checkDialogueTags(chapterId, text, opts),
    ...checkFillerWords(chapterId, text, opts),
  ];
  return all.sort((a, b) => a.position - b.position);
}

/** Alle Checks ueber mehrere Kapitel (Kapitelreihenfolge, darin Position). */
export function analyzeBook(
  chapters: LektoratChapterInput[],
  opts: LektoratOptions = {},
): LektoratFinding[] {
  const order = new Map(chapters.map((c, i) => [c.id, i]));
  return chapters
    .flatMap((c) => analyzeChapter(c.id, c.content, opts))
    .sort((a, b) => (order.get(a.chapterId) ?? 0) - (order.get(b.chapterId) ?? 0) || a.position - b.position);
}

/** Zaehlt Befunde pro Typ (fuer UI-Badges). Exportiert fuer Tests. */
export function countFindingsByType(findings: LektoratFinding[]): Record<LektoratFindingType, number> {
  const counts: Record<LektoratFindingType, number> = {
    repeated_word: 0,
    sentence_variance: 0,
    passive_voice: 0,
    dialogue_tag: 0,
    filler_word: 0,
  };
  for (const f of findings) counts[f.type]++;
  return counts;
}

// ---------------------------------------------------------------------------
// Optionale LLM-Umformulierung (injizierbar, offline ohne `complete`).
// ---------------------------------------------------------------------------

/**
 * Formuliert die Textstelle eines Befunds via LLM um. Ohne `complete`
 * wird die lokale `suggestion` zurueckgegeben (offline-Fallback).
 */
export async function rephraseWithLlm(
  finding: LektoratFinding,
  passage: string,
  complete?: CompleteFn,
): Promise<string> {
  if (!complete) return finding.suggestion;
  const prompt = [
    `Du bist ein deutscher Lektor. Befundtyp: ${finding.type}.`,
    `Befund: ${finding.suggestion}`,
    `Textstelle: „${passage}“`,
    `Gib NUR die umformulierte Textstelle zurück, ohne Erklärung.`,
  ].join("\n");
  const out = await complete(prompt);
  return out.trim().length > 0 ? out.trim() : finding.suggestion;
}

/**
 * Baut eine `CompleteFn` auf dem bestehenden Ollama-Service
 * (`completeOnce` aus `@/services/llm` + Settings). Lazy-Importe: Dieses
 * Modul bleibt ohne Aufruf dieser Funktion netzwerk- und seitenffektfrei.
 * Es entsteht KEIN neuer Netzwerk-Code — nur Verdrahtung (Muster aus
 * `./continuity`).
 */
export function createOllamaComplete(): CompleteFn {
  return async (prompt: string): Promise<string> => {
    const { loadSettings } = await import("@/services/settings");
    const { completeOnce } = await import("@/services/llm");
    const settings = loadSettings();
    return completeOnce(settings, prompt);
  };
}
