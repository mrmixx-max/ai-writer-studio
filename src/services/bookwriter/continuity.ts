// Bookwriter Continuity-Ledger (Sprint 10, Agent 1).
//
// Langfrist-Kontinuität für lange Bücher: Entitäten-Ledger (Charaktere, Orte,
// Begriffe, Zeitmarken) pro Kapitel, Widerspruchs-Flags (Namensvarianten,
// Zeitlinien-Reihenfolge, Attributkonflikte, fehlende Entitäten) und ein
// komprimierter Kapitel-Brief als Kontext für das nächste Kapitel.
//
// Design-Regeln:
// - Reine Logik, KEINE Seiteneffekte: kein DB-, kein Netzwerk-Import zur
//   Ladezeit. Die NER-Heuristik ist deterministisch und offline.
// - LLM-Hook: der einzige LLM-Pfad ist die injizierbare `CompleteFn`
//   `(prompt) => Promise<string>`. `createOllamaComplete()` baut daraus eine
//   Implementierung auf dem bestehenden Ollama-Service (Lazy-Import, kein
//   neuer Netzwerk-Code). Tests mocken `complete` — zero network.
// - Namensnormalisierung ist bewusst lokal (kompatibel zu `./consistency`),
//   statt von dort zu importieren: consistency.ts zieht die DB-Schicht
//   (@/services/db, @/services/project) in den Modulgraphen; dieses Modul
//   bleibt dadurch import-seitig seitenffektfrei und hermetisch testbar.
// - Bestehende bookwriter-Dateien werden NICHT verändert — nur diese Datei
//   (plus UI-Panel und Tests) ist neu.

/** Art einer Ledger-Entität. */
export type EntityKind = "character" | "place" | "term" | "timeline";

/** Eine Entität im Kontinuitäts-Ledger. */
export interface EntityEntry {
  /** Kanonischer Name (längste gesehene Variante). */
  name: string;
  kind: EntityKind;
  /** Kapitel-Index des ersten Auftretens. */
  firstSeenChapter: number;
  /** Alle Kapitel-Indizes mit Auftreten (sortiert, eindeutig). */
  chapters: number[];
  /** Bekannte Schreibvarianten (ohne kanonischen Namen). */
  aliases: string[];
  /** Vorkommenshäufigkeit über alle Kapitel. */
  mentions: number;
  /** Optional: Notiz (z.B. LLM-Anreicherung). */
  note: string | null;
}

/** Das Kontinuitäts-Ledger eines Buchs. */
export interface Ledger {
  entities: EntityEntry[];
  /** Anzahl erfasster Kapitel. */
  chapterCount: number;
  createdAt: number;
}

/** Minimaler Kapitel-Input (entkoppelt von GeneratedChapter/OutlineChapter). */
export interface ChapterInput {
  title: string;
  content: string;
}

/** Nächstes Kapitel für den Brief (Outline-Auszug, Felder optional). */
export interface NextChapterInput {
  title: string;
  goal?: string;
  conflict?: string;
  outcome?: string;
  pov?: string;
}

/** Art eines Widerspruchs. */
export type ContradictionType =
  | "name_variant"
  | "timeline_order"
  | "attribute_conflict"
  | "missing_entity";

/** Ein erkannter Widerspruch. */
export interface Contradiction {
  type: ContradictionType;
  severity: "warning" | "error";
  /** Betroffener Kapitel-Index (−1 = kapitelübergreifend). */
  chapterIndex: number;
  expected: string | null;
  found: string | null;
  details: string;
}

/** Komprimierter Kontext für das nächste Kapitel. */
export interface ChapterBrief {
  /** Für welchen Kapitel-Index (0-basiert) der Brief gilt. */
  forChapter: number;
  nextTitle: string;
  /** Aktive Entitäten (nach Kapitelabdeckung sortiert, gekappt). */
  activeEntities: EntityEntry[];
  /** Offene Widersprüche. */
  contradictions: Contradiction[];
  /** Fertiger Prompt-Baustein für die Generierung. */
  promptBlock: string;
}

/** Injizierbare LLM-Funktion — einzige LLM-Schnittstelle dieses Moduls. */
export type CompleteFn = (prompt: string) => Promise<string>;

