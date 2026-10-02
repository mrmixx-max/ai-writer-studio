// ---------------------------------------------------------------------------
// WP 23.2 — Air-Gapped Disaster-Vault & AES-256-Tresor
// ---------------------------------------------------------------------------
// Lokaler, deterministischer Service: das gesamte Projekt (Kapitel, SQLite-Dump,
// Bilder, Audio-Cues, Notizen) wird in ein einziges selbsttragendes Archiv
// gepackt, DEFLATE-komprimiert und mit AES-256-GCM verschluesselt.
//
//   * KEIN LLM, kein Netzwerk, keine Tauri-IPC — rein lokal und offline.
//   * Web Crypto API fuer AES-256-GCM + PBKDF2-SHA256 (Schluesselableitung).
//   * SHA-256 fuer die Chunk-Integritaet (synchron, damit verifyIntegrity()
//     ohne Passwort und ohne await jeden Chunk pruefen kann).
//
// Container-Layout (alles Big-Endian):
//
//   HEADER (128 Byte)
//     0..12    magic        "AIWS-VAULT-1"
//     12       version      1
//     13       compression  0 = roh, 1 = deflate
//     14..16   reserved     0
//     16..32   salt         16 Byte (PBKDF2)
//     32..44   iv           12 Byte (GCM-Nonce, pro Archiv eindeutig)
//     44..48   payloadLength  u32  (Chiffretext inkl. 16-Byte GCM-Tag)
//     48..52   chunkCount     u32  (Anzahl Chunks im Manifest)
//     52..84   plaintextSha256  32 Byte (Hash der komprimierten Nutzdaten)
//     84..116  manifestSha256   32 Byte (Hash des Manifest-Blocks)
//     116..120 iterations    u32  (PBKDF2-Runden)
//     120..124 reserved      0
//     124..128 headerChecksum u32 = erste 4 Byte von SHA-256(header[0..124])
//
//   MANIFEST-BLOCK
//     128..132 manifestLength u32
//     132..    manifestBytes  UTF-8 JSON { v, chunkSize, chunks:[{size, sha256}] }
//
//   PAYLOAD
//     ...      ciphertext = AES-256-GCM(compressed plaintext)
//
// Sicherheitsentscheidungen:
//   * Als GCM-AAD gehen magic|version|flags|salt|iv, der Klartext-Hash und die
//     PBKDF2-Runden ein (siehe buildAad). Header-Manipulation (z. B. vertauschte
//     IV oder Salt) laesst die Authentizitaetspruefung scheitern. Laengenfelder
//     und Manifest-Hash entstehen erst nach der Verschluesselung und sind ueber
//     die Header-Pruefsumme plus die Chunk-SHA-256-Liste abgesichert.
//   * Salt und IV sind PRO ARCHIV zufaellig (16 bzw. 12 Byte). Feste Groessen,
//     keine festen Werte: eine konstante Nonce unter demselben Schluessel waere
//     ein katastrophaler GCM-Fehler. Fuer reproduzierbare Tests lassen sich Salt,
//     IV, Zeitstempel und Iterationen per Options-Objekt injizieren.
//   * Das Manifest haelt SHA-256 ueber jeden *Chiffretext*-Chunk. Damit kann
//     verifyIntegrity() Bit-Rot erkennen, ohne das Passwort zu kennen; die
//     eigentliche Authentizitaet garantiert weiterhin der GCM-Tag.
// ---------------------------------------------------------------------------

export interface VaultProject {
  name: string;
  chapters: string[];
  database: Uint8Array;
  images: Uint8Array[];
  audioCues: string[];
  notes: string[];
}

export interface IntegrityResult {
  valid: boolean;
  chunksChecked: number;
  errors: string[];
}

/** Optionale Injektionspunkte — nur fuer deterministische Tests/Benchmarks. */
export interface VaultExportOptions {
  /** 16 Byte; ohne Angabe kryptografisch zufaellig. */
  salt?: Uint8Array;
  /** 12 Byte; ohne Angabe kryptografisch zufaellig. */
  iv?: Uint8Array;
  /** Zeitstempel im Klartext-Envelope; Default Date.now(). */
  createdAt?: number;
  /** PBKDF2-Runden; Default DEFAULT_ITERATIONS. */
  iterations?: number;
  /** Chunk-Groesse fuer das Integritaets-Manifest; Default DEFAULT_CHUNK_SIZE. */
  chunkSize?: number;
}

