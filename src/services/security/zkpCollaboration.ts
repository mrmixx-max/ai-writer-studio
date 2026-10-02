/**
 * ZKP-Kollaborations-Service — WP 31.2 (Zero-Knowledge-Kollaborationsschleuse)
 *
 * Lokaler, deterministischer Service zur kapitelgranularen Verschlüsselung,
 * Rollen-Token-Generierung und Integritätsverifikation.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type Role = 'lector' | 'sensitivity-reader';

export interface EncryptedChapter {
  id: string;
  encryptedData: string;
  iv: string;
  authTag: string;
}

export interface RoleToken {
  token: string;
  role: Role;
  chapterIds: string[];
  expiresAt: number;
}

export interface IntegrityResult {
  valid: boolean;
  message: string;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 Stunden

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Verschlüsselt ein Kapitel mit AES-256-GCM.
 */
export async function encryptChapter(chapter: string, key: string): Promise<EncryptedChapter> {
  if (!chapter || typeof chapter !== 'string') {
    throw new Error('Ungültiges Kapitel');
  }
  if (!key || typeof key !== 'string') {
    throw new Error('Ungültiger Schlüssel');
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(key.padEnd(32, '0').slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt']);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoder.encode(chapter),
  );

  const encryptedArray = new Uint8Array(encrypted);
  const authTag = encryptedArray.slice(-16);
  const data = encryptedArray.slice(0, -16);

  return {
    id: generateId(),
    encryptedData: Array.from(data).map((b) => b.toString(16).padStart(2, '0')).join(''),
    iv: Array.from(iv).map((b) => b.toString(16).padStart(2, '0')).join(''),
    authTag: Array.from(authTag).map((b) => b.toString(16).padStart(2, '0')).join(''),
  };
}

/**
 * Erzeugt ein Rollen-Token für Lektoren oder Sensitivitäts-Leser.
 */
export function generateRoleToken(role: Role, chapterIds: string[]): RoleToken {
  if (!role || (role !== 'lector' && role !== 'sensitivity-reader')) {
    throw new Error('Ungültige Rolle');
  }
  if (!chapterIds || chapterIds.length === 0) {
    throw new Error('Keine Kapitel-IDs angegeben');
  }

  const tokenData = `${role}:${chapterIds.join(',')}:${Date.now()}`;
  // Sync-Hash: einfacher FNV-1a als Token-ID
  let hash = 0x811c9dc5;
  for (let i = 0; i < tokenData.length; i++) {
    hash ^= tokenData.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const token = (hash >>> 0).toString(16).padStart(8, '0');

  return {
    token,
    role,
    chapterIds: [...chapterIds],
    expiresAt: Date.now() + TOKEN_EXPIRY_MS,
  };
}

/**
 * Verifiziert die Integrität eines verschlüsselten Kapitels.
 */
export async function verifyIntegrity(
  chapter: EncryptedChapter,
  originalHash: string,
): Promise<IntegrityResult> {
  if (!chapter || !chapter.encryptedData) {
    return { valid: false, message: 'Ungültiges verschlüsseltes Kapitel' };
  }
  if (!originalHash) {
    return { valid: false, message: 'Kein Original-Hash angegeben' };
  }

  // Hash der verschlüsselten Daten berechnen
  const dataHash = await sha256(chapter.encryptedData);

  if (dataHash === originalHash) {
    return { valid: true, message: 'Integrität bestätigt' };
  }

  return { valid: false, message: 'Integritätsprüfung fehlgeschlagen' };
}
