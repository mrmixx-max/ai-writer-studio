// BallisticsForensicsStudio (WP 114.2)
// Blutspuren-Geometrie & Ballistik-Forensik-Studio für Krimis.
// Elliptische Auftreffwinkel, Muster-Klassifikation, Schussdistanz-Schmauch-Analyse,
// Schussrichtungs-Rekonstruktion und SVG-Rekonstruktions-Canvas.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 1. Elliptische Auftreffwinkel-Berechnung
// ---------------------------------------------------------------------------

export interface ImpactAngleResult {
  angleDegrees: number;
  angleRadians: number;
  description: string;
}

/**
 * Berechnet den Auftreffwinkel eines elliptischen Blutstropfens.
 * Formel: sin(angle) = Breite / Länge.
 * Ein kreisrunder Tropfen (Breite = Länge) trifft senkrecht (90°) auf.
 * Ein sehr schmaler Tropfen (Breite ≪ Länge) deutet auf einen flachen Aufprall hin.
 */
export function calculateImpactAngle(dropletWidthMm: number, dropletLengthMm: number): ImpactAngleResult {
  if (dropletWidthMm < 0 || dropletLengthMm < 0) {
    throw new Error("Breite und Länge müssen nicht-negativ sein.");
  }
  if (dropletLengthMm <= 0) {
    throw new Error("Die Länge eines Blutstropfens muss größer als 0 mm sein.");
  }
  if (dropletWidthMm > dropletLengthMm) {
    throw new Error("Breite darf die Länge nicht überschreiten (sin(angle) > 1).");
  }
  if (dropletWidthMm === 0) {
    const angleRadians = 0;
    return {
      angleDegrees: 0,
      angleRadians,
      description:
        "Breite 0 mm: extrem flacher Auftreffwinkel (0°). Der Tropfen zog eine Linie statt einer Ellipse.",
    };
  }

  const ratio = dropletWidthMm / dropletLengthMm;
  const angleRadians = Math.asin(Math.max(0, Math.min(1, ratio)));
  const angleDegrees = Math.round((angleRadians * 180) / Math.PI * 100) / 100;
  const roundedRadians = Math.round(angleRadians * 10000) / 10000;

  let description: string;
  if (angleDegrees >= 80) {
    description = `Nahezu senkrechter Aufprall (${angleDegrees}°). Der Tropfen ist fast kreisrund.`;
  } else if (angleDegrees >= 45) {
    description = `Mittlerer Auftreffwinkel (${angleDegrees}°). Deutlich elliptische Tropfenform.`;
  } else if (angleDegrees >= 15) {
    description = `Flacher Auftreffwinkel (${angleDegrees}°). Stark gestreckte Ellipse.`;
  } else {
    description = `Sehr flacher Auftreffwinkel (${angleDegrees}°). Tropfen liegt als schmale Bahn vor.`;
  }

  return { angleDegrees, angleRadians: roundedRadians, description };
}

// ---------------------------------------------------------------------------
// 2. Blutspuren-Muster-Klassifikation
// ---------------------------------------------------------------------------

export type BloodstainPatternId =
  | "passive"
  | "transfer"
  | "spatter"
  | "castoff"
  | "void"
  | "saturation";

export interface BloodstainPatternResult {
  pattern: BloodstainPatternId;
  description: string;
  origin: string;
  forceLevel: "low" | "medium" | "high" | "extreme";
  reconstructPossible: boolean;
}

interface BloodstainPatternDef {
  description: string;
  origin: string;
  forceLevel: "low" | "medium" | "high" | "extreme";
  reconstructPossible: boolean;
}

