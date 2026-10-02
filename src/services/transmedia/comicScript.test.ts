/**
 * Tests: Comic-Skript-Service (WP 26.1)
 */

import { describe, it, expect } from 'vitest';
import {
  parseComicScript,
  syncFranchiseFact,
  exportToStandardScript,
  type ComicPanel,
} from './comicScript';

describe('parseComicScript', () => {
  it('leerer String ergibt leeres Array', () => {
    expect(parseComicScript('')).toEqual([]);
  });

  it('null/undefined ergibt leeres Array', () => {
    expect(parseComicScript(null as unknown as string)).toEqual([]);
    expect(parseComicScript(undefined as unknown as string)).toEqual([]);
  });

  it('erkennt einfachen Dialog', () => {
    const text = 'Anna: Hallo Welt';
    const panels = parseComicScript(text);
    expect(panels.length).toBeGreaterThan(0);
    expect(panels[0].dialogue.length).toBe(1);
    expect(panels[0].dialogue[0].character).toBe('Anna');
    expect(panels[0].dialogue[0].text).toBe('Hallo Welt');
  });

  it('erkennt Sprechblasen-Typ', () => {
    const text = 'Bert: Wie geht es?';
    const panels = parseComicScript(text);
    expect(panels[0].dialogue[0].type).toBe('dialogue');
  });

  it('erkennt Gedankenblasen', () => {
    const text = 'Gedanke: Was mach ich hier?';
    const panels = parseComicScript(text);
    expect(panels[0].dialogue[0].type).toBe('thought');
    expect(panels[0].dialogue[0].text).toBe('Was mach ich hier?');
  });

  it('erkennt Schrei', () => {
    const text = 'Klaus schreit: Halt sofort!';
    const panels = parseComicScript(text);
    expect(panels[0].dialogue[0].type).toBe('shout');
    expect(panels[0].dialogue[0].character).toBe('Klaus');
  });

  it('erkennt SFX (Onomatopoesie)', () => {
    const text = 'KRAKK — die Tür fliegt auf';
    const panels = parseComicScript(text);
    expect(panels[0].sfx).toContain('KRAKK');
  });

  it('erkennt Panel-Header', () => {
    const text = 'Panel 1: Der Held betritt die Halle';
    const panels = parseComicScript(text);
    expect(panels[0].panelNumber).toBe(1);
    expect(panels[0].description).toContain('Der Held');
  });

  it('erkennt Seitenumbruch', () => {
    const text = 'Anna: Hallo\n--- Seite 2 ---\nBert: Hi';
    const panels = parseComicScript(text);
    expect(panels.length).toBeGreaterThanOrEqual(2);
  });

  it('erkennt mehrere Panels mit Nummern', () => {
    const text = '1/1: Erste Szene\nAnna: Hallo\n1/2: Zweite Szene\nBert: Hi';
    const panels = parseComicScript(text);
    expect(panels.length).toBeGreaterThanOrEqual(2);
  });

  it('mehrere Dialoge in einem Panel', () => {
    const text = 'Panel 1: Szene\nAnna: Hallo\nBert: Hi';
    const panels = parseComicScript(text);
    expect(panels[0].dialogue.length).toBe(2);
  });

  it('ungültige Eingaben werden behandelt', () => {
    expect(parseComicScript(123 as unknown as string)).toEqual([]);
  });

  it('Panels haben eindeutige IDs', () => {
    const text = 'Anna: Hallo\nBert: Hi';
    const panels = parseComicScript(text);
    const ids = panels.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('syncFranchiseFact', () => {
  it('synchronisiert eine Figur-Eigenschaft', () => {
    const result = syncFranchiseFact('Anna', 'Augenfarbe', 'blau');
    expect(result.character).toBe('Anna');
    expect(result.fact).toBe('Augenfarbe');
    expect(result.newValue).toBe('blau');
  });

  it('leerer Name wird zu Unbekannt', () => {
    const result = syncFranchiseFact('', 'Waffe', 'Schwert');
    expect(result.character).toBe('Unbekannt');
  });

  it('betroffene Medien werden aufgelistet', () => {
    const result = syncFranchiseFact('Bert', 'Waffe', 'Schwert');
    expect(result.affectedMedia).toContain('comic');
    expect(result.affectedMedia).toContain('novel');
  });
});

describe('exportToStandardScript', () => {
  it('leere Panels ergibt leeren String', () => {
    expect(exportToStandardScript([])).toBe('');
  });

  it('exportiert Panels als formatierten Text', () => {
    const panels: ComicPanel[] = [
      {
        id: 'p1',
        pageNumber: 1,
        panelNumber: 1,
        description: 'Der Held betritt die Halle',
        dialogue: [{ type: 'dialogue', character: 'Anna', text: 'Hallo' }],
        sfx: ['KRAKK'],
      },
    ];
    const output = exportToStandardScript(panels);
    expect(output).toContain('STANDARD COMIC SCRIPT');
    expect(output).toContain('SEITE 1, PANEL 1');
    expect(output).toContain('Anna: Hallo');
    expect(output).toContain('KRAKK');
  });

  it('mehrere Panels werden exportiert', () => {
    const panels: ComicPanel[] = [
      { id: 'p1', pageNumber: 1, panelNumber: 1, description: 'A', dialogue: [], sfx: [] },
      { id: 'p2', pageNumber: 1, panelNumber: 2, description: 'B', dialogue: [], sfx: [] },
    ];
    const output = exportToStandardScript(panels);
    expect(output).toContain('PANEL 1');
    expect(output).toContain('PANEL 2');
  });

  it('undefinierte Eingabe ergibt leeren String', () => {
    expect(exportToStandardScript(null as unknown as ComicPanel[])).toBe('');
    expect(exportToStandardScript(undefined as unknown as ComicPanel[])).toBe('');
  });
});
