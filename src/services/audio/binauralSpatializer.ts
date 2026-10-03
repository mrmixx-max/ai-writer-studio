// Binaural-Spatializer-Service (WP 36.2 — 3D-Spatialisierung / HRTF-Näherung).
//
// Berechnet wahrnehmungsnahe räumliche Parameter aus Kugelkoordinaten:
// - ITD (Interaural Time Difference) via Woodworth-Näherung.
// - ILD (Interaural Level Difference) als frequenzunabhängige Pegeldifferenz.
// - Doppler-Effekt für bewegte Quellen.
// - Export einer 3D-Panning-Timeline für DAW-Tools (Reaper, Pro Tools, ...).
//
// Design-Vertrag:
// - Rein lokal & deterministisch: KEIN LLM-Call, kein Netzwerk, keine Audio-IO.
// - Defensive Fallbacks: NaN/Infinity/negative Distanz werden auf Defaults
//   abgebildet. Distanz 0 erzeugt KEINE Singularität und KEINE Phasen-Auslöschung.
// - Gleiche Eingabe ⇒ gleiche Ausgabe.

// --- Types ---------------------------------------------------------------------------

/** Räumliche Position eines Klangkörpers inkl. wahrnehmungsnaher Parameter. */
export interface SpatialPosition {
  /** Azimut in Grad (-180..180; 0 = frontal, +90 = rechts). */
  azimuth: number;
  /** Elevation in Grad (-90..90; +90 = oben). */
  elevation: number;
  /** Distanz in Metern (>= 0). */
  distance: number;
  /** Interaurale Zeitdifferenz in Millisekunden (Vorzeichen: + = rechtes Ohr führt). */
  itdMs: number;
  /** Interaurale Pegeldifferenz in dB (Vorzeichen: + = rechts lauter). */
  ildDb: number;
  /** Verstärkungsfaktor linkes Ohr in (0, 1]. */
  leftGain: number;
  /** Verstärkungsfaktor rechtes Ohr in (0, 1]. */
  rightGain: number;
}

/** Ein einzelner räumlicher Cue für die Timeline. */
export interface SpatialCue {
  id: string;
  azimuth: number;
  elevation: number;
  distance: number;
  startTimeMs: number;
  durationMs: number;
}

/** Ergebnis der Doppler-Simulation. */
export interface DopplerResult {
  /** Beobachtete (verschobene) Frequenz in Hz. */
  observedFrequency: number;
  /** Absolute Frequenzverschiebung in Hz (observed - source). */
  shift: number;
}

// --- Konstanten ----------------------------------------------------------------------

/** Schallgeschwindigkeit in Luft bei ~20 °C in m/s. */
export const SPEED_OF_SOUND = 343;

/** Maximaler ITD-Wert in ms (Kopfbreite ~17.5 cm, 90° Azimut). */
export const MAX_ITD_MS = 0.63;

/** Maximaler ILD-Wert in dB bei hohen Frequenzen und 90° Azimut. */
export const MAX_ILD_DB = 20;

/** Standard-Distanz in Metern, wenn keine gültige angegeben ist. */
export const DEFAULT_DISTANCE = 1;

/** Standard-Frequenz in Hz, wenn keine gültige angegeben ist. */
export const DEFAULT_FREQUENCY = 440;

/** Sicherheitsfaktor: Quellengeschwindigkeit wird auf ±99 % der Schallgeschwindigkeit begrenzt. */
const MAX_VELOCITY_RATIO = 0.99;

// --- Kleine, defensive Helfer --------------------------------------------------------

/** Liefert value, falls endlich, sonst fallback. */
function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/** Begrenzt auf [min, max]; NaN/Infinity → min. */
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Normalisiert einen Winkel in Grad auf (-180, 180]. */
function normalizeAzimuth(deg: number): number {
  const wrapped = (((deg + 180) % 360) + 360) % 360 - 180;
  // -180 → 180 für eine symmetrischere Darstellung.
  return wrapped === -180 ? 180 : wrapped;
}

const DEG_TO_RAD = Math.PI / 180;

// --- Kernfunktionen ------------------------------------------------------------------

/**
 * Berechnet die räumliche Position aus Kugelkoordinaten.
 *
 * ITD nutzt die Woodworth-Näherung, normiert auf {@link MAX_ITD_MS}:
 *   ITD(az) = MAX_ITD_MS * sin(az)
 * Damit ist ITD(0°)=0, ITD(±90°)=±MAX_ITD_MS und ITD(180°)=0.
 *
 * ILD wird analog als reine Azimut-Abhängigkeit modelliert und auf
 * {@link MAX_ILD_DB} normiert. Die Verstärkungen werden so verteilt, dass das
 * lautere Ohr den Faktor 1 erhält und das leisere nie 0 erreicht
 * (keine vollständige Auslöschung).
 *
 * ITD/ILD sind bewusst distanzunabhängig — eine Distanz von 0 erzeugt daher
 * weder Singularitäten noch Phasen-Auslöschungen.
 *
 * @param azimuth  Azimut in Grad.
 * @param elevation Elevation in Grad (wird auf [-90, 90] begrenzt).
 * @param distance Distanz in Metern (wird auf >= 0 begrenzt).
 */