export const VAULT_MAGIC = "AIWS-VAULT-1";
export const VAULT_VERSION = 1;
export const VAULT_HEADER_SIZE = 128;
export const VAULT_SALT_SIZE = 16;
export const VAULT_IV_SIZE = 12;
export const DEFAULT_CHUNK_SIZE = 64 * 1024;
export const DEFAULT_ITERATIONS = 310_000;
const GCM_TAG_BITS = 128;
const MANIFEST_VERSION = 1;

interface VaultChunkEntry {
  size: number;
  sha256: string;
}

interface VaultManifest {
  v: number;
  chunkSize: number;
  chunks: VaultChunkEntry[];
}

interface VaultEnvelope {
  format: string;
  createdAt: number;
  project: {
    name: string;
    chapters: string[];
    database: string;
    images: string[];
    audioCues: string[];
    notes: string[];
  };
}

// ---------------------------------------------------------------------------
// Synchrones SHA-256 (FIPS 180-4)
// ---------------------------------------------------------------------------
// Notwendig, weil crypto.subtle.digest() Promise-basiert ist, verifyIntegrity()
// laut Vertrag aber synchron ein IntegrityResult liefern muss. Die Umsetzung ist
// gegen Node `crypto.createHash("sha256")` kreuzgetestet (siehe Testdatei).
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

/** SHA-256 ueber beliebige Bytes — synchron, deterministisch, 32 Byte Ausgabe. */
export function sha256Bytes(data: Uint8Array): Uint8Array {
  const bytes = data instanceof Uint8Array ? data : toBytes(data);
  const bitLen = bytes.length * 8;
  // Padding: 0x80 + Nullbytes bis Laenge ≡ 56 (mod 64) + 8 Byte Laenge.
  const paddedLength = (((bytes.length + 1 + 8) + 63) & ~63) >>> 0;
  const buffer = new Uint8Array(paddedLength);
  buffer.set(bytes);
  buffer[bytes.length] = 0x80;
  const bdv = new DataView(buffer.buffer);
  bdv.setUint32(paddedLength - 8, Math.floor(bitLen / 0x100000000), false);
  bdv.setUint32(paddedLength - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = bdv.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const bigS1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + bigS1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const bigS0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (bigS0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, h0, false); odv.setUint32(4, h1, false);
  odv.setUint32(8, h2, false); odv.setUint32(12, h3, false);
  odv.setUint32(16, h4, false); odv.setUint32(20, h5, false);
  odv.setUint32(24, h6, false); odv.setUint32(28, h7, false);
  return out;
}

const HEX = "0123456789abcdef";
function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += HEX[bytes[i] >> 4] + HEX[bytes[i] & 0x0f];
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Defensive Normalisierung fehlender / kaputter Daten
// ---------------------------------------------------------------------------

/** Uint8Array aus Uint8Array | ArrayBuffer | ArrayBufferView | number[]. */
function toBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    const view = value as unknown as { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
    return new Uint8Array(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
  }
  if (Array.isArray(value)) {
    const out = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) {
      const n = Number(value[i]);
      out[i] = Number.isFinite(n) ? ((n % 256) + 256) % 256 : 0;
    }
    return out;
  }
  return new Uint8Array(0);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string") out.push(item);
    else if (typeof item === "number" || typeof item === "boolean") out.push(String(item));
    // null / undefined / Objekte werden verworfen statt zu crashen.
  }
  return out;
}

function toBytesArray(value: unknown): Uint8Array[] {
  if (!Array.isArray(value)) return [];
  const out: Uint8Array[] = [];
  for (const item of value) {
    if (item === null || item === undefined) continue;
    out.push(toBytes(item));
  }
  return out;
}

/** Erzwingt die VaultProject-Form; fehlende Felder werden sicher ersetzt. */
export function normalizeVaultProject(input: unknown): VaultProject {
  const raw = (input ?? {}) as Partial<VaultProject> & Record<string, unknown>;
  const name = typeof raw.name === "string" && raw.name.trim().length > 0 ? raw.name : "Unbenannt";
  return {
    name,
    chapters: toStringArray(raw.chapters),
    database: toBytes(raw.database),
    images: toBytesArray(raw.images),
    audioCues: toStringArray(raw.audioCues),
    notes: toStringArray(raw.notes),
  };
}