// ---------------------------------------------------------------------------
// Namensnormalisierung (kompatibel zu consistency.ts, lokal — siehe Header).
// ---------------------------------------------------------------------------

/** Normalisiert einen Namen für den Varianten-Vergleich. */
export function normalizeContinuityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\u200d/g, "")
    .replace(/‌/g, "")
    .replace(/\u200d/g, "")
    .replace(/\ufeff/g, "")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n];
}

/** Prüft, ob zwei Namen dieselbe Entität meinen (Drift-Varianten inklusive). */
export function continuityNamesLikelySame(a: string, b: string): boolean {
  const na = normalizeContinuityName(a);
  const nb = normalizeContinuityName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  if (na.length >= 5 && nb.length >= 5 && Math.abs(na.length - nb.length) <= 1) {
    return levenshtein(na, nb) <= 1;
  }
  const ta = a.trim().split(/\s+/);
  const tb = b.trim().split(/\s+/);
  if (ta.length === tb.length && ta.length > 0) {
    return ta.every((x, i) => {
      const nx = normalizeContinuityName(x);
      const ny = normalizeContinuityName(tb[i]);
      if (nx === ny) return true;
      return nx.length >= 3 && ny.length >= 3 && levenshtein(nx, ny) <= 1;
    });
  }
  return false;
}

// ---------------------------------------------------------------------------
// Heuristische Entitätsextraktion (deterministisch, offline).
// ---------------------------------------------------------------------------

const NAME_STOPWORDS = new Set([
  "Der", "Die", "Das", "Ein", "Eine", "Einer", "Einem", "Einen",
  "Ich", "Er", "Sie", "Es", "Wir", "Ihr", "Du",
  "Und", "Aber", "Denn", "Doch", "Wie", "Was", "Wer", "Wo", "Wann", "Warum",
  "Kapitel", "Zusammenfassung", "Ergebnis", "Ziel", "Konflikt",
  "Im", "In", "Am", "An", "Auf", "Aus", "Zur", "Zum", "Beim", "Nach", "Vor",
  "Bei", "Mit", "Ohne", "Als", "Vom", "Von", "Für", "Über", "Durch",
  "Wenn", "Dass", "Weil", "Auch", "Nur", "Schon", "Noch", "Sehr", "Hier",
  "Dort", "Dann", "Dieser", "Diese", "Dieses", "Jeder", "Alle",
]);

// Starke Orts-Präpositionen (mit Artikel). Bewusst eng: „auf/vor/nach-
// Personen" (auf Anna warten, vor Ben stehen) sind keine Orte — „auf",
// „vor", „hinter", „neben", „zwischen", „unter", „über", „durch" gelten
// deshalb NICHT als Orts-Signal.
const PLACE_PREPOSITIONS = new Set([
  "in", "nach", "aus", "bei", "am", "im", "zum", "zur",
]);

const PLACE_NOUNS = new Set([
  "stadt", "dorf", "hafen", "schloss", "burg", "turm", "wald", "berg",
  "see", "fluss", "strasse", "haus", "gasthaus", "taverne",
  "marktplatz", "bahnhof", "kirche", "kloster", "mühle", "brücke",
  "gasse", "platz", "garten", "park", "friedhof", "rathaus", "schenke",
  "herberge", "festung", "ruine", "höhle", "insel", "küste", "tal",
]);

const MONTHS = new Set([
  "januar", "februar", "märz", "maerz", "april", "mai", "juni", "juli",
  "august", "september", "oktober", "november", "dezember",
  "january", "february", "march", "june", "july", "october", "december",
]);

const SEASONS = new Set([
  "frühling", "fruehling", "sommer", "herbst", "winter",
  "spring", "summer", "autumn", "fall",
]);

const YEAR_RE = /\b(1[5-9]\d{2}|20\d{2})\b/g;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface RawCandidate {
  text: string;
  count: number;
}

