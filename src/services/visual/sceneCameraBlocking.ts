// 3D-Szenen- & Kamera-Blocking (WP 70.2)
//
// Regisseure, Graphic-Novel-Zeichner und Autoren ordnen komplexe Ensembleszenen
// im Raum an: Wer steht wo? Wer blickt wen an? Wo steht die Kamera?
//
// Der Kern ist der 180-Grad-Achsen-Wächter: überspringt ein Kameraschnitt die
// Handlungsachse, springt die Blickrichtung im fertigen Film und der Zuschauer
// verliert die Orientierung.
//
// Design-Regeln (analog den übrigen Services):
//   - Vollständig lokal, deterministisch, KEIN LLM, KEIN Netzwerkzugriff.
//   - KEINE node:-Module (läuft im Browser/Vite).
//   - Eingaben werden nie mutiert; Rückgaben sind frische Objekte/Arrays.
//   - Defensive Fallbacks: fehlende/ungültige Eingaben liefern leere Ergebnisse.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Art eines Bühnen-Elements. */
export type StageElementKind = 'character' | 'prop' | 'door' | 'camera';

/** Ein Element auf der Bühne. */
export interface StageElement {
  /** Eindeutige ID. */
  id: string;
  /** Anzeigename. */
  label: string;
  /** Art. */
  kind: StageElementKind;
  /** Position auf der Bühne (Meter, Ursprung links oben). */
  x: number;
  /** Position auf der Bühne. */
  y: number;
  /** Blickrichtung in Grad (0 = nach rechts, 90 = nach unten im Raster). */
  rotation: number;
}

/** Kameraeinstellung. */
export type ShotSize = 'close-up' | 'medium' | 'wide' | 'extreme-wide';

/** Kamerawinkel. */
export type CameraAngle = 'eye-level' | 'low' | 'high' | 'birds-eye';

/** Eine Kamera mit Einstellung. */
export interface CameraSetup {
  /** Element-ID der Kamera. */
  cameraId: string;
  /** Einstellungsgröße. */
  shotSize: ShotSize;
  /** Kamerawinkel. */
  angle: CameraAngle;
  /** Brennweite in mm. */
  focalLength: number;
}

/** Ergebnis der Achsen-Prüfung. */
export interface AxisCheck {
  /** true, wenn kein Achsensprung vorliegt. */
  valid: boolean;
  /** Die Handlungsachse (zwei Figuren-IDs), falls bestimmbar. */
  axis: [string, string] | null;
  /** Seitenvorzeichen der Kamera relativ zur Achse (-1, 0, +1). */
  cameraSide: number;
  /** Vorherige Seite, falls eine frühere Einstellung übergeben wurde. */
  previousSide: number | null;
  /** true, wenn der Schnitt die Achse überspringt. */
  crossedAxis: boolean;
  /** Warnmeldung. */
  message: string;
}

/** Blickfeld-Berechnung. */
export interface Frustum {
  /** Kameraposition. */
  origin: { x: number; y: number };
  /** Blickrichtung in Grad. */
  direction: number;
  /** Halber Öffnungswinkel in Grad. */
  halfAngle: number;
  /** Reichweite in Metern. */
  range: number;
  /** Die beiden Randstrahlen als Endpunkte. */
  edges: Array<{ x: number; y: number }>;
  /** Bildausschnitt-Beschreibung. */
  framing: string;
}

/** Ergebnis der Blocking-Analyse. */
export interface BlockingReport {
  /** Anzahl Figuren. */
  characterCount: number;
  /** Anzahl Kameras. */
  cameraCount: number;
  /** Figuren, die einander anblicken. */
  sightLines: Array<{ from: string; to: string; angle: number }>;
  /** Warnungen (z. B. überlappende Positionen). */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Geometrie-Helfer
// ---------------------------------------------------------------------------

/** Rechnet Grad in Bogenmaß um. */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Rundet auf 2 Nachkommastellen. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Normalisiert einen Winkel auf [0, 360). */
function normalizeAngle(deg: number): number {
  const a = deg % 360;
  return a < 0 ? a + 360 : a;
}

/** Abstand zweier Punkte. */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return round2(Math.hypot(b.x - a.x, b.y - a.y));
}

