// Stimmfarben- & Akzent-Synthesizer (WP 70.1)
//
// Hörbuch- und Hörspiel-Produzenten brauchen für jede Figur eine akustische
// DNA, damit kein Sprecher dem anderen gleicht.
//
// Drei deterministische Werkzeuge:
//
//   1. synthesizeVoiceTimbre — Formanten-Parameter aus Figurenprofil
//   2. applyAccent          — Phonem-Transformationsregeln für 6 Akzente
//   3. buildVoiceTestPhrase — Sprechprobe mit Akzent-Transformation
//
// Design-Regeln (analog den übrigen Services):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - KEINE node:-Module (läuft im Browser/Vite).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Akzent-Profil. */
export type AccentProfile =
  | 'scottish'
  | 'bavarian'
  | 'french'
  | 'berlin'
  | 'victorian'
  | 'neutral';

/** Akustische Formanten-Parameter einer Stimme. */
export interface VoiceTimbre {
  /** Grundfrequenz in Hz (Pitch). */
  pitchHz: number;
  /** Formantenverschiebung in Prozent (negativ = Bruststimme, positiv = Kopfstimme). */
  formantShift: number;
  /** Heiserkeit / Vocal Fry in Prozent. */
  vocalFry: number;
  /** Atemanteil (Breathiness) in Prozent. */
  breathiness: number;
  /** Zitterfrequenz in Hz (Tremor für Alter/Furcht). */
  tremorHz: number;
  /** Sprechgeschwindigkeit in Silben pro Sekunde. */
  speechRate: number;
  /** Menschenlesbare Charakterisierung. */
  character: string;
}

/** Eingabe-Profil für die Stimm-Synthese. */
export interface VoiceProfileInput {
  /** Alter in Jahren. */
  age?: number;
  /** Geschlechts-Tendenz. */
  gender?: 'male' | 'female' | 'neutral';
  /** Statur. */
  build?: 'slight' | 'average' | 'heavy';
  /** Grundstimmung. */
  mood?: 'calm' | 'anxious' | 'authoritative' | 'warm' | 'cold';
  /** Akzent. */
  accent?: AccentProfile;
  /** Figurenname (für den Seed). */
  name?: string;
}

/** Eine Phonem-Transformationsregel. */
export interface PhonemeRule {
  /** Regulärer Ausdruck (Quelltext). */
  pattern: string;
  /** Ersatz. */
  replacement: string;
  /** Kurzbeschreibung. */
  note: string;
}