function collectNameSequences(text: string): RawCandidate[] {
  const seqs =
    text.match(/\p{Lu}\p{L}{2,}(?:\s+\p{Lu}\p{L}{2,}){0,2}/gu) ?? [];
  const counts = new Map<string, number>();
  for (const raw of seqs) {
    const seq = raw.trim().replace(/\s+/g, " ");
    if (!seq) continue;
    const words = seq.split(" ");
    if (words.length === 1 && NAME_STOPWORDS.has(words[0])) continue;
    if (words.length > 1 && words.every((w) => NAME_STOPWORDS.has(w))) continue;
    counts.set(seq, (counts.get(seq) ?? 0) + 1);
  }
  return [...counts.entries()].map(([text, count]) => ({ text, count }));
}

function collectQuotedTerms(text: string): RawCandidate[] {
  const out = new Map<string, number>();
  const re = /["„“»«]([^"“”»«]{3,60})["“”»«]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const term = m[1].trim().replace(/\s+/g, " ");
    if (term) out.set(term, (out.get(term) ?? 0) + 1);
  }
  return [...out.entries()].map(([text, count]) => ({ text, count }));
}

function collectYears(text: string): RawCandidate[] {
  const out = new Map<string, number>();
  YEAR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = YEAR_RE.exec(text)) !== null) {
    out.set(m[1], (out.get(m[1]) ?? 0) + 1);
  }
  return [...out.entries()].map(([text, count]) => ({ text, count }));
}

function isMonthOrSeason(word: string): boolean {
  const n = word.toLowerCase();
  return MONTHS.has(n) || SEASONS.has(n);
}

function hasPlacePreposition(text: string, name: string): boolean {
  const preps = [...PLACE_PREPOSITIONS].join("|");
  const re = new RegExp(
    `\\b(?:${preps})\\s+(?:der|die|das|den|dem|einem|einer|einen)?\\s*${escapeRegExp(name)}\\b`,
    "i",
  );
  return re.test(text);
}

/** Enthält der Kandidat selbst ein Ortsnomen („Hamburger Hafen")? */
function containsPlaceNoun(name: string): boolean {
  return name
    .toLowerCase()
    .split(/\s+/)
    .some((w) => PLACE_NOUNS.has(w));
}

function classifyCandidate(
  text: string,
  fullText: string,
  count: number,
): EntityKind {
  if (/^\d{4}$/.test(text)) return "timeline";
  const words = text.split(" ");
  if (words.length === 1 && isMonthOrSeason(words[0])) return "timeline";
  if (hasPlacePreposition(fullText, text) || containsPlaceNoun(text)) {
    return "place";
  }
  // Wiederholt auftretende Einzelbegriffe ohne Personen-Kontext sind eher
  // Terminologie als Charaktere (z.B. "Zeitmaschine" × 5).
  if (words.length === 1 && count >= 3) return "term";
  return "character";
}

/** Max. Entitäten pro Kapitel (Rauschen begrenzen). */
export const MAX_ENTITIES_PER_CHAPTER = 40;

/**
 * Extrahiert Entitäten aus einem Kapiteltext (deterministisch, offline).
 * Mehrwort-Namen ab 1×, Einzelwörter ab 2× Vorkommen.
 */
export function extractEntities(text: string, chapterIndex: number): EntityEntry[] {
  if (!text || !text.trim()) return [];
  const byNorm = new Map<string, EntityEntry>();

  const upsert = (name: string, kind: EntityKind, count: number) => {
    const norm = normalizeContinuityName(name);
    if (!norm) return;
    const existing = byNorm.get(norm);
    if (existing) {
      existing.mentions += count;
      if (!existing.chapters.includes(chapterIndex)) {
        existing.chapters.push(chapterIndex);
        existing.chapters.sort((a, b) => a - b);
      }
      return;
    }
    byNorm.set(norm, {
      name,
      kind,
      firstSeenChapter: chapterIndex,
      chapters: [chapterIndex],
      aliases: [],
      mentions: count,
      note: null,
    });
  };

  // 1) Zeitmarken (Jahre) — immer erfassen.
  for (const y of collectYears(text)) upsert(y.text, "timeline", y.count);

  // 2) Zitierte Begriffe → terms (kurze, plausible Phrasen).
  for (const q of collectQuotedTerms(text)) {
    if (q.text.split(" ").length <= 4) upsert(q.text, "term", q.count);
  }

  // 3) Namens-Sequenzen.
  const seqs = collectNameSequences(text);
  const ranked = seqs
    .filter((s) => {
      if (/^\d+$/.test(s.text)) return false; // reine Zahlen sind keine Namen
      if (s.text.split(" ").length > 1) return true;
      if (isMonthOrSeason(s.text)) return true;
      return s.count >= 2;
    })
    .map((s) => ({ s, kind: classifyCandidate(s.text, text, s.count) }))
    .sort((a, b) => {
      const rank = (k: EntityKind) =>
        k === "character" ? 0 : k === "place" ? 1 : k === "timeline" ? 2 : 3;
      if (rank(a.kind) !== rank(b.kind)) return rank(a.kind) - rank(b.kind);
      return b.s.count - a.s.count;
    })
    .slice(0, MAX_ENTITIES_PER_CHAPTER);

  for (const { s, kind } of ranked) upsert(s.text, kind, s.count);

  return [...byNorm.values()].sort((a, b) => b.mentions - a.mentions);
}

