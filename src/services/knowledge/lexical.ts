// Lexikalische Suche (BM25) — funktioniert vollständig offline, ohne LLM und ohne Embeddings.
//
// Zweck: garantierte Grundfunktion der Projektwissen-Suche. Wenn Ollama nicht läuft,
// bleibt die Suche brauchbar statt auszufallen. Zusätzlich liefert BM25 im Hybrid-Modus
// die exakte Term-Komponente, die reine Embeddings notorisch schlecht abdecken
// (Eigennamen, Ortsnamen, Fachbegriffe).

/** BM25-Parameter. k1 steuert Termfrequenz-Sättigung, b die Längennormalisierung. */
const K1 = 1.2;
const B = 0.75;

/**
 * Deutsche Stoppwörter. Bewusst konservativ: Wörter, die für Manuskriptsuche
 * bedeutungstragend sein können (z. B. "nicht", "kein"), bleiben drin.
 */
const STOPWORDS = new Set([
  "der", "die", "das", "des", "dem", "den", "ein", "eine", "einer", "eines", "einem", "einen",
  "und", "oder", "aber", "sondern", "denn", "als", "wie", "wenn", "dass", "weil", "ob",
  "ich", "du", "er", "sie", "es", "wir", "ihr", "mich", "dich", "sich", "uns", "euch",
  "mein", "dein", "sein", "unser", "euer", "ihre", "ihren", "ihrem", "ihres",
  "in", "im", "an", "am", "auf", "aus", "bei", "mit", "nach", "von", "vom", "vor", "zu", "zur", "zum",
  "über", "unter", "durch", "für", "gegen", "ohne", "um", "bis", "seit", "während",
  "ist", "sind", "war", "waren", "wird", "werden", "wurde", "wurden", "hat", "haben", "hatte", "hatten",
  "kann", "können", "muss", "müssen", "soll", "sollen", "will", "wollen",
  "auch", "noch", "nur", "schon", "sehr", "so", "dann", "da", "hier", "dort", "doch", "mal",
  "man", "sich", "zum", "zur", "eines", "etwas", "alle", "allen", "aller",
]);

export interface Posting {
  /** Term-Frequenzen dieses Dokuments. */
  tf: Record<string, number>;
  /** Gesamtzahl Tokens im Dokument (nach Tokenisierung). */
  length: number;
}

/**
 * Tokenisiert deutschen Text: kleinschreibt, trennt an Nicht-Buchstaben,
 * behält Umlaute und ß, entfernt Stoppwörter und Einzelzeichen.
 */
export function tokenize(text: string): string[] {
  if (typeof text !== "string" || !text) return [];
  return text
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .split(/[^a-zäöüß0-9-]+/i)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Sehr leichtes deutsches Stemming. Kein Porter/Snowball —
 * bewusst nur häufige Flexionsendungen, um Overstemming zu vermeiden
 * (bei Eigennamen im Manuskript ist Overstemming schädlicher als Understemming).
 */
export function stem(token: string): string {
  if (token.length <= 4) return token;
  for (const suf of ["ungen", "erung", "ische", "lichen", "licher", "liches", "ungen"]) {
    if (token.endsWith(suf) && token.length - suf.length >= 4) return token.slice(0, -suf.length);
  }
  for (const suf of ["ern", "end", "est", "ung", "lich", "isch", "heit", "keit"]) {
    if (token.endsWith(suf) && token.length - suf.length >= 4) return token.slice(0, -suf.length);
  }
  for (const suf of ["en", "er", "es", "em", "st", "te", "ts"]) {
    if (token.endsWith(suf) && token.length - suf.length >= 4) return token.slice(0, -suf.length);
  }
  if (token.endsWith("s") && token.length > 4) return token.slice(0, -1);
  return token;
}

/** Tokenisiert und stemmt in einem Schritt. */
export function analyze(text: string): string[] {
  return tokenize(text).map(stem);
}

/** Baut das Posting (Termfrequenzen + Länge) für einen Text. */
export function buildPosting(text: string): Posting {
  const tokens = analyze(text);
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
  return { tf, length: tokens.length };
}

/** Serialisiert ein Posting für die DB-Spalte `term_freq`. */
export function serializePosting(p: Posting): string {
  return JSON.stringify({ tf: p.tf, len: p.length });
}

/** Liest ein Posting aus der DB-Spalte. Liefert null bei fehlerhaftem Inhalt. */
export function deserializePosting(raw: string | null): Posting | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object" || typeof o.tf !== "object") return null;
    return { tf: o.tf as Record<string, number>, length: Number(o.len ?? 0) };
  } catch {
    return null;
  }
}

