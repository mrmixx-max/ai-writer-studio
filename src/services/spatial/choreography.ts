/**
 * Choreografie-Service — WP 26.2 (Räumliche Szenen-Choreografie & Sichtachsen)
 *
 * Lokaler, deterministischer Service zur Platzierung von Figuren auf einem
 * 2D-Raster, zur Berechnung von Sichtlinien (Line-of-Sight) und zur
 * Simulation von Schallausbreitung. Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type EntityType = 'character' | 'door' | 'cover' | 'obstacle';

export interface GridEntity {
  id: string;
  type: EntityType;
  x: number;
  y: number;
  rotation: number; // 0–360°
  name?: string;
}

export type ObstacleType = 'wall' | 'pillar' | 'door';

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  type: ObstacleType;
  blocksSight: boolean;
  blocksSound: boolean;
}

export interface LineOfSightResult {
  visible: boolean;
  blockedBy?: Obstacle;
  distance: number;
}

export type SoundType = 'whisper' | 'normal' | 'shout';

export interface SoundPropagationResult {
  audible: boolean;
  volume: number; // 0–1
  reason: string;
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

/** Maximale Hörweite pro Schalltyp (in Rastereinheiten). */
const MAX_HEARING_DISTANCE: Record<SoundType, number> = {
  whisper: 5,
  normal: 15,
  shout: 30,
};

/** Dämpfung pro Hindernis-Typ (multiplikativ). */
const SOUND_DAMPING: Record<ObstacleType, number> = {
  wall: 0.3,
  pillar: 0.5,
  door: 0.7,
};

/** Mindestlautstärke, um als "hörbar" zu gelten. */
const MIN_AUDIBLE_VOLUME = 0.05;

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/**
 * Normalisiert einen Winkel auf [0, 360).
 */
function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * Berechnet die euklidische Distanz zwischen zwei Punkten.
 */
function euclideanDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Berechnet den Schnittpunkt zweier 2D-Segmente.
 *
 * Segment 1: P1 + t * (P2 - P1), t ∈ [0, 1]
 * Segment 2: P3 + u * (P4 - P3), u ∈ [0, 1]
 *
 * Verwendet die Kreuzprodukt-Methode. Robust gegen Division-by-Zero:
 * Wenn der Nenner 0 ist, sind die Segmente parallel oder kollinear —
 * es gibt keinen eindeutigen Schnittpunkt.
 *
 * Gibt { t, u } zurück, wenn ein Schnittpunkt existiert, sonst null.
 */
function segmentIntersection(
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
  p4x: number, p4y: number,
): { t: number; u: number } | null {
  const dx1 = p2x - p1x;
  const dy1 = p2y - p1y;
  const dx2 = p4x - p3x;
  const dy2 = p4y - p3y;

  // Nenner = Kreuzprodukt der Richtungsvektoren
  const denominator = dx1 * dy2 - dy1 * dx2;

  // Parallel oder kollinear → kein eindeutiger Schnittpunkt
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }

  const dx3 = p3x - p1x;
  const dy3 = p3y - p1y;

  const t = (dx3 * dy2 - dy3 * dx2) / denominator;
  const u = (dx3 * dy1 - dy3 * dx1) / denominator;

  // Schnittpunkt muss auf beiden Segmenten liegen
  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }

  return { t, u };
}

/**
 * Prüft, ob ein Segment ein Rechteck schneidet.
 *
 * Das Rechteck wird als 4 Kanten (Segmente) repräsentiert. Ein Schnitt
 * mit einer der Kanten bedeutet, dass das Segment das Rechteck durchdringt.
 */
function segmentIntersectsRect(
  x1: number, y1: number,
  x2: number, y2: number,
  rx: number, ry: number,
  rw: number, rh: number,
): boolean {
  // Rechteck-Ecken
  const left = rx;
  const right = rx + rw;
  const top = ry;
  const bottom = ry + rh;

  // 4 Kanten des Rechtecks
  const edges: Array<[number, number, number, number]> = [
    [left, top, right, top],       // oben
    [right, top, right, bottom],   // rechts
    [right, bottom, left, bottom], // unten
    [left, bottom, left, top],     // links
  ];

  for (const [ex1, ey1, ex2, ey2] of edges) {
    if (segmentIntersection(x1, y1, x2, y2, ex1, ey1, ex2, ey2) !== null) {
      return true;
    }
  }

  return false;
}

// ─── Öffentliche API ─────────────────────────────────────────────────────────

/**
 * Platziert eine Figur auf dem 2D-Raster mit Blickwinkel.
 *
 * Defensive Fallbacks:
 * - Fehlende Koordinaten → 0
 * - Fehlender Winkel → 0
 * - Nicht-finite Werte → 0
 */
export function placeOnGrid(
  entity: GridEntity,
  x: number,
  y: number,
  rotation?: number,
): GridEntity {
  const safeX = Number.isFinite(x) ? x : 0;
  const safeY = Number.isFinite(y) ? y : 0;
  const safeRotation = rotation !== undefined && Number.isFinite(rotation)
    ? normalizeAngle(rotation)
    : (Number.isFinite(entity.rotation) ? normalizeAngle(entity.rotation) : 0);

  return {
    ...entity,
    x: safeX,
    y: safeY,
    rotation: safeRotation,
  };
}

