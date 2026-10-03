/**
 * Tests: Contract-Signer-Service (WP 39.2)
 *
 * Deckt Erzeugung, Signatur, Verifikation (inkl. Replay-/Stripping-
 * Widerstand) und den HTML-Prüfbericht ab. Ed25519 über die Web Crypto API.
 */

import { describe, it, expect } from 'vitest';
import {
  createContract,
  signContract,
  verifyContract,
  generateHtmlReport,
  CONTRACT_VERSION,
  type ContractEnvelope,
} from './contractSigner';

// ─── Helfer ──────────────────────────────────────────────────────────────────

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Erzeugt ein Ed25519-Schlüsselpaar und liefert Seed (Hex) + öffentlichen x-Wert. */
async function makeKey(): Promise<{ seedHex: string; pubX: string }> {
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
  const seedHex = toHex(pkcs8.slice(16)); // roher 32-Byte-Seed
  const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey);
  return { seedHex, pubX: jwk.x as string };
}

/** Signiert eine Hülle mit allen deklarierten Parteien (deterministische Zeitstempel). */
async function signAll(
  envelope: ContractEnvelope,
  keys: Record<string, { seedHex: string }>,
  baseTs = 1_000,
): Promise<ContractEnvelope> {
  let out = envelope;
  for (let i = 0; i < envelope.parties.length; i++) {
    const party = envelope.parties[i];
    out = await signContract(out, party, keys[party].seedHex, { timestamp: baseTs + i });
  }
  return out;
}

// ─── createContract ──────────────────────────────────────────────────────────

describe('createContract', () => {
  it('erzeugt eine leere Hülle mit Version und Parteien', () => {
    const env = createContract('hash-abc', ['Alice', 'Bob']);
    expect(env.documentHash).toBe('hash-abc');
    expect(env.parties).toEqual(['Alice', 'Bob']);
    expect(env.signatures).toEqual([]);
    expect(env.version).toBe(CONTRACT_VERSION);
  });

  it('trimmt und dedupliziert Parteien (Reihenfolge stabil)', () => {
    const env = createContract('h', ['  Alice ', 'Bob', 'Alice', 'Bob ']);
    expect(env.parties).toEqual(['Alice', 'Bob']);
  });

  it('wirft bei leerem Dokument-Hash', () => {
    expect(() => createContract('', ['Alice'])).toThrow();
    expect(() => createContract('   ', ['Alice'])).toThrow();
  });

  it('wirft ohne gültige Partei', () => {
    expect(() => createContract('h', [])).toThrow();
    expect(() => createContract('h', ['', '  '])).toThrow();
  });
});

// ─── signContract ────────────────────────────────────────────────────────────

describe('signContract', () => {
  it('fügt eine Signatur hinzu', async () => {
    const key = await makeKey();
    const env = createContract('h', ['Alice']);
    const signed = await signContract(env, 'Alice', key.seedHex, { timestamp: 123 });
    expect(signed.signatures).toHaveLength(1);
    expect(signed.signatures[0].party).toBe('Alice');
    expect(signed.signatures[0].timestamp).toBe(123);
    expect(signed.signatures[0].signature).toMatch(/^ed25519-v1:[A-Za-z0-9_-]{43}:[0-9a-f]{128}$/);
  });

  it('verändert die Eingabe-Hülle nicht (Immutabilität)', async () => {
    const key = await makeKey();
    const env = createContract('h', ['Alice', 'Bob']);
    const before = JSON.stringify(env);
    await signContract(env, 'Alice', key.seedHex, { timestamp: 1 });
    expect(JSON.stringify(env)).toBe(before);
    expect(env.signatures).toHaveLength(0);
  });

  it('ist deterministisch (gleicher Schlüssel/Zeitstempel ⇒ gleiche Signatur)', async () => {
    const key = await makeKey();
    const env = createContract('h', ['Alice']);
    const a = await signContract(env, 'Alice', key.seedHex, { timestamp: 42 });
    const b = await signContract(env, 'Alice', key.seedHex, { timestamp: 42 });
    expect(a.signatures[0].signature).toBe(b.signatures[0].signature);
  });

  it('wirft für eine nicht deklarierte Partei', async () => {
    const key = await makeKey();
    const env = createContract('h', ['Alice']);
    await expect(signContract(env, 'Mallory', key.seedHex)).rejects.toThrow(/nicht im Vertrag/);
  });

  it('wirft bei Doppelsignatur derselben Partei', async () => {
    const key = await makeKey();
    const env = createContract('h', ['Alice']);
    const signed = await signContract(env, 'Alice', key.seedHex, { timestamp: 1 });
    await expect(signContract(signed, 'Alice', key.seedHex, { timestamp: 2 })).rejects.toThrow(/bereits signiert/);
  });

  it('wirft bei ungültigem privatem Schlüssel', async () => {
    const env = createContract('h', ['Alice']);
    await expect(signContract(env, 'Alice', '')).rejects.toThrow();
    await expect(signContract(env, 'Alice', 'nicht-hex-zz')).rejects.toThrow();
  });
});

// ─── verifyContract ──────────────────────────────────────────────────────────