const BLOODSTAIN_PATTERNS: Record<BloodstainPatternId, BloodstainPatternDef> = {
  passive: {
    description:
      "Passive Tropfen: runde Tropfen, die allein durch die Schwerkraft fielen — ohne äußere Gewalt.",
    origin: "Frei fallende Tropfen aus einer Wunde oder einem blutenden Gegenstand.",
    forceLevel: "low",
    reconstructPossible: true,
  },
  transfer: {
    description:
      "Übertragungsmuster: Abdruck eines blutbenetzten Gegenstands (Hand, Schuh, Klinge) auf einer Fläche.",
    origin: "Direkter Kontakt zwischen blutigem Objekt und einer Oberfläche.",
    forceLevel: "low",
    reconstructPossible: false,
  },
  spatter: {
    description:
      "Spritzmuster: viele kleine Tropfen, die durch plötzliche Gewalteinwirkung radial nach außen geschleudert wurden.",
    origin: "Ein Schlag oder Schuss traf eine blutende Quelle (Impact-Spatter).",
    forceLevel: "medium",
    reconstructPossible: true,
  },
  castoff: {
    description:
      "Abschleudermuster: eine linienförmige Reihe von Tropfen, entstanden durch Schwung einer blutigen Waffe.",
    origin: "Ausholende oder schwingende Bewegung mit einer blutigen Klinge.",
    forceLevel: "medium",
    reconstructPossible: true,
  },
  void: {
    description:
      "Void-Muster (Leerstelle): eine blutfreie Zone innerhalb eines Spritzbildes, dort stand ein Körper oder Gegenstand.",
    origin: "Ein Objekt oder eine Person blockierte die Flugbahn der Tropfen.",
    forceLevel: "low",
    reconstructPossible: true,
  },
  saturation: {
    description:
      "Sättigungsmuster: eine durchtränkte Fläche, das Blut durchdringt Gewebe oder sammelt sich über Zeit.",
    origin: "Anhaltende Blutung an einer Stelle oder Eintauchen in eine Blutlache.",
    forceLevel: "low",
    reconstructPossible: false,
  },
};

export function classifyBloodstainPattern(pattern: string): BloodstainPatternResult {
  const key = pattern.toLowerCase().trim() as BloodstainPatternId;
  const def = BLOODSTAIN_PATTERNS[key];
  if (!def) {
    const known = Object.keys(BLOODSTAIN_PATTERNS).join(", ");
    throw new Error(`Unbekanntes Blutspuren-Muster: "${pattern}". Bekannte Muster: ${known}.`);
  }
  return {
    pattern: key,
    description: def.description,
    origin: def.origin,
    forceLevel: def.forceLevel,
    reconstructPossible: def.reconstructPossible,
  };
}

// ---------------------------------------------------------------------------
// 3. Schussdistanz & Schmauch-Analyse
// ---------------------------------------------------------------------------

export type GunshotDistanceCategory = "contact" | "close" | "medium" | "far";

export interface GunshotDistanceAnalysis {
  distanceCm: number;
  category: GunshotDistanceCategory;
  muzzleMark: boolean;
  powderResidue: boolean;
  burnRing: boolean;
  sootDeposit: boolean;
  description: string;
}

/**
 * Analysiert die Schussdistanz anhand forensischer Schmauchmerkmale.
 * Regeln:
 * - Kontakt: Stanzmarke (Mündungsabdruck) + sternförmiges Aufplatzen der Wunde.
 * - Nahschuss (< 30 cm): Pulverschmauch (Ruß) + Verbrennungszone (Schmauchhof).
 * - Mitteldistanz (30–100 cm): abnehmender Schmauch, keine Verbrennung.
 * - Fernschuss (≥ 100 cm): kein Schmauchhof, keine Rückstände.
 */
