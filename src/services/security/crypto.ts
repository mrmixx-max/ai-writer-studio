// Krypto-Basis: AES-256-GCM Verschluesselung + PBKDF2-Schluessableitung
// ueber die WebCrypto-API (verfuegbar in Tauri WebView2, Browser und Node>=19).
//
// Format verschluesselter Nutzdaten (Base64-kodiert, |-separierte Felder):
//   AWS1|<salt b64>|<iv b64>|<ciphertext b64>
// Der Praefix "AWS1" dient als Magic-Marker, damit verschluesselte Inhalte
// eindeutig erkannt werden koennen (Doppelverschluesselung / Fehlentschluesselung).

const PBKDF2_ITERATIONS = 310_000; // OWASP-Empfehlung 2023+ fuer PBKDF2-SHA256
const AES_BITS = 256;

/** Wandelt Uint8Array -> Base64. */
export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Wandelt Base64 -> Uint8Array. */
export function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Kryptografisch sichere Zufallsbytes. */
export function randomBytes(len: number): Uint8Array {
  const out = new Uint8Array(len);
  crypto.getRandomValues(out);
  return out;
}

/** SHA-256-Pruefsumme als Hex-String (fuer Backups / Integritaet). */
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Leitet aus einem Passwort/PIN einen 256-Bit-AES-Schluessel ab (PBKDF2-SHA256).
 * `salt` wird einmalig erzeugt und mit dem Chiffretext gespeichert.
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(password) as BufferSource, "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: AES_BITS },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Verschluesselt Text mit AES-256-GCM und liefert das AWS1-Format. */
export async function encryptString(plaintext: string, password: string): Promise<string> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(plaintext) as BufferSource,
  );
  return `AWS1|${toBase64(salt)}|${toBase64(iv)}|${toBase64(new Uint8Array(cipher))}`;
}

/**
 * Entschluesselt ein AWS1-Paket. Wirft eine Error mit erkennbarer Meldung,
 * wenn das Passwort falsch ist (GCM-Authentizitaetspruefung schlgt fehl).
 */
export async function decryptString(payload: string, password: string): Promise<string> {
  const parts = payload.split("|");
  if (parts.length !== 4 || parts[0] !== "AWS1") {
    throw new Error("Ungltiges Chiffreformat (erwartet: AWS1).");
  }
  const salt = fromBase64(parts[1]);
  const iv = fromBase64(parts[2]);
  const ciphertext = fromBase64(parts[3]);
  const key = await deriveKey(password, salt);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ciphertext as BufferSource);
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("Entschluesselung fehlgeschlagen: falsches Passwort oder beschdigte Daten.");
  }
}

/** true, wenn der Text im AWS1-Chiffreformat vorliegt. */
export function isEncryptedPayload(text: string): boolean {
  return typeof text === "string" && text.startsWith("AWS1|");
}
