// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  hashString,
  createSeededRandom,
  calculateImpactAngle,
  classifyBloodstainPattern,
  analyzeGunshotDistance,
  reconstructShotOrigin,
  generateSpatterCanvas,
  createSampleImpactAngle,
  createSampleGunshotAnalysis,
} from './ballisticsForensicsStudio';

// ---------------------------------------------------------------------------
// 1. hashString
// ---------------------------------------------------------------------------
describe('hashString', () => {
  it('ist deterministisch — gleicher String ergibt gleichen Hash', () => {
    const h1 = hashString('Blutspur');
    const h2 = hashString('Blutspur');
    expect(h1).toBe(h2);
  });

  it('erzeugt für unterschiedliche Strings unterschiedliche Hashes', () => {
    const h1 = hashString('Tropfen A');
    const h2 = hashString('Tropfen B');
    expect(h1).not.toBe(h2);
  });

  it('liefert für den leeren String einen gültigen Hash', () => {
    const h = hashString('');
    expect(typeof h).toBe('number');
    expect(Number.isFinite(h)).toBe(true);
  });

  it('verarbeitet Unicode-Strings korrekt', () => {
    const h = hashString('🩸 Blut');
    expect(typeof h).toBe('number');
    expect(Number.isFinite(h)).toBe(true);
  });

  it('gibt unterschiedliche Hashes für Groß-/Kleinschreibung aus', () => {
    const h1 = hashString('Blutspur');
    const h2 = hashString('blutspur');
    expect(h1).not.toBe(h2);
  });

  it('liefert konsistente Hashes über mehrere Aufrufe', () => {
    const results = [1, 2, 3].map(() => hashString('test'));
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
  });
});