export function analyzeGunshotDistance(distanceCm: number): GunshotDistanceAnalysis {
  if (distanceCm < 0) {
    throw new Error("Die Schussdistanz darf nicht negativ sein.");
  }

  const d = Math.round(distanceCm * 100) / 100;

  if (d === 0) {
    return {
      distanceCm: d,
      category: "contact",
      muzzleMark: true,
      powderResidue: true,
      burnRing: true,
      sootDeposit: true,
      description:
        "Absoluter Kontaktschuss: Stanzmarke (Mündungsabdruck) auf der Haut, sternförmiges Aufplatzen der Wunde durch eingeleitete Gase, dichte Ruß- und Schmauchablagerung in der Wunde.",
    };
  }

  if (d < 30) {
    return {
      distanceCm: d,
      category: "close",
      muzzleMark: false,
      powderResidue: true,
      burnRing: true,
      sootDeposit: true,
      description:
        "Nahschuss unter 30 cm: Pulverschmauch (Rußhof) und Verbrennungszone um den Einschuss sichtbar, noch kein Mündungsabdruck.",
    };
  }

  if (d < 100) {
    const fading = d >= 60;
    return {
      distanceCm: d,
      category: "medium",
      muzzleMark: false,
      powderResidue: fading,
      burnRing: false,
      sootDeposit: fading,
      description: fading
        ? "Mitteldistanz (60–100 cm): Schmauchhof stark ausgedünnt, einzelne Rußpartikel, keine Verbrennungszone mehr."
        : "Mitteldistanz (30–60 cm): noch deutlicher, aber lockerer Schmauchhof, keine Verbrennungszone.",
    };
  }

  return {
    distanceCm: d,
    category: "far",
    muzzleMark: false,
    powderResidue: false,
    burnRing: false,
    sootDeposit: false,
    description:
      "Fernschuss ab 100 cm: kein Schmauchhof und keine Pulverrückstände am Einschuss; Distanz nur über Spuren am Geschoß und Zielballistik bestimmbar.",
  };
}

// ---------------------------------------------------------------------------
// 4. Schussrichtungs-Rekonstruktion
// ---------------------------------------------------------------------------

export interface ShotOriginResult {
  originX: number;
  originY: number;
  originZ: number;
  coneAngle: number;
  confidence: number;
  description: string;
}

export interface DropletAngles {
  widthMm: number;
  lengthMm: number;
}

export interface SurfaceNormal {
  x: number;
  y: number;
  z: number;
}

/**
 * Rekonstruiert den Ursprung eines Schusses (oder Schlags) aus mehreren
 * elliptischen Blutstropfen. Nutzt die gemittelten Auftreffwinkel als
 * einfache Triangulation entlang der Ebenennormalen.
 */
export function reconstructShotOrigin(
  angles: DropletAngles[],
  surfaceNormal: SurfaceNormal
): ShotOriginResult {
  if (!angles || angles.length === 0) {
    throw new Error("Zur Rekonstruktion wird mindestens ein Blutstropfen benötigt.");
  }

  // Normalisieren der Ebenennormalen (Schutz gegen Nullvektor).
  const nLen = Math.sqrt(
    surfaceNormal.x * surfaceNormal.x + surfaceNormal.y * surfaceNormal.y + surfaceNormal.z * surfaceNormal.z
  );
  const nx = nLen === 0 ? 0 : surfaceNormal.x / nLen;
  const ny = nLen === 0 ? 0 : surfaceNormal.y / nLen;
  const nz = nLen === 0 ? 1 : surfaceNormal.z / nLen;

  // Gemittelter Auftreffwinkel über alle Tropfen.
  let angleSum = 0;
  let validCount = 0;
  for (const a of angles) {
    if (a.lengthMm <= 0 || a.widthMm > a.lengthMm) continue;
    const ratio = a.widthMm / a.lengthMm;
    angleSum += Math.asin(Math.max(0, Math.min(1, ratio)));
    validCount++;
  }
  const avgRadians = validCount > 0 ? angleSum / validCount : Math.PI / 2;
  const avgDegrees = (avgRadians * 180) / Math.PI;

  // Der Kegelwinkel entspricht dem gemittelten Auftreffwinkel (0..90°).
  const coneAngle = Math.round(avgDegrees * 100) / 100;

  // Einfache Triangulation: Projektion der Flugachse auf die Ebenennormale.
  // Je flacher der Auftreffwinkel, desto weiter entfernt der Ursprung.
  const spread = Math.max(0, Math.cos(avgRadians)); // 1 bei senkrecht, 0 bei flach
  const reach = 100 + (1 - spread) * 900;

  const originX = Math.round(nx * reach * 100) / 100;
  const originY = Math.round(ny * reach * 100) / 100;
  const originZ = Math.round(nz * reach * 100) / 100;

  // Konfidenz: mehr Tropfen und ein klarer, mittlerer Winkel erhöhen sie.
  const countFactor = Math.min(1, validCount / 5);
  const angleFactor = 1 - Math.abs(avgDegrees - 45) / 45;
  const confidence = Math.round(Math.max(0.05, Math.min(1, 0.4 + countFactor * 0.4 + angleFactor * 0.2)) * 100) / 100;

  let description: string;
  if (confidence >= 0.75) {
    description = `Verlässliche Rekonstruktion aus ${validCount} Tropfen: Kegelwinkel ${coneAngle}°, Ursprung nahe der Flächennormalen.`;
  } else if (confidence >= 0.5) {
    description = `Brauchbare Rekonstruktion aus ${validCount} Tropfen: Kegelwinkel ${coneAngle}°, mittlere Streuung.`;
  } else {
    description = `Grobe Rekonstruktion aus ${validCount} Tropfen: Kegelwinkel ${coneAngle}°, hohe Unsicherheit — weitere Tropfen sichern das Ergebnis.`;
  }

  return { originX, originY, originZ, coneAngle, confidence, description };
}