/**
 * Richtungswinkel von A nach B in Grad (0 = nach rechts, gegen den Uhrzeigersinn
 * negativ, also Bildschirm-Konvention).
 */
export function angleBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return round2(normalizeAngle(deg));
}

/** Kleinste Winkeldifferenz zwischen zwei Richtungen (0–180). */
export function angleDifference(a: number, b: number): number {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b)) % 360;
  return round2(diff > 180 ? 360 - diff : diff);
}

// ---------------------------------------------------------------------------
// 1) 180-Grad-Achsen-Wächter
// ---------------------------------------------------------------------------

/**
 * Prüft, ob ein Kameraschnitt die Handlungsachse überspringt.
 *
 * Die Achse ist die Verbindungslinie zwischen den beiden Hauptfiguren. Eine
 * Kamera steht auf einer Seite dieser Linie (Vorzeichen des Kreuzprodukts).
 * Wechselt das Vorzeichen zwischen zwei Einstellungen, hat der Regisseur die
 * Achse übersprungen — im fertigen Film springen die Blickrichtungen.
 *
 * Defensiv: ohne zwei Figuren oder ohne Kamera ist `valid: true` (nichts zu
 * prüfen ist kein Fehler).
 */
export function checkAxisCrossing(
  elements: readonly StageElement[] | null | undefined,
  cameraId: string,
  previousCameraId?: string | null,
): AxisCheck {
  const list = Array.isArray(elements) ? elements : [];
  const characters = list.filter((e) => e.kind === 'character');

  if (characters.length < 2) {
    return {
      valid: true,
      axis: null,
      cameraSide: 0,
      previousSide: null,
      crossedAxis: false,
      message: 'Weniger als zwei Figuren — keine Handlungsachse bestimmbar.',
    };
  }

  const [a, b] = characters;
  const axis: [string, string] = [a.id, b.id];

  const sideOf = (el: StageElement | undefined): number => {
    if (!el) return 0;
    // Kreuzprodukt der Achse (a→b) mit dem Vektor (a→Kamera).
    const cross = (b.x - a.x) * (el.y - a.y) - (b.y - a.y) * (el.x - a.x);
    if (Math.abs(cross) < 1e-6) return 0;
    return cross > 0 ? 1 : -1;
  };

  const camera = list.find((e) => e.id === cameraId);
  const previous = previousCameraId ? list.find((e) => e.id === previousCameraId) : undefined;

  const cameraSide = sideOf(camera);
  const previousSide = previous ? sideOf(previous) : null;

  // Ein Achsensprung liegt nur vor, wenn beide Seiten bekannt und verschieden
  // sind. Eine Kamera exakt auf der Achse (0) ist neutral.
  const crossedAxis =
    previousSide !== null && cameraSide !== 0 && previousSide !== 0 && cameraSide !== previousSide;

  const message = crossedAxis
    ? `Achsensprung: Kamera „${camera?.label ?? cameraId}" steht auf der anderen Seite der Handlungsachse als „${previous?.label ?? previousCameraId}".`
    : cameraSide === 0
      ? 'Kamera steht auf der Achse — neutrale Einstellung.'
      : 'Achse eingehalten.';

  return {
    valid: !crossedAxis,
    axis,
    cameraSide,
    previousSide,
    crossedAxis,
    message,
  };
}

// ---------------------------------------------------------------------------
// 2) Blickfeld-Berechnung
// ---------------------------------------------------------------------------

/** Halber Öffnungswinkel je Einstellungsgröße (Grad). */
const FRUSTUM_HALF_ANGLE: Record<ShotSize, number> = {
  'close-up': 12,
  medium: 22,
  wide: 38,
  'extreme-wide': 55,
};

/** Reichweite je Einstellungsgröße (Meter). */
const FRUSTUM_RANGE: Record<ShotSize, number> = {
  'close-up': 4,
  medium: 10,
  wide: 25,
  'extreme-wide': 60,
};

/**
 * Berechnet das Sichtfeld einer Kamera.
 *
 * Defensiv: ohne Kamera wird ein leeres Frustum mit Ursprung (0,0) geliefert.
 */
