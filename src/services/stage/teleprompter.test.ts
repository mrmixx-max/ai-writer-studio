/**
 * Tests: Teleprompter-Service (WP 27.1)
 */

import { describe, it, expect } from 'vitest';
import {
  parsePerformanceMarkup,
  calculateScrollDuration,
  formatStageMode,
  type PerformanceLine,
} from './teleprompter';

describe('parsePerformanceMarkup', () => {
  it('leerer String ergibt leeres Array', () => {
    expect(parsePerformanceMarkup('')).toEqual([]);
  });

  it('null/undefined ergibt leeres Array', () => {
    expect(parsePerformanceMarkup(null as unknown as string)).toEqual([]);
    expect(parsePerformanceMarkup(undefined as unknown as string)).toEqual([]);
  });

  it('einfache Zeile ohne Markup', () => {
    const lines = parsePerformanceMarkup('Hallo Welt');
    expect(lines.length).toBe(1);
    expect(lines[0].text).toBe('Hallo Welt');
  });

  it(' erkennt Pause', () => {
    const lines = parsePerformanceMarkup('[Pause: 3s] Hallo');
    expect(lines[0].pause).toBe(3);
    expect(lines[0].text).toBe('Hallo');
  });

  it('erkennt Standard-Pause ohne Wert', () => {
    const lines = parsePerformanceMarkup('[Pause] Hallo');
    expect(lines[0].pause).toBe(2);
  });

  it('erkennt Modulation leiser werden', () => {
    const lines = parsePerformanceMarkup('[leiser werden] Hallo');
    expect(lines[0].modulation).toBe('quieter');
  });

  it('erkennt Modulation drohend', () => {
    const lines = parsePerformanceMarkup('[drohend] Hallo');
    expect(lines[0].modulation).toBe('threatening');
  });

  it('erkennt Modulation schneller', () => {
    const lines = parsePerformanceMarkup('[schneller] Hallo');
    expect(lines[0].modulation).toBe('faster');
  });

  it('erkennt Bold-Emphasis', () => {
    const lines = parsePerformanceMarkup('**Hallo** Welt');
    expect(lines[0].emphasis).toBe('bold');
    expect(lines[0].text).toBe('Hallo Welt');
  });

  it('erkennt Highlight-Emphasis', () => {
    const lines = parsePerformanceMarkup('==Hallo== Welt');
    expect(lines[0].emphasis).toBe('highlight');
    expect(lines[0].text).toBe('Hallo Welt');
  });

  it('erkennt Italic-Emphasis', () => {
    const lines = parsePerformanceMarkup('*Hallo* Welt');
    expect(lines[0].emphasis).toBe('italic');
    expect(lines[0].text).toBe('Hallo Welt');
  });

  it('mehrere Zeilen werden geparst', () => {
    const lines = parsePerformanceMarkup('Hallo\nWelt\nWie geht es?');
    expect(lines.length).toBe(3);
  });

  it('leere Zeilen werden übersprungen', () => {
    const lines = parsePerformanceMarkup('Hallo\n\nWelt');
    expect(lines.length).toBe(2);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(parsePerformanceMarkup(123 as unknown as string)).toEqual([]);
  });
});

describe('calculateScrollDuration', () => {
  it('berechnet Dauer bei 150 WPM', () => {
    // 150 WPM = 2.5 Wörter/Sekunde → 10 Wörter = 4 Sekunden
    const duration = calculateScrollDuration('Eins zwei drei vier fünf sechs sieben acht neun zehn', 150);
    expect(duration).toBe(4);
  });

  it('leerer String ergibt 0', () => {
    expect(calculateScrollDuration('', 150)).toBe(0);
  });

  it('null/undefined ergibt 0', () => {
    expect(calculateScrollDuration(null as unknown as string, 150)).toBe(0);
    expect(calculateScrollDuration(undefined as unknown as string, 150)).toBe(0);
  });

  it('WPM=0 wird zu 1', () => {
    const duration = calculateScrollDuration('Eins zwei drei', 0);
    expect(duration).toBeGreaterThan(0);
  });

  it('negatives WPM wird zu 1', () => {
    const duration = calculateScrollDuration('Eins zwei drei', -10);
    expect(duration).toBeGreaterThan(0);
  });

  it('längere Texte dauern länger', () => {
    const short = calculateScrollDuration('Eins zwei', 150);
    const long = calculateScrollDuration('Eins zwei drei vier fünf sechs sieben acht neun zehn', 150);
    expect(long).toBeGreaterThan(short);
  });
});

describe('formatStageMode', () => {
  it('leere Lines ergibt leeren String', () => {
    expect(formatStageMode([])).toBe('');
  });

  it('formatiert einfache Zeile als HTML', () => {
    const lines: PerformanceLine[] = [{ text: 'Hallo Welt' }];
    const html = formatStageMode(lines);
    expect(html).toContain('stage-line');
    expect(html).toContain('Hallo Welt');
  });

  it('Bold wird zu strong', () => {
    const lines: PerformanceLine[] = [{ text: 'Hallo', emphasis: 'bold' }];
    const html = formatStageMode(lines);
    expect(html).toContain('<strong>Hallo</strong>');
  });

  it('Highlight wird zu mark', () => {
    const lines: PerformanceLine[] = [{ text: 'Hallo', emphasis: 'highlight' }];
    const html = formatStageMode(lines);
    expect(html).toContain('<mark>Hallo</mark>');
  });

  it('Italic wird zu em', () => {
    const lines: PerformanceLine[] = [{ text: 'Hallo', emphasis: 'italic' }];
    const html = formatStageMode(lines);
    expect(html).toContain('<em>Hallo</em>');
  });

  it('Modulation wird als data-Attribut', () => {
    const lines: PerformanceLine[] = [{ text: 'Hallo', modulation: 'quieter' }];
    const html = formatStageMode(lines);
    expect(html).toContain('data-modulation="quieter"');
  });

  it('Pause wird als data-Attribut', () => {
    const lines: PerformanceLine[] = [{ text: 'Hallo', pause: 3 }];
    const html = formatStageMode(lines);
    expect(html).toContain('data-pause="3"');
  });

  it('mehrzeilige Eingabe wird mit stage-line formatiert', () => {
    const lines: PerformanceLine[] = [
      { text: 'Eins' },
      { text: 'Zwei' },
    ];
    const html = formatStageMode(lines);
    const stageLines = html.match(/stage-line/g);
    expect(stageLines?.length).toBe(2);
  });

  it('undefinierte Eingabe ergibt leeren String', () => {
    expect(formatStageMode(null as unknown as PerformanceLine[])).toBe('');
    expect(formatStageMode(undefined as unknown as PerformanceLine[])).toBe('');
  });
});
