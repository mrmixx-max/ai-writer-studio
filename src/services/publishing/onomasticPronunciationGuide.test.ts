// @vitest-environment jsdom
/**
 * Tests: Onomastischer Lautschrift-Leitfaden (Meilenstein 64.0 / v7.6.0)
 *
 * Deckt ab:
 *   - hashString (FNV-1a, unsigned 32-bit, Determinismus)
 *   - createSeededRandom (mulberry32, [0, 1))
 *   - extractProperNames (Eigennamen-Extraktion + Kategorisierung)
 *   - generatePronunciation (IPA, einfache Lautschrift, Silben, Hinweise)
 *   - buildPronunciationGuide (Leitfaden-Aufbau)
 *   - exportGlossaryAppendix (druckfertiger Anhang + SVG-Vorschau)
 *   - createSamplePronunciationGuide / createSampleAppendix
 */

import { describe, it, expect } from 'vitest';
import {
  hashString,
  createSeededRandom,
  extractProperNames,
  generatePronunciation,
  buildPronunciationGuide,
  exportGlossaryAppendix,
  createSamplePronunciationGuide,
  createSampleAppendix,
  type ProperNamesResult,
  type PronunciationEntry,
  type GlossaryAppendix,
} from './onomasticPronunciationGuide';

// ---------------------------------------------------------------------------
// Gemeinsame Testdaten
// ---------------------------------------------------------------------------

const FANTASY_NAMES: string[] = [
  'Kailen', 'Aurelia', 'Mordred', 'Elowen', 'Tharion',
  'Ysolda', 'Balthasar', 'Grimward', 'Nordhafen', 'Zephyria',
];

const MANY_CAPITALISED =
  'Kailen traf Aurelia. Mordred, Elowen und Tharion berieten mit ' +
  'Ysolda und Balthasar in Grimward, während Nordhafen und Zephyria ' +
  'am Horizont lagen.';

const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}/;

// ---------------------------------------------------------------------------
// hashString
// ---------------------------------------------------------------------------

