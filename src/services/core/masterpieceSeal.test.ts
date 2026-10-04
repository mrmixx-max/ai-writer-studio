import { describe, it, expect } from 'vitest';
import {
  runEcosystemHealthScan,
  generateSealCertificate,
  generateSealSvg,
  verifySeal,
  type SealCertificate,
} from './masterpieceSeal';

describe('runEcosystemHealthScan', () => {
  it('liefert vier Tabellen in fester Reihenfolge', () => {
    const r = runEcosystemHealthScan();
    expect(r.tables).toHaveLength(4);
    expect(r.tables.map((t) => t.name)).toEqual([
      'chapters',
      'characters',
      'notes',
      'settings',
    ]);
  });

  it('gibt jeder Tabelle positive rowCount/sizeBytes und gültigen Status', () => {
    const r = runEcosystemHealthScan();
    for (const t of r.tables) {
      expect(t.rowCount).toBeGreaterThan(0);
      expect(t.sizeBytes).toBeGreaterThan(0);
      expect(['ok', 'degraded', 'critical']).toContain(t.status);
    }
  });

  it('liefert plausibles i18n, Cache, Latenz und Timestamp', () => {
    const r = runEcosystemHealthScan();
    expect(['ok', 'degraded', 'critical']).toContain(r.cacheStatus);
    expect(r.i18nCompleteness).toBeGreaterThanOrEqual(0);
    expect(r.i18nCompleteness).toBeLessThanOrEqual(1);
    expect(r.bundleLatencyMs).toBeGreaterThan(0);
    expect(r.timestamp).toBeGreaterThan(0);
  });

  it('bleibt im gesunden deterministischen Baseline-Zustand', () => {
    const r = runEcosystemHealthScan();
    expect(r.cacheStatus).toBe('ok');
    expect(r.overallStatus).toBe('ok');
    expect(r.tables.every((t) => t.status === 'ok')).toBe(true);
  });

  it('hält die Bundle-Latenz unter dem 20ms-Budget', () => {
    const r = runEcosystemHealthScan();
    expect(r.bundleLatencyMs).toBeLessThan(20);
  });
});

describe('generateSealCertificate', () => {
  it('erzeugt ein Zertifikat mit allen Feldern', () => {
    const c = generateSealCertificate(6000, '49.2.0');
    expect(c.testCount).toBe(6000);
    expect(c.version).toBe('49.2.0');
    expect(c.issuer).toBe('ai-writer-studio');
    expect(c.timestamp).toBeGreaterThan(0);
  });

  it('erzeugt SHA-256-Hash (64 hex) und Signatur (64 hex) und 16-hex id', () => {
    const c = generateSealCertificate(6000, '49.2.0');
    expect(c.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(c.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(c.id).toMatch(/^[a-f0-9]{16}$/);
  });

  it('defensive: negative, NaN und undefined testCount werden zu 0', () => {
    expect(generateSealCertificate(-100, '49.2.0').testCount).toBe(0);
    expect(generateSealCertificate(NaN, '49.2.0').testCount).toBe(0);
    expect(
      generateSealCertificate(undefined as unknown as number, '49.2.0').testCount,
    ).toBe(0);
  });

  it('defensive: leere oder fehlende Version wird zu 0.0.0', () => {
    expect(generateSealCertificate(6000, '').version).toBe('0.0.0');
    expect(
      generateSealCertificate(6000, undefined as unknown as string).version,
    ).toBe('0.0.0');
  });

  it('unterschiedliche Eingaben erzeugen unterschiedliche Hashes', () => {
    const a = generateSealCertificate(6000, '49.2.0');
    const b = generateSealCertificate(5000, '49.2.0');
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('generateSealSvg', () => {
  it('erzeugt gültiges SVG mit Testzahl, Version und Issuer', () => {
    const c = generateSealCertificate(6000, '49.2.0');
    const svg = generateSealSvg(c);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('6000');
    expect(svg).toContain('49.2.0');
    expect(svg).toContain('ai-writer-studio');
    expect(svg).toContain('<circle');
    expect(svg).toContain(c.hash.slice(0, 8));
  });

  it('zeigt VERIFIED ab 6000 Tests', () => {
    expect(generateSealSvg(generateSealCertificate(6000, '49.2.0'))).toContain(
      'VERIFIED',
    );
  });

  it('zeigt PENDING unter 6000 Tests', () => {
    expect(generateSealSvg(generateSealCertificate(5000, '49.2.0'))).toContain(
      'PENDING',
    );
  });

  it('defensive: null/undefined Zertifikat erzeugt trotzdem SVG', () => {
    const svg = generateSealSvg(undefined as unknown as SealCertificate);
    expect(svg).toContain('<svg');
    expect(svg).toContain('0.0.0');
    expect(svg).toContain('PENDING');
  });
});

describe('verifySeal', () => {
  it('verifiziert ein frisch erzeugtes Zertifikat', () => {
    expect(verifySeal(generateSealCertificate(6000, '49.2.0'))).toBe(true);
  });

  it('verifiziert Zertifikat mit 0 Tests', () => {
    expect(verifySeal(generateSealCertificate(0, '49.2.0'))).toBe(true);
  });

  it('verifiziert Zertifikat mit Sonderzeichen-Version', () => {
    expect(
      verifySeal(generateSealCertificate(6000, '49.2.0-beta+exp.sha.5114f85')),
    ).toBe(true);
  });

  it('lehnt manipulierten Hash ab', () => {
    const c = generateSealCertificate(6000, '49.2.0');
    expect(verifySeal({ ...c, hash: 'f'.repeat(64) })).toBe(false);
  });

  it('lehnt manipulierte Signatur ab', () => {
    const c = generateSealCertificate(6000, '49.2.0');
    expect(verifySeal({ ...c, signature: 'f'.repeat(64) })).toBe(false);
  });

  it('defensive: null/undefined/unvollständig geben false', () => {
    expect(verifySeal(undefined as unknown as SealCertificate)).toBe(false);
    expect(verifySeal(null as unknown as SealCertificate)).toBe(false);
    expect(verifySeal({} as SealCertificate)).toBe(false);
  });
});
