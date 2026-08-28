// App-Start-Schutz: PIN/Passwort-Abfrage vor der Nutzung der App.
//
// Es wird NIE das Passwort selbst gespeichert, sondern ein PBKDF2-SHA256-Hash
// (310k Iterationen) mit eigenem Salt. Persistiert wird nur { hashHex, salt }
// ueber den Settings-Service (Schluessel "security_auth").
export interface AuthRecord {
  /** Hex-kodierter abgeleiteter Verifikationsschluessel. */
  hashHex: string;
  /** Base64-kodiertes PBKDF2-Salt. */
  saltB64: string;
  iterations: number;
  createdAt: number;
}

const PBKDF2_ITERATIONS = 310_000;

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveVerifier(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(password) as BufferSource, "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    256,
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Erzeugt einen Auth-Eintrag aus einem neuen PIN/Passwort. */
export async function createAuthRecord(password: string): Promise<AuthRecord> {
  if (!password || password.length < 4) {
    throw new Error("PIN/Passwort muss mindestens 4 Zeichen lang sein.");
  }
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hashHex = await deriveVerifier(password, salt, PBKDF2_ITERATIONS);
  return { hashHex, saltB64: toBase64(salt), iterations: PBKDF2_ITERATIONS, createdAt: Date.now() };
}

/** Prueft ein eingegebenes PIN/Passwort gegen einen gespeicherten Eintrag. */
export async function verifyPassword(password: string, record: AuthRecord): Promise<boolean> {
  const computed = await deriveVerifier(password, fromBase64(record.saltB64), record.iterations);
  // konstante Zeit-Vergleichsstrategie: XOR-Akkumulator
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ record.hashHex.charCodeAt(i);
  return diff === 0 && computed.length === record.hashHex.length;
}

/**
 * Dauer-Format fuer Auto-Lock: "30m", "1h", "off".
 */
export type AutoLockSetting = "off" | "5m" | "15m" | "30m" | "1h";

export function autoLockMs(setting: AutoLockSetting): number | null {
  switch (setting) {
    case "5m": return 5 * 60_000;
    case "15m": return 15 * 60_000;
    case "30m": return 30 * 60_000;
    case "1h": return 60 * 60_000;
    default: return null;
  }
}
