/**
 * Tests: Cover-Embellishment-Service (WP 33.1)
 */

import { describe, it, expect } from 'vitest';
import {
  generateFoilMask,
  generateSpotUvMask,
  calculateEdgeColoring,
  type CoverDesign,
} from './coverEmbellishment';

describe('generateFoilMask', () => {
  it('leeres Design ergibt leere Maske', () => {
    const result = generateFoilMask({ title: '', author: '', width: 0, height: 0, elements: [] });
    expect(result.elements).toEqual([]);
  });

  it('null/undefined ergibt leere Maske', () => {
    expect(generateFoilMask(null as unknown as CoverDesign).elements).toEqual([]);
    expect(generateFoilMask(undefined as unknown as CoverDesign).elements).toEqual([]);
  });

  it('generiert Foil-Maske mit CMYK', () => {
    const design: CoverDesign = {
      title: 'Test',
      author: 'Autor',
      width: 200,
      height: 300,
      elements: [{ id: '1', type: 'text', x: 0, y: 0, width: 100, height: 20, content: 'Titel' }],
    };
    const result = generateFoilMask(design);
    expect(result.colorSpace).toBe('CMYK');
    expect(result.inkPercentage).toBe(100);
  });

  it('Elemente werden übernommen', () => {
    const design: CoverDesign = {
      title: 'Test',
      author: 'Autor',
      width: 200,
      height: 300,
      elements: [{ id: '1', type: 'text', x: 0, y: 0, width: 100, height: 20, content: 'Titel' }],
    };
    const result = generateFoilMask(design);
    expect(result.elements.length).toBe(1);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(generateFoilMask(null as unknown as CoverDesign).elements).toEqual([]);
  });
});

describe('generateSpotUvMask', () => {
  it('leeres Design ergibt leere Maske', () => {
    const result = generateSpotUvMask({ title: '', author: '', width: 0, height: 0, elements: [] });
    expect(result.elements).toEqual([]);
  });

  it('null/undefined ergibt leere Maske', () => {
    expect(generateSpotUvMask(null as unknown as CoverDesign).elements).toEqual([]);
    expect(generateSpotUvMask(undefined as unknown as CoverDesign).elements).toEqual([]);
  });

  it('generiert Spot-UV-Maske mit Gloss-Level', () => {
    const design: CoverDesign = {
      title: 'Test',
      author: 'Autor',
      width: 200,
      height: 300,
      elements: [{ id: '1', type: 'shape', x: 0, y: 0, width: 50, height: 50 }],
    };
    const result = generateSpotUvMask(design);
    expect(result.glossLevel).toBe(80);
  });

  it('Elemente werden übernommen', () => {
    const design: CoverDesign = {
      title: 'Test',
      author: 'Autor',
      width: 200,
      height: 300,
      elements: [{ id: '1', type: 'shape', x: 0, y: 0, width: 50, height: 50 }],
    };
    const result = generateSpotUvMask(design);
    expect(result.elements.length).toBe(1);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(generateSpotUvMask(null as unknown as CoverDesign).elements).toEqual([]);
  });
});

describe('calculateEdgeColoring', () => {
  it('0 Seiten ergibt leeres Muster', () => {
    const result = calculateEdgeColoring(0, '#ff0000');
    expect(result.pattern).toEqual([]);
  });

  it('null/undefined ergibt leeres Muster', () => {
    expect(calculateEdgeColoring(null as unknown as number, '#ff0000').pattern).toEqual([]);
    expect(calculateEdgeColoring(undefined as unknown as number, '#ff0000').pattern).toEqual([]);
  });

  it('berechnet Muster für 100 Seiten', () => {
    const result = calculateEdgeColoring(100, '#ff0000');
    expect(result.pattern.length).toBe(100);
  });

  it('Farbe wird übernommen', () => {
    const result = calculateEdgeColoring(10, '#ff0000');
    expect(result.color).toBe('#ff0000');
  });

  it('leere Farbe wird zu Schwarz', () => {
    const result = calculateEdgeColoring(10, '');
    expect(result.color).toBe('#000000');
  });

  it('pageCount wird zurückgegeben', () => {
    const result = calculateEdgeColoring(50, '#00ff00');
    expect(result.pageCount).toBe(50);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(calculateEdgeColoring(null as unknown as number, '#ff0000').pattern).toEqual([]);
  });
});