describe('verifyContract', () => {
  it('ist gültig, wenn alle Parteien signiert haben', async () => {
    const keys = { Alice: await makeKey(), Bob: await makeKey() };
    const env = await signAll(createContract('h', ['Alice', 'Bob']), keys);
    const res = await verifyContract(env);
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.signedBy).toEqual(['Alice', 'Bob']);
    expect(res.missing).toEqual([]);
  });

  it('meldet fehlende Parteien bei Teil-Signatur', async () => {
    const keys = { Alice: await makeKey(), Bob: await makeKey() };
    const base = createContract('h', ['Alice', 'Bob']);
    const partial = await signContract(base, 'Alice', keys.Alice.seedHex, { timestamp: 1 });
    const res = await verifyContract(partial);
    expect(res.valid).toBe(false);
    expect(res.signedBy).toEqual(['Alice']);
    expect(res.missing).toEqual(['Bob']);
  });

  it('erkennt einen manipulierten Dokument-Hash (Replay auf anderen Vertrag)', async () => {
    const keys = { Alice: await makeKey(), Bob: await makeKey() };
    const env = await signAll(createContract('hashA', ['Alice', 'Bob']), keys);
    const tampered: ContractEnvelope = { ...env, documentHash: 'hashB' };
    const res = await verifyContract(tampered);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('erkennt Stripping (entfernte Signatur bricht die Kette)', async () => {
    const keys = { Alice: await makeKey(), Bob: await makeKey(), Carol: await makeKey() };
    const env = await signAll(createContract('h', ['Alice', 'Bob', 'Carol']), keys);
    // Mittlere Signatur entfernen
    const stripped: ContractEnvelope = { ...env, signatures: [env.signatures[0], env.signatures[2]] };
    const res = await verifyContract(stripped);
    expect(res.valid).toBe(false);
    expect(res.missing).toContain('Bob');
  });

  it('erkennt vertauschte Signatur-Reihenfolge', async () => {
    const keys = { Alice: await makeKey(), Bob: await makeKey() };
    const env = await signAll(createContract('h', ['Alice', 'Bob']), keys);
    const reordered: ContractEnvelope = { ...env, signatures: [env.signatures[1], env.signatures[0]] };
    const res = await verifyContract(reordered);
    expect(res.valid).toBe(false);
  });

  it('erkennt eine aus einem anderen Vertrag kopierte Signatur', async () => {
    const keys = { Alice: await makeKey(), Bob: await makeKey() };
    const a = await signAll(createContract('hashA', ['Alice', 'Bob']), keys);
    const b = createContract('hashB', ['Alice', 'Bob']);
    const replayed: ContractEnvelope = { ...b, signatures: [a.signatures[0]] };
    const res = await verifyContract(replayed);
    expect(res.valid).toBe(false);
  });

  it('erkennt einen manipulierten Zeitstempel', async () => {
    const keys = { Alice: await makeKey() };
    const env = await signAll(createContract('h', ['Alice']), keys);
    const tampered: ContractEnvelope = {
      ...env,
      signatures: [{ ...env.signatures[0], timestamp: env.signatures[0].timestamp + 1 }],
    };
    const res = await verifyContract(tampered);
    expect(res.valid).toBe(false);
  });

  it('erkennt ein ungültiges Signaturformat', async () => {
    const env: ContractEnvelope = {
      documentHash: 'h',
      parties: ['Alice'],
      version: CONTRACT_VERSION,
      signatures: [{ party: 'Alice', signature: 'kaputt', timestamp: 1 }],
    };
    const res = await verifyContract(env);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => /format/i.test(e))).toBe(true);
  });

  it('erkennt eine Signatur einer unbekannten Partei', async () => {
    const keys = { Alice: await makeKey() };
    const env = await signAll(createContract('h', ['Alice']), keys);
    const forged: ContractEnvelope = {
      ...env,
      signatures: [...env.signatures, { party: 'Mallory', signature: env.signatures[0].signature, timestamp: 9 }],
    };
    const res = await verifyContract(forged);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => /unbekannte Partei/.test(e))).toBe(true);
  });

  it('erkennt doppelte Signatur-Einträge', async () => {
    const keys = { Alice: await makeKey() };
    const env = await signAll(createContract('h', ['Alice']), keys);
    const dup: ContractEnvelope = { ...env, signatures: [env.signatures[0], { ...env.signatures[0] }] };
    const res = await verifyContract(dup);
    expect(res.valid).toBe(false);
  });

  it('wirft nie bei null/undefined/Müll', async () => {
    const r1 = await verifyContract(null as unknown as ContractEnvelope);
    const r2 = await verifyContract(undefined as unknown as ContractEnvelope);
    const r3 = await verifyContract('quatsch' as unknown as ContractEnvelope);
    const r4 = await verifyContract({} as unknown as ContractEnvelope);
    for (const r of [r1, r2, r3, r4]) {
      expect(r.valid).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);
    }
  });
});

// ─── generateHtmlReport ──────────────────────────────────────────────────────

describe('generateHtmlReport', () => {
  it('liefert ein autarkes HTML-Dokument ohne externe Ressourcen', async () => {
    const keys = { Alice: await makeKey() };
    const env = await signAll(createContract('abc123', ['Alice']), keys);
    const html = generateHtmlReport(env);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Vertrags-Prüfbericht');
    expect(html).toContain('abc123');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<link');
  });

  it('listet Parteien und Signaturstatus auf', async () => {
    const keys = { Alice: await makeKey(), Bob: await makeKey() };
    const base = createContract('h', ['Alice', 'Bob']);
    const env = await signContract(base, 'Alice', keys.Alice.seedHex, { timestamp: 1 });
    const html = generateHtmlReport(env);
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
    expect(html).toContain('signiert');
    expect(html).toContain('offen');
  });

  it('escapet HTML in Parteiennamen (XSS-Schutz)', () => {
    const env = createContract('h', ['<script>alert(1)</script>']);
    const html = generateHtmlReport(env);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('liefert auch bei ungültiger Hülle gültiges HTML', () => {
    const html = generateHtmlReport(null as unknown as ContractEnvelope);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Ungültige Hülle');
  });
});