// ---------------------------------------------------------------------------
// Ledger-Aufbau (kapitelübergreifend mergen).
// ---------------------------------------------------------------------------

/**
 * Baut das Ledger aus allen Kapiteln: gleiche Entitäten (inkl. Drift-
 * Varianten) werden unter dem längsten Namen zusammengeführt, Varianten
 * landen in `aliases`.
 */
export function buildLedger(chapters: ChapterInput[]): Ledger {
  const merged: EntityEntry[] = [];

  const findSlot = (name: string): EntityEntry | undefined =>
    merged.find(
      (e) =>
        continuityNamesLikelySame(e.name, name) ||
        e.aliases.some((a) => continuityNamesLikelySame(a, name)),
    );

  chapters.forEach((ch, idx) => {
    for (const ent of extractEntities(ch.content, idx)) {
      const slot = findSlot(ent.name);
      if (!slot) {
        merged.push({ ...ent, chapters: [...ent.chapters], aliases: [] });
        continue;
      }
      slot.mentions += ent.mentions;
      for (const c of ent.chapters) {
        if (!slot.chapters.includes(c)) slot.chapters.push(c);
      }
      slot.chapters.sort((a, b) => a - b);
      slot.firstSeenChapter = Math.min(slot.firstSeenChapter, ent.firstSeenChapter);
      if (
        normalizeContinuityName(ent.name) !== normalizeContinuityName(slot.name) &&
        !slot.aliases.some((a) => continuityNamesLikelySame(a, ent.name))
      ) {
        if (ent.name.length > slot.name.length) {
          slot.aliases.push(slot.name);
          slot.name = ent.name;
        } else {
          slot.aliases.push(ent.name);
        }
      }
    }
  });

  merged.sort(
    (a, b) => b.chapters.length - a.chapters.length || b.mentions - a.mentions,
  );
  return { entities: merged, chapterCount: chapters.length, createdAt: Date.now() };
}

// ---------------------------------------------------------------------------
// Widerspruchserkennung.
// ---------------------------------------------------------------------------

/** Extrahiert alle 4-stelligen Jahre aus einem Text (in Reihenfolge). */
export function extractYearsOrdered(text: string): number[] {
  YEAR_RE.lastIndex = 0;
  const out: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = YEAR_RE.exec(text)) !== null) out.push(Number(m[1]));
  return out;
}

function extractAgeMentions(
  content: string,
  name: string,
): Array<{ years: number }> {
  const out: Array<{ years: number }> = [];
  const escaped = escapeRegExp(name);
  const re = new RegExp(
    `${escaped}[^.!?]{0,80}?\\b(\\d{1,3})\\s*(?:Jahre(?:\\s+alt)?|j\\u00e4hrig(?:e|er|es)?)`,
    "gi",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) out.push({ years: Number(m[1]) });
  return out;
}

