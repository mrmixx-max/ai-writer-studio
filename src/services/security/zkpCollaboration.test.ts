/**
 * Tests: ZKP-Kollaborations-Service (WP 31.2)
 */

import { describe, it, expect } from 'vitest';
import {
  encryptChapter,
  generateRoleToken,
  verifyIntegrity,
  type Role,
} from './zkpCollaboration';

describe('encryptChapter', () => {
  it('verschlüsselt ein Kapitel', async () => {
    const result = await encryptChapter('Kapitel 1', 'key123');
    expect(result.id).toBeDefined();
    expect(result.encryptedData).toBeDefined();
    expect(result.iv).toBeDefined();
    expect(result.authTag).toBeDefined();
  });

  it('verschlüsselt mit AES-256-GCM', async () => {
    const result = await encryptChapter('Test', 'key');
    expect(result.encryptedData).not.toBe('');
    expect(result.iv).toHaveLength(24); // 12 bytes = 24 hex chars
  });

  it('gleicher Text mit gleichem Schlüssel ergibt verschiedene IV', async () => {
    const result1 = await encryptChapter('Test', 'key');
    const result2 = await encryptChapter('Test', 'key');
    expect(result1.iv).not.toBe(result2.iv);
  });

  it('leeres Kapitel wirft Fehler', async () => {
    await expect(encryptChapter('', 'key')).rejects.toThrow();
  });

  it('leerer Schlüssel wirft Fehler', async () => {
    await expect(encryptChapter('Test', '')).rejects.toThrow();
  });

  it('null/undefined wirft Fehler', async () => {
    await expect(encryptChapter(null as unknown as string, 'key')).rejects.toThrow();
    await expect(encryptChapter('Test', null as unknown as string)).rejects.toThrow();
  });
});

describe('generateRoleToken', () => {
  it('erzeugt Token für Lektor', () => {
    const token = generateRoleToken('lector', ['ch1', 'ch2']);
    expect(token.role).toBe('lector');
    expect(token.chapterIds).toEqual(['ch1', 'ch2']);
    expect(token.expiresAt).toBeGreaterThan(Date.now());
  });

  it('erzeugt Token für Sensitivitäts-Leser', () => {
    const token = generateRoleToken('sensitivity-reader', ['ch1']);
    expect(token.role).toBe('sensitivity-reader');
  });

  it('Token enthält Ablaufzeit', () => {
    const token = generateRoleToken('lector', ['ch1']);
    expect(token.expiresAt).toBeGreaterThan(Date.now());
  });

  it('leere Kapitel-IDs wirft Fehler', () => {
    expect(() => generateRoleToken('lector', [])).toThrow();
  });

  it('ungültige Rolle wirft Fehler', () => {
    expect(() => generateRoleToken('unbekannt' as Role, ['ch1'])).toThrow();
  });

  it('null/undefined wirft Fehler', () => {
    expect(() => generateRoleToken(null as unknown as Role, ['ch1'])).toThrow();
    expect(() => generateRoleToken('lector', null as unknown as string[])).toThrow();
  });
});

describe('verifyIntegrity', () => {
  it('verifiziert Integrität mit korrektem Hash', async () => {
    const chapter = await encryptChapter('Test', 'key');
    // verifyIntegrity berechnet sha256(encryptedData) und vergleicht mit originalHash
    // Daher müssen wir den Hash der verschlüsselten Daten als originalHash übergeben
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(chapter.encryptedData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    const result = await verifyIntegrity(chapter, hash);
    expect(result.valid).toBe(true);
  });

  it('verifiziert nicht mit falschem Hash', async () => {
    const chapter = await encryptChapter('Test', 'key');
    const result = await verifyIntegrity(chapter, 'a'.repeat(64));
    expect(result.valid).toBe(false);
  });

  it('verifiziert nicht mit falschem Hash', async () => {
    const chapter = await encryptChapter('Test', 'key');
    const result = await verifyIntegrity(chapter, 'falscher-hash');
    expect(result.valid).toBe(false);
  });

  it('leeres Kapitel wird abgelehnt', async () => {
    const result = await verifyIntegrity(null as unknown as any, 'hash');
    expect(result.valid).toBe(false);
  });

  it('leerer Hash wird abgelehnt', async () => {
    const chapter = await encryptChapter('Test', 'key');
    const result = await verifyIntegrity(chapter, '');
    expect(result.valid).toBe(false);
  });

  it('null/undefined wird abgelehnt', async () => {
    const result = await verifyIntegrity(null as unknown as any, null as unknown as string);
    expect(result.valid).toBe(false);
  });
});
