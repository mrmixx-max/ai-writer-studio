// Guest-Review-Portal-Service (WP 42.2): Lektoren-Session mit lokalem Link + QR.
//
// Rein lokal und deterministisch: kein LLM, keine DB, kein Netzwerkzugriff.
// Der "Netzwerk-Link" wird lediglich als String gebaut (die lokale HTTP-Schicht
// liegt außerhalb dieses Moduls); es findet KEIN Socket-/Fetch-Aufruf statt.
//
// Enthält einen echten, minimalen QR-Encoder (Version 1–4, Byte-Mode,
// Fehlerkorrektur-Level L) — NUR mit Mathematik, ohne npm-Library:
//   * GF(256)-Arithmetik (Primitivpolynom 0x11D),
//   * Reed-Solomon-Fehlerkorrektur (Versions 1–4, Level L = je EIN Block),
//   * Funktions-Patterns (Finder, Timing, Alignment, Format-Info),
//   * Maskenauswahl über die vier Penalty-Regeln der Spezifikation.
// Einschränkung (ehrlich dokumentiert): Es werden nur Versionen 1–4 (Level L,
// Byte-Mode) unterstützt; das entspricht max. 78 Bytes Nutzlast. Längere
// Eingaben werden deterministisch auf 78 Bytes gekürzt (`truncated: true`),
// damit die Ausgabe strukturell gültig bleibt. Für die real erzeugten
// Review-Links reicht das aus.
//
// Alle öffentlichen Funktionen sind defensiv: fehlende/unvollständige/ungültige
// Daten führen zu neutralen No-ops bzw. sicheren Defaults statt zu Exceptions.
// Zeit ist über `__setClock` (Test-Hook) injizierbar — wie in p2pSync.ts.

// ---------------------------------------------------------------------------
// Öffentliche Typen (gemäß WP-42.2-Vertrag)
// ---------------------------------------------------------------------------

/** Ein Kapitel, das der Lektor lesen/bewerten darf. */
export interface ReviewChapter {
  id: string;
  title: string;
  content: string;
}

/** Optionen für die Erstellung einer Review-Session. */
export interface ReviewOptions {
  /** `readonly` = nur lesen; `commentable` = Kommentare erlaubt (Default). */
  mode?: "readonly" | "commentable";
  /** Gültigkeitsdauer in Minuten (Default 1440 = 24h). */
  expiresInMinutes?: number;
}

/** Ein Kommentar eines Lektors an einer Textposition (Zeichen-Offset). */
export interface ReviewComment {
  id: string;
  chapterId: string;
  text: string;
  author: string;
  position: number;
  createdAt: number;
}

/** Eine Lektoren-Session. */
export interface ReviewSession {
  id: string;
  token: string;
  chapters: ReviewChapter[];
  mode: string;
  createdAt: number;
  expiresAt: number;
  comments: ReviewComment[];
}

/** Ein teilbarer Review-Link inklusive Token und QR-Code. */
export interface ReviewLink {
  url: string;
  token: string;
  qrCodeSvg: string;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

const DEFAULT_MODE = "commentable" as const;
const DEFAULT_EXPIRES_MINUTES = 1440; // 24 Stunden
const MAX_EXPIRES_MINUTES = 525600; // ein Jahr
const MS_PER_MINUTE = 60_000;
const DEFAULT_HOST = "localhost";

// ---------------------------------------------------------------------------
// Kleine Helfer (deterministisch, ohne Zufall)
// ---------------------------------------------------------------------------

/** FNV-1a-Hash (32 Bit, deterministisch). */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 32-stelliger Hex-Token aus einem Seed (deterministisch, kein Zufall). */
function tokenFrom(seed: string): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += fnv1a(`${seed}#${i}`).toString(16).padStart(8, "0");
  }
  return out;
}

