// Unit-Tests: Hermes Engine Turbo & VRAM-Profiler (WP 25.2)
// ALLE Tests lokal, deterministisch, KEINE LLM-Calls, KEIN Netzwerk.
import { describe, it, expect } from 'vitest';
import {
  calculateOptimalContext,
  benchmarkTokensPerSecond,
  optimizePrompt,
  getOfflineFallback,
  type ModelConfig,
} from '@/services/ai/engineTurbo';

// ─── calculateOptimalContext ────────────────────────────────────────────────

describe('calculateOptimalContext', () => {
  it('wählt 4K-Kontext bei VRAM < 4 GB', () => {
    const config = calculateOptimalContext(2048, 2);
    expect(config.contextWindow).toBe(4096);
    expect(config.kvCacheSize).toBe(512);
    expect(config.batchSize).toBe(1);
  });

  it('wählt 8K-Kontext im Bereich 4–8 GB', () => {
    const config = calculateOptimalContext(6144, 3);
    expect(config.contextWindow).toBe(8192);
    expect(config.kvCacheSize).toBe(1024);
    expect(config.batchSize).toBe(2);
  });

  it('wählt 16K-Kontext bei VRAM > 8 GB', () => {
    const config = calculateOptimalContext(16384, 7);
    expect(config.contextWindow).toBe(16384);
    expect(config.kvCacheSize).toBe(2048);
    expect(config.batchSize).toBe(4);
  });

  it('behandelt exakt 4 GB als 8K-Stufe (Grenze inklusiv)', () => {
    expect(calculateOptimalContext(4096, 2).contextWindow).toBe(8192);
  });

  it('behandelt exakt 8 GB als 8K-Stufe (Grenze inklusiv)', () => {
    expect(calculateOptimalContext(8192, 4).contextWindow).toBe(8192);
  });

  it('behandelt knapp über 8 GB als 16K-Stufe', () => {
    expect(calculateOptimalContext(8193, 4).contextWindow).toBe(16384);
  });

  it('senkt die Batch-Größe auf 1, wenn das Modell den VRAM übersteigt', () => {
    const config = calculateOptimalContext(16384, 32);
    expect(config.contextWindow).toBe(16384);
    expect(config.batchSize).toBe(1);
  });

  it('ist deterministisch bei gleicher Eingabe', () => {
    expect(calculateOptimalContext(6144, 3)).toEqual(calculateOptimalContext(6144, 3));
  });

  it('fällt bei ungültigem VRAM defensiv auf die kleinste Stufe zurück', () => {
    const config = calculateOptimalContext(NaN, 2);
    expect(config.contextWindow).toBe(4096);
    expect(config.batchSize).toBe(1);
  });

  it('behandelt negativen VRAM wie 0 (kleinste Stufe)', () => {
    expect(calculateOptimalContext(-1024, 1).contextWindow).toBe(4096);
  });
});

// ─── benchmarkTokensPerSecond ───────────────────────────────────────────────