// ---------------------------------------------------------------------------
// Base64 (blockweise — verhindert Stack-Ueberlauf bei grossen Binaerdaten)
// ---------------------------------------------------------------------------
const B64_BLOCK = 0x8000;

function bytesToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  if (typeof btoa !== "function") throw new Error("btoa ist in dieser Umgebung nicht verfuegbar.");
  let binary = "";
  for (let i = 0; i < bytes.length; i += B64_BLOCK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + B64_BLOCK));
  }
  return btoa(binary);
}

function base64ToBytes(value: unknown): Uint8Array {
  if (typeof value !== "string" || value.length === 0) return new Uint8Array(0);
  if (typeof atob !== "function") throw new Error("atob ist in dieser Umgebung nicht verfuegbar.");
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw new Error("Vault-Inhalt beschaedigt: Base64-Feld ist nicht dekodierbar.");
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------------------
// Web Crypto Helfer
// ---------------------------------------------------------------------------
function getSubtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error("Web Crypto API (crypto.subtle) ist in dieser Umgebung nicht verfuegbar.");
  }
  return c.subtle;
}

function secureRandom(length: number): Uint8Array {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || typeof c.getRandomValues !== "function") {
    throw new Error("crypto.getRandomValues ist in dieser Umgebung nicht verfuegbar.");
  }
  const out = new Uint8Array(length);
  c.getRandomValues(out);
  return out;
}

async function deriveAesKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const subtle = getSubtle();
  const base = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------------------
// Kompression (DEFLATE via CompressionStream, mit Roh-Fallback)
// ---------------------------------------------------------------------------
function hasCompressionStream(): boolean {
  return typeof (globalThis as { CompressionStream?: unknown }).CompressionStream === "function";
}

function hasDecompressionStream(): boolean {
  return typeof (globalThis as { DecompressionStream?: unknown }).DecompressionStream === "function";
}

/** true, wenn tatsaechlich komprimiert wurde. */
async function deflateBytes(bytes: Uint8Array): Promise<{ data: Uint8Array; compressed: boolean }> {
  if (!hasCompressionStream()) return { data: new Uint8Array(bytes), compressed: false };
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  return { data: out, compressed: true };
}

