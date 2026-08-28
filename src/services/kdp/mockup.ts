// 3D-Buchcover-Mockup: berechnet Perspektive, Spine-Breite und Transform
// für die Cover-Vorschau. Rein deterministisch (testbar ohne DOM).

/** Maße der 3D-Buchvorschau. */
export interface MockupSpec {
  /** Front-Cover-Breite in px. */
  frontWidth: number;
  /** Front-Cover-Höhe in px. */
  frontHeight: number;
  /** Seitenverhältnis des Covers (Breite/Höhe). */
  aspectRatio: number;
  /** Buchdicke in px (Spine). */
  spineWidth: number;
  /** CSS-perspective-Wert in px. */
  perspective: number;
  /** CSS-Transform für die Gesamtgruppe. */
  groupTransform: string;
  /** CSS-Transform des Rückens (Spine). */
  spineTransform: string;
}

/** KDP-empfohlenes Seitenverhältnis (1.6) und Standard-Viewport-Mockup. */
export const DEFAULT_MOCKUP_OPTIONS = {
  frontWidth: 260,
  aspectRatio: 1.6,
  /** px dicke pro 100 Seiten (grob). */
  pxPerHundredPages: 6,
} as const;

/** Berechnet die Spezifikation für das 3D-Mockup. */
export function computeMockupSpec(
  pageCount: number,
  options: Partial<typeof DEFAULT_MOCKUP_OPTIONS> = {},
): MockupSpec {
  const opts = { ...DEFAULT_MOCKUP_OPTIONS, ...options };
  const frontWidth = opts.frontWidth;
  const frontHeight = Math.round(frontWidth * opts.aspectRatio);
  const spineWidth = Math.max(
    8,
    Math.round((Math.max(pageCount, 50) / 100) * opts.pxPerHundredPages),
  );
  return {
    frontWidth,
    frontHeight,
    aspectRatio: opts.aspectRatio,
    spineWidth,
    perspective: 900,
    groupTransform: "rotateY(-22deg) rotateX(6deg)",
    spineTransform: `translateX(-100%) rotateY(90deg) translateZ(${-spineWidth}px)`,
  };
}

/** Berechnet die Anzeige-Größe für ein eingebettetes Cover-Bild (Object-fit). */
export function coverDisplaySize(
  imageWidth: number,
  imageHeight: number,
  maxSide: number,
): { width: number; height: number } {
  if (imageWidth <= 0 || imageHeight <= 0) return { width: maxSide, height: maxSide };
  const scale = Math.min(maxSide / imageWidth, maxSide / imageHeight, 1);
  return {
    width: Math.round(imageWidth * scale),
    height: Math.round(imageHeight * scale),
  };
}