/**
 * Erkennt Widersprüche aus Ledger + Kapiteltexten:
 * - name_variant (warning): Alias weicht vom kanonischen Namen ab.
 * - timeline_order (error): Jahreszahl fällt gegenüber früherem Kapitel
 *   zurück (nicht-monotone Erzählzeit).
 * - attribute_conflict (error): Altersangabe weicht > 2 Jahre ab.
 * - missing_entity (warning): Charakter aus frühen Kapiteln fehlt in den
 *   letzten beiden Kapiteln (erst ab ≥ 4 Kapiteln).
 */
export function detectContradictions(
  ledger: Ledger,
  chapters: ChapterInput[],
): Contradiction[] {
  const out: Contradiction[] = [];

  // 1) Namensvarianten aus dem Ledger.
  for (const ent of ledger.entities) {
    if (ent.kind !== "character" && ent.kind !== "place") continue;
    for (const alias of ent.aliases) {
      if (normalizeContinuityName(alias) === normalizeContinuityName(ent.name)) {
        continue;
      }
      out.push({
        type: "name_variant",
        severity: "warning",
        chapterIndex: ent.firstSeenChapter,
        expected: ent.name,
        found: alias,
        details: `Schreibvariante "${alias}" weicht vom Ledger-Namen "${ent.name}" ab.`,
      });
    }
  }

  // 2) Zeitlinien-Reihenfolge: max. Jahr pro Kapitel muss monoton wachsen.
  let maxSoFar: number | null = null;
  let maxSoFarChapter = -1;
  chapters.forEach((ch, idx) => {
    const years = extractYearsOrdered(ch.content);
    if (years.length === 0) return;
    const maxHere = Math.max(...years);
    if (maxSoFar !== null && maxHere < maxSoFar) {
      out.push({
        type: "timeline_order",
        severity: "error",
        chapterIndex: idx,
        expected: `≥ ${maxSoFar} (Kapitel ${maxSoFarChapter + 1})`,
        found: String(maxHere),
        details:
          `Kapitel ${idx + 1} fällt auf ${maxHere} zurück, nach ${maxSoFar} ` +
          `in Kapitel ${maxSoFarChapter + 1}.`,
      });
    }
    if (maxSoFar === null || maxHere > maxSoFar) {
      maxSoFar = maxHere;
      maxSoFarChapter = idx;
    }
  });

  // 3) Attributkonflikte (Alter) pro Charakter über alle Kapitel.
  for (const ent of ledger.entities) {
    if (ent.kind !== "character") continue;
    const ages: Array<{ years: number; chapter: number }> = [];
    chapters.forEach((ch, idx) => {
      const variants = [ent.name, ...ent.aliases];
      for (const v of variants) {
        for (const a of extractAgeMentions(ch.content, v)) {
          ages.push({ years: a.years, chapter: idx });
        }
      }
    });
    if (ages.length >= 2) {
      const min = Math.min(...ages.map((a) => a.years));
      const max = Math.max(...ages.map((a) => a.years));
      if (max - min > 2) {
        const latest = ages.reduce((p, c) => (c.chapter >= p.chapter ? c : p));
        out.push({
          type: "attribute_conflict",
          severity: "error",
          chapterIndex: latest.chapter,
          expected: `${min} Jahre (${ent.name})`,
          found: String(latest.years),
          details:
            `Altersangaben für "${ent.name}" widersprechen sich ` +
            `(${min} vs. ${max} Jahre).`,
        });
      }
    }
  }

  // 4) Fehlende Entitäten: Charakter aus frühen Kapiteln fehlt zuletzt.
  if (chapters.length >= 4) {
    const lastTwo = new Set([chapters.length - 2, chapters.length - 1]);
    for (const ent of ledger.entities) {
      if (ent.kind !== "character") continue;
      if (ent.chapters.length < 2) continue;
      const early = ent.chapters.some((c) => c < chapters.length - 2);
      const late = ent.chapters.some((c) => lastTwo.has(c));
      if (early && !late) {
        out.push({
          type: "missing_entity",
          severity: "warning",
          chapterIndex: -1,
          expected: ent.name,
          found: null,
          details:
            `"${ent.name}" kommt in frühen Kapiteln vor, fehlt aber in den ` +
            `letzten beiden Kapiteln — beabsichtigt?`,
        });
      }
    }
  }

  const severityRank = (s: Contradiction["severity"]) => (s === "error" ? 0 : 1);
  out.sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      a.chapterIndex - b.chapterIndex,
  );
  return out;
}