/**
 * Berechnet geometrisch, ob Figur A freie Sicht auf Figur B hat.
 *
 * Raycasting: Ein Segment von A zu B wird gegen alle Hindernisse mit
 * blocksSight=true getestet. Schneidet ein Hindernis das Segment,
 * ist die Sicht blockiert.
 *
 * Defensive Fallbacks:
 * - Fehlende Entitäten → nicht sichtbar, Distanz 0
 * - Leere Hindernisliste → freie Sicht
 */
export function calculateLineOfSight(
  from: GridEntity,
  to: GridEntity,
  obstacles: Obstacle[],
): LineOfSightResult {
  // Defensive Fallbacks
  if (!from || !to) {
    return { visible: false, distance: 0 };
  }

  const fromX = Number.isFinite(from.x) ? from.x : 0;
  const fromY = Number.isFinite(from.y) ? from.y : 0;
  const toX = Number.isFinite(to.x) ? to.x : 0;
  const toY = Number.isFinite(to.y) ? to.y : 0;

  const distance = euclideanDistance(fromX, fromY, toX, toY);

  // Identische Position → immer sichtbar
  if (distance < 1e-10) {
    return { visible: true, distance: 0 };
  }

  if (!obstacles || obstacles.length === 0) {
    return { visible: true, distance };
  }

  // Prüfe jedes hindernis, das Sicht blockiert
  for (const obstacle of obstacles) {
    if (!obstacle || !obstacle.blocksSight) continue;

    const ox = Number.isFinite(obstacle.x) ? obstacle.x : 0;
    const oy = Number.isFinite(obstacle.y) ? obstacle.y : 0;
    const ow = Number.isFinite(obstacle.width) ? obstacle.width : 0;
    const oh = Number.isFinite(obstacle.height) ? obstacle.height : 0;

    if (ow <= 0 || oh <= 0) continue;

    if (segmentIntersectsRect(fromX, fromY, toX, toY, ox, oy, ow, oh)) {
      return { visible: false, blockedBy: obstacle, distance };
    }
  }

  return { visible: true, distance };
}

/**
 * Berechnet, ob Dialoge über Distanz und durch Türen hörbar sind.
 *
 * Die Lautstärke wird durch:
 * 1. Distanz (lineare Dämpfung bis zur Maximal-Hörweite)
 * 2. Hindernisse mit blocksSound=true (multiplikative Dämpfung pro Typ)
 *
 * bestimmt.
 *
 * Defensive Fallbacks:
 * - Fehlende Entitäten → nicht hörbar, volume 0
 * - Unbekannter Schalltyp → 'normal'
 * - Leere Hindernisliste → nur Distanzdämpfung
 */
export function calculateSoundPropagation(
  source: GridEntity,
  target: GridEntity,
  obstacles: Obstacle[],
  soundType: SoundType,
): SoundPropagationResult {
  // Defensive Fallbacks
  if (!source || !target) {
    return { audible: false, volume: 0, reason: 'Fehlende Entität' };
  }

  const safeSoundType: SoundType = soundType === 'whisper' || soundType === 'normal' || soundType === 'shout'
    ? soundType
    : 'normal';

  const sourceX = Number.isFinite(source.x) ? source.x : 0;
  const sourceY = Number.isFinite(source.y) ? source.y : 0;
  const targetX = Number.isFinite(target.x) ? target.x : 0;
  const targetY = Number.isFinite(target.y) ? target.y : 0;

  const distance = euclideanDistance(sourceX, sourceY, targetX, targetY);

  // Identische Position → immer hörbar
  if (distance < 1e-10) {
    return { audible: true, volume: 1, reason: 'Gleiche Position' };
  }

  const maxDistance = MAX_HEARING_DISTANCE[safeSoundType];

  // Zu weit entfernt → nicht hörbar
  if (distance > maxDistance) {
    return {
      audible: false,
      volume: 0,
      reason: `Distanz ${distance.toFixed(1)} überschreitet maximale Hörweite ${maxDistance} für ${safeSoundType}`,
    };
  }

  // Basis-Dämpfung durch Distanz (linear)
  let volume = 1 - (distance / maxDistance);

  // Dämpfung durch Hindernisse
  if (obstacles && obstacles.length > 0) {
    for (const obstacle of obstacles) {
      if (!obstacle || !obstacle.blocksSound) continue;

      const ox = Number.isFinite(obstacle.x) ? obstacle.x : 0;
      const oy = Number.isFinite(obstacle.y) ? obstacle.y : 0;
      const ow = Number.isFinite(obstacle.width) ? obstacle.width : 0;
      const oh = Number.isFinite(obstacle.height) ? obstacle.height : 0;

      if (ow <= 0 || oh <= 0) continue;

      if (segmentIntersectsRect(sourceX, sourceY, targetX, targetY, ox, oy, ow, oh)) {
        const damping = SOUND_DAMPING[obstacle.type] ?? 0.5;
        volume *= damping;
      }
    }
  }

  // Clamp auf [0, 1]
  volume = Math.max(0, Math.min(1, volume));

  const audible = volume >= MIN_AUDIBLE_VOLUME;

  return {
    audible,
    volume,
    reason: audible
      ? `Hörbar mit Lautstärke ${volume.toFixed(2)}`
      : `Zu leise (Lautstärke ${volume.toFixed(2)} < ${MIN_AUDIBLE_VOLUME})`,
  };
}