async function inflateBytes(bytes: Uint8Array): Promise<Uint8Array> {
  if (!hasDecompressionStream()) {
    throw new Error("Archiv ist komprimiert, aber DecompressionStream fehlt in dieser Umgebung.");
  }
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Zusaetzlich authentifizierte Daten (AAD) fuer GCM.
 *
 * Bewusst nur die Felder, die VOR der Verschluesselung feststehen:
 * magic|version|flags|salt|iv (0..44), plaintextSha256 (52..84),
 * PBKDF2-Runden (116..120). Damit sind Salt, IV und Krypto-Parameter
 * manipulationsgeschuetzt — ein vertauschter IV laesst die
 * Authentizitaetspruefung scheitern.
 *
 * Die Laengenfelder (44..48, 48..52) und der Manifest-Hash (84..116)
 * entstehen erst NACH der Verschluesselung und sind deshalb nicht Teil der
 * AAD; sie werden ueber die Header-Pruefsumme (124..128) und die
 * Chunk-SHA-256-Liste abgesichert.
 */
function buildAad(header: Uint8Array): Uint8Array {
  const aad = new Uint8Array(44 + 32 + 4);
  aad.set(header.subarray(0, 44), 0); // magic|version|compression|reserved|salt|iv
  aad.set(header.subarray(52, 84), 44); // plaintextSha256
  aad.set(header.subarray(116, 120), 76); // PBKDF2-Runden
  return aad;
}

// ---------------------------------------------------------------------------
// Container-Parsing (passwortlos) — Basis fuer verifyIntegrity + restore
// ---------------------------------------------------------------------------
interface ParsedContainer {
  header: Uint8Array;
  salt: Uint8Array;
  iv: Uint8Array;
  iterations: number;
  compressed: boolean;
  payloadLength: number;
  chunkCount: number;
  plaintextSha256: Uint8Array;
  manifest: VaultManifest | null;
  payloadStart: number;
}

function readMagic(data: Uint8Array): string {
  let out = "";
  for (let i = 0; i < VAULT_MAGIC.length; i++) out += String.fromCharCode(data[i] ?? 0);
  return out;
}

/**
 * Liest und prueft die Container-Struktur. Sammelt Fehler in `errors`;
 * liefert null, wenn kein sinnvolles Parsing mehr moeglich ist.
 */
function parseContainer(data: Uint8Array, errors: string[]): ParsedContainer | null {
  if (!(data instanceof Uint8Array) || data.length < VAULT_HEADER_SIZE + 4) {
    errors.push(`Archiv zu kurz: ${data?.length ?? 0} Byte (Minimum ${VAULT_HEADER_SIZE + 4}).`);
    return null;
  }

  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const header = data.subarray(0, VAULT_HEADER_SIZE);

  if (readMagic(data) !== VAULT_MAGIC) {
    errors.push(`Ungueltiger Magic-Header (erwartet "${VAULT_MAGIC}").`);
  }
  const version = data[12];
  if (version !== VAULT_VERSION) {
    errors.push(`Nicht unterstuetzte Vault-Version: ${version}.`);
  }

  const storedChecksum = dv.getUint32(124, false);
  const calcChecksum = new DataView(sha256Bytes(header.subarray(0, 124)).buffer).getUint32(0, false);
  if (storedChecksum !== calcChecksum) {
    errors.push("Header-Pruefsumme stimmt nicht — Header beschaedigt oder manipuliert.");
  }

  const payloadLength = dv.getUint32(44, false);
  const chunkCount = dv.getUint32(48, false);
  const iterations = dv.getUint32(116, false);
  const manifestLength = dv.getUint32(VAULT_HEADER_SIZE, false);

  const manifestStart = VAULT_HEADER_SIZE + 4;
  const payloadStart = manifestStart + manifestLength;

  if (payloadStart + payloadLength !== data.length) {
    errors.push(
      `Laengenangaben inkonsistent: Header/Manifest erwarten ${payloadStart + payloadLength} Byte, ` +
        `Archiv hat ${data.length} Byte.`,
    );
  }
  if (iterations <= 0) {
    errors.push(`Ungueltige PBKDF2-Rundenzahl: ${iterations}.`);
  }
  if (payloadStart > data.length) {
    errors.push("Manifest ragt ueber das Archiv hinaus.");
    return null;
  }

  const manifestBytes = data.subarray(manifestStart, payloadStart);
  if (!bytesEqual(sha256Bytes(manifestBytes), data.subarray(84, 116))) {
    errors.push("Manifest-Pruefsumme stimmt nicht — Integritaetsliste beschaedigt.");
  }

  let manifest: VaultManifest | null = null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(manifestBytes));
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as VaultManifest).chunks)) {
      manifest = parsed as VaultManifest;
    } else {
      errors.push("Manifest hat keine gueltige Chunk-Liste.");
    }
  } catch {
    errors.push("Manifest ist kein gueltiges JSON.");
  }

  return {
    header,
    salt: data.subarray(16, 32),
    iv: data.subarray(32, 44),
    iterations,
    compressed: data[13] === 1,
    payloadLength,
    chunkCount,
    plaintextSha256: data.subarray(52, 84),
    manifest,
    payloadStart,
  };
}

// ---------------------------------------------------------------------------
// 3) verifyIntegrity — SHA-256 pro Chunk, ohne Passwort, synchron
// ---------------------------------------------------------------------------
export function verifyIntegrity(vaultData: Uint8Array): IntegrityResult {
  const errors: string[] = [];
  let chunksChecked = 0;

  try {
    const data = toBytes(vaultData);
    const parsed = parseContainer(data, errors);
    if (!parsed) return { valid: false, chunksChecked: 0, errors };

    if (!parsed.manifest) {
      return { valid: false, chunksChecked: 0, errors };
    }

    const chunks = parsed.manifest.chunks;
    if (chunks.length !== parsed.chunkCount) {
      errors.push(
        `Chunk-Anzahl inkonsistent: Header meldet ${parsed.chunkCount}, Manifest listet ${chunks.length}.`,
      );
    }

    let offset = parsed.payloadStart;
    let declaredTotal = 0;
    for (let i = 0; i < chunks.length; i++) {
      const entry = chunks[i];
      const size = Number(entry?.size);
      if (!Number.isInteger(size) || size < 0) {
        errors.push(`Chunk ${i}: ungueltige Groesse (${String(entry?.size)}).`);
        continue;
      }
      declaredTotal += size;
      if (offset + size > data.length) {
        errors.push(`Chunk ${i}: ragt ueber das Archiv hinaus (Offset ${offset}, Groesse ${size}).`);
        continue;
      }
      const slice = data.subarray(offset, offset + size);
      const actual = toHex(sha256Bytes(slice));
      chunksChecked++;
      const expected = typeof entry?.sha256 === "string" ? entry.sha256.toLowerCase() : "";
      if (actual !== expected) {
        errors.push(`Chunk ${i}: SHA-256 stimmt nicht (erwartet ${expected || "<fehlt>"}, ist ${actual}).`);
      }
      offset += size;
    }

    if (declaredTotal !== parsed.payloadLength) {
      errors.push(
        `Chunk-Summe (${declaredTotal} Byte) passt nicht zur Payload-Laenge (${parsed.payloadLength} Byte).`,
      );
    }
    if (chunksChecked !== parsed.chunkCount) {
      errors.push(`Es konnten nur ${chunksChecked} von ${parsed.chunkCount} Chunks geprueft werden.`);
    }

    return {
      valid: errors.length === 0 && chunksChecked === parsed.chunkCount,
      chunksChecked,
      errors,
    };
  } catch (err) {
    errors.push(`Integritaetspruefung abgebrochen: ${err instanceof Error ? err.message : String(err)}`);
    return { valid: false, chunksChecked, errors };
  }
}