// ---------------------------------------------------------------------------
// 2. createSeededRandom
// ---------------------------------------------------------------------------
describe('createSeededRandom', () => {
  it('ist deterministisch für denselben Seed', () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    const seq1 = Array.from({ length: 10 }, () => rng1());
    const seq2 = Array.from({ length: 10 }, () => rng2());
    expect(seq1).toEqual(seq2);
  });

  it('liefert Werte im Bereich [0, 1)', () => {
    const rng = createSeededRandom(123);
    for (let i = 0; i < 100; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('erzeugt für unterschiedliche Seeds unterschiedliche Sequenzen', () => {
    const rng1 = createSeededRandom(1);
    const rng2 = createSeededRandom(9999);
    const seq1 = Array.from({ length: 5 }, () => rng1());
    const seq2 = Array.from({ length: 5 }, () => rng2());
    expect(seq1).not.toEqual(seq2);
  });

  it('arbeitet über viele Aufrufe hinweg stabil', () => {
    const rng = createSeededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const val = rng();
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it('akzeptiert Seed 0 korrekt', () => {
    const rng = createSeededRandom(0);
    const val = rng();
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// 3. calculateImpactAngle
// ---------------------------------------------------------------------------
describe('calculateImpactAngle', () => {
  it('berechnet sin(angle) = width/length korrekt', () => {
    const result = calculateImpactAngle(3, 4);
    const expectedRatio = 3 / 4;
    const expectedRadians = Math.asin(expectedRatio);
    const expectedDegrees = Math.round((expectedRadians * 180) / Math.PI * 100) / 100;
    expect(result.angleDegrees).toBeCloseTo(expectedDegrees, 2);
    expect(result.angleRadians).toBeCloseTo(expectedRadians, 3);
  });

  it('wirft Fehler, wenn Breite > Länge', () => {
    expect(() => calculateImpactAngle(10, 5)).toThrow();
  });

  it('gibt 0° für Breite 0 zurück', () => {
    const result = calculateImpactAngle(0, 10);
    expect(result.angleDegrees).toBe(0);
    expect(result.angleRadians).toBe(0);
  });

  it('gibt 90° für kreisrunden Tropfen zurück', () => {
    const result = calculateImpactAngle(5, 5);
    expect(result.angleDegrees).toBe(90);
  });

  it('setzt angleDegrees und angleRadians', () => {
    const result = calculateImpactAngle(3, 5);
    expect(typeof result.angleDegrees).toBe('number');
    expect(typeof result.angleRadians).toBe('number');
    expect(result.angleDegrees).toBeGreaterThanOrEqual(0);
    expect(result.angleDegrees).toBeLessThanOrEqual(90);
    expect(result.angleRadians).toBeGreaterThanOrEqual(0);
    expect(result.angleRadians).toBeLessThanOrEqual(Math.PI / 2);
  });

  it('setzt eine Beschreibung', () => {
    const result = calculateImpactAngle(3, 5);
    expect(typeof result.description).toBe('string');
    expect(result.description.length).toBeGreaterThan(0);
  });

  it('wirft Fehler für negative Werte', () => {
    expect(() => calculateImpactAngle(-1, 5)).toThrow();
    expect(() => calculateImpactAngle(5, -1)).toThrow();
  });

  it('wirft Fehler für Länge 0', () => {
    expect(() => calculateImpactAngle(5, 0)).toThrow();
  });

  it('klassifiziert nahezu senkrechten Aufprall korrekt', () => {
    const result = calculateImpactAngle(99, 100);
    expect(result.angleDegrees).toBeGreaterThanOrEqual(80);
  });

  it('klassifiziert flachen Aufprall korrekt', () => {
    const result = calculateImpactAngle(1, 10);
    expect(result.angleDegrees).toBeLessThan(15);
  });
});

// ---------------------------------------------------------------------------
// 4. classifyBloodstainPattern
// ---------------------------------------------------------------------------
describe('classifyBloodstainPattern', () => {
  const allPatterns = ['passive', 'transfer', 'spatter', 'castoff', 'void', 'saturation'] as const;

  it.each(allPatterns)('klassifiziert Muster "%s" korrekt', (pattern) => {
    const result = classifyBloodstainPattern(pattern);
    expect(result.pattern).toBe(pattern);
    expect(typeof result.description).toBe('string');
    expect(result.description.length).toBeGreaterThan(0);
    expect(typeof result.origin).toBe('string');
    expect(result.origin.length).toBeGreaterThan(0);
    expect(['low', 'medium', 'high', 'extreme']).toContain(result.forceLevel);
    expect(typeof result.reconstructPossible).toBe('boolean');
  });

  it('erkennt "passive" mit korrekten Eigenschaften', () => {
    const result = classifyBloodstainPattern('passive');
    expect(result.pattern).toBe('passive');
    expect(result.forceLevel).toBe('low');
    expect(result.reconstructPossible).toBe(true);
  });

  it('erkennt "transfer" mit korrekten Eigenschaften', () => {
    const result = classifyBloodstainPattern('transfer');
    expect(result.pattern).toBe('transfer');
    expect(result.forceLevel).toBe('low');
    expect(result.reconstructPossible).toBe(false);
  });

  it('erkennt "spatter" mit korrekten Eigenschaften', () => {
    const result = classifyBloodstainPattern('spatter');
    expect(result.pattern).toBe('spatter');
    expect(result.forceLevel).toBe('medium');
    expect(result.reconstructPossible).toBe(true);
  });

  it('erkennt "castoff" mit korrekten Eigenschaften', () => {
    const result = classifyBloodstainPattern('castoff');
    expect(result.pattern).toBe('castoff');
    expect(result.forceLevel).toBe('medium');
    expect(result.reconstructPossible).toBe(true);
  });

  it('erkennt "void" mit korrekten Eigenschaften', () => {
    const result = classifyBloodstainPattern('void');
    expect(result.pattern).toBe('void');
    expect(result.forceLevel).toBe('low');
    expect(result.reconstructPossible).toBe(true);
  });

  it('erkennt "saturation" mit korrekten Eigenschaften', () => {
    const result = classifyBloodstainPattern('saturation');
    expect(result.pattern).toBe('saturation');
    expect(result.forceLevel).toBe('low');
    expect(result.reconstructPossible).toBe(false);
  });

  it('ist case-insensitive', () => {
    const r1 = classifyBloodstainPattern('PASSIVE');
    const r2 = classifyBloodstainPattern('passive');
    expect(r1.pattern).toBe(r2.pattern);
  });

  it('wirft Fehler für unbekanntes Muster', () => {
    expect(() => classifyBloodstainPattern('unbekannt')).toThrow();
  });

  it('trimmt Leerzeichen', () => {
    const result = classifyBloodstainPattern('  passive  ');
    expect(result.pattern).toBe('passive');
  });
});

// ---------------------------------------------------------------------------
// 5. analyzeGunshotDistance
// ---------------------------------------------------------------------------
describe('analyzeGunshotDistance', () => {
  it('Kontaktschuss (0 cm): alle Schmauchmerkmale true', () => {
    const result = analyzeGunshotDistance(0);
    expect(result.category).toBe('contact');
    expect(result.muzzleMark).toBe(true);
    expect(result.powderResidue).toBe(true);
    expect(result.burnRing).toBe(true);
    expect(result.sootDeposit).toBe(true);
  });

  it('Nahschuss (< 30 cm): Schmauch vorhanden, kein Mündungsabdruck', () => {
    const result = analyzeGunshotDistance(15);
    expect(result.category).toBe('close');
    expect(result.muzzleMark).toBe(false);
    expect(result.powderResidue).toBe(true);
    expect(result.burnRing).toBe(true);
    expect(result.sootDeposit).toBe(true);
  });

  it('Mitteldistanz (30–100 cm): abnehmender Schmauch', () => {
    const result = analyzeGunshotDistance(45);
    expect(result.category).toBe('medium');
    expect(result.muzzleMark).toBe(false);
    expect(result.burnRing).toBe(false);
  });

  it('Mitteldistanz ab 60 cm: ausgedünnter Schmauch', () => {
    const result = analyzeGunshotDistance(80);
    expect(result.category).toBe('medium');
    expect(result.powderResidue).toBe(true);
    expect(result.sootDeposit).toBe(true);
  });

  it('Fernschuss (≥ 100 cm): keine Rückstände', () => {
    const result = analyzeGunshotDistance(150);
    expect(result.category).toBe('far');
    expect(result.muzzleMark).toBe(false);
    expect(result.powderResidue).toBe(false);
    expect(result.burnRing).toBe(false);
    expect(result.sootDeposit).toBe(false);
  });

  it('setzt eine Beschreibung für jede Kategorie', () => {
    const categories = [0, 15, 45, 150];
    for (const d of categories) {
      const result = analyzeGunshotDistance(d);
      expect(typeof result.description).toBe('string');
      expect(result.description.length).toBeGreaterThan(0);
    }
  });

  it('rundet die Distanz auf 2 Nachkommastellen', () => {
    const result = analyzeGunshotDistance(15.12345);
    expect(result.distanceCm).toBe(15.12);
  });

  it('wirft Fehler für negative Distanz', () => {
    expect(() => analyzeGunshotDistance(-5)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 6. reconstructShotOrigin
// ---------------------------------------------------------------------------
describe('reconstructShotOrigin', () => {
  const defaultNormal = { x: 0, y: 0, z: 1 };

  it('liefert originX/Y/Z als Zahlen', () => {
    const result = reconstructShotOrigin(
      [{ widthMm: 3, lengthMm: 5 }],
      defaultNormal
    );
    expect(typeof result.originX).toBe('number');
    expect(typeof result.originY).toBe('number');
    expect(typeof result.originZ).toBe('number');
  });

  it('liefert coneAngle, confidence und description', () => {
    const result = reconstructShotOrigin(
      [{ widthMm: 3, lengthMm: 5 }],
      defaultNormal
    );
    expect(typeof result.coneAngle).toBe('number');
    expect(result.coneAngle).toBeGreaterThanOrEqual(0);
    expect(result.coneAngle).toBeLessThanOrEqual(90);
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.description).toBe('string');
    expect(result.description.length).toBeGreaterThan(0);
  });

  it('mittelt Auftreffwinkel über mehrere Tropfen', () => {
    const result = reconstructShotOrigin(
      [
        { widthMm: 3, lengthMm: 5 },
        { widthMm: 4, lengthMm: 5 },
      ],
      defaultNormal
    );
    expect(result.coneAngle).toBeGreaterThan(0);
    expect(result.coneAngle).toBeLessThan(90);
  });

  it('wirft Fehler für leeres Array', () => {
    expect(() => reconstructShotOrigin([], defaultNormal)).toThrow();
  });

  it('mehr Tropfen erhöhen die Konfidenz', () => {
    const few = reconstructShotOrigin(
      [{ widthMm: 3, lengthMm: 5 }],
      defaultNormal
    );
    const many = reconstructShotOrigin(
      [
        { widthMm: 3, lengthMm: 5 },
        { widthMm: 4, lengthMm: 5 },
        { widthMm: 3, lengthMm: 5 },
        { widthMm: 4, lengthMm: 5 },
        { widthMm: 3, lengthMm: 5 },
      ],
      defaultNormal
    );
    expect(many.confidence).toBeGreaterThanOrEqual(few.confidence);
  });

  it('ignoriert ungültige Tropfen (width > length)', () => {
    const result = reconstructShotOrigin(
      [{ widthMm: 10, lengthMm: 5 }],
      defaultNormal
    );
    expect(result.coneAngle).toBe(90);
  });

  it('berücksichticht die Ebenennormale', () => {
    const result = reconstructShotOrigin(
      [{ widthMm: 3, lengthMm: 5 }],
      { x: 1, y: 0, z: 0 }
    );
    expect(result.originX).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 7. generateSpatterCanvas
// ---------------------------------------------------------------------------
describe('generateSpatterCanvas', () => {
  const sampleSpatters = [
    { x: 50, y: 50, widthMm: 3, lengthMm: 5, angle: 30 },
    { x: 80, y: 120, widthMm: 2, lengthMm: 4, angle: 60 },
  ];

  it('liefert einen SVG-String', () => {
    const svg = generateSpatterCanvas(sampleSpatters, 200, 200);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('verwendet keine Hex-Farben', () => {
    const svg = generateSpatterCanvas(sampleSpatters, 200, 200);
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('verwendet Design-Tokens (var(--...))', () => {
    const svg = generateSpatterCanvas(sampleSpatters, 200, 200);
    expect(svg).toContain('var(--');
  });

  it('enthält Ellipsen für jeden Tropfen', () => {
    const svg = generateSpatterCanvas(sampleSpatters, 200, 200);
    const ellipseCount = (svg.match(/<ellipse/g) || []).length;
    expect(ellipseCount).toBe(sampleSpatters.length);
  });

  it('verarbeitet leeres Spatter-Array', () => {
    const svg = generateSpatterCanvas([], 200, 200);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<ellipse');
  });

  it('enthält Text mit Tropfenanzahl', () => {
    const svg = generateSpatterCanvas(sampleSpatters, 200, 200);
    expect(svg).toContain(`${sampleSpatters.length} Tropfen`);
  });

  it('akzeptiert null/undefined für spatters', () => {
    const svg = generateSpatterCanvas(null as unknown as [], 200, 200);
    expect(svg).toContain('<svg');
  });

  it('begrenzt Werte auf Minimum 1', () => {
    const svg = generateSpatterCanvas([], 0, 0);
    expect(svg).toContain('width="1"');
    expect(svg).toContain('height="1"');
  });
});

// ---------------------------------------------------------------------------
// 8. createSampleImpactAngle
// ---------------------------------------------------------------------------
describe('createSampleImpactAngle', () => {
  it('liefert gültige Werte', () => {
    const sample = createSampleImpactAngle();
    expect(typeof sample.dropletWidthMm).toBe('number');
    expect(typeof sample.dropletLengthMm).toBe('number');
    expect(sample.dropletWidthMm).toBeGreaterThan(0);
    expect(sample.dropletLengthMm).toBeGreaterThan(0);
    expect(sample.dropletWidthMm).toBeLessThanOrEqual(sample.dropletLengthMm);
  });

  it('result enthält gültigen ImpactAngleResult', () => {
    const sample = createSampleImpactAngle();
    expect(typeof sample.result.angleDegrees).toBe('number');
    expect(typeof sample.result.angleRadians).toBe('number');
    expect(typeof sample.result.description).toBe('string');
    expect(sample.result.description.length).toBeGreaterThan(0);
  });

  it('Width entspricht dem Wert aus result (Konsistenz)', () => {
    const sample = createSampleImpactAngle();
    const expected = calculateImpactAngle(sample.dropletWidthMm, sample.dropletLengthMm);
    expect(sample.result.angleDegrees).toBeCloseTo(expected.angleDegrees, 2);
  });
});

// ---------------------------------------------------------------------------
// 9. createSampleGunshotAnalysis
// ---------------------------------------------------------------------------
describe('createSampleGunshotAnalysis', () => {
  it('liefert gültige Werte', () => {
    const sample = createSampleGunshotAnalysis();
    expect(typeof sample.distanceCm).toBe('number');
    expect(sample.distanceCm).toBeGreaterThanOrEqual(0);
  });

  it('analysis enthält gültige Kategorie', () => {
    const sample = createSampleGunshotAnalysis();
    expect(['contact', 'close', 'medium', 'far']).toContain(sample.analysis.category);
  });

  it('analysis enthält Schmauch-Booleans', () => {
    const sample = createSampleGunshotAnalysis();
    expect(typeof sample.analysis.muzzleMark).toBe('boolean');
    expect(typeof sample.analysis.powderResidue).toBe('boolean');
    expect(typeof sample.analysis.burnRing).toBe('boolean');
    expect(typeof sample.analysis.sootDeposit).toBe('boolean');
  });

  it('pattern ist ein gültiges Blutspuren-Muster', () => {
    const sample = createSampleGunshotAnalysis();
    expect(sample.pattern.pattern).toBe('castoff');
    expect(typeof sample.pattern.description).toBe('string');
    expect(typeof sample.pattern.origin).toBe('string');
  });

  it('distanceCm in analysis konsistent', () => {
    const sample = createSampleGunshotAnalysis();
    expect(sample.analysis.distanceCm).toBe(sample.distanceCm);
  });
});
