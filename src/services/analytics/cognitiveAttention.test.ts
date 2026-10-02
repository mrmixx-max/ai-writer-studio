/**
 * Tests: Cognitive-Attention-Service (WP 30.1)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCognitiveLoad,
  detectGlazeOverZones,
  calculateReadingTime,
  type ReaderProfile,
} from './cognitiveAttention';

describe('calculateCognitiveLoad', () => {
  it('leerer Text ergibt niedrige Belastung', () => {
    const result = calculateCognitiveLoad('');
    expect(result.index).toBe(0);
    expect(result.level).toBe('low');
  });

  it('null/undefined ergibt niedrige Belastung', () => {
    expect(calculateCognitiveLoad(null as unknown as string).index).toBe(0);
    expect(calculateCognitiveLoad(undefined as unknown as string).index).toBe(0);
  });

  it('kurzer Text ergibt niedrige Belastung', () => {
    const result = calculateCognitiveLoad('Der Hund bellt.');
    expect(result.level).toBe('low');
  });

  it('langer Text mit Fachwörtern ergibt hohe Belastung', () => {
    const text = 'Der Algorithmus implementiert eine komplexe Datenbank-Schnittstelle mit Middleware und Pipeline-Architektur. '.repeat(10);
    const result = calculateCognitiveLoad(text);
    expect(result.level).toBe('high');
    expect(result.factors.length).toBeGreaterThan(0);
  });

  it('Passivkonstruktionen werden erkannt', () => {
    const text = 'Es wurde gemacht. Es wurde gedacht. Es wurde gesagt.';
    const result = calculateCognitiveLoad(text);
    expect(result.factors).toContain('Viele Passivkonstruktionen');
  });

  it('Fachwortdichte wird erkannt', () => {
    const text = 'Algorithmus Datenbank Protokoll Schnittstelle Architektur Framework Middleware Pipeline Repository';
    const result = calculateCognitiveLoad(text);
    expect(result.factors).toContain('Hohe Fachwortdichte');
  });

  it('Abstraktheitsgrad wird erkannt', () => {
    const text = 'Konzept Theorie Methode System Prozess Struktur Funktion Analyse Evaluation Implementierung';
    const result = calculateCognitiveLoad(text);
    expect(result.factors).toContain('Hoher Abstraktheitsgrad');
  });

  it('Index ist zwischen 0 und 100', () => {
    const result = calculateCognitiveLoad('Ein sehr langer Text mit vielen Fachwörtern und Passivkonstruktionen. '.repeat(20));
    expect(result.index).toBeGreaterThanOrEqual(0);
    expect(result.index).toBeLessThanOrEqual(100);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(calculateCognitiveLoad(123 as unknown as string).index).toBe(0);
  });
});

describe('detectGlazeOverZones', () => {
  it('leeres Array ergibt leeres Array', () => {
    expect(detectGlazeOverZones([])).toEqual([]);
  });

  it('null/undefined ergibt leeres Array', () => {
    expect(detectGlazeOverZones(null as unknown as string[])).toEqual([]);
    expect(detectGlazeOverZones(undefined as unknown as string[])).toEqual([]);
  });

  it('erkennt Glaze-Over-Zonen', () => {
    const paragraphs = [
      'Der Hund bellt.',
      'Der Algorithmus implementiert eine komplexe Datenbank-Schnittstelle mit Middleware und Pipeline-Architektur. '.repeat(5),
      'Die Katze schläft.',
    ];
    const zones = detectGlazeOverZones(paragraphs);
    expect(zones.length).toBeGreaterThan(0);
  });

  it('keine Glaze-Over-Zonen bei einfachen Texten', () => {
    const paragraphs = ['Der Hund bellt.', 'Die Katze schläft.', 'Der Vogel singt.'];
    expect(detectGlazeOverZones(paragraphs)).toEqual([]);
  });

  it('Zone enthält paragraphIndex', () => {
    const paragraphs = [
      'Der Algorithmus implementiert eine komplexe Datenbank-Schnittstelle. '.repeat(10),
    ];
    const zones = detectGlazeOverZones(paragraphs);
    expect(zones[0].paragraphIndex).toBe(0);
  });
});

describe('calculateReadingTime', () => {
  it('leerer Text ergibt 0 Sekunden', () => {
    const result = calculateReadingTime('', 'standard');
    expect(result.seconds).toBe(0);
  });

  it('null/undefined ergibt 0 Sekunden', () => {
    expect(calculateReadingTime(null as unknown as string, 'standard').seconds).toBe(0);
    expect(calculateReadingTime(undefined as unknown as string, 'standard').seconds).toBe(0);
  });

  it('berechnet Lesezeit für Standardleser', () => {
    const text = 'Eins zwei drei vier fünf sechs sieben acht neun zehn';
    const result = calculateReadingTime(text, 'standard');
    expect(result.wpm).toBe(220);
    expect(result.seconds).toBeGreaterThan(0);
  });

  it('berechnet Lesezeit für Diagonalleser', () => {
    const text = 'Eins zwei drei vier fünf sechs sieben acht neun zehn';
    const result = calculateReadingTime(text, 'diagonal');
    expect(result.wpm).toBe(350);
  });

  it('berechnet Lesezeit für Genussleser', () => {
    const text = 'Eins zwei drei vier fünf sechs sieben acht neun zehn';
    const result = calculateReadingTime(text, 'genuss');
    expect(result.wpm).toBe(130);
  });

  it('Diagonalleser ist schneller als Standardleser', () => {
    const text = 'Eins zwei drei vier fünf sechs sieben acht neun zehn';
    const diagonal = calculateReadingTime(text, 'diagonal');
    const standard = calculateReadingTime(text, 'standard');
    expect(diagonal.seconds).toBeLessThan(standard.seconds);
  });

  it('Genussleser ist langsamer als Standardleser', () => {
    const text = 'Eins zwei drei vier fünf sechs sieben acht neun zehn';
    const genuss = calculateReadingTime(text, 'genuss');
    const standard = calculateReadingTime(text, 'standard');
    expect(genuss.seconds).toBeGreaterThan(standard.seconds);
  });

  it('unbekanntes Profil wird zu Standard', () => {
    const text = 'Eins zwei drei';
    const result = calculateReadingTime(text, 'unbekannt' as ReaderProfile);
    expect(result.wpm).toBe(220);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(calculateReadingTime(123 as unknown as string, 'standard').seconds).toBe(0);
  });
});