/** true, wenn die Bytes mit dem Vault-Magic beginnen (kein vollstaendiger Check). */
export function isVaultArchive(vaultData: unknown): boolean {
  if (!(vaultData instanceof Uint8Array) || vaultData.length < VAULT_HEADER_SIZE) return false;
  return readMagic(vaultData) === VAULT_MAGIC;
}

// ---------------------------------------------------------------------------
// 1) exportToVault — Projekt -> komprimiertes, AES-256-GCM-verschluesseltes Archiv
// ---------------------------------------------------------------------------
export async function exportToVault(
  project: VaultProject,
  password: string,
  options: VaultExportOptions = {},
): Promise<Uint8Array> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Vault-Export ohne Passwort ist nicht erlaubt.");
  }

  const normalized = normalizeVaultProject(project);
  const createdAt = Number.isFinite(options.createdAt) ? Number(options.createdAt) : Date.now();
  const iterations = Number.isInteger(options.iterations) && (options.iterations as number) > 0
    ? (options.iterations as number)
    : DEFAULT_ITERATIONS;
  const chunkSize = Number.isInteger(options.chunkSize) && (options.chunkSize as number) > 0
    ? (options.chunkSize as number)
    : DEFAULT_CHUNK_SIZE;

  const salt = options.salt !== undefined ? toBytes(options.salt) : secureRandom(VAULT_SALT_SIZE);
  const iv = options.iv !== undefined ? toBytes(options.iv) : secureRandom(VAULT_IV_SIZE);
  if (salt.length !== VAULT_SALT_SIZE) {
    throw new Error(`Salt muss ${VAULT_SALT_SIZE} Byte lang sein (ist ${salt.length}).`);
  }
  if (iv.length !== VAULT_IV_SIZE) {
    throw new Error(`IV muss ${VAULT_IV_SIZE} Byte lang sein (ist ${iv.length}).`);
  }

  // 1. Envelope serialisieren (feste Schluesselreihenfolge -> deterministisch).
  const envelope: VaultEnvelope = {
    format: VAULT_MAGIC,
    createdAt,
    project: {
      name: normalized.name,
      chapters: normalized.chapters,
      database: bytesToBase64(normalized.database),
      images: normalized.images.map(bytesToBase64),
      audioCues: normalized.audioCues,
      notes: normalized.notes,
    },
  };
  const plain = new TextEncoder().encode(JSON.stringify(envelope));

  // 2. Komprimieren.
  const { data: compressed, compressed: didCompress } = await deflateBytes(plain);

  // 3. Manifest mit SHA-256 pro Chiffretext-Chunk vorbereiten.
  //    (Chunks werden erst nach der Verschluesselung gehasht.)
  const subtle = getSubtle();
  const key = await deriveAesKey(password, salt, iterations);

  // 4. Header aufbauen — der komplette Header ist GCM-AAD.
  const header = new Uint8Array(VAULT_HEADER_SIZE);
  for (let i = 0; i < VAULT_MAGIC.length; i++) header[i] = VAULT_MAGIC.charCodeAt(i);
  header[12] = VAULT_VERSION;
  header[13] = didCompress ? 1 : 0;
  header.set(salt, 16);
  header.set(iv, 32);
  header.set(sha256Bytes(compressed), 52);
  // PBKDF2-Runden VOR der Verschluesselung eintragen — sie sind Teil der AAD.
  new DataView(header.buffer).setUint32(116, iterations, false);

  const cipherBuffer = await subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: buildAad(header) as BufferSource, tagLength: GCM_TAG_BITS },
    key,
    compressed as BufferSource,
  );
  const cipher = new Uint8Array(cipherBuffer);

  const manifest: VaultManifest = { v: MANIFEST_VERSION, chunkSize, chunks: [] };
  for (let off = 0; off < cipher.length; off += chunkSize) {
    const part = cipher.subarray(off, Math.min(off + chunkSize, cipher.length));
    manifest.chunks.push({ size: part.length, sha256: toHex(sha256Bytes(part)) });
  }
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  header.set(sha256Bytes(manifestBytes), 84);

  const hdv = new DataView(header.buffer);
  hdv.setUint32(44, cipher.length, false);
  hdv.setUint32(48, manifest.chunks.length, false);
  hdv.setUint32(124, new DataView(sha256Bytes(header.subarray(0, 124)).buffer).getUint32(0, false), false);

  // 5. Container zusammensetzen.
  const out = new Uint8Array(VAULT_HEADER_SIZE + 4 + manifestBytes.length + cipher.length);
  out.set(header, 0);
  new DataView(out.buffer).setUint32(VAULT_HEADER_SIZE, manifestBytes.length, false);
  out.set(manifestBytes, VAULT_HEADER_SIZE + 4);
  out.set(cipher, VAULT_HEADER_SIZE + 4 + manifestBytes.length);
  return out;
}