/** Kurzer, inhaltlich gebundener Suffix (8 Hex-Zeichen). */
function hash8(seed: string): string {
  return tokenFrom(seed).slice(0, 8);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Normalisiert Host: entfernt Protokoll, Pfad und Slashes; leere Werte → Default. */
function normalizeHost(host: unknown): string {
  let h = asString(host).trim();
  h = h.replace(/^[a-z]+:\/\//i, "");
  h = h.replace(/\/.*$/, "");
  h = h.replace(/\s+/g, "");
  return h || DEFAULT_HOST;
}

/** Minuten defensiv normalisieren (nicht-numerisch/negativ → Default). */
function normalizeMinutes(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < 0) return DEFAULT_EXPIRES_MINUTES;
  return Math.min(n, MAX_EXPIRES_MINUTES);
}

// ---------------------------------------------------------------------------
// Modul-Store (In-Memory, Single-User-Desktop-App)
// ---------------------------------------------------------------------------

const sessions = new Map<string, ReviewSession>();
/** Bereits in den Editor importierte Kommentar-IDs je Session. */
const importedComments = new Map<string, Set<string>>();
let sessionCounter = 0;
let commentCounter = 0;
let nowFn: () => number = () => Date.now();

function clock(): number {
  const t = nowFn();
  return Number.isFinite(t) ? t : 0;
}

/** Test-Hook: setzt die Uhr (wie p2pSync.__setClock). */
export function __setClock(fn?: (() => number) | null): void {
  nowFn = typeof fn === "function" ? fn : () => Date.now();
}

/** Test-Hook: leert Store und Zähler, setzt die Uhr zurück. */
export function __reset(): void {
  sessions.clear();
  importedComments.clear();
  sessionCounter = 0;
  commentCounter = 0;
  nowFn = () => Date.now();
}

// ---------------------------------------------------------------------------
// Normalisierung (defensiv)
// ---------------------------------------------------------------------------

function normalizeChapter(raw: unknown, index: number): ReviewChapter | null {
  const r = asRecord(raw);
  if (!r) return null;
  const id = asString(r.id).trim() || `ch-${index}`;
  const title = asString(r.title);
  const content = asString(r.content);
  if (!title && !content && !asString(r.id).trim()) return null;
  return { id, title, content };
}

function normalizeChapters(chapters: unknown): ReviewChapter[] {
  if (!Array.isArray(chapters)) return [];
  const out: ReviewChapter[] = [];
  chapters.forEach((raw, i) => {
    const c = normalizeChapter(raw, i);
    if (c) out.push(c);
  });
  return out;
}

/** Normalisiert einen Kommentar. Leere/ungültige Eingaben → null (No-op). */
function normalizeComment(raw: unknown): ReviewComment | null {
  const r = asRecord(raw);
  if (!r) return null;
  const chapterId = asString(r.chapterId).trim();
  const text = asString(r.text);
  if (!chapterId || !text.trim()) return null;
  const id = asString(r.id).trim() || (() => {
    commentCounter += 1;
    return `rc-${commentCounter.toString(36)}`;
  })();
  const author = asString(r.author).trim() || "Gast";
  const posRaw = typeof r.position === "number" ? r.position : Number(r.position);
  const position = Number.isFinite(posRaw) ? Math.max(0, Math.floor(posRaw)) : 0;
  const createdRaw = typeof r.createdAt === "number" ? r.createdAt : Number(r.createdAt);
  const createdAt = Number.isFinite(createdRaw) ? createdRaw : clock();
  return { id, chapterId, text, author, position, createdAt };
}

function normalizeSessionShape(session: unknown): ReviewSession {
  const s = asRecord(session) ?? {};
  const chapters = normalizeChapters(s.chapters);
  const createdAt =
    typeof s.createdAt === "number" && Number.isFinite(s.createdAt) ? s.createdAt : clock();
  const expiresAt =
    typeof s.expiresAt === "number" && Number.isFinite(s.expiresAt)
      ? s.expiresAt
      : createdAt + DEFAULT_EXPIRES_MINUTES * MS_PER_MINUTE;
  const rawComments = Array.isArray(s.comments) ? s.comments : [];
  const comments: ReviewComment[] = [];
  for (const c of rawComments) {
    const n = normalizeComment(c);
    if (n) comments.push(n);
  }
  return {
    id: asString(s.id).trim() || "rs-unknown",
    token: asString(s.token),
    chapters,
    mode: s.mode === "readonly" ? "readonly" : DEFAULT_MODE,
    createdAt,
    expiresAt,
    comments,
  };
}

/** Leere, gültige Session als defensiver Fallback für ungültige Eingaben. */
function emptySession(): ReviewSession {
  const t = clock();
  return {
    id: "rs-invalid",
    token: "",
    chapters: [],
    mode: "readonly",
    createdAt: t,
    expiresAt: t,
    comments: [],
  };
}

/**
 * Löst eine Session defensiv gegen den Store auf. Fehlende Sessions mit gültiger
 * ID werden adoptiert (normalisiert) und registriert; ungültige → null.
 */
function resolveSession(session: ReviewSession | null | undefined): ReviewSession | null {
  const s = asRecord(session);
  if (!s) return null;
  const id = asString(s.id).trim();
  if (!id) return null;
  let known = sessions.get(id);
  if (!known) {
    known = normalizeSessionShape(session);
    sessions.set(id, known);
  }
  if (!importedComments.has(id)) importedComments.set(id, new Set());
  return known;
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Erstellt eine Lektoren-Session. Defensiv: ungültige `chapters` → leere Liste;
 * ungültige Optionen → Defaults (`commentable`, 24h). Deterministisch (kein
 * Zufall) — ID und Token werden aus Inhalt + Zähler + Zeit abgeleitet.
 */
export function createReviewSession(
  chapters: ReviewChapter[],
  options: ReviewOptions = {},
): ReviewSession {
  const opts = asRecord(options) ?? {};
  const chs = normalizeChapters(chapters);
  const mode = opts.mode === "readonly" ? "readonly" : DEFAULT_MODE;
  const minutes = normalizeMinutes(opts.expiresInMinutes);
  const createdAt = clock();

  const seed = chs.map((c) => `${c.id}:${c.title}:${c.content}`).join("|");
  sessionCounter += 1;
  const id = `rs-${sessionCounter.toString(36)}-${hash8(seed)}`;
  const token = tokenFrom(`${id}|${seed}|${createdAt}`);

  const session: ReviewSession = {
    id,
    token,
    chapters: chs,
    mode,
    createdAt,
    expiresAt: createdAt + minutes * MS_PER_MINUTE,
    comments: [],
  };
  sessions.set(id, session);
  importedComments.set(id, new Set());
  return session;
}

/**
 * Erzeugt einen lokalen Netzwerk-Link + Token. `host` kann mit/ohne Protokoll
 * übergeben werden; leer/ungültig → `localhost`. Der Link ist rein lokal
 * zusammengesetzt (kein Netzwerkzugriff).
 */
export function generateReviewLink(session: ReviewSession, host: string): ReviewLink {
  const resolved = resolveSession(session);
  let rawId = resolved?.id ?? "";
  if (!rawId && session && typeof session === "object") {
    rawId = asString((session as ReviewSession).id).trim();
  }
  // Defensiv: bei ungültiger Session bleibt der Link wohlgeformt.
  if (!rawId) rawId = "rs-invalid";
  const token =
    resolved && resolved.token ? resolved.token : tokenFrom(rawId || "unknown");
  const h = normalizeHost(host);
  const url = `http://${h}/review/${encodeURIComponent(rawId)}?token=${encodeURIComponent(token)}`;
  return { url, token, qrCodeSvg: generateReviewQrCode(url) };
}

/**
 * Erzeugt einen QR-Code als SVG-String (echter QR-Encoder, s. Kopfkommentar).
 * Nicht-String-Eingaben werden als leerer String behandelt (defensiv).
 */
export function generateReviewQrCode(link: string): string {
  const text = typeof link === "string" ? link : "";
  const result = encodeQr(text);
  return qrToSvg(result.modules);
}

/**
 * Fügt einer Session einen Kommentar hinzu. No-ops (Session unverändert):
 *   * ungültige Session,
 *   * `mode: "readonly"`,
 *   * abgelaufene Session,
 *   * ungültiger/leerer Kommentar (fehlende chapterId oder leerer Text).
 * Gibt bei Erfolg eine NEUE Session mit dem angehängten Kommentar zurück.
 */
export function submitReviewComment(
  session: ReviewSession,
  comment: ReviewComment,
): ReviewSession {
  const resolved = resolveSession(session);
  if (!resolved) return emptySession();
  const norm = normalizeComment(comment);
  if (!norm) return resolved;
  if (resolved.mode === "readonly") return resolved;
  if (isSessionExpired(resolved)) return resolved;

  const updated: ReviewSession = { ...resolved, comments: [...resolved.comments, norm] };
  sessions.set(updated.id, updated);
  return updated;
}

/**
 * Liefert die seit dem letzten Import NEUEN Kommentare für den Editor und
 * markiert sie als importiert (ein zweiter Aufruf liefert für dieselben
 * Kommentare `[]`). Ungültige Session → `[]`.
 */
export function importReviewComments(session: ReviewSession): ReviewComment[] {
  const resolved = resolveSession(session);
  if (!resolved) return [];
  let seen = importedComments.get(resolved.id);
  if (!seen) {
    seen = new Set<string>();
    importedComments.set(resolved.id, seen);
  }
  const fresh = resolved.comments.filter(
    (c) => c && typeof c.id === "string" && !seen.has(c.id),
  );
  for (const c of fresh) seen.add(c.id);
  return fresh.map((c) => ({ ...c }));
}

/**
 * Prüft den Ablauf. Defensiv: ungültige Session oder fehlender/ungültiger
 * `expiresAt` → `false` (kein Ablauf). Abgelaufen, sobald `now >= expiresAt`.
 */
export function isSessionExpired(session: ReviewSession): boolean {
  const resolved = resolveSession(session);
  if (!resolved) return false;
  const exp = resolved.expiresAt;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return false;
  return clock() >= exp;
}

// ===========================================================================
// QR-ENCODER (Version 1–4, Byte-Mode, EC-Level L, ohne Library)
// ===========================================================================

// --- GF(256)-Arithmetik (Primitivpolynom 0x11D) ---

const GF_EXP: number[] = new Array(256).fill(0);
const GF_LOG: number[] = new Array(256).fill(0);

(function initGfTables(): void {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  GF_EXP[255] = GF_EXP[0];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
}

/** Reed-Solomon-Generatorpolynom vom Grad `n` (big-endian, Koeffizient 0 = x^n). */
function rsGenerator(n: number): number[] {
  let poly: number[] = [1];
  for (let i = 0; i < n; i++) {
    const a = GF_EXP[i % 255];
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], a);
    }
    poly = next;
  }
  return poly;
}