// ---------------------------------------------------------------------------
// Kapitel-Brief (komprimierter Kontext für das nächste Kapitel).
// ---------------------------------------------------------------------------

/** Standard-Budget für den Prompt-Baustein (Zeichen). */
export const DEFAULT_BRIEF_BUDGET_CHARS = 2000;
/** Max. Entitäten im Brief. */
export const MAX_BRIEF_ENTITIES = 12;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

const KIND_LABEL: Record<EntityKind, string> = {
  character: "Charakter",
  place: "Ort",
  term: "Begriff",
  timeline: "Zeit",
};

/**
 * Erzeugt den komprimierten Kapitel-Brief: aktive Entitäten, offene
 * Widersprüche, bisherige Zusammenfassungen und das nächste Kapitelziel —
 * als fertiger Prompt-Baustein unter dem Zeichen-Budget.
 */
export function buildChapterBrief(
  ledger: Ledger,
  contradictions: Contradiction[],
  next: NextChapterInput,
  prevSummaries: string[] = [],
  budgetChars: number = DEFAULT_BRIEF_BUDGET_CHARS,
): ChapterBrief {
  const forChapter = ledger.chapterCount;
  const activeEntities = [...ledger.entities]
    .sort((a, b) => b.chapters.length - a.chapters.length || b.mentions - a.mentions)
    .slice(0, MAX_BRIEF_ENTITIES);

  const lines: string[] = [];
  lines.push(`KONTEXT FÜR KAPITEL ${forChapter + 1}: "${next.title}"`);
  if (next.goal) lines.push(`Ziel: ${truncate(next.goal, 200)}`);
  if (next.conflict) lines.push(`Konflikt: ${truncate(next.conflict, 200)}`);
  if (next.outcome) lines.push(`Ergebnis: ${truncate(next.outcome, 200)}`);
  if (next.pov) lines.push(`Perspektive: ${truncate(next.pov, 120)}`);

  if (activeEntities.length > 0) {
    lines.push("Entitäten (kanonische Schreibweise einhalten):");
    for (const e of activeEntities) {
      const alias = e.aliases.length > 0 ? ` (Varianten: ${e.aliases.join(", ")})` : "";
      const note = e.note ? ` — ${truncate(e.note, 100)}` : "";
      lines.push(`- [${KIND_LABEL[e.kind]}] ${e.name}${alias}${note}`);
    }
  }

  const open = contradictions.slice(0, 8);
  if (open.length > 0) {
    lines.push("Offene Widersprüche (auflösen oder bewusst fortführen):");
    for (const c of open) {
      const where = c.chapterIndex >= 0 ? `Kapitel ${c.chapterIndex + 1}` : "kapitelübergreifend";
      lines.push(`- [${c.severity}] ${c.type} (${where}): ${truncate(c.details, 160)}`);
    }
  }

  const summaries = prevSummaries.filter((s) => s.trim()).slice(-3);
  if (summaries.length > 0) {
    lines.push("Bisher:");
    for (const s of summaries) lines.push(`- ${truncate(s, 220)}`);
  }

  let promptBlock = lines.join("\n");
  if (promptBlock.length > budgetChars) {
    // Kürzen: zuerst Zusammenfassungen streichen, dann Entitäten kappen.
    const withoutSummaries = lines
      .filter((l) => !summaries.some((s) => l.includes(truncate(s, 220).slice(0, 24))))
      .join("\n");
    promptBlock = withoutSummaries.length <= budgetChars
      ? withoutSummaries
      : truncate(withoutSummaries, budgetChars);
  }

  return {
    forChapter,
    nextTitle: next.title,
    activeEntities,
    contradictions: [...contradictions],
    promptBlock,
  };
}

// ---------------------------------------------------------------------------
// LLM-Hook (injizierbar, kein neuer Netzwerk-Code).
// ---------------------------------------------------------------------------

/** Ein LLM-Normalisierungsvorschlag für eine Entität. */
export interface LlmEntitySuggestion {
  name: string;
  kind: EntityKind;
  note?: string;
}