// ---------------------------------------------------------------------------
// 2) restoreFromVault — Archiv -> VaultProject
// ---------------------------------------------------------------------------
export async function restoreFromVault(vaultData: Uint8Array, password: string): Promise<VaultProject> {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Vault-Restore ohne Passwort ist nicht erlaubt.");
  }

  const data = toBytes(vaultData);

  // Struktur + Chunk-Hashes zuerst — trennt "beschaedigt" von "falsches Passwort".
  const integrity = verifyIntegrity(data);
  if (!integrity.valid) {
    throw new Error(`Vault-Archiv beschaedigt: ${integrity.errors.join(" ") || "unbekannter Fehler."}`);
  }

  const errors: string[] = [];
  const parsed = parseContainer(data, errors);
  if (!parsed) throw new Error(`Vault-Archiv unlesbar: ${errors.join(" ")}`);

  const subtle = getSubtle();
  const key = await deriveAesKey(password, parsed.salt, parsed.iterations);

  let compressed: Uint8Array;
  try {
    const decrypted = await subtle.decrypt(
      {
        name: "AES-GCM",
        iv: parsed.iv as BufferSource,
        additionalData: buildAad(parsed.header) as BufferSource,
        tagLength: GCM_TAG_BITS,
      },
      key,
      data.subarray(parsed.payloadStart) as BufferSource,
    );
    compressed = new Uint8Array(decrypted);
  } catch {
    throw new Error("Entschluesselung fehlgeschlagen: falsches Passwort oder beschaedigtes Archiv.");
  }

  if (!bytesEqual(sha256Bytes(compressed), parsed.plaintextSha256)) {
    throw new Error("Nutzdaten-Pruefsumme stimmt nicht — Archiv wurde nachtraeglich veraendert.");
  }

  const plain = parsed.compressed ? await inflateBytes(compressed) : compressed;

  let envelope: VaultEnvelope;
  try {
    envelope = JSON.parse(new TextDecoder().decode(plain)) as VaultEnvelope;
  } catch {
    throw new Error("Vault-Inhalt ist kein gueltiges JSON.");
  }
  if (!envelope || typeof envelope !== "object" || !envelope.project) {
    throw new Error("Vault-Inhalt hat ein unbekanntes Format.");
  }

  const p = envelope.project;
  return normalizeVaultProject({
    name: p.name,
    chapters: p.chapters,
    database: base64ToBytes(p.database),
    images: Array.isArray(p.images) ? p.images.map(base64ToBytes) : [],
    audioCues: p.audioCues,
    notes: p.notes,
  });
}