/** Reed-Solomon-EC-Codewords für `data` (LFSR-Division). */
function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenerator(ecLen);
  const rem = new Array<number>(ecLen).fill(0);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.shift();
    rem.push(0);
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

/** Wertet ein Polynom (big-endian) an der Stelle `x` in GF(256) aus. */
function evalPoly(coeffs: number[], x: number): number {
  let acc = 0;
  for (const c of coeffs) acc = gfMul(acc, x) ^ c;
  return acc;
}

// --- Versions-/Kapazitätstabellen (Level L, ein Block je Version) ---

const VERSION_INFO: Record<number, { data: number; ec: number }> = {
  1: { data: 19, ec: 7 },
  2: { data: 34, ec: 10 },
  3: { data: 55, ec: 15 },
  4: { data: 80, ec: 20 },
};

/** Max. Byte-Nutzlast je Version (4 Bit Mode + 8 Bit Count = 12 Bit Overhead). */
function maxBytesFor(version: number): number {
  const info = VERSION_INFO[version];
  return Math.floor((info.data * 8 - 12) / 8);
}

// --- UTF-8-Encoding ---

function toUtf8Bytes(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const cp = str.codePointAt(i);
    if (cp === undefined) continue;
    if (cp > 0xffff) i++; // Surrogatpaar verbraucht
    if (cp < 0x80) {
      out.push(cp);
    } else if (cp < 0x800) {
      out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    } else if (cp < 0x10000) {
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    } else {
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      );
    }
  }
  return out;
}