// ---------------------------------------------------------------------------
// 5. SVG-Rekonstruktions-Canvas
// ---------------------------------------------------------------------------

export interface SpatterDrop {
  x: number;
  y: number;
  widthMm: number;
  lengthMm: number;
  angle: number;
}

/**
 * Zeichnet ein Blutspurenmuster als SVG. Jeder Tropfen wird als rotierte
 * Ellipse dargestellt. Verwendet ausschließlich Design-Tokens (keine Hex-Farben).
 */
export function generateSpatterCanvas(spatters: SpatterDrop[], width: number, height: number): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));

  const drops = (spatters || [])
    .map((drop) => {
      const rx = Math.max(0.5, drop.lengthMm / 2);
      const ry = Math.max(0.5, drop.widthMm / 2);
      const cx = Math.round(drop.x * 100) / 100;
      const cy = Math.round(drop.y * 100) / 100;
      const rot = Math.round(drop.angle * 100) / 100;
      const opacity = 0.45 + Math.min(0.5, ry / 20);
      const fill = `color-mix(in srgb, var(--accent) ${Math.round(opacity * 100)}%, var(--panel))`;
      return `<ellipse cx="${cx}" cy="${cy}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" transform="rotate(${rot} ${cx} ${cy})" style="fill: ${fill}; stroke: var(--border-strong)" stroke-width="0.5" />`;
    })
    .join("");

  const gridLines: string[] = [];
  const step = 50;
  for (let x = step; x < w; x += step) {
    gridLines.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${h}" style="stroke: var(--border)" stroke-width="0.25" />`
    );
  }
  for (let y = step; y < h; y += step) {
    gridLines.push(
      `<line x1="0" y1="${y}" x2="${w}" y2="${y}" style="stroke: var(--border)" stroke-width="0.25" />`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect x="0" y="0" width="${w}" height="${h}" style="fill: var(--bg)" />
  <g>${gridLines.join("")}</g>
  <g>${drops}</g>
  <text x="10" y="${h - 10}" style="fill: var(--muted)" font-size="10">Blutspuren-Rekonstruktion · ${(spatters || []).length} Tropfen</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// Sample-Factories
// ---------------------------------------------------------------------------

export interface SampleImpactAngle {
  dropletWidthMm: number;
  dropletLengthMm: number;
  result: ImpactAngleResult;
}

export function createSampleImpactAngle(): SampleImpactAngle {
  const dropletWidthMm = 6;
  const dropletLengthMm = 12;
  return {
    dropletWidthMm,
    dropletLengthMm,
    result: calculateImpactAngle(dropletWidthMm, dropletLengthMm),
  };
}

export interface SampleGunshotAnalysis {
  distanceCm: number;
  analysis: GunshotDistanceAnalysis;
  pattern: BloodstainPatternResult;
}

export function createSampleGunshotAnalysis(): SampleGunshotAnalysis {
  const distanceCm = 45;
  return {
    distanceCm,
    analysis: analyzeGunshotDistance(distanceCm),
    pattern: classifyBloodstainPattern("castoff"),
  };
}
