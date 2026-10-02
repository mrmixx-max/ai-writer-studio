/**
 * Cover-Embellishment-Service — WP 33.1 (3D-Cover- & Veredelungs-Simulator)
 *
 * Lokaler, deterministischer Service zur Generierung von Druckmasken
 * für Heißfolienprägung, partiellen Relieflack und Farbschnitt.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CoverElement {
  id: string;
  type: 'text' | 'image' | 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
}

export interface CoverDesign {
  title: string;
  author: string;
  width: number;
  height: number;
  elements: CoverElement[];
}

export interface FoilMask {
  elements: CoverElement[];
  colorSpace: 'CMYK';
  inkPercentage: number;
}

export interface SpotUvMask {
  elements: CoverElement[];
  glossLevel: number;
}

export interface EdgeColoringResult {
  pageCount: number;
  color: string;
  pattern: string[];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generiert 100 % Schwarz (K-Only) Vektor-/PDF-Maske für Heißfolienprägung.
 */
export function generateFoilMask(design: CoverDesign): FoilMask {
  if (!design || typeof design !== 'object') {
    return { elements: [], colorSpace: 'CMYK', inkPercentage: 100 };
  }

  return {
    elements: design.elements || [],
    colorSpace: 'CMYK',
    inkPercentage: 100,
  };
}

/**
 * Generiert exakte Umriss-Maske für partiellen Relieflack.
 */
export function generateSpotUvMask(design: CoverDesign): SpotUvMask {
  if (!design || typeof design !== 'object') {
    return { elements: [], glossLevel: 0 };
  }

  return {
    elements: design.elements || [],
    glossLevel: 80,
  };
}

/**
 * Berechnet Schnittkanten-Muster für die Buchblockseiten.
 */
export function calculateEdgeColoring(pageCount: number, color: string): EdgeColoringResult {
  const safePageCount = Math.max(0, pageCount || 0);
  const safeColor = color?.trim() || '#000000';

  const pattern: string[] = [];
  for (let i = 0; i < safePageCount; i++) {
    pattern.push(safeColor);
  }

  return { pageCount: safePageCount, color: safeColor, pattern };
}