export function computeFrustum(
  elements: readonly StageElement[] | null | undefined,
  setup: CameraSetup | null | undefined,
): Frustum {
  const list = Array.isArray(elements) ? elements : [];
  const camera = setup ? list.find((e) => e.id === setup.cameraId) : undefined;
  const shotSize = setup?.shotSize ?? 'medium';
  const angle = setup?.angle ?? 'eye-level';

  const halfAngle = FRUSTUM_HALF_ANGLE[shotSize] ?? 22;
  const range = FRUSTUM_RANGE[shotSize] ?? 10;
  const direction = camera ? normalizeAngle(camera.rotation) : 0;

  const origin = { x: camera?.x ?? 0, y: camera?.y ?? 0 };

  const edges = [-halfAngle, halfAngle].map((offset) => {
    const rad = toRad(direction + offset);
    return {
      x: round2(origin.x + Math.cos(rad) * range),
      y: round2(origin.y + Math.sin(rad) * range),
    };
  });

  const framing = [
    shotSize === 'close-up' ? 'Nahaufnahme' : shotSize === 'medium' ? 'Halbnah' : shotSize === 'wide' ? 'Totale' : 'Weite Totale',
    angle === 'eye-level' ? 'Augenhöhe' : angle === 'low' ? 'Untersicht' : angle === 'high' ? 'Aufsicht' : 'Vogelperspektive',
    setup?.focalLength ? `${setup.focalLength}mm` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return { origin, direction, halfAngle, range, edges, framing };
}

// ---------------------------------------------------------------------------
// 3) Blocking-Analyse
// ---------------------------------------------------------------------------

/**
 * Analysiert die Bühne: Blicklinien zwischen Figuren und Auffälligkeiten.
 *
 * Defensiv: eine leere Bühne liefert einen Null-Bericht.
 */
export function analyzeBlocking(
  elements: readonly StageElement[] | null | undefined,
): BlockingReport {
  const list = Array.isArray(elements) ? elements : [];
  const characters = list.filter((e) => e.kind === 'character');
  const cameras = list.filter((e) => e.kind === 'camera');
  const warnings: string[] = [];

  // Blicklinien: schaut Figur A in Richtung B (Toleranz 25 Grad)?
  const sightLines: Array<{ from: string; to: string; angle: number }> = [];
  for (const from of characters) {
    for (const to of characters) {
      if (from.id === to.id) continue;
      const target = angleBetween(from, to);
      const diff = angleDifference(from.rotation, target);
      if (diff <= 25) {
        sightLines.push({ from: from.id, to: to.id, angle: round2(diff) });
      }
    }
  }

  // Überlappende Positionen: zwei Elemente näher als 0,5 m.
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const d = distance(list[i], list[j]);
      if (d < 0.5) {
        warnings.push(`„${list[i].label}" und „${list[j].label}" stehen nur ${d} m auseinander.`);
      }
    }
  }

  if (cameras.length === 0 && characters.length > 0) {
    warnings.push('Keine Kamera auf der Bühne — es gibt keine Einstellung.');
  }
  if (characters.length === 0) {
    warnings.push('Keine Figuren auf der Bühne.');
  }

  return {
    characterCount: characters.length,
    cameraCount: cameras.length,
    sightLines,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 4) Szenen-Vorlage
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine Standard-Ensemble-Bühne (zwei Figuren gegenüber, Kamera davor).
 *
 * Defensiv: immer eine gültige, spielbare Bühne.
 */
export function buildDefaultStage(): StageElement[] {
  return [
    { id: 'fig-a', label: 'Mira', kind: 'character', x: 2, y: 3, rotation: 0 },
    { id: 'fig-b', label: 'Halden', kind: 'character', x: 8, y: 3, rotation: 180 },
    { id: 'cam-1', label: 'Kamera 1', kind: 'camera', x: 5, y: 7, rotation: 270 },
    { id: 'cam-2', label: 'Kamera 2', kind: 'camera', x: 5, y: -1, rotation: 90 },
    { id: 'prop-1', label: 'Tisch', kind: 'prop', x: 5, y: 3, rotation: 0 },
    { id: 'door-1', label: 'Tür', kind: 'door', x: 10, y: 0, rotation: 0 },
  ];
}