describe('benchmarkTokensPerSecond', () => {
  const model: ModelConfig = { name: 'test-model', size: 4, vramRequirement: 4 };

  it('liefert ein vollständiges Ergebnis für einen Prompt', () => {
    const result = benchmarkTokensPerSecond('Hallo Welt, das ist ein Test.', model);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.tokensPerSecond).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it('ist deterministisch bei gleicher Eingabe', () => {
    const a = benchmarkTokensPerSecond('Deterministischer Prompt.', model);
    const b = benchmarkTokensPerSecond('Deterministischer Prompt.', model);
    expect(a).toEqual(b);
  });

  it('zählt mehr Tokens für einen längeren Prompt', () => {
    const short = benchmarkTokensPerSecond('Ein kurzer Satz.', model);
    const long = benchmarkTokensPerSecond(
      'Ein deutlich längerer Satz mit vielen weiteren Wörtern und Zeichen!',
      model,
    );
    expect(long.totalTokens).toBeGreaterThan(short.totalTokens);
  });

  it('berechnet die Dauer konsistent aus Tokenzahl und Durchsatz', () => {
    const result = benchmarkTokensPerSecond('Konsistenzprüfung der Dauer.', model);
    const expected = Math.round((result.totalTokens / result.tokensPerSecond) * 1000);
    expect(result.durationMs).toBe(expected);
  });

  it('verarbeitet einen leeren Prompt defensiv', () => {
    const result = benchmarkTokensPerSecond('', model);
    expect(result).toEqual({ tokensPerSecond: 0, totalTokens: 0, durationMs: 0 });
  });

  it('verarbeitet reine Whitespaces als leeren Prompt', () => {
    expect(benchmarkTokensPerSecond('   \n\t  ', model).totalTokens).toBe(0);
  });

  it('verarbeitet eine fehlende ModelConfig defensiv', () => {
    const result = benchmarkTokensPerSecond(
      'Test ohne Modellkonfiguration.',
      null as unknown as ModelConfig,
    );
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(Number.isFinite(result.tokensPerSecond)).toBe(true);
    expect(result.tokensPerSecond).toBeGreaterThan(0);
  });

  it('meldet für ein größeres Modell einen niedrigeren Durchsatz', () => {
    const small = benchmarkTokensPerSecond('Vergleichsprompt für Modelle.', {
      name: 'small',
      size: 2,
      vramRequirement: 2,
    });
    const large = benchmarkTokensPerSecond('Vergleichsprompt für Modelle.', {
      name: 'large',
      size: 20,
      vramRequirement: 16,
    });
    expect(large.tokensPerSecond).toBeLessThan(small.tokensPerSecond);
  });
});

// ─── optimizePrompt ─────────────────────────────────────────────────────────

describe('optimizePrompt', () => {
  it('kollabiert mehrfache Leerzeichen zu einem', () => {
    expect(optimizePrompt('Hallo    Welt   mit   Abständen')).toBe('Hallo Welt mit Abständen');
  });

  it('entfernt Leerzeichen um Zeilenumbrüche', () => {
    expect(optimizePrompt('Zeile eins   \n   Zeile zwei')).toBe('Zeile eins\nZeile zwei');
  });

  it('fasst drei oder mehr Leerzeilen zu einer zusammen', () => {
    expect(optimizePrompt('Absatz eins\n\n\n\nAbsatz zwei')).toBe('Absatz eins\n\nAbsatz zwei');
  });

  it('normalisiert CRLF zu LF', () => {
    expect(optimizePrompt('Zeile eins\r\nZeile zwei')).toBe('Zeile eins\nZeile zwei');
  });

  it('trimmt führende und nachfolgende Whitespaces', () => {
    expect(optimizePrompt('   \n  getrimmt  \n  ')).toBe('getrimmt');
  });

  it('konvertiert Tabs zu einem Leerzeichen', () => {
    expect(optimizePrompt('Spalte1\t\tSpalte2')).toBe('Spalte1 Spalte2');
  });

  it('ist idempotent für bereits optimierte Eingaben', () => {
    const clean = 'Bereits sauberer Text.\n\nZweiter Absatz.';
    expect(optimizePrompt(clean)).toBe(clean);
    expect(optimizePrompt(optimizePrompt('  doppelt    optimiert  '))).toBe(
      optimizePrompt('  doppelt    optimiert  '),
    );
  });

  it('verarbeitet leeren String defensiv', () => {
    expect(optimizePrompt('')).toBe('');
  });

  it('verarbeitet Nicht-Strings defensiv', () => {
    expect(optimizePrompt(undefined as unknown as string)).toBe('');
  });

  it('erhält Satzinhalt und Interpunktion unverändert', () => {
    expect(optimizePrompt('Satz eins.  Satz zwei!')).toBe('Satz eins. Satz zwei!');
  });
});

// ─── getOfflineFallback ─────────────────────────────────────────────────────

describe('getOfflineFallback', () => {
  it('bleibt im GPU-Modus bei ausreichend VRAM (≥ 4 GB)', () => {
    const config = getOfflineFallback(8192);
    expect(config.mode).toBe('gpu');
    expect(config.reason).toContain('GPU');
  });

  it('schaltet auf CPU-Modus bei VRAM < 4 GB', () => {
    const config = getOfflineFallback(2048);
    expect(config.mode).toBe('cpu');
    expect(config.batchSize).toBe(1);
    expect(config.reason).toContain('CPU');
  });

  it('begrenzt die CPU-Threads auf maximal 8', () => {
    const config = getOfflineFallback(1024);
    expect(config.threads).toBeGreaterThanOrEqual(1);
    expect(config.threads).toBeLessThanOrEqual(8);
  });

  it('verwendet batchSize = 1 im CPU-Modus', () => {
    expect(getOfflineFallback(0).batchSize).toBe(1);
  });

  it('behandelt negativen VRAM defensiv als CPU-Fallback', () => {
    const config = getOfflineFallback(-512);
    expect(config.mode).toBe('cpu');
    expect(config.batchSize).toBe(1);
  });

  it('behandelt ungültigen VRAM (NaN) defensiv als CPU-Fallback', () => {
    expect(getOfflineFallback(NaN).mode).toBe('cpu');
  });

  it('behandelt exakt 4 GB als GPU-Modus (Grenze inklusiv)', () => {
    expect(getOfflineFallback(4096).mode).toBe('gpu');
  });

  it('ist deterministisch bei gleicher Eingabe', () => {
    expect(getOfflineFallback(2048)).toEqual(getOfflineFallback(2048));
  });
});
