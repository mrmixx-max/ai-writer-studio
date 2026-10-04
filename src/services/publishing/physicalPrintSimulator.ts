// Physical-Print-Simulator (WP 45.2): Rückenbreiten-, Umschlag- und
// 3D-Hardcover-Berechnung für den Druck-Preview-Workflow.
//
// Rein deterministisch, keine LLM-Abhängigkeit, defensive Fallbacks:
// ungültige Eingaben (NaN, Infinity, negative Werte, unbekannte Enum-Werte)
// werden auf sichere Defaults abgebildet, statt zu werfen.

// ---------------------------------------------------------------------------
// Öffentliche Typen
// ---------------------------------------------------------------------------

export type PaperType =
  | "offset80"
  | "werkdruck90"
  | "werkdruck90_175"
  | "bilderdruck100";

export type BindingType = "softcover" | "hardcover";

export interface PaperPreset {
  /** Stabile ID (gleichzeitig PaperType). */
  id: PaperType;
  /** Anzeigename für die UI. */
  label: string;
  /** Flächengewicht in g/m². */
  grammage: number;
  /** Volumen (Bulking-Faktor) in cm³/g. */
  volume: number;
}

export interface SpineResult {
  /** Millimetergenaue Rückenbreite inkl. Umschlagzugabe. */
  spineWidthMm: number;
  paper: PaperType;
  binding: BindingType;
  pageCount: number;
  /** Zugabe für die Umschlagdicke (0.6mm Hardcover, 0.2mm Softcover). */
  coverAllowanceMm: number;
}

export interface TrimSize {
  widthMm: number;
  heightMm: number;
  label: string;
}

export interface CoverDimensions {
  /** Gesamtbreite: Rückseite + Rücken + Vorderseite + 2× Beschnitt. */
  totalWidthMm: number;
  /** Gesamthöhe: Trimmhöhe + 2× Beschnitt. */
  totalHeightMm: number;
  frontWidthMm: number;
  spineWidthMm: number;
  backWidthMm: number;
  bleedMm: number;
}

export interface HardcoverOptions {
  dustjacketFlaps: boolean;
  flapWidthMm?: number;
  roundedSpine: boolean;
}