const VALID_KINDS = new Set<EntityKind>(["character", "place", "term", "timeline"]);

function parseLlmEntities(raw: string): LlmEntitySuggestion[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    const out: LlmEntitySuggestion[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.name !== "string" || !rec.name.trim()) continue;
      if (typeof rec.kind !== "string" || !VALID_KINDS.has(rec.kind as EntityKind)) {
        continue;
      }
      out.push({
        name: rec.name.trim().slice(0, 80),
        kind: rec.kind as EntityKind,
        note: typeof rec.note === "string" ? rec.note.slice(0, 200) : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Prompt für die LLM-Anreicherung (exportiert → testbar, mockbar). */
export function buildEnrichmentPrompt(chapterText: string, maxChars = 3000): string {
  const excerpt = truncate(chapterText, maxChars);
  return [
    "Extrahiere die wichtigsten Entitäten (Charaktere, Orte, Begriffe, Zeitmarken).",
    "Antworte AUSSCHLIESSLICH mit einem JSON-Array, z.B.:",
    '[{"name":"Anna Weber","kind":"character","note":"Detektivin"},',
    ' {"name":"Hamburg","kind":"place"}, {"name":"1987","kind":"timeline"}]',
    "Erlaubte kind-Werte: character, place, term, timeline. Max. 15 Einträge.",
    "Text:",
    excerpt,
  ].join("\n");
}

export interface EnrichResult {
  ledger: Ledger;
  /** Anzahl neu aufgenommener/aktualisierter Entitäten. */
  added: number;
  /** Rohe LLM-Antwort (für Diagnose). */
  raw: string;
}

/**
 * Reichert das Ledger per LLM an. `complete` ist injizierbar (Mock in Tests);
 * ungültige/fehlerhafte Antworten sind kein Fehler (added = 0). Wirft nur,
 * wenn `complete` selbst wirft — Aufrufer entscheiden über Fallback.
 */
export async function enrichLedgerWithLlm(
  ledger: Ledger,
  chapterText: string,
  chapterIndex: number,
  complete: CompleteFn,
): Promise<EnrichResult> {
  const raw = await complete(buildEnrichmentPrompt(chapterText));
  const suggestions = parseLlmEntities(raw);
  if (suggestions.length === 0) return { ledger, added: 0, raw };

  const entities = ledger.entities.map((e) => ({
    ...e,
    chapters: [...e.chapters],
    aliases: [...e.aliases],
  }));
  let added = 0;
  for (const s of suggestions) {
    const slot = entities.find(
      (e) =>
        continuityNamesLikelySame(e.name, s.name) ||
        e.aliases.some((a) => continuityNamesLikelySame(a, s.name)),
    );
    if (slot) {
      if (s.note && !slot.note) {
        slot.note = s.note;
        added++;
      }
      if (!slot.chapters.includes(chapterIndex)) {
        slot.chapters.push(chapterIndex);
        slot.chapters.sort((a, b) => a - b);
      }
      continue;
    }
    entities.push({
      name: s.name,
      kind: s.kind,
      firstSeenChapter: chapterIndex,
      chapters: [chapterIndex],
      aliases: [],
      mentions: 1,
      note: s.note ?? null,
    });
    added++;
  }
  entities.sort(
    (a, b) => b.chapters.length - a.chapters.length || b.mentions - a.mentions,
  );
  return { ledger: { ...ledger, entities }, added, raw };
}

/**
 * Baut eine `CompleteFn` auf dem bestehenden Ollama-Service
 * (`completeOnce` aus `@/services/llm` + Settings). Lazy-Importe: Dieses
 * Modul bleibt ohne Aufruf dieser Funktion netzwerk- und seitenffektfrei.
 * Es entsteht KEIN neuer Netzwerk-Code — nur Verdrahtung.
 */
export function createOllamaComplete(): CompleteFn {
  return async (prompt: string): Promise<string> => {
    const { loadSettings } = await import("@/services/settings");
    const { completeOnce } = await import("@/services/llm");
    const settings = loadSettings();
    return completeOnce(settings, prompt);
  };
}