// --- Daten-Codewords (Byte-Mode) ---

function buildDataCodewords(bytes: number[], dataLen: number): number[] {
  const bits: number[] = [];
  const pushBits = (val: number, len: number): void => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  pushBits(0b0100, 4); // Byte-Mode-Indikator
  pushBits(bytes.length, 8); // Zeichenzahl (Versionen 1–9)
  for (const b of bytes) pushBits(b, 8);

  const capacityBits = dataLen * 8;
  const term = Math.min(4, Math.max(0, capacityBits - bits.length));
  for (let i = 0; i < term; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    out.push(b);
  }
  let pad = 0;
  while (out.length < dataLen) {
    out.push(pad % 2 === 0 ? 0xec : 0x11);
    pad++;
  }
  return out.slice(0, dataLen);
}

// --- Matrix & Funktions-Patterns ---

interface QrMatrix {
  size: number;
  modules: boolean[][]; // [row][col]
  func: boolean[][]; // [row][col] — true = Funktionsmodul
}

function makeMatrix(version: number): QrMatrix {
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const func = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  return { size, modules, func };
}

function setFunc(m: QrMatrix, x: number, y: number, dark: boolean): void {
  if (x < 0 || y < 0 || x >= m.size || y >= m.size) return;
  m.modules[y][x] = dark;
  m.func[y][x] = true;
}

