// Klassische Chiffren & Steganografie-Lab für Spionageromane.
//
// Enthaelt:
//   - One-Time Pad (OTP) mit XOR auf Char-Codes
//   - Buch-Chiffre (Book Cipher) mit Seiten/Zeile/Wort-Referenzen
//   - Null-Chiffre / Steganografie (Nachricht in jedem N-ten Wort verstecken)
//
// Alle Funktionen sind deterministisch bei gleichem Seed.
// Verwendet createSeededRandom mit hashString fuer Randomisierung.

// ---------------------------------------------------------------------------
// Hash & Zufall
// ---------------------------------------------------------------------------

/**
 * FNV-1a Hash eines Strings. Liefert einen unsigned 32-bit Wert.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * mulberry32 Pseudo-Zufallszahlengenerator. Liefert Werte in [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function (): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Waehlt ein zufaelliges Element aus einem Array. Wirft bei leerem Array.
 */
function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error("pick(): leeres Array");
  }
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// One-Time Pad (OTP)
// ---------------------------------------------------------------------------

/**
 * Generiert einen deterministischen Schluessel aus dem Plaintext.
 */
function generateOTPKey(plaintext: string): number[] {
  const seed = hashString(plaintext);
  const rng = createSeededRandom(seed);
  const range = Array.from({ length: 256 }, (_, i) => i);
  const key: number[] = [];
  for (let i = 0; i < plaintext.length; i++) {
    key.push(pick(range, rng));
  }
  return key;
}

/**
 * Verschluesselt mit One-Time Pad (XOR auf Char-Codes).
 * Liefert 5-digit numerische Bloecke wie '48201 93820 18492'.
 */
export function encryptOneTimePad(
  plaintext: string,
  key?: number[]
): { ciphertext: string; key: number[]; blocks: string[] } {
  const actualKey = key ?? generateOTPKey(plaintext);
  const blocks: string[] = [];
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i);
    const keyByte = actualKey[i % actualKey.length];
    const xorResult = charCode ^ keyByte;
    blocks.push(String(xorResult).padStart(5, "0"));
  }
  return {
    ciphertext: blocks.join(" "),
    key: actualKey,
    blocks,
  };
}

/**
 * Entschluesselt einen One-Time-Pad-Ciphertext.
 */
export function decryptOneTimePad(ciphertext: string, key: number[]): string {
  const blocks = ciphertext.split(" ");
  let result = "";
  for (let i = 0; i < blocks.length; i++) {
    const xorResult = parseInt(blocks[i], 10);
    const keyByte = key[i % key.length];
    const charCode = xorResult ^ keyByte;
    result += String.fromCharCode(charCode);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Buch-Chiffre (Book Cipher)
// ---------------------------------------------------------------------------

/**
 * Verschluesselt mit Buch-Chiffre. Jeder Char wird als Referenz
 * (Seite, Zeile, Wort) codiert.
 */
export function encryptBookCipher(
  plaintext: string,
  book: { pages: number; linesPerPage: number; wordsPerPage: number },
  seed: number
): {
  ciphertext: string;
  references: { page: number; line: number; word: number }[];
  key: string;
} {
  const references: { page: number; line: number; word: number }[] = [];
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i);
    const page = (charCode % book.pages) + 1;
    const line = (Math.floor(charCode / book.pages) % book.linesPerPage) + 1;
    const word =
      (Math.floor(charCode / (book.pages * book.linesPerPage)) % book.wordsPerPage) + 1;
    references.push({ page, line, word });
  }
  const ciphertext = `${book.pages}x${book.linesPerPage}x${book.wordsPerPage}`;
  const key = `book:${book.pages}x${book.linesPerPage}x${book.wordsPerPage}:seed:${seed}`;
  return { ciphertext, references, key };
}

/**
 * Entschluesselt eine Buch-Chiffre. Benoetigt die Buch-Dimensionen
 * im Ciphertext und die Referenzen.
 */
export function decryptBookCipher(
  ciphertext: string,
  references: { page: number; line: number; word: number }[]
): string {
  const [pages, linesPerPage] = ciphertext.split("x").map(Number);
  let result = "";
  for (const ref of references) {
    const charCode =
      (ref.page - 1) + (ref.line - 1) * pages + (ref.word - 1) * pages * linesPerPage;
    result += String.fromCharCode(charCode);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Null-Chiffre / Steganografie
// ---------------------------------------------------------------------------

/**
 * Versteckt eine Nachricht in jedem N-ten Wort eines Cover-Textes.
 * Der Buchstabe wird an das Wort angehaengt.
 */
export function hideMessage(
  coverText: string,
  secretMessage: string,
  interval: number = 3
): { steganogram: string; positions: number[]; key: string } {
  const words = coverText.split(" ");
  const positions: number[] = [];
  let wordIndex = interval - 1;
  for (let i = 0; i < secretMessage.length; i++) {
    if (wordIndex >= words.length) {
      throw new Error("hideMessage(): Cover-Text hat nicht genug Wörter");
    }
    words[wordIndex] = words[wordIndex] + secretMessage[i];
    positions.push(wordIndex);
    wordIndex += interval;
  }
  const steganogram = words.join(" ");
  const key = `interval:${interval}:positions:${positions.join(",")}`;
  return { steganogram, positions, key };
}

/**
 * Extrahiert eine versteckte Nachricht aus einem Steganogramm.
 */
export function extractMessage(
  steganogram: string,
  interval: number = 3, // eslint-disable-line @typescript-eslint/no-unused-vars
  positions: number[]
): string {
  const words = steganogram.split(" ");
  let result = "";
  for (const pos of positions) {
    const word = words[pos];
    if (!word || word.length === 0) {
      throw new Error("extractMessage(): Ungültige Position");
    }
    result += word[word.length - 1];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Factory-Funktionen
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein Beispiel-OTP.
 */
export function createSampleOTP(): {
  ciphertext: string;
  key: number[];
  blocks: string[];
} {
  return encryptOneTimePad("Hallo Welt");
}

/**
 * Erzeugt ein Beispiel-Steganogramm.
 */
export function createSampleSteganogram(): {
  steganogram: string;
  positions: number[];
  key: string;
} {
  const coverText =
    "Der schnelle braune Fuchs springt über den faulen Hund im Garten während die Sonne langsam hinter den alten Bäumen untergeht";
  const secretMessage = "Hallo";
  return hideMessage(coverText, secretMessage);
}
