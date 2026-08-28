// Manuskript-Verschluesselung: verschluesselt Kapitel-Inhalte (Chapter.content)
// AES-256-GCM, bevor sie in die SQLite-DB geschrieben werden.
//
// Ablauf:
//   - Die App haelt nach dem ersten Entsperren den abgeleiteten Schluessel
//     nur im Speicher (Module-Scope, nie persistiert).
//   - encryptChapterContent() liefert das AWS1-Format aus crypto.ts.
//   - decryptChapterContent() ist idempotent: Klartext bleibt Klartext,
//     damit alte unverschluesselte Kapitel weiter lesbar sind.
import { encryptString, decryptString, isEncryptedPayload } from "./crypto";

/** Im Speicher gehaltener Schluessel-Geheimnis (nie persistiert). */
let masterSecret: string | null = null;

/** true, sobald der Nutzer die Verschluesselung entschlsselt hat. */
export function isManuscriptUnlocked(): boolean {
  return masterSecret !== null;
}

/** Setzt das Master-Geheimnis (z.B. nach Passwort-Eingabe beim App-Start). */
export function setMasterSecret(secret: string): void {
  masterSecret = secret;
}

/** Verwirft das Master-Geheimnis (App-Lock / Abmeldung). */
export function clearMasterSecret(): void {
  masterSecret = null;
}

/**
 * Verschluesselt einen Kapitel-Inhalt. Wirft, wenn kein Master-Geheimnis
 * gesetzt ist — Aufrufer (Save-Pfad) muessen vorher isManuscriptUnlocked()
 * prfen bzw. den Lock-Screen erzwingen.
 */
export async function encryptChapterContent(content: string): Promise<string> {
  if (masterSecret === null) {
    throw new Error("Manuskript-Verschluesselung aktiv, aber nicht entsperrt.");
  }
  if (isEncryptedPayload(content)) return content; // bereits verschluesselt
  return encryptString(content, masterSecret);
}

/**
 * Entschluesselt einen Kapitel-Inhalt zum Anzeigen/Editieren.
 * Unverschluesselte Inhalte (Altbestand) werden unverndert zurueckgegeben.
 */
export async function decryptChapterContent(content: string): Promise<string> {
  if (!isEncryptedPayload(content)) return content;
  if (masterSecret === null) {
    throw new Error("Kapitel ist verschluesselt — bitte zuerst entsperren.");
  }
  return decryptString(content, masterSecret);
}