export interface Bm25Doc {
  id: string;
  posting: Posting;
}

export interface Bm25Hit {
  id: string;
  score: number;
  /** Welche Query-Terme in diesem Dokument getroffen haben. */
  matchedTerms: string[];
}

/**
 * BM25-Ranking über eine Dokumentmenge.
 * Scores werden auf 0..1 normalisiert, damit sie im Hybrid-Modus
 * mit Kosinus-Ähnlichkeiten kombinierbar sind.
 */
export function bm25Search(query: string, docs: Bm25Doc[], limit = 20): Bm25Hit[] {
  const qTerms = Array.from(new Set(analyze(query)));
  if (!qTerms.length || !docs.length) return [];

  const N = docs.length;
  const avgLen = docs.reduce((s, d) => s + d.posting.length, 0) / N || 1;

  // Dokumentfrequenz je Term
  const df: Record<string, number> = {};
  for (const term of qTerms) {
    let c = 0;
    for (const d of docs) if (d.posting.tf[term]) c++;
    df[term] = c;
  }

  const hits: Bm25Hit[] = [];
  for (const d of docs) {
    let score = 0;
    const matched: string[] = [];
    for (const term of qTerms) {
      const f = d.posting.tf[term];
      if (!f) continue;
      matched.push(term);
      const n = df[term];
      // IDF mit +1 im Logarithmus: nie negativ, auch wenn ein Term in allen Dokumenten steht
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      const norm = f * (K1 + 1) / (f + K1 * (1 - B + B * (d.posting.length / avgLen)));
      score += idf * norm;
    }
    if (score > 0) hits.push({ id: d.id, score, matchedTerms: matched });
  }

  hits.sort((a, b) => b.score - a.score);
  const max = hits[0]?.score ?? 1;
  return hits.slice(0, limit).map((h) => ({ ...h, score: max > 0 ? h.score / max : 0 }));
}

/**
 * Exakte Suche: Teilstring-Treffer, unabhängig von Tokenisierung und Stemming.
 * Für Fälle, in denen der Autor genau weiß, wonach er sucht ("Wo steht 'blauer Mantel'?").
 */
export function exactSearch(
  query: string,
  docs: { id: string; text: string }[],
  limit = 50,
): Bm25Hit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: Bm25Hit[] = [];
  for (const d of docs) {
    const hay = d.text.toLowerCase();
    let count = 0;
    let pos = hay.indexOf(q);
    while (pos !== -1) {
      count++;
      pos = hay.indexOf(q, pos + q.length);
    }
    if (count > 0) {
      // Mehr Treffer und kürzeres Dokument = relevanter
      hits.push({ id: d.id, score: count / Math.sqrt(Math.max(1, d.text.length / 500)), matchedTerms: [q] });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  const max = hits[0]?.score ?? 1;
  return hits.slice(0, limit).map((h) => ({ ...h, score: max > 0 ? h.score / max : 0 }));
}

/**
 * Kombiniert zwei Ranglisten per Reciprocal Rank Fusion.
 * RRF statt Score-Addition, weil Kosinus- und BM25-Scores nicht dieselbe
 * Verteilung haben — Rangfusion ist robuster gegen Skalenunterschiede.
 */
export function reciprocalRankFusion(
  lists: { id: string; score: number }[][],
  k = 60,
  limit = 20,
): { id: string; score: number }[] {
  const acc: Record<string, number> = {};
  for (const list of lists) {
    list.forEach((item, rank) => {
      acc[item.id] = (acc[item.id] ?? 0) + 1 / (k + rank + 1);
    });
  }
  const out = Object.entries(acc).map(([id, score]) => ({ id, score }));
  out.sort((a, b) => b.score - a.score);
  const max = out[0]?.score ?? 1;
  return out.slice(0, limit).map((o) => ({ ...o, score: max > 0 ? o.score / max : 0 }));
}