/** Ergebnis der Akzent-Anwendung. */
export interface AccentResult {
  /** Transformierter Text. */
  text: string;
  /** Verwendeter Akzent. */
  accent: AccentProfile;
  /** Menschenlesbarer Akzent-Name. */
  accentLabel: string;
  /** Anzahl der angewendeten Regeln. */
  appliedRules: number;
  /** Regeln, die gegriffen haben. */
  matchedRules: string[];
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

// ---------------------------------------------------------------------------
// Akzent-Definitionen
// ---------------------------------------------------------------------------

/** Menschenlesbare Akzent-Namen. */
export const ACCENT_LABELS: Record<AccentProfile, string> = {
  scottish: 'Schottisch',
  bavarian: 'Bayerisch',
  french: 'Französischer Akzent',
  berlin: 'Berlinerisch',
  victorian: 'Viktorianisches Englisch',
  neutral: 'Neutral',
};

/**
 * Phonem-Transformationsregeln je Akzent.
 *
 * Die Regeln sind bewusst als Regex-Paare hinterlegt (nicht als feste
 * Wortlisten), damit sie auch auf Wörter greifen, die nicht in einer Liste
 * stehen — siehe die Skill-Regel zu Phrasen-Markern.
 */
export const ACCENT_RULES: Record<AccentProfile, readonly PhonemeRule[]> = {
  scottish: [
    { pattern: '\\bwh', replacement: 'hw', note: 'wh → hw' },
    { pattern: 'oo', replacement: 'u', note: 'oo → u' },
    { pattern: '\\bnot\\b', replacement: 'no', note: 'not → no' },
    { pattern: '\\bcan\\b', replacement: 'cannae', note: 'can → cannae' },
    { pattern: '\\bvery\\b', replacement: 'awfy', note: 'very → awfy' },
  ],
  bavarian: [
    { pattern: '\\bist\\b', replacement: 'is', note: 'ist → is' },
    { pattern: '\\bich\\b', replacement: 'i', note: 'ich → i' },
    { pattern: '\\bauch\\b', replacement: 'aa', note: 'auch → aa' },
    { pattern: '\\bnicht\\b', replacement: 'ned', note: 'nicht → ned' },
    { pattern: 'st\\b', replacement: 'st', note: 'Endsilbe bleibt hart' },
  ],
  french: [
    { pattern: '\\bthe\\b', replacement: 'ze', note: 'th → z' },
    { pattern: '\\bthis\\b', replacement: 'zis', note: 'this → zis' },
    { pattern: '\\bthat\\b', replacement: 'zat', note: 'that → zat' },
    { pattern: 'h\\b', replacement: '', note: 'stummes h' },
    { pattern: '\\bwith\\b', replacement: 'wiz', note: 'with → wiz' },
  ],
  berlin: [
    { pattern: '\\bich\\b', replacement: 'ick', note: 'ich → ick' },
    { pattern: '\\bdas\\b', replacement: 'det', note: 'das → det' },
    { pattern: '\\bwas\\b', replacement: 'wat', note: 'was → wat' },
    { pattern: '\\bnicht\\b', replacement: 'nüscht', note: 'nicht → nüscht' },
    { pattern: '\\bauf\\b', replacement: 'uff', note: 'auf → uff' },
  ],
  victorian: [
    { pattern: '\\byou\\b', replacement: 'one', note: 'you → one (unpersönlich)' },
    { pattern: '\\byes\\b', replacement: 'indeed', note: 'yes → indeed' },
    { pattern: '\\bhello\\b', replacement: 'good day', note: 'hello → good day' },
    { pattern: "n't\\b", replacement: ' not', note: 'Kontraktion aufgelöst' },
    { pattern: '\\bokay\\b', replacement: 'very well', note: 'okay → very well' },
  ],
  neutral: [],
};

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Zahl auf einen Bereich begrenzen. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Rundet auf 2 Nachkommastellen. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Akzent defensiv prüfen. */
function normalizeAccent(value: unknown): AccentProfile {
  const all: AccentProfile[] = ['scottish', 'bavarian', 'french', 'berlin', 'victorian', 'neutral'];
  return typeof value === 'string' && (all as string[]).includes(value)
    ? (value as AccentProfile)
    : 'neutral';
}

// ---------------------------------------------------------------------------
// 1) Stimmfarben-Synthese
// ---------------------------------------------------------------------------

/**
 * Leitet akustische Formanten-Parameter aus einem Figurenprofil ab.
 *
 * Jede Eigenschaft verschiebt die Parameter in eine physiologisch plausible
 * Richtung: Alter hebt den Tremor, schwere Statur senkt den Pitch, Angst
 * beschleunigt die Sprechrate. Ein deterministischer Jitter (aus dem Namen)
 * sorgt dafür, dass zwei gleich alte Figuren nie identisch klingen.
 *
 * Defensiv: ohne Profil entsteht eine neutrale, plausible Standardstimme.
 */
export function synthesizeVoiceTimbre(
  profile?: VoiceProfileInput | null,
): VoiceTimbre {
  const age = clamp(typeof profile?.age === 'number' && Number.isFinite(profile.age) ? profile.age : 35, 1, 120);
  const gender = profile?.gender ?? 'neutral';
  const build = profile?.build ?? 'average';
  const mood = profile?.mood ?? 'calm';
  const name = typeof profile?.name === 'string' ? profile.name : 'Stimme';

  // Basis-Pitch nach Geschlechts-Tendenz.
  let pitch = gender === 'male' ? 120 : gender === 'female' ? 210 : 165;

  // Statur: schwerere Statur → tiefere Stimme.
  if (build === 'heavy') pitch -= 12;
  if (build === 'slight') pitch += 10;

  // Alter: Kinder höher, Senioren tiefer.
  if (age < 14) pitch += 45;
  else if (age < 25) pitch += 12;
  else if (age > 65) pitch -= 18;
  else if (age > 50) pitch -= 8;

  // Deterministischer Jitter ±6 Hz aus dem Namen.
  const rand = createSeededRandom(hashString(name));
  pitch += (rand() * 12 - 6);

  // Formantenverschiebung: Bruststimme (negativ) vs. Kopfstimme (positiv).
  let formantShift = 0;
  if (build === 'heavy') formantShift -= 12;
  if (build === 'slight') formantShift += 8;
  if (age < 14) formantShift += 15;
  if (mood === 'authoritative') formantShift -= 10;
  if (mood === 'warm') formantShift += 4;

  // Heiserkeit: steigt mit Alter und bei kalter/anxöser Stimmung.
  let vocalFry = clamp((age - 40) * 0.8, 0, 35);
  if (mood === 'anxious') vocalFry += 8;
  if (mood === 'cold') vocalFry += 5;
  vocalFry = clamp(vocalFry + (rand() * 6 - 3), 0, 60);

  // Atemanteil: junge und warme Stimmen atmen mehr, kalte weniger.
  let breathiness = 12;
  if (age < 25) breathiness += 10;
  if (mood === 'warm') breathiness += 8;
  if (mood === 'cold') breathiness -= 6;
  if (mood === 'anxious') breathiness += 12;
  breathiness = clamp(breathiness + (rand() * 8 - 4), 0, 70);

  // Tremor: ab 55 deutlich, bei Angst stark.
  let tremorHz = age > 55 ? (age - 55) * 0.25 : 0;
  if (mood === 'anxious') tremorHz += 3.5;
  tremorHz = clamp(round2(tremorHz + rand() * 0.6), 0, 12);

  // Sprechrate: Angst schnell, Bedächtigkeit langsam.
  let speechRate = 4.2;
  if (mood === 'anxious') speechRate += 1.4;
  if (mood === 'authoritative') speechRate -= 0.6;
  if (age > 70) speechRate -= 0.5;
  speechRate = clamp(round2(speechRate + (rand() * 0.4 - 0.2)), 2, 8);

  const character = describeTimbre({ pitch, formantShift, vocalFry, breathiness, tremorHz, speechRate });

  return {
    pitchHz: Math.round(clamp(pitch, 60, 400)),
    formantShift: Math.round(clamp(formantShift, -30, 30)),
    vocalFry: Math.round(clamp(vocalFry, 0, 60)),
    breathiness: Math.round(clamp(breathiness, 0, 70)),
    tremorHz: round2(clamp(tremorHz, 0, 12)),
    speechRate,
    character,
  };
}

/** Menschenlesbare Charakterisierung der Stimme. */
function describeTimbre(t: {
  pitch: number;
  formantShift: number;
  vocalFry: number;
  breathiness: number;
  tremorHz: number;
  speechRate: number;
}): string {
  const parts: string[] = [];
  parts.push(t.pitch < 110 ? 'tief' : t.pitch > 200 ? 'hoch' : 'mittlere Lage');
  parts.push(t.formantShift < -6 ? 'Bruststimme' : t.formantShift > 6 ? 'Kopfstimme' : 'ausgeglichen');
  if (t.vocalFry > 25) parts.push('rau');
  else if (t.vocalFry > 12) parts.push('leicht heiser');
  if (t.breathiness > 30) parts.push('stark behaucht');
  else if (t.breathiness > 18) parts.push('behaucht');
  if (t.tremorHz > 4) parts.push('zittrig');
  else if (t.tremorHz > 1.5) parts.push('leichtes Zittern');
  parts.push(t.speechRate > 5 ? 'schnell' : t.speechRate < 3.6 ? 'bedächtig' : 'normales Tempo');
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// 2) Akzent-Anwendung
// ---------------------------------------------------------------------------

/**
 * Wendet die Phonem-Transformationen eines Akzents auf Text an.
 *
 * Defensiv: unbekannte Akzente fallen auf 'neutral' zurück (keine Änderung).
 */
export function applyAccent(
  text: string,
  accent: AccentProfile | string,
): AccentResult {
  const safeText = typeof text === 'string' ? text : '';
  const profile = normalizeAccent(accent);
  const rules = ACCENT_RULES[profile];

  let out = safeText;
  const matchedRules: string[] = [];

  for (const rule of rules) {
    const re = new RegExp(rule.pattern, 'gi');
    if (re.test(out)) {
      matchedRules.push(rule.note);
      // Frisches Regex-Objekt, damit lastIndex nicht leckt.
      out = out.replace(new RegExp(rule.pattern, 'gi'), (match) =>
        matchCase(rule.replacement, match),
      );
    }
  }

  return {
    text: out,
    accent: profile,
    accentLabel: ACCENT_LABELS[profile],
    appliedRules: matchedRules.length,
    matchedRules,
  };
}

/** Überträgt die Groß-/Kleinschreibung des Originals auf den Ersatz. */
function matchCase(replacement: string, original: string): string {
  if (replacement.length === 0) return '';
  const first = original.charAt(0);
  if (first === first.toUpperCase() && first !== first.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

// ---------------------------------------------------------------------------
// 3) Sprechprobe
// ---------------------------------------------------------------------------

/** Standard-Sprechprobe für Stimmvergleiche. */
export const DEFAULT_TEST_PHRASE =
  'Ich kann nicht glauben, dass du das wirklich gesagt hast. Das ist nicht richtig, und ich weiß es.';

/**
 * Baut eine Sprechprobe mit Akzent-Transformation.
 *
 * Defensiv: ohne Text wird die Standard-Phrase verwendet.
 */
export function buildVoiceTestPhrase(
  text?: string | null,
  accent?: AccentProfile | string,
): AccentResult {
  const source = typeof text === 'string' && text.trim().length > 0
    ? text
    : DEFAULT_TEST_PHRASE;
  return applyAccent(source, accent ?? 'neutral');
}

// ---------------------------------------------------------------------------
// 4) Vergleich zweier Stimmen
// ---------------------------------------------------------------------------

/**
 * Bewertet, wie ähnlich sich zwei Stimmen klingen (0 = identisch, 1 = maximal
 * verschieden).
 *
 * Defensiv: fehlende Stimmen liefern 0.
 */
export function voiceDistance(
  a: VoiceTimbre | null | undefined,
  b: VoiceTimbre | null | undefined,
): number {
  if (!a || !b) return 0;
  const norm = (v: number, max: number) => v / max;
  const d =
    Math.abs(norm(a.pitchHz - b.pitchHz, 200)) +
    Math.abs(norm(a.formantShift - b.formantShift, 60)) +
    Math.abs(norm(a.vocalFry - b.vocalFry, 60)) +
    Math.abs(norm(a.breathiness - b.breathiness, 70)) +
    Math.abs(norm(a.tremorHz - b.tremorHz, 12)) +
    Math.abs(norm(a.speechRate - b.speechRate, 6));
  return round2(clamp(d / 6, 0, 1));
}