export function calculateSpatialPosition(
  azimuth: number,
  elevation: number,
  distance: number,
): SpatialPosition {
  const az = normalizeAzimuth(finiteOr(azimuth, 0));
  const el = clamp(finiteOr(elevation, 0), -90, 90);
  const dist = Math.max(0, finiteOr(distance, DEFAULT_DISTANCE));

  const azRad = az * DEG_TO_RAD;
  const sinAz = Math.sin(azRad);

  // ITD: distanzunabhängig, stets im Bereich [-MAX_ITD_MS, MAX_ITD_MS].
  const itdMs = MAX_ITD_MS * sinAz;

  // ILD: distanzunabhängig, stets im Bereich [-MAX_ILD_DB, MAX_ILD_DB].
  const ildDb = MAX_ILD_DB * sinAz;

  // Symmetrische Pegelverteilung: lauteres Ohr = 1, leisere Seite = 10^(-ILD/20).
  const halfDb = ildDb / 2;
  const rawLeft = Math.pow(10, -halfDb / 20);
  const rawRight = Math.pow(10, halfDb / 20);
  const peak = Math.max(rawLeft, rawRight) || 1;
  const leftGain = rawLeft / peak;
  const rightGain = rawRight / peak;

  return {
    azimuth: az,
    elevation: el,
    distance: dist,
    itdMs,
    ildDb,
    leftGain,
    rightGain,
  };
}

/**
 * Simuliert den Doppler-Effekt für eine sich bewegende Quelle.
 *
 * Klassische Formel (positive Velocity = Quelle nähert sich):
 *   f_obs = f * c / (c - v)
 *
 * Die Quellengeschwindigkeit wird defensiv auf ±99 % der Schallgeschwindigkeit
 * begrenzt, sodass der Nenner nie 0 oder negativ wird — es entsteht keine
 * Singularität und keine Vorzeichenumkehr.
 *
 * @param sourceVelocity Geschwindigkeit der Quelle in m/s (+ = nähernd).
 * @param frequency      Ruhe-Frequenz der Quelle in Hz.
 */
export function calculateDopplerEffect(
  sourceVelocity: number,
  frequency: number,
): DopplerResult {
  const f = Math.max(1e-6, finiteOr(frequency, DEFAULT_FREQUENCY));
  const maxV = SPEED_OF_SOUND * MAX_VELOCITY_RATIO;
  const v = clamp(finiteOr(sourceVelocity, 0), -maxV, maxV);

  const denominator = SPEED_OF_SOUND - v;
  // denominator >= SPEED_OF_SOUND * (1 - 0.99) = ~3.43 → nie 0.
  const observedFrequency = (f * SPEED_OF_SOUND) / denominator;

  return {
    observedFrequency,
    shift: observedFrequency - f,
  };
}

// --- Timeline-Export -----------------------------------------------------------------

/** Prüft, ob ein Cue alle für den Export nötigen, endlichen Felder besitzt. */
function isValidCue(cue: SpatialCue | null | undefined): cue is SpatialCue {
  if (!cue || typeof cue !== "object") return false;
  return (
    typeof cue.id === "string" &&
    cue.id.length > 0 &&
    Number.isFinite(cue.azimuth) &&
    Number.isFinite(cue.elevation) &&
    Number.isFinite(cue.distance) &&
    Number.isFinite(cue.startTimeMs) &&
    Number.isFinite(cue.durationMs)
  );
}

/**
 * Exportiert eine 3D-Panning-Timeline als Text für DAW-Tools.
 *
 * Format: Kommentar-Header (beginnend mit '#') gefolgt von einer tab-separierten
 * Datenzeile je Cue. Die Cues werden nach Startzeit sortiert. Ungültige Cues
 * (NaN/Infinity/fehlende Felder) werden defensiv übersprungen.
 */
export function exportSpatialTimeline(cues: SpatialCue[]): string {
  const safeCues = Array.isArray(cues) ? cues.filter(isValidCue) : [];

  const header = [
    "# ai-writer-studio — Spatial Audio Timeline (WP 36.2)",
    "# Format: id\taz(deg)\tel(deg)\tdist(m)\tstart(ms)\tdur(ms)\titd(ms)\tild(dB)\tL\tR",
    "# Import: tab-separiert, Zeilen ohne '#' sind Daten.",
  ].join("\n");

  const dataLines = safeCues
    .slice()
    .sort((a, b) => a.startTimeMs - b.startTimeMs)
    .map((cue) => {
      const pos = calculateSpatialPosition(cue.azimuth, cue.elevation, cue.distance);
      return [
        cue.id,
        pos.azimuth,
        pos.elevation,
        pos.distance,
        cue.startTimeMs,
        cue.durationMs,
        pos.itdMs.toFixed(3),
        pos.ildDb.toFixed(2),
        pos.leftGain.toFixed(4),
        pos.rightGain.toFixed(4),
      ].join("\t");
    });

  return [header, ...dataLines].join("\n") + "\n";
}