function drawFinder(m: QrMatrix, cx: number, cy: number): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      setFunc(m, cx + dx, cy + dy, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignment(m: QrMatrix, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFunc(m, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function alignPositions(version: number, size: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.ceil(((version * 4 + 4) / (numAlign * 2 - 2))) * 2;
  const result: number[] = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function getBit(x: number, i: number): boolean {
  return ((x >>> i) & 1) !== 0;
}

/** Zeichnet die 15-Bit-Format-Information (Level L + Maske). */
function drawFormat(m: QrMatrix, mask: number): void {
  const data = (1 << 3) | mask; // EC-Level L = Formatbits 01
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;

  for (let i = 0; i <= 5; i++) setFunc(m, 8, i, getBit(bits, i));
  setFunc(m, 8, 7, getBit(bits, 6));
  setFunc(m, 8, 8, getBit(bits, 7));
  setFunc(m, 7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i++) setFunc(m, 14 - i, 8, getBit(bits, i));

  for (let i = 0; i < 8; i++) setFunc(m, m.size - 1 - i, 8, getBit(bits, i));
  for (let i = 8; i < 15; i++) setFunc(m, 8, m.size - 15 + i, getBit(bits, i));
  setFunc(m, 8, m.size - 8, true); // immer dunkles Modul
}

function drawFunctionPatterns(m: QrMatrix, version: number): void {
  for (let i = 0; i < m.size; i++) {
    setFunc(m, 6, i, i % 2 === 0);
    setFunc(m, i, 6, i % 2 === 0);
  }
  drawFinder(m, 3, 3);
  drawFinder(m, m.size - 4, 3);
  drawFinder(m, 3, m.size - 4);

  const pos = alignPositions(version, m.size);
  const n = pos.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const corner = (i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0);
      if (!corner) drawAlignment(m, pos[i], pos[j]);
    }
  }
  drawFormat(m, 0); // Dummy-Format, wird bei Maskenwahl neu gezeichnet
}

/** Platziert die Codewords im Zickzack (Spalten von rechts nach links). */
function drawCodewords(m: QrMatrix, codewords: number[]): void {
  const size = m.size;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!m.func[y][x] && i < codewords.length * 8) {
          m.modules[y][x] = getBit(codewords[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

function maskInverts(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(m: QrMatrix, mask: number): void {
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!m.func[y][x] && maskInverts(mask, x, y)) m.modules[y][x] = !m.modules[y][x];
    }
  }
}

// --- Penalty-Regeln (ISO/IEC 18004, vier Regeln) ---

const N1 = 3;
const N2 = 3;
const N3 = 40;
const N4 = 10;

function finderPenaltyCountPatterns(runHistory: number[]): number {
  const n = runHistory[1];
  const core =
    n > 0 &&
    runHistory[2] === n &&
    runHistory[3] === n * 3 &&
    runHistory[4] === n &&
    runHistory[5] === n;
  return (
    (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) +
    (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0)
  );
}

function finderPenaltyAddHistory(size: number, runLength: number, runHistory: number[]): void {
  if (runHistory[0] === 0) runLength += size;
  runHistory.pop();
  runHistory.unshift(runLength);
}

function finderPenaltyTerminateAndCount(
  size: number,
  currentRunColor: boolean,
  currentRunLength: number,
  runHistory: number[],
): number {
  if (currentRunColor) {
    finderPenaltyAddHistory(size, currentRunLength, runHistory);
    currentRunLength = 0;
  }
  currentRunLength += size;
  finderPenaltyAddHistory(size, currentRunLength, runHistory);
  return finderPenaltyCountPatterns(runHistory);
}

function getPenaltyScore(m: QrMatrix): number {
  const size = m.size;
  const mod = m.modules;
  let result = 0;

  // Regel 1 (Zeilen) + Regel 3 (finder-ähnliche Muster)
  for (let y = 0; y < size; y++) {
    let runColor = false;
    let runLen = 0;
    const rh = [0, 0, 0, 0, 0, 0, 0];
    for (let x = 0; x < size; x++) {
      if (mod[y][x] === runColor) {
        runLen++;
        if (runLen === 5) result += N1;
        else if (runLen > 5) result++;
      } else {
        finderPenaltyAddHistory(size, runLen, rh);
        if (!runColor) result += finderPenaltyCountPatterns(rh) * N3;
        runColor = mod[y][x];
        runLen = 1;
      }
    }
    result += finderPenaltyTerminateAndCount(size, runColor, runLen, rh) * N3;
  }

  // Regel 1 (Spalten) + Regel 3
  for (let x = 0; x < size; x++) {
    let runColor = false;
    let runLen = 0;
    const rh = [0, 0, 0, 0, 0, 0, 0];
    for (let y = 0; y < size; y++) {
      if (mod[y][x] === runColor) {
        runLen++;
        if (runLen === 5) result += N1;
        else if (runLen > 5) result++;
      } else {
        finderPenaltyAddHistory(size, runLen, rh);
        if (!runColor) result += finderPenaltyCountPatterns(rh) * N3;
        runColor = mod[y][x];
        runLen = 1;
      }
    }
    result += finderPenaltyTerminateAndCount(size, runColor, runLen, rh) * N3;
  }

  // Regel 2: 2x2-Blöcke gleicher Farbe
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = mod[y][x];
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) result += N2;
    }
  }

  // Regel 4: Balance dunkel/hell
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (mod[y][x]) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += k * N4;

  return result;
}