describe('hashString', () => {
  it('liefert eine Zahl', () => {
    expect(typeof hashString('Kailen')).toBe('number');
  });

  it('ist deterministisch für gleiche Eingabe', () => {
    expect(hashString('Aurelia')).toBe(hashString('Aurelia'));
  });

  it('ist auch nach vielen Wiederholungen stabil', () => {
    const first = hashString('Mordred');
    for (let i = 0; i < 25; i++) {
      expect(hashString('Mordred')).toBe(first);
    }
  });

  it('liefert immer ganze Zahlen', () => {
    for (const s of FANTASY_NAMES) {
      expect(Number.isInteger(hashString(s))).toBe(true);
    }
  });

  it('liefert nie negative Werte (unsigned)', () => {
    for (const s of FANTASY_NAMES) {
      expect(hashString(s)).toBeGreaterThanOrEqual(0);
    }
  });

  it('bleibt im 32-Bit-Bereich (<= 0xFFFFFFFF)', () => {
    for (const s of FANTASY_NAMES) {
      expect(hashString(s)).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('leerer String ergibt den FNV-Offset-Basiswert', () => {
    expect(hashString('')).toBe(2166136261);
  });

  it('Hash für „a“ entspricht dem FNV-1a-Referenzwert', () => {
    expect(hashString('a')).toBe(3826002220);
  });

  it('Hash für „A“ entspricht dem FNV-1a-Referenzwert', () => {
    expect(hashString('A')).toBe(3289118412);
  });

  it('Hash für „Kailen“ entspricht dem Referenzwert', () => {
    expect(hashString('Kailen')).toBe(1054182367);
  });

  it('Hash für „Aurelia“ entspricht dem Referenzwert', () => {
    expect(hashString('Aurelia')).toBe(1344033088);
  });

  it('Hash für „abcdef“ entspricht dem Referenzwert', () => {
    expect(hashString('abcdef')).toBe(4282878506);
  });

  it('Hash für „Ähre“ (Umlaut) entspricht dem Referenzwert', () => {
    expect(hashString('Ähre')).toBe(116040228);
  });

  it('unterscheidet Groß- und Kleinschreibung', () => {
    expect(hashString('Kailen')).not.toBe(hashString('kailen'));
  });

  it('unterscheidet einzelne Buchstaben a und A', () => {
    expect(hashString('a')).not.toBe(hashString('A'));
  });

  it('unterscheidet Umlaute von ihren Grundvokalen', () => {
    expect(hashString('ä')).not.toBe(hashString('a'));
    expect(hashString('ö')).not.toBe(hashString('o'));
    expect(hashString('ü')).not.toBe(hashString('u'));
  });

  it('ist reihenfolgeabhängig („ab“ ≠ „ba“)', () => {
    expect(hashString('ab')).not.toBe(hashString('ba'));
  });

  it('ist leerzeichenabhängig („a b“ ≠ „ab“)', () => {
    expect(hashString('a b')).not.toBe(hashString('ab'));
  });

  it('liefert für 100 verschiedene Strings 100 verschiedene Hashes', () => {
    const values = new Set<number>();
    for (let i = 0; i < 100; i++) {
      values.add(hashString(`Eigenname-${i}`));
    }
    expect(values.size).toBe(100);
  });

  it('verarbeitet sehr lange Eingaben ohne Absturz', () => {
    const long = 'Aurelia'.repeat(500);
    expect(Number.isInteger(hashString(long))).toBe(true);
  });

  it('verarbeitet reine Sonderzeichenketten', () => {
    expect(Number.isInteger(hashString('---...???'))).toBe(true);
  });

  it('verarbeitet gemischte Unicode-Zeichen', () => {
    expect(Number.isInteger(hashString('Zephyria—Nordhafen⛰'))).toBe(true);
  });

  it('unterscheidet Strings mit angehängtem Leerzeichen', () => {
    expect(hashString('Kailen')).not.toBe(hashString('Kailen '));
  });
});

// ---------------------------------------------------------------------------
// createSeededRandom
// ---------------------------------------------------------------------------

describe('createSeededRandom', () => {
  it('liefert eine Funktion', () => {
    expect(typeof createSeededRandom(1)).toBe('function');
  });

  it('liefert Zahlen', () => {
    const rng = createSeededRandom(1);
    expect(typeof rng()).toBe('number');
  });

  it('Seed 42 liefert die erwarteten ersten drei Werte', () => {
    const rng = createSeededRandom(42);
    expect(rng()).toBeCloseTo(0.6011037519201636, 12);
    expect(rng()).toBeCloseTo(0.44829055899754167, 12);
    expect(rng()).toBeCloseTo(0.8524657934904099, 12);
  });

  it('Seed 0 liefert die erwarteten ersten zwei Werte', () => {
    const rng = createSeededRandom(0);
    expect(rng()).toBeCloseTo(0.26642920868471265, 12);
    expect(rng()).toBeCloseTo(0.0003297457005828619, 12);
  });

  it('gleicher Seed → identische Sequenz', () => {
    const a = createSeededRandom(7);
    const b = createSeededRandom(7);
    for (let i = 0; i < 50; i++) {
      expect(a()).toBe(b());
    }
  });

  it('500 Ziehungen liegen im Intervall [0, 1)', () => {
    const rng = createSeededRandom(12345);
    for (let i = 0; i < 500; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('500 Ziehungen sind niemals negativ', () => {
    const rng = createSeededRandom(999);
    for (let i = 0; i < 500; i++) {
      expect(rng()).toBeGreaterThanOrEqual(0);
    }
  });

  it('500 Ziehungen erreichen niemals 1', () => {
    const rng = createSeededRandom(4242);
    for (let i = 0; i < 500; i++) {
      expect(rng()).toBeLessThan(1);
    }
  });

  it('500 Ziehungen sind alle endlich (kein NaN/Infinity)', () => {
    const rng = createSeededRandom(314159);
    for (let i = 0; i < 500; i++) {
      expect(Number.isFinite(rng())).toBe(true);
    }
  });

  it('die 500 Ziehungen sind exakt reproduzierbar', () => {
    const a = createSeededRandom(2024);
    const b = createSeededRandom(2024);
    for (let i = 0; i < 500; i++) {
      expect(a()).toBe(b());
    }
  });

  it('unterschiedliche Seeds liefern unterschiedliche Werte', () => {
    expect(createSeededRandom(1)()).not.toBe(createSeededRandom(2)());
  });

  it('zwei Instanzen mit gleichem Seed haben getrennten Zustand', () => {
    const a = createSeededRandom(5);
    const b = createSeededRandom(5);
    const aFirst = a();
    b(); b(); b();
    // a ist unbeeinflusst vom Verbrauch in b
    const aSecond = a();
    const fresh = createSeededRandom(5);
    expect(fresh()).toBe(aFirst);
    expect(fresh()).toBe(aSecond);
  });

  it('aufeinanderfolgende Werte unterscheiden sich', () => {
    const rng = createSeededRandom(88);
    const first = rng();
    const second = rng();
    expect(first).not.toBe(second);
  });

  it('verarbeitet Seed 0 ohne Sonderfall', () => {
    const rng = createSeededRandom(0);
    expect(Number.isFinite(rng())).toBe(true);
  });

  it('verarbeitet einen sehr großen Seed', () => {
    const rng = createSeededRandom(0xffffffff);
    expect(rng()).toBeGreaterThanOrEqual(0);
    expect(rng()).toBeLessThan(1);
  });

  it('verarbeitet einen negativen Seed (via >>> 0)', () => {
    const rng = createSeededRandom(-1);
    expect(rng()).toBeGreaterThanOrEqual(0);
    expect(rng()).toBeLessThan(1);
  });

  it('negativer Seed entspricht dem entsprechenden unsigned Seed', () => {
    const a = createSeededRandom(-1);
    const b = createSeededRandom(0xffffffff);
    expect(a()).toBe(b());
  });

  it('Mittelwert über 500 Ziehungen liegt grob bei 0,5', () => {
    const rng = createSeededRandom(2718);
    let sum = 0;
    for (let i = 0; i < 500; i++) sum += rng();
    const mean = sum / 500;
    expect(mean).toBeGreaterThan(0.3);
    expect(mean).toBeLessThan(0.7);
  });

  it('erzeugt nicht nur identische Werte über 500 Ziehungen', () => {
    const rng = createSeededRandom(13);
    const set = new Set<number>();
    for (let i = 0; i < 500; i++) set.add(rng());
    expect(set.size).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// extractProperNames
// ---------------------------------------------------------------------------

describe('extractProperNames', () => {
  it('leerer String ergibt leeres Ergebnis', () => {
    const r = extractProperNames('');
    expect(r.names).toEqual([]);
    expect(r.count).toBe(0);
  });

  it('reiner Leerraum ergibt leeres Ergebnis', () => {
    const r = extractProperNames('   \n\t  ');
    expect(r.count).toBe(0);
  });

  it('null ergibt leeres Ergebnis ohne Ausnahme', () => {
    const r = extractProperNames(null as unknown as string);
    expect(r.count).toBe(0);
  });

  it('undefined ergibt leeres Ergebnis ohne Ausnahme', () => {
    const r = extractProperNames(undefined as unknown as string);
    expect(r.count).toBe(0);
  });

  it('Zahl als Eingabe ergibt leeres Ergebnis ohne Ausnahme', () => {
    const r = extractProperNames(42 as unknown as string);
    expect(r.count).toBe(0);
  });

  it('leeres Ergebnis hat die drei byType-Arrays', () => {
    const r = extractProperNames('');
    expect(Array.isArray(r.byType.characters)).toBe(true);
    expect(Array.isArray(r.byType.places)).toBe(true);
    expect(Array.isArray(r.byType.artifacts)).toBe(true);
  });

  it('liefert ein names-Array', () => {
    expect(Array.isArray(extractProperNames('Kailen').names)).toBe(true);
  });

  it('count entspricht stets names.length', () => {
    for (const text of [MANY_CAPITALISED, 'Kailen', '', 'Der Held Anna kämpfte.']) {
      const r = extractProperNames(text);
      expect(r.count).toBe(r.names.length);
    }
  });

  it('erkennt mehrere Eigennamen', () => {
    const r = extractProperNames('Kailen reiste nach Aurelia. Mordred wartete in Tharion.');
    expect(r.names).toContain('Kailen');
    expect(r.names).toContain('Aurelia');
    expect(r.names).toContain('Mordred');
    expect(r.names).toContain('Tharion');
  });

  it('behält die Reihenfolge des ersten Auftretens', () => {
    const r = extractProperNames('Zephyria und Kailen und Mordred');
    const iZeph = r.names.indexOf('Zephyria');
    const iKai = r.names.indexOf('Kailen');
    const iMor = r.names.indexOf('Mordred');
    expect(iZeph).toBeLessThan(iKai);
    expect(iKai).toBeLessThan(iMor);
  });

  it('dedupliziert mehrfach genannte Namen', () => {
    const r = extractProperNames('Kailen sah Kailen und nochmals Kailen.');
    expect(r.names.filter((n) => n === 'Kailen')).toHaveLength(1);
  });

  it('count zählt deduplizierte Namen', () => {
    const r = extractProperNames('Aurelia Aurelia Aurelia');
    expect(r.count).toBe(1);
  });

  it('verwirft großgeschriebene Funktionswörter (Der)', () => {
    const r = extractProperNames('Der Kailen ging.');
    expect(r.names).not.toContain('Der');
  });

  it('verwirft großgeschriebenes „Und“ am Satzanfang', () => {
    const r = extractProperNames('Und Kailen kam.');
    expect(r.names).not.toContain('Und');
  });

  it('verwirft großgeschriebenes „Die“', () => {
    const r = extractProperNames('Die Aurelia war da.');
    expect(r.names).not.toContain('Die');
  });

  it('verwirft Einzelbuchstaben (Länge < 2)', () => {
    const r = extractProperNames('A B C D');
    expect(r.count).toBe(0);
  });

  it('Text ohne großgeschriebene Wörter ergibt leeres Ergebnis', () => {
    const r = extractProperNames('alles klein geschrieben und ohne namen');
    expect(r.count).toBe(0);
  });

  it('ordnet Standardnamen als Charakter ein', () => {
    const r = extractProperNames('Kailen und Aurelia');
    expect(r.byType.characters).toContain('Kailen');
    expect(r.byType.characters).toContain('Aurelia');
  });

  it('ordnet Namen nach Ortsmarker als Ort ein', () => {
    const r = extractProperNames('Die Stadt Rabenau lag weit.');
    expect(r.byType.places).toContain('Rabenau');
  });

  it('ordnet Namen nach Orts-Suffix („-hafen“) als Ort ein', () => {
    const r = extractProperNames('Er kam aus Nordhafen.');
    expect(r.byType.places).toContain('Nordhafen');
  });

  it('ordnet Namen nach Orts-Suffix („-burg“) als Ort ein', () => {
    const r = extractProperNames('Falkenburg war alt.');
    expect(r.byType.places).toContain('Falkenburg');
  });

  it('ordnet Namen nach Orts-Suffix („-ingen“) als Ort ein', () => {
    const r = extractProperNames('Sie lebten in Elbingen.');
    expect(r.byType.places).toContain('Elbingen');
  });

  it('ordnet Namen nach Artefaktmarker als Artefakt ein', () => {
    const r = extractProperNames('Er trug das Schwert Excalibur.');
    expect(r.byType.artifacts).toContain('Excalibur');
  });

  it('ordnet Namen nach Artefakt-Suffix („-klinge“) als Artefakt ein', () => {
    const r = extractProperNames('Die Frostklinge lag dort.');
    expect(r.byType.artifacts).toContain('Frostklinge');
  });

  it('ordnet Namen nach Charaktertitel als Charakter ein', () => {
    const r = extractProperNames('König Balthasar sprach.');
    expect(r.byType.characters).toContain('Balthasar');
  });

  it('erkennt umlaut­haltige Namen (Ölberg)', () => {
    const r = extractProperNames('Ölberg war hoch.');
    expect(r.names).toContain('Ölberg');
  });

  it('ordnet Ölberg über das Suffix „-berg“ als Ort ein', () => {
    const r = extractProperNames('Ölberg war hoch.');
    expect(r.byType.places).toContain('Ölberg');
  });

  it('erkennt Umlaut-Namen Überwald als Ort', () => {
    const r = extractProperNames('Überwald war alt.');
    expect(r.byType.places).toContain('Überwald');
  });

  it('erkennt Namen mit Bindestrich', () => {
    const r = extractProperNames('Anna-Marie lachte.');
    expect(r.names).toContain('Anna-Marie');
  });

  it('erkennt Namen mit Apostroph', () => {
    const r = extractProperNames("O'Neil kam an.");
    expect(r.names).toContain("O'Neil");
  });

  it('erkennt Namen mit typografischem Apostroph', () => {
    const r = extractProperNames('D’Angelo kam an.');
    expect(r.names).toContain('D’Angelo');
  });

  it('kategorisiert Namen mit Umlaut-Standardfall als Charakter', () => {
    const r = extractProperNames('Zürich war schön.');
    expect(r.byType.characters).toContain('Zürich');
  });

  it('die byType-Arrays partitionieren die Namen vollständig', () => {
    const r = extractProperNames(MANY_CAPITALISED);
    const sum =
      r.byType.characters.length + r.byType.places.length + r.byType.artifacts.length;
    expect(sum).toBe(r.count);
  });

  it('jeder Name erscheint in genau einem byType-Array', () => {
    const r = extractProperNames(MANY_CAPITALISED);
    for (const name of r.names) {
      const inChar = r.byType.characters.includes(name);
      const inPlace = r.byType.places.includes(name);
      const inArt = r.byType.artifacts.includes(name);
      const occurrences = [inChar, inPlace, inArt].filter(Boolean).length;
      expect(occurrences).toBe(1);
    }
  });

  it('erkennt viele großgeschriebene Namen in einem Text', () => {
    const r = extractProperNames(MANY_CAPITALISED);
    expect(r.count).toBeGreaterThanOrEqual(8);
  });

  it('alle erkannten Namen haben mindestens zwei Zeichen', () => {
    const r = extractProperNames(MANY_CAPITALISED);
    for (const n of r.names) {
      expect(n.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('alle erkannten Namen beginnen mit einem Großbuchstaben', () => {
    const r = extractProperNames(MANY_CAPITALISED);
    for (const n of r.names) {
      expect(/^[A-ZÄÖÜ]/.test(n)).toBe(true);
    }
  });

  it('ist deterministisch für den gleichen Text', () => {
    const a = extractProperNames(MANY_CAPITALISED);
    const b = extractProperNames(MANY_CAPITALISED);
    expect(a).toEqual(b);
  });

  it('Satzzeichen trennen Namen korrekt', () => {
    const r = extractProperNames('Kailen, Aurelia; Mordred: Elowen!');
    expect(r.names).toContain('Kailen');
    expect(r.names).toContain('Aurelia');
    expect(r.names).toContain('Mordred');
    expect(r.names).toContain('Elowen');
  });

  it('liefert ein zum Interface passendes Ergebnisobjekt', () => {
    const r: ProperNamesResult = extractProperNames('Kailen');
    expect(Object.keys(r).sort()).toEqual(['byType', 'count', 'names']);
  });

  it('verarbeitet sehr langen Text stabil', () => {
    const long = `${MANY_CAPITALISED} `.repeat(50);
    const r = extractProperNames(long);
    expect(r.count).toBe(r.names.length);
    expect(r.count).toBeGreaterThan(0);
  });

  it('einzelnes Wort als Text wird erkannt', () => {
    const r = extractProperNames('Kailen');
    expect(r.names).toEqual(['Kailen']);
    expect(r.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// generatePronunciation
// ---------------------------------------------------------------------------

describe('generatePronunciation', () => {
  it('gibt den Namen unverändert zurück', () => {
    expect(generatePronunciation('Kailen', 42).name).toBe('Kailen');
  });

  it('trimmt umgebenden Leerraum im Namen', () => {
    expect(generatePronunciation('  Kailen  ', 1).name).toBe('Kailen');
  });

  it('leerer Name wird zu „Unbenannt“', () => {
    expect(generatePronunciation('', 1).name).toBe('Unbenannt');
  });

  it('reiner Leerraum wird zu „Unbenannt“', () => {
    expect(generatePronunciation('   ', 1).name).toBe('Unbenannt');
  });

  it('null als Name wird zu „Unbenannt“ ohne Ausnahme', () => {
    expect(generatePronunciation(null as unknown as string, 1).name).toBe('Unbenannt');
  });

  it('IPA beginnt mit einer öffnenden eckigen Klammer', () => {
    for (const n of FANTASY_NAMES) {
      expect(generatePronunciation(n, 3).ipa.startsWith('[')).toBe(true);
    }
  });

  it('IPA endet mit einer schließenden eckigen Klammer', () => {
    for (const n of FANTASY_NAMES) {
      expect(generatePronunciation(n, 3).ipa.endsWith(']')).toBe(true);
    }
  });

  it('IPA ist nicht leer (abzüglich Klammern)', () => {
    const entry = generatePronunciation('Kailen', 5);
    expect(entry.ipa.length).toBeGreaterThan(2);
  });

  it('IPA enthält das Betonungszeichen ˈ', () => {
    const entry = generatePronunciation('Aurelia', 7);
    expect(entry.ipa).toContain('ˈ');
  });

  it('einfache Lautschrift ist nicht leer', () => {
    for (const n of FANTASY_NAMES) {
      expect(generatePronunciation(n, 2).simple.length).toBeGreaterThan(0);
    }
  });

  it('einfache Lautschrift nennt die Betonung', () => {
    const entry = generatePronunciation('Kailen', 9);
    expect(entry.simple).toContain('Betonung');
  });

  it('stressIndex ist eine Zahl', () => {
    expect(typeof generatePronunciation('Kailen', 4).stressIndex).toBe('number');
  });

  it('stressIndex ist nicht negativ', () => {
    for (const n of FANTASY_NAMES) {
      expect(generatePronunciation(n, 6).stressIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('stressIndex liegt innerhalb der Silbenzahl', () => {
    for (const n of FANTASY_NAMES) {
      const entry = generatePronunciation(n, 11);
      expect(entry.stressIndex).toBeLessThan(entry.syllables.length);
    }
  });

  it('syllables ist ein nicht-leeres Array', () => {
    for (const n of FANTASY_NAMES) {
      const entry = generatePronunciation(n, 8);
      expect(Array.isArray(entry.syllables)).toBe(true);
      expect(entry.syllables.length).toBeGreaterThan(0);
    }
  });

  it('notes ist nicht leer', () => {
    for (const n of FANTASY_NAMES) {
      expect(generatePronunciation(n, 10).notes.length).toBeGreaterThan(0);
    }
  });

  it('notes nennt die Silbenanzahl', () => {
    const entry = generatePronunciation('Aurelia', 12);
    expect(entry.notes).toContain(String(entry.syllables.length));
  });

  it('notes enthält das Wort „Silbe“', () => {
    const entry = generatePronunciation('Kailen', 13);
    expect(entry.notes).toContain('Silbe');
  });

  it('ist deterministisch für gleichen Namen und Seed', () => {
    expect(generatePronunciation('Mordred', 42)).toEqual(generatePronunciation('Mordred', 42));
  });

  it('gleicher Name, unterschiedlicher Seed → jeweils deterministisch', () => {
    const a = generatePronunciation('Elowen', 1);
    const b = generatePronunciation('Elowen', 2);
    expect(generatePronunciation('Elowen', 1)).toEqual(a);
    expect(generatePronunciation('Elowen', 2)).toEqual(b);
  });

  it('unterschiedliche Namen liefern unterschiedliche IPA', () => {
    expect(generatePronunciation('Kailen', 1).ipa).not.toBe(
      generatePronunciation('Mordred', 1).ipa
    );
  });

  it('Einzelbuchstabe „A“ wird verarbeitet', () => {
    const entry = generatePronunciation('A', 1);
    expect(entry.name).toBe('A');
    expect(entry.syllables.length).toBeGreaterThan(0);
    expect(entry.ipa.startsWith('[')).toBe(true);
  });

  it('Einzelbuchstabe hat stressIndex 0', () => {
    expect(generatePronunciation('A', 99).stressIndex).toBe(0);
  });

  it('zweibuchstabiger Name wird verarbeitet', () => {
    const entry = generatePronunciation('Bo', 1);
    expect(entry.syllables.length).toBeGreaterThan(0);
    expect(entry.simple.length).toBeGreaterThan(0);
  });

  it('sehr langer Name wird verarbeitet', () => {
    const long = 'Aurelia'.repeat(15);
    const entry = generatePronunciation(long, 1);
    expect(entry.name).toBe(long);
    expect(entry.syllables.length).toBeGreaterThan(0);
  });

  it('Name mit Umlauten ä/ö/ü wird verarbeitet', () => {
    const entry = generatePronunciation('Mähüö', 1);
    expect(entry.ipa.startsWith('[')).toBe(true);
    expect(entry.ipa.endsWith(']')).toBe(true);
  });

  it('Name mit Bindestrich wird verarbeitet', () => {
    const entry = generatePronunciation('Anna-Marie', 1);
    expect(entry.name).toBe('Anna-Marie');
    expect(entry.syllables.length).toBeGreaterThan(0);
  });

  it('Name mit Apostroph wird verarbeitet', () => {
    const entry = generatePronunciation("O'Neil", 1);
    expect(entry.name).toBe("O'Neil");
    expect(entry.notes.length).toBeGreaterThan(0);
  });

  it('Name ohne Vokale wird als eine Silbe behandelt', () => {
    const entry = generatePronunciation('Krkk', 1);
    expect(entry.syllables).toEqual(['Krkk']);
  });

  it('Name mit Ziffern wird verarbeitet', () => {
    const entry = generatePronunciation('Kailen2', 1);
    expect(entry.ipa.startsWith('[')).toBe(true);
  });

  it('alle 10 Fantasynamen liefern gültige Einträge', () => {
    for (const n of FANTASY_NAMES) {
      const entry: PronunciationEntry = generatePronunciation(n, 17);
      expect(entry.name).toBe(n);
      expect(entry.ipa.startsWith('[')).toBe(true);
      expect(entry.ipa.endsWith(']')).toBe(true);
      expect(entry.simple.length).toBeGreaterThan(0);
      expect(typeof entry.stressIndex).toBe('number');
      expect(entry.syllables.length).toBeGreaterThan(0);
      expect(entry.notes.length).toBeGreaterThan(0);
    }
  });

  it('für 30 Seeds bleibt stressIndex stets im gültigen Bereich', () => {
    for (let seed = 0; seed < 30; seed++) {
      const entry = generatePronunciation('Balthasar', seed);
      expect(entry.stressIndex).toBeGreaterThanOrEqual(0);
      expect(entry.stressIndex).toBeLessThan(entry.syllables.length);
    }
  });

  it('die Betonung markiert genau eine Silbe (Großschreibung)', () => {
    const entry = generatePronunciation('Aurelia', 21);
    const stressed = entry.syllables[entry.stressIndex];
    expect(entry.simple.toUpperCase()).toContain(stressed.toUpperCase());
  });

  it('mehrsilbige einfache Lautschrift nutzt Bindestriche', () => {
    const entry = generatePronunciation('Aurelia', 3);
    if (entry.syllables.length > 1) {
      expect(entry.simple).toContain('-');
    }
  });

  it('einsilbige einfache Lautschrift enthält keinen Bindestrich vor der Klammer', () => {
    const entry = generatePronunciation('Krkk', 1);
    expect(entry.simple.split(' (')[0]).not.toContain('-');
  });

  it('IPA enthält keine ASCII-Anführungszeichen', () => {
    const entry = generatePronunciation('Kailen', 1);
    expect(entry.ipa).not.toContain('"');
  });

  it('seed 0 wird verarbeitet', () => {
    expect(generatePronunciation('Tharion', 0).name).toBe('Tharion');
  });

  it('negativer Seed wird verarbeitet', () => {
    const entry = generatePronunciation('Tharion', -5);
    expect(entry.stressIndex).toBeGreaterThanOrEqual(0);
  });

  it('sehr großer Seed wird verarbeitet', () => {
    const entry = generatePronunciation('Tharion', 0xffffffff);
    expect(entry.syllables.length).toBeGreaterThan(0);
  });

  it('Silben setzen sich zum Originalnamen zusammen', () => {
    const entry = generatePronunciation('Kailen', 1);
    expect(entry.syllables.join('')).toBe('Kailen');
  });

  it('Silben eines Umlaut-Namens ergeben den Namen', () => {
    const entry = generatePronunciation('Mähüö', 1);
    expect(entry.syllables.join('')).toBe('Mähüö');
  });

  it('Interface-Felder sind vollständig vorhanden', () => {
    const entry = generatePronunciation('Ysolda', 1);
    expect(Object.keys(entry).sort()).toEqual(
      ['ipa', 'name', 'notes', 'simple', 'stressIndex', 'syllables'].sort()
    );
  });
});

// ---------------------------------------------------------------------------
// buildPronunciationGuide
// ---------------------------------------------------------------------------

describe('buildPronunciationGuide', () => {
  it('entries-Länge entspricht der Eingabeliste', () => {
    expect(buildPronunciationGuide(FANTASY_NAMES, 42).entries).toHaveLength(FANTASY_NAMES.length);
  });

  it('count entspricht der Eingabeliste', () => {
    expect(buildPronunciationGuide(FANTASY_NAMES, 42).count).toBe(FANTASY_NAMES.length);
  });

  it('count entspricht entries.length', () => {
    const guide = buildPronunciationGuide(FANTASY_NAMES, 42);
    expect(guide.count).toBe(guide.entries.length);
  });

  it('description ist nicht leer', () => {
    expect(buildPronunciationGuide(FANTASY_NAMES, 42).description.length).toBeGreaterThan(0);
  });

  it('description enthält die Anzahl', () => {
    const guide = buildPronunciationGuide(FANTASY_NAMES, 42);
    expect(guide.description).toContain(String(guide.count));
  });

  it('leeres Array ergibt leeren Leitfaden', () => {
    const guide = buildPronunciationGuide([], 42);
    expect(guide.entries).toEqual([]);
    expect(guide.count).toBe(0);
  });

  it('leeres Array liefert dennoch eine description', () => {
    expect(buildPronunciationGuide([], 42).description.length).toBeGreaterThan(0);
  });

  it('nicht-Array-Eingabe wird wie leer behandelt', () => {
    const guide = buildPronunciationGuide(null as unknown as string[], 42);
    expect(guide.entries).toEqual([]);
    expect(guide.count).toBe(0);
  });

  it('jeder Eintrag hat Name, IPA, simple, syllables und notes', () => {
    const guide = buildPronunciationGuide(FANTASY_NAMES, 42);
    for (const entry of guide.entries) {
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.ipa).toBe('string');
      expect(typeof entry.simple).toBe('string');
      expect(Array.isArray(entry.syllables)).toBe(true);
      expect(typeof entry.notes).toBe('string');
    }
  });

  it('jeder Eintrag hat nicht-leere IPA', () => {
    const guide = buildPronunciationGuide(FANTASY_NAMES, 42);
    for (const entry of guide.entries) {
      expect(entry.ipa.length).toBeGreaterThan(0);
    }
  });

  it('jeder Eintrag hat nicht-leere notes', () => {
    const guide = buildPronunciationGuide(FANTASY_NAMES, 42);
    for (const entry of guide.entries) {
      expect(entry.notes.length).toBeGreaterThan(0);
    }
  });

  it('jeder Eintrag hat ein nicht-leeres syllables-Array', () => {
    const guide = buildPronunciationGuide(FANTASY_NAMES, 42);
    for (const entry of guide.entries) {
      expect(entry.syllables.length).toBeGreaterThan(0);
    }
  });

  it('die Namen der Einträge entsprechen der Eingabe', () => {
    const guide = buildPronunciationGuide(FANTASY_NAMES, 42);
    expect(guide.entries.map((e) => e.name)).toEqual([...FANTASY_NAMES]);
  });

  it('jeder Eintrag enthält keine stressIndex-Eigenschaft', () => {
    const guide = buildPronunciationGuide(FANTASY_NAMES, 42);
    for (const entry of guide.entries) {
      expect('stressIndex' in entry).toBe(false);
    }
  });

  it('ist deterministisch für gleiche Eingabe und Seed', () => {
    expect(buildPronunciationGuide(FANTASY_NAMES, 42)).toEqual(
      buildPronunciationGuide(FANTASY_NAMES, 42)
    );
  });

  it('description nutzt die Einzahl bei genau einem Namen', () => {
    const guide = buildPronunciationGuide(['Kailen'], 42);
    expect(guide.description).toContain('Eigenname');
  });

  it('description nutzt die Mehrzahl bei mehreren Namen', () => {
    const guide = buildPronunciationGuide(['Kailen', 'Aurelia'], 42);
    expect(guide.description).toContain('Eigennamen');
  });

  it('verarbeitet eine große Namensliste', () => {
    const names = Array.from({ length: 50 }, (_, i) => `Name${i}X`);
    const guide = buildPronunciationGuide(names, 42);
    expect(guide.entries).toHaveLength(50);
    expect(guide.count).toBe(50);
  });

  it('IPA eines jeden Eintrags ist in Klammern gefasst', () => {
    const guide = buildPronunciationGuide(FANTASY_NAMES, 7);
    for (const entry of guide.entries) {
      expect(entry.ipa.startsWith('[')).toBe(true);
      expect(entry.ipa.endsWith(']')).toBe(true);
    }
  });

  it('unterschiedliche Seeds verändern den Leitfaden', () => {
    const a = buildPronunciationGuide(FANTASY_NAMES, 1);
    const b = buildPronunciationGuide(FANTASY_NAMES, 2);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

// ---------------------------------------------------------------------------
// exportGlossaryAppendix
// ---------------------------------------------------------------------------

describe('exportGlossaryAppendix', () => {
  const sampleGuide = buildPronunciationGuide(FANTASY_NAMES, 42);

  it('title ist nicht leer', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).title.length).toBeGreaterThan(0);
  });

  it('title enthält „Anhang“', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).title).toContain('Anhang');
  });

  it('sections ist ein nicht-leeres Array', () => {
    const app = exportGlossaryAppendix(sampleGuide, 42);
    expect(Array.isArray(app.sections)).toBe(true);
    expect(app.sections.length).toBeGreaterThan(0);
  });

  it('enthält vier Sektionen', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).sections).toHaveLength(4);
  });

  it('jede Sektion hat eine nicht-leere heading', () => {
    for (const s of exportGlossaryAppendix(sampleGuide, 42).sections) {
      expect(typeof s.heading).toBe('string');
      expect(s.heading.length).toBeGreaterThan(0);
    }
  });

  it('jede Sektion hat einen nicht-leeren body', () => {
    for (const s of exportGlossaryAppendix(sampleGuide, 42).sections) {
      expect(typeof s.body).toBe('string');
      expect(s.body.length).toBeGreaterThan(0);
    }
  });

  it('die erste Sektion ist die Einleitung', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).sections[0].heading).toBe('Einleitung');
  });

  it('enthält eine Sektion „Aussprache-Regeln“', () => {
    const headings = exportGlossaryAppendix(sampleGuide, 42).sections.map((s) => s.heading);
    expect(headings).toContain('Aussprache-Regeln');
  });

  it('enthält eine Sektion „Eigennamen-Verzeichnis“', () => {
    const headings = exportGlossaryAppendix(sampleGuide, 42).sections.map((s) => s.heading);
    expect(headings).toContain('Eigennamen-Verzeichnis');
  });

  it('enthält eine Sektion „Hinweise für Sprecher“', () => {
    const headings = exportGlossaryAppendix(sampleGuide, 42).sections.map((s) => s.heading);
    expect(headings).toContain('Hinweise für Sprecher');
  });

  it('die Regeln-Sektion nennt die IPA-Klammern', () => {
    const rules = exportGlossaryAppendix(sampleGuide, 42).sections.find(
      (s) => s.heading === 'Aussprache-Regeln'
    );
    expect(rules?.body).toContain('eckigen Klammern');
  });

  it('die Regeln-Sektion verwendet deutsche Anführungszeichen korrekt gepaart', () => {
    const rules = exportGlossaryAppendix(sampleGuide, 42).sections.find(
      (s) => s.heading === 'Aussprache-Regeln'
    );
    expect(rules?.body).toContain('„ei“');
  });

  it('pageCount ist mindestens 1', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).pageCount).toBeGreaterThanOrEqual(1);
  });

  it('pageCount ist eine ganze Zahl', () => {
    expect(Number.isInteger(exportGlossaryAppendix(sampleGuide, 42).pageCount)).toBe(true);
  });

  it('printReady ist true', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).printReady).toBe(true);
  });

  it('svgPreview beginnt mit „<svg“', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).svgPreview.startsWith('<svg')).toBe(true);
  });

  it('svgPreview endet mit „</svg>“', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).svgPreview.endsWith('</svg>')).toBe(true);
  });

  it('svgPreview enthält Textknoten', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).svgPreview).toContain('<text');
  });

  it('svgPreview enthält das svg-Namespace-Attribut', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).svgPreview).toContain(
      'xmlns="http://www.w3.org/2000/svg"'
    );
  });

  it('SVG enthält keine Hex-Farben', () => {
    expect(HEX_COLOR_RE.test(exportGlossaryAppendix(sampleGuide, 42).svgPreview)).toBe(false);
  });

  it('SVG enthält kein „rgba(“', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).svgPreview).not.toContain('rgba(');
  });

  it('SVG enthält kein „rgb(“', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).svgPreview).not.toContain('rgb(');
  });

  it('SVG nutzt CSS-Variablen für die Farbgebung', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).svgPreview).toContain('var(--');
  });

  it('ist deterministisch für gleiche Eingabe und Seed', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42)).toEqual(
      exportGlossaryAppendix(sampleGuide, 42)
    );
  });

  it('svgPreview ist deterministisch', () => {
    expect(exportGlossaryAppendix(sampleGuide, 42).svgPreview).toBe(
      exportGlossaryAppendix(sampleGuide, 42).svgPreview
    );
  });

  it('leerer Leitfaden wird ohne Ausnahme verarbeitet', () => {
    const app = exportGlossaryAppendix({ entries: [] }, 42);
    expect(app.sections.length).toBeGreaterThan(0);
    expect(app.pageCount).toBeGreaterThanOrEqual(1);
  });

  it('leerer Leitfaden nennt „Keine Eigennamen erfasst.“', () => {
    const app = exportGlossaryAppendix({ entries: [] }, 42);
    const dir = app.sections.find((s) => s.heading === 'Eigennamen-Verzeichnis');
    expect(dir?.body).toContain('Keine Eigennamen erfasst.');
  });

  it('null-Leitfaden wird ohne Ausnahme verarbeitet', () => {
    const app = exportGlossaryAppendix(null as unknown as { entries: never[] }, 42);
    expect(app.printReady).toBe(true);
  });

  it('pageCount wächst mit vielen Einträgen', () => {
    const many = buildPronunciationGuide(
      Array.from({ length: 100 }, (_, i) => `Wesen${i}X`),
      42
    );
    const app = exportGlossaryAppendix(many, 42);
    expect(app.pageCount).toBeGreaterThan(1);
  });

  it('Verzeichnis-Sektion listet die Einträge mit Trennzeichen „·“', () => {
    const app = exportGlossaryAppendix(sampleGuide, 42);
    const dir = app.sections.find((s) => s.heading === 'Eigennamen-Verzeichnis');
    expect(dir?.body).toContain('·');
  });

  it('Verzeichnis-Sektion enthält den ersten Namen', () => {
    const app = exportGlossaryAppendix(sampleGuide, 42);
    const dir = app.sections.find((s) => s.heading === 'Eigennamen-Verzeichnis');
    expect(dir?.body).toContain(FANTASY_NAMES[0]);
  });

  it('das Ergebnis erfüllt das GlossaryAppendix-Interface', () => {
    const app: GlossaryAppendix = exportGlossaryAppendix(sampleGuide, 42);
    expect(Object.keys(app).sort()).toEqual(
      ['pageCount', 'printReady', 'sections', 'svgPreview', 'title'].sort()
    );
  });

  it('unterschiedliche Seeds liefern jeweils gültige Ergebnisse', () => {
    for (let seed = 0; seed < 10; seed++) {
      const app = exportGlossaryAppendix(sampleGuide, seed);
      expect(app.printReady).toBe(true);
      expect(app.svgPreview.startsWith('<svg')).toBe(true);
    }
  });

  it('SVG mit Sonderzeichen im Namen bleibt wohlgeformt', () => {
    const guide = { entries: [{ name: 'A&B', ipa: '[a]', simple: 'A' }] };
    const app = exportGlossaryAppendix(guide, 1);
    expect(app.svgPreview).toContain('&amp;');
    expect(app.svgPreview.endsWith('</svg>')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Factory-Funktionen
// ---------------------------------------------------------------------------

describe('createSamplePronunciationGuide', () => {
  it('liefert einen Leitfaden mit 7 Einträgen', () => {
    expect(createSamplePronunciationGuide().entries).toHaveLength(7);
  });

  it('count ist 7', () => {
    expect(createSamplePronunciationGuide().count).toBe(7);
  });

  it('enthält den Beispielnamen „Kailen“', () => {
    expect(createSamplePronunciationGuide().entries.map((e) => e.name)).toContain('Kailen');
  });

  it('description ist nicht leer', () => {
    expect(createSamplePronunciationGuide().description.length).toBeGreaterThan(0);
  });

  it('ist deterministisch', () => {
    expect(createSamplePronunciationGuide()).toEqual(createSamplePronunciationGuide());
  });

  it('alle Einträge sind gültig', () => {
    for (const entry of createSamplePronunciationGuide().entries) {
      expect(entry.ipa.startsWith('[')).toBe(true);
      expect(entry.ipa.endsWith(']')).toBe(true);
      expect(entry.syllables.length).toBeGreaterThan(0);
      expect(entry.notes.length).toBeGreaterThan(0);
    }
  });
});

describe('createSampleAppendix', () => {
  it('liefert einen Anhang mit nicht-leerem Titel', () => {
    expect(createSampleAppendix().title.length).toBeGreaterThan(0);
  });

  it('printReady ist true', () => {
    expect(createSampleAppendix().printReady).toBe(true);
  });

  it('sections ist nicht leer', () => {
    expect(createSampleAppendix().sections.length).toBeGreaterThan(0);
  });

  it('pageCount ist mindestens 1', () => {
    expect(createSampleAppendix().pageCount).toBeGreaterThanOrEqual(1);
  });

  it('svgPreview ist ein gültiger SVG-String', () => {
    const app = createSampleAppendix();
    expect(app.svgPreview.startsWith('<svg')).toBe(true);
    expect(app.svgPreview.endsWith('</svg>')).toBe(true);
  });

  it('SVG enthält keine Hex-Farben', () => {
    expect(HEX_COLOR_RE.test(createSampleAppendix().svgPreview)).toBe(false);
  });

  it('ist deterministisch', () => {
    expect(createSampleAppendix()).toEqual(createSampleAppendix());
  });

  it('Verzeichnis-Sektion listet den Beispielnamen', () => {
    const dir = createSampleAppendix().sections.find(
      (s) => s.heading === 'Eigennamen-Verzeichnis'
    );
    expect(dir?.body).toContain('Kailen');
  });
});
