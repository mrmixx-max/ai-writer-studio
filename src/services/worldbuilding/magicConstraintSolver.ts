/**
 * Magie-Constraint-Solver — WP 32.1 (Axiomatische Weltenphysik & Magie-Solver)
 *
 * Lokaler, deterministischer Service zur Definition von Axiomen,
 * Prüfung von Szenen auf Regelbrüche und Erkennung von Deus-ex-Machina.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Axiom {
  id: string;
  name: string;
  preconditions: string[];
  energyCost: number;
  limitations: string[];
}

export interface SceneAction {
  id: string;
  character: string;
  action: string;
  target?: string;
  context: string[];
}

export interface Violation {
  axiomId: string;
  reason: string;
  severity: 'error' | 'warning';
}

export interface ComplianceResult {
  compliant: boolean;
  violations: Violation[];
}

export interface DeusExMachinaResult {
  detected: boolean;
  reason: string;
  unestablishedAbilities: string[];
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Definiert ein Axiom mit Vorbedingungen, Energiekosten und Limitationen.
 */
export function defineAxiom(axiom: Axiom): Axiom {
  if (!axiom || typeof axiom !== 'object') {
    throw new Error('Ungültiges Axiom');
  }

  return {
    id: axiom.id?.trim() || `axiom-${Date.now()}`,
    name: axiom.name?.trim() || 'Unbenanntes Axiom',
    preconditions: axiom.preconditions || [],
    energyCost: Math.max(0, axiom.energyCost || 0),
    limitations: axiom.limitations || [],
  };
}

/**
 * Prüft eine Szene auf Regelbrüche.
 */
export function checkSceneCompliance(scene: SceneAction, axioms: Axiom[]): ComplianceResult {
  if (!scene || typeof scene !== 'object') {
    return { compliant: false, violations: [{ axiomId: '', reason: 'Ungültige Szene', severity: 'error' }] };
  }
  if (!axioms || axioms.length === 0) {
    return { compliant: true, violations: [] };
  }

  const violations: Violation[] = [];

  for (const axiom of axioms) {
    // Vorbedingungen prüfen
    for (const pre of axiom.preconditions) {
      if (!scene.context.includes(pre)) {
        violations.push({
          axiomId: axiom.id,
          reason: `Vorbedingung "${pre}" nicht erfüllt`,
          severity: 'error',
        });
      }
    }

    // Limitationen prüfen
    for (const lim of axiom.limitations) {
      if (scene.context.includes(lim)) {
        violations.push({
          axiomId: axiom.id,
          reason: `Limitation "${lim}" verletzt`,
          severity: 'warning',
        });
      }
    }
  }

  return { compliant: violations.length === 0, violations };
}

/**
 * Erkennt Deus-ex-Machina-Verstöße.
 */
export function detectDeusExMachina(
  scene: SceneAction,
  establishedAbilities: string[],
): DeusExMachinaResult {
  if (!scene || typeof scene !== 'object') {
    return { detected: false, reason: '', unestablishedAbilities: [] };
  }
  if (!establishedAbilities || establishedAbilities.length === 0) {
    return { detected: false, reason: '', unestablishedAbilities: [] };
  }

  const unestablished: string[] = [];
  const actionLower = scene.action.toLowerCase();

  for (const ability of establishedAbilities) {
    if (actionLower.includes(ability.toLowerCase())) {
      return { detected: false, reason: '', unestablishedAbilities: [] };
    }
  }

  // Prüfe ob die Aktion eine neue Fähigkeit ist
  const knownPatterns = ['teleport', 'feuer', 'eis', 'heil', 'unsichtbar', 'fliegen', 'lesen', 'schwert', 'magie'];
  const isKnown = knownPatterns.some((p) => actionLower.includes(p));

  if (!isKnown && actionLower.length > 3) {
    unestablished.push(scene.action);
  }

  return {
    detected: unestablished.length > 0,
    reason: unestablished.length > 0 ? `Nicht etablierte Fähigkeit: ${unestablished.join(', ')}` : '',
    unestablishedAbilities: unestablished,
  };
}