// --- Gesamter Encode-Vorgang ---

interface QrResult {
  version: number;
  size: number;
  modules: boolean[][];
  codewords: number[];
  dataCodewords: number[];
  ecCodewords: number[];
  truncated: boolean;
}

function encodeQr(text: string): QrResult {
  const raw = toUtf8Bytes(typeof text === "string" ? text : "");

  let version = 1;
  for (version = 1; version <= 4; version++) {
    if (raw.length <= maxBytesFor(version)) break;
  }
  let truncated = false;
  let bytes = raw;
  if (version > 4) {
    version = 4;
    bytes = raw.slice(0, maxBytesFor(4));
    truncated = true;
  }

  const info = VERSION_INFO[version];
  const dataCodewords = buildDataCodewords(bytes, info.data);
  const ecCodewords = rsEncode(dataCodewords, info.ec);
  const codewords = dataCodewords.concat(ecCodewords);

  const m = makeMatrix(version);
  drawFunctionPatterns(m, version);
  drawCodewords(m, codewords);

  let bestMask = 0;
  let minPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(m, mask);
    drawFormat(m, mask);
    const penalty = getPenaltyScore(m);
    if (penalty < minPenalty) {
      minPenalty = penalty;
      bestMask = mask;
    }
    applyMask(m, mask); // Maske zurücknehmen
  }
  applyMask(m, bestMask);
  drawFormat(m, bestMask);

  return {
    version,
    size: m.size,
    modules: m.modules,
    codewords,
    dataCodewords,
    ecCodewords,
    truncated,
  };
}

/** Rendert die QR-Matrix als deterministisches SVG (Quiet-Zone 4 Module). */
function qrToSvg(modules: boolean[][], border = 4): string {
  const n = modules.length;
  const dim = n + border * 2;
  let path = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (modules[y][x]) path += `M${x + border} ${y + border}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" ` +
    `viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR-Code">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    `<path d="${path}" fill="#000000"/>` +
    `</svg>`
  );
}

// ---------------------------------------------------------------------------
// Test-Hooks (nur zur Verifikation des QR-Encoders)
// ---------------------------------------------------------------------------

/** Interne Primitiven für die QR-Verifikation in Tests. */
export const __qrTestHooks = {
  encode(text: string): QrResult {
    return encodeQr(text);
  },
  gfExp(i: number): number {
    return GF_EXP[((i % 255) + 255) % 255];
  },
  gfMul,
  evalPoly,
  rsGenerator,
  maxBytesFor,
};