export interface HardcoverSimulation {
  /** Falz (Gelenk) zwischen Deckel und Rücken in mm. */
  jointMm: number;
  /** Stützpunkte der Rückenkurve (x entlang der Rückenbreite, y = Wölbung). */
  spineCurve: { x: number; y: number }[];
  /** Breite der Schutzumschlag-Einschläge in mm (0 = keine). */
  flapWidthMm: number;
  /** Gesamttiefe des geschlossenen Hardcovers in mm. */
  totalDepthMm: number;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Zugabe für die Umschlagdicke je Bindungstyp. */
export const COVER_ALLOWANCE_HARDCOVER_MM = 0.6;
export const COVER_ALLOWANCE_SOFTCOVER_MM = 0.2;

/** Standard-Beschnitt (Bleed) an allen Seiten. */
export const DEFAULT_BLEED_MM = 3;

/** Standard-Falz (Gelenk) eines Hardcover-Deckels. */
export const HARDCOVER_JOINT_MM = 8;

/** Deckelstärke eines Hardcover-Buchs (Graupappe). */
export const HARDCOVER_BOARD_THICKNESS_MM = 2.5;

/** Standardbreite der Schutzumschlag-Einschläge. */
export const DEFAULT_FLAP_WIDTH_MM = 80;

/** Anzahl der Stützpunkte der Rückenkurve (Segmente + 1). */
export const SPINE_CURVE_SEGMENTS = 16;

/** Fallback-Trimmgröße (A5), wenn keine gültige Angabe vorliegt. */
export const DEFAULT_TRIM_SIZE: TrimSize = {
  widthMm: 148,
  heightMm: 210,
  label: "A5",
};

/** Verfügbare Papier-Presets (Reihenfolge = UI-Reihenfolge). */
export const PAPER_PRESETS: readonly PaperPreset[] = [
  { id: "offset80", label: "Offset 80 g/m²", grammage: 80, volume: 1.0 },
  { id: "werkdruck90", label: "Werkdruck 90 g/m²", grammage: 90, volume: 1.5 },
  {
    id: "werkdruck90_175",
    label: "Werkdruck 90 g/m² (Vol. 1,75)",
    grammage: 90,
    volume: 1.75,
  },
  {
    id: "bilderdruck100",
    label: "Bilderdruck 100 g/m²",
    grammage: 100,
    volume: 0.9,
  },
] as const;

// ---------------------------------------------------------------------------
// Interne Helfer
// ---------------------------------------------------------------------------

/** Rundet auf zwei Nachkommastellen (millimetergenau). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Liefert ein endliches, nicht-negatives Maß oder den Fallback. */
function safePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/** Bildet eine Seitenzahl auf eine ganze, nicht-negative Zahl ab. */
function sanitizePageCount(pageCount: number): number {
  if (!Number.isFinite(pageCount) || pageCount <= 0) return 0;
  return Math.floor(pageCount);
}

/** Löst ein Papier-Preset auf; unbekannte IDs fallen auf Offset 80 zurück. */
function resolvePreset(paper: PaperType): PaperPreset {
  const preset = PAPER_PRESETS.find((p) => p.id === paper);
  return preset ?? PAPER_PRESETS[0];
}

/** Bildet den Bindungstyp auf einen gültigen Wert ab (Default: softcover). */
function resolveBinding(binding: BindingType): BindingType {
  return binding === "hardcover" ? "hardcover" : "softcover";
}

/** Zugabe für die Umschlagdicke je Bindungstyp. */
function allowanceFor(binding: BindingType): number {
  return binding === "hardcover"
    ? COVER_ALLOWANCE_HARDCOVER_MM
    : COVER_ALLOWANCE_SOFTCOVER_MM;
}

/** Sanitisiert eine Trimmgröße gegen ungültige Werte. */
function sanitizeTrim(trim: TrimSize | undefined | null): TrimSize {
  const width = safePositive(trim?.widthMm ?? NaN, DEFAULT_TRIM_SIZE.widthMm);
  const height = safePositive(trim?.heightMm ?? NaN, DEFAULT_TRIM_SIZE.heightMm);
  const label =
    typeof trim?.label === "string" && trim.label.length > 0
      ? trim.label
      : `${width}x${height}`;
  return { widthMm: width, heightMm: height, label };
}

/**
 * Erzeugt die Stützpunkte der Rückenkurve.
 * - flach: gerade Linie (y = 0)
 * - gerundet: Halbkreis mit Radius = Rückenbreite / 2
 */
function buildSpineCurve(
  spineWidthMm: number,
  rounded: boolean,
): { x: number; y: number }[] {
  const width = spineWidthMm > 0 ? spineWidthMm : 0;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= SPINE_CURVE_SEGMENTS; i++) {
    const x = round2((width * i) / SPINE_CURVE_SEGMENTS);
    let y = 0;
    if (rounded && width > 0) {
      const r = width / 2;
      const dx = x - r;
      y = round2(Math.sqrt(Math.max(0, r * r - dx * dx)));
    }
    points.push({ x, y });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Millimetergenaue Rückenbreite.
 *
 * Formel: spineWidth = (pageCount / 2) * (grammage / 1000) * volume + allowance
 * Die Umschlagzugabe beträgt 0.6mm (Hardcover) bzw. 0.2mm (Softcover).
 *
 * Defensive Fallbacks: ungültige Seitenzahl → 0, unbekanntes Papier →
 * Offset 80, unbekannter Bindungstyp → Softcover.
 */
export function calculateSpineWidth(
  pageCount: number,
  paper: PaperType,
  binding: BindingType,
): SpineResult {
  const safePageCount = sanitizePageCount(pageCount);
  const preset = resolvePreset(paper);
  const safeBinding = resolveBinding(binding);
  const allowance = allowanceFor(safeBinding);

  const sheets = safePageCount / 2;
  const thicknessPerSheet = (preset.grammage / 1000) * preset.volume;
  const rawSpine = sheets * thicknessPerSheet;

  return {
    spineWidthMm: round2(rawSpine + allowance),
    paper: preset.id,
    binding: safeBinding,
    pageCount: safePageCount,
    coverAllowanceMm: allowance,
  };
}

/**
 * Umschlagmaße (Vorderseite + Rücken + Rückseite + Beschnitt).
 * Vorder- und Rückseite entsprechen der Trimmbreite; der Beschnitt (3mm
 * Standard) wird an Breite und Höhe beidseitig addiert.
 *
 * Defensive Fallbacks: ungültige Rückenbreite → 0, ungültige Trimmgröße →
 * A5 (148×210mm).
 */
export function calculateCoverDimensions(
  spine: SpineResult,
  trimSize: TrimSize,
): CoverDimensions {
  const trim = sanitizeTrim(trimSize);
  const spineWidth = safePositive(spine?.spineWidthMm ?? NaN, 0);
  const bleed = DEFAULT_BLEED_MM;

  const frontWidth = trim.widthMm;
  const backWidth = trim.widthMm;

  return {
    totalWidthMm: round2(backWidth + spineWidth + frontWidth + 2 * bleed),
    totalHeightMm: round2(trim.heightMm + 2 * bleed),
    frontWidthMm: round2(frontWidth),
    spineWidthMm: round2(spineWidth),
    backWidthMm: round2(backWidth),
    bleedMm: bleed,
  };
}

/**
 * 3D-Vorschau-Daten für ein Hardcover.
 *
 * - jointMm: Standard-Falz zwischen Deckel und Rücken.
 * - spineCurve: Stützpunkte der Rückenkurve (gerundet → Halbkreis, sonst flach).
 * - flapWidthMm: Einschlagbreite bei Schutzumschlag (Default 80mm, sonst 0).
 * - totalDepthMm: Gesamttiefe = Rückenbreite + 2× Deckelstärke.
 *
 * Defensive Fallbacks: fehlende Options → { dustjacketFlaps: false,
 * roundedSpine: false }; ungültige Maße → 0.
 */
export function simulate3dHardcover(
  dims: CoverDimensions,
  options?: HardcoverOptions,
): HardcoverSimulation {
  const safeOptions: HardcoverOptions = {
    dustjacketFlaps: options?.dustjacketFlaps === true,
    flapWidthMm: options?.flapWidthMm,
    roundedSpine: options?.roundedSpine === true,
  };

  const spineWidth = safePositive(dims?.spineWidthMm ?? NaN, 0);

  const flapWidthMm = safeOptions.dustjacketFlaps
    ? safePositive(safeOptions.flapWidthMm ?? NaN, DEFAULT_FLAP_WIDTH_MM)
    : 0;

  const totalDepthMm = round2(
    spineWidth + 2 * HARDCOVER_BOARD_THICKNESS_MM,
  );

  return {
    jointMm: HARDCOVER_JOINT_MM,
    spineCurve: buildSpineCurve(spineWidth, safeOptions.roundedSpine),
    flapWidthMm: round2(flapWidthMm),
    totalDepthMm,
  };
}

/** Liefert die verfügbaren Papier-Presets (defensive Kopie). */
export function listPaperPresets(): PaperPreset[] {
  return PAPER_PRESETS.map((p) => ({ ...p }));
}
