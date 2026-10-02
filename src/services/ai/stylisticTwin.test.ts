// Unit-Tests: Stil-DNA-Service (WP 22.1 — Autoren-Zwilling & Stil-DNA-Mimikry)
// ALLE Tests lokal, deterministisch, KEINE LLM-Calls, KEIN Netzwerk.
import { describe, it, expect } from 'vitest';
import {
  extractStyleDNA,
  buildPersonaPrompt,
  analyzeSentenceRhythm,
  type StyleDNA,
} from '@/services/ai/stylisticTwin';

// ─── extractStyleDNA ────────────────────────────────────────────────────────

describe('extractStyleDNA', () => {
  it('extrahiert Style-DNA aus einem einfachen Kapitel', () => {
    const chapters = ['Der schnelle Hund läuft über den Weg.'];
    const dna = extractStyleDNA(chapters);
    expect(dna).toBeDefined();
    expect(dna.adjectiveVerbRatio).toBeGreaterThanOrEqual(0);
    expect(dna.sentencePatterns).toHaveLength(3);
    expect(dna.vocabularyDensity).toBeGreaterThan(0);
    expect(dna.avgSentenceLength).toBeGreaterThan(0);
  });

  it('verarbeitet leeres Array defensiv (Fallback)', () => {
    const dna = extractStyleDNA([]);
    expect(dna.adjectiveVerbRatio).toBe(0);
    expect(dna.sentencePatterns).toEqual([]);
    expect(dna.vocabularyDensity).toBe(0);
    expect(dna.regionalWords).toEqual([]);
    expect(dna.avgSentenceLength).toBe(0);
  });

  it('verarbeitet Array mit leeren Strings defensiv', () => {
    const dna = extractStyleDNA(['', '   ', '']);
    expect(dna.adjectiveVerbRatio).toBe(0);
    expect(dna.sentencePatterns).toEqual([]);
    expect(dna.vocabularyDensity).toBe(0);
    expect(dna.regionalWords).toEqual([]);
    expect(dna.avgSentenceLength).toBe(0);
  });

  it('berechnet Adjektiv-Verhältnis korrekt', () => {
    // "schnelles" ist Adjektiv, "laufen" ist Verb (Infinitiv)
    const chapters = ['Der schnelles Hund kann laufen.'];
    const dna = extractStyleDNA(chapters);
    expect(dna.adjectiveVerbRatio).toBeGreaterThan(0);
  });

  it('erkennt Satzmuster (participle, paratactic, hypotactic)', () => {
    const chapters = [
      'Der Hund läuft und die Katze schläft.',
      'Weil es regnet, bleiben wir zu Hause.',
    ];
    const dna = extractStyleDNA(chapters);
    expect(dna.sentencePatterns).toHaveLength(3);
    const types = dna.sentencePatterns.map((p) => p.type);
    expect(types).toContain('participle');
    expect(types).toContain('paratactic');
    expect(types).toContain('hypotactic');
  });

  it('berechnet Vokabular-Dichte', () => {
    const chapters = ['Hund Katze Hund Katze Hund'];
    const dna = extractStyleDNA(chapters);
    expect(dna.vocabularyDensity).toBeGreaterThan(0);
    expect(dna.vocabularyDensity).toBeLessThanOrEqual(1);
  });

  it('findet regionale Wörter', () => {
    const chapters = ['Moin, ich bin aus Berlin und das Wetter ist schön.'];
    const dna = extractStyleDNA(chapters);
    expect(dna.regionalWords).toContain('moin');
  });

  it('berechnet durchschnittliche Satzlänge', () => {
    const chapters = ['Eins. Zwei drei. Vier fünf sechs sieben.'];
    const dna = extractStyleDNA(chapters);
    expect(dna.avgSentenceLength).toBeGreaterThan(0);
  });
});

// ─── buildPersonaPrompt ─────────────────────────────────────────────────────

describe('buildPersonaPrompt', () => {
  const sampleDNA: StyleDNA = {
    adjectiveVerbRatio: 0.5,
    sentencePatterns: [
      { type: 'participle', frequency: 0.3 },
      { type: 'paratactic', frequency: 0.5 },
      { type: 'hypotactic', frequency: 0.2 },
    ],
    vocabularyDensity: 0.7,
    regionalWords: ['moin', 'icke'],
    avgSentenceLength: 12.5,
  };

  it('erstellt Prompt mit vollständiger Style-DNA', () => {
    const prompt = buildPersonaPrompt(sampleDNA, 'Kapitel 1');
    expect(prompt).toContain('persönlichen Schreibstil');
    expect(prompt).toContain('Adjektive zu Verben');
    expect(prompt).toContain('Satzmuster');
    expect(prompt).toContain('Vokabular-Dichte');
    expect(prompt).toContain('Regionale Wörter');
    expect(prompt).toContain('Durchschnittliche Satzlänge');
    expect(prompt).toContain('Kapitel 1');
  });

  it('verarbeitet fehlende Style-DNA defensiv', () => {
    const prompt = buildPersonaPrompt(null as unknown as StyleDNA, 'Test');
    expect(prompt).toContain('persönlichen Stil');
    expect(prompt).toContain('Test');
  });

  it('enthält Kontext im Prompt', () => {
    const prompt = buildPersonaPrompt(sampleDNA, 'Der Protagonist geht nach Hause.');
    expect(prompt).toContain('Der Protagonist geht nach Hause.');
  });

  it('verarbeitet leeren Kontext defensiv', () => {
    const prompt = buildPersonaPrompt(sampleDNA, '');
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('persönlichen Schreibstil');
  });
});

// ─── analyzeSentenceRhythm ───────────────────────────────────────────────────

describe('analyzeSentenceRhythm', () => {
  it('analysiert Satzrhythmus eines einfachen Textes', () => {
    const text = 'Der Hund läuft. Die Katze schläft.';
    const profile = analyzeSentenceRhythm(text);
    expect(profile.avgLength).toBeGreaterThan(0);
    expect(profile.variance).toBeGreaterThanOrEqual(0);
    expect(profile.shortSentences).toBeGreaterThanOrEqual(0);
    expect(profile.longSentences).toBeGreaterThanOrEqual(0);
  });

  it('verarbeitet leeren Text defensiv', () => {
    const profile = analyzeSentenceRhythm('');
    expect(profile.avgLength).toBe(0);
    expect(profile.variance).toBe(0);
    expect(profile.shortSentences).toBe(0);
    expect(profile.longSentences).toBe(0);
  });

  it('zählt kurze und lange Sätze', () => {
    const text = 'Eins. Zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn fünfzehn sechzehn siebzehn achtzehn neunzehn zwanzig einundzwanzig zweiundzwanzig.';
    const profile = analyzeSentenceRhythm(text);
    expect(profile.shortSentences).toBeGreaterThan(0);
    expect(profile.longSentences).toBeGreaterThan(0);
  });

  it('berechnet Varianz korrekt', () => {
    const text = 'Eins. Eins zwei drei vier fünf.';
    const profile = analyzeSentenceRhythm(text);
    expect(profile.variance).toBeGreaterThanOrEqual(0);
  });
});
