/**
 * Cultural-Authenticity- & Tropen-Audit-Service — WP 49.1
 *
 * Lokaler, deterministischer Service zur Erkennung schädlicher Erzählmuster
 * (Tropen) und ableistischer Sprachfloskeln in Manuskripten.
 *
 * Keine LLM-Aufrufe. Alle Ergebnisse sind rein regelbasiert und damit
 * reproduzierbar. Defensive Fallbacks für ungültige Eingaben.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type TropeCategory =
  | 'incurable-evil'
  | 'white-savior'
  | 'bury-your-gays'
  | 'magical-negro'
  | 'damsel-in-distress'
  | 'other';

export type SensitivityCategory = 'ableist' | 'sexist' | 'racist' | 'other';

export type Severity = 'low' | 'medium' | 'high';

export interface TropeFinding {
  id: string;
  trope: string;
  category: TropeCategory;
  severity: Severity;
  excerpt: string;
  suggestion: string;
}

export interface SensitivityFinding {
  id: string;
  phrase: string;
  category: SensitivityCategory;
  severity: Severity;
  excerpt: string;
  suggestion: string;
}

export interface AuditReport {
  text: string;
  tropes: TropeFinding[];
  sensitivities: SensitivityFinding[];
  overallScore: number;
  summary: string;
}

// ─── Interne Definitionen ────────────────────────────────────────────────────

interface TropeDef {
  trope: string;
  category: TropeCategory;
  severity: Severity;
  /** Regex-Quelle ohne Delimiter/Flags; wird als `gi`-Regex ausgeführt. */
  source: string;
}

interface SensitivityDef {
  phrase: string;
  category: SensitivityCategory;
  severity: Severity;
  replacement: string;
  source: string;
}

const TROPE_DEFS: TropeDef[] = [
  {
    trope: 'incurable evil race',
    category: 'incurable-evil',
    severity: 'high',
    source: '(unbesiegbare|unheilbare|ewig böse).*(rasse|volk|wesen)',
  },
  {
    trope: 'white savior',
    category: 'white-savior',
    severity: 'high',
    source: '(weiße?r? held|retter).*(afrika|dritte welt|entwicklung)',
  },
  {
    trope: 'bury your gays',
    category: 'bury-your-gays',
    severity: 'high',
    source: '(schwul|lesbisch|queer).*(stirbt|tot|umgebracht)',
  },
  {
    trope: 'magical negro',
    category: 'magical-negro',
    severity: 'high',
    source: '(magische?r?|mystische?r?).*(schwarz|afro)',
  },
  {
    trope: 'damsel in distress',
    category: 'damsel-in-distress',
    severity: 'medium',
    source: '(prinzessin|frau).*(rettung|entführung)',
  },
];

const SENSITIVITY_DEFS: SensitivityDef[] = [
  {
    phrase: 'blind vor Wut',
    category: 'ableist',
    severity: 'medium',
    replacement: 'vor Wut',
    source: 'blind vor wut',
  },
  {
    phrase: 'gelähmt vor Schreck',
    category: 'ableist',
    severity: 'medium',
    replacement: 'vor Schreck erstarrt',
    source: 'gelähmt vor schreck',
  },
  {
    phrase: 'taub für Kritik',
    category: 'ableist',
    severity: 'medium',
    replacement: 'unempfänglich für Kritik',
    source: 'taub für kritik',
  },
  {
    phrase: 'lähmt',
    category: 'ableist',
    severity: 'medium',
    replacement: 'blockiert',
    source: 'lähmt',
  },
];

/** Wörtliche (körperliche) Kontexte, in denen „lähmt“ keine Metapher ist. */
const LITERAL_BODY_PART =
  /\b(muskeln?|arme?n?|beine?n?|hände?|füße?|körper|glieder|zunge|nerven|bewegung)\b/i;

const TROPE_ADVICE: Record<TropeCategory, string> = {
  'incurable-evil':
    'Zeige Figuren als Individuen mit eigenen Motiven statt als kollektiv böse Gruppe; vermeide die Gleichsetzung von Herkunft und Bosheit.',
  'white-savior':
    'Lass lokale Figuren selbst handeln und Verantwortung tragen; die Hauptfigur unterstützt, statt zu „retten“.',
  'bury-your-gays':
    'Gib queeren Figuren Handlungsmacht und ein Überleben jenseits des dramatischen Tods; prüfe, ob der Tod erzählerisch nötig ist.',
  'magical-negro':
    'Gib der Figur eigene Ziele, Konflikte und Entwicklung statt einer reinen Hilfe-Funktion für andere.',
  'damsel-in-distress':
    'Gib der Figur eigene Agency und aktive Entscheidungen, statt sie nur als Rettungsobjekt zu zeigen.',
  other:
    'Prüfe das Muster auf Stereotype und gib der betroffenen Figur Eigenständigkeit und Tiefe.',
};

const SENS_ADVICE: Record<SensitivityCategory, string> = {
  ableist:
    'Ersetze die ableistische Metapher durch eine wörtliche, körperneutrale Formulierung.',
  sexist: 'Formuliere geschlechtsneutral bzw. ohne abwertende Zuschreibung.',
  racist: 'Entferne rassistische Zuschreibungen und formuliere respektvoll und präzise.',
  other:
    'Prüfe die Formulierung auf diskriminierende Konnotationen und formuliere wertschätzend.',
};

const GENERIC_ADVICE =
  'Prüfe die Stelle auf stereotype oder diskriminierende Implikationen und formuliere sie bewusster.';

const SEVERITY_PENALTY: Record<Severity, number> = {
  low: 4,
  medium: 8,
  high: 15,
};

// ─── Helfer ──────────────────────────────────────────────────────────────────

/** Baut einen begrenzten Kontext-Ausschnitt um einen Treffer. */
function makeExcerpt(text: string, index: number, matchLength: number): string {
  const safeLength = Math.min(Math.max(matchLength, 0), 80);
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + safeLength + 20);
  let excerpt = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) excerpt = `…${excerpt}`;
  if (end < text.length) excerpt = `${excerpt}…`;
  return excerpt;
}

function buildSummary(tropeCount: number, sensitivityCount: number, score: number): string {
  if (tropeCount === 0 && sensitivityCount === 0) {
    return 'Keine kritischen Erzählmuster oder sprachlichen Sensibilitäten gefunden.';
  }
  return `Es wurden ${tropeCount} Tropen und ${sensitivityCount} sprachliche Sensibilitäten gefunden (Score: ${score}/100).`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Tropen-Radar: erkennt schädliche Erzählmuster im Text.
 */
export function scanForTropes(text: string): TropeFinding[] {
  if (!text || typeof text !== 'string') return [];

  const findings: TropeFinding[] = [];
  let counter = 0;

  for (const def of TROPE_DEFS) {
    const re = new RegExp(def.source, 'gi');
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      counter += 1;
      findings.push({
        id: `trope-${counter}`,
        trope: def.trope,
        category: def.category,
        severity: def.severity,
        excerpt: makeExcerpt(text, match.index, match[0].length),
        suggestion: TROPE_ADVICE[def.category],
      });
    }
  }

  return findings;
}

/**
 * Prüft den Text auf ableistische (und weitere) Floskeln.
 */
export function checkLinguisticSensitivity(text: string): SensitivityFinding[] {
  if (!text || typeof text !== 'string') return [];

  const findings: SensitivityFinding[] = [];
  let counter = 0;

  for (const def of SENSITIVITY_DEFS) {
    const re = new RegExp(`\\b${def.source}\\b`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }

      // „lähmt“ nur im übertragenen Sinne melden, nicht bei Körperbezug.
      if (def.phrase === 'lähmt') {
        const after = text.slice(match.index + match[0].length, match.index + match[0].length + 30);
        if (LITERAL_BODY_PART.test(after)) continue;
      }

      counter += 1;
      findings.push({
        id: `sens-${counter}`,
        phrase: def.phrase,
        category: def.category,
        severity: def.severity,
        excerpt: makeExcerpt(text, match.index, match[0].length),
        suggestion: `${SENS_ADVICE[def.category]} Konkret: „${def.phrase}“ → „${def.replacement}“.`,
      });
    }
  }

  return findings;
}

/**
 * Liefert einen konstruktiven Verbesserungsvorschlag für einen Befund.
 */
export function suggestImprovements(finding: TropeFinding | SensitivityFinding): string {
  if (!finding || typeof finding !== 'object') return GENERIC_ADVICE;

  if ('trope' in finding) {
    const category = (finding as TropeFinding).category;
    return TROPE_ADVICE[category] ?? TROPE_ADVICE.other;
  }

  const category = (finding as SensitivityFinding).category;
  return SENS_ADVICE[category] ?? SENS_ADVICE.other;
}

/**
 * Erstellt einen vollständigen Audit-Bericht für einen Text.
 */
export function generateAuditReport(text: string): AuditReport {
  const safeText = typeof text === 'string' ? text : '';

  const tropes = scanForTropes(safeText);
  const sensitivities = checkLinguisticSensitivity(safeText);

  const penalty =
    tropes.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0) +
    sensitivities.reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);

  const overallScore = Math.max(0, Math.min(100, 100 - penalty));

  return {
    text: safeText,
    tropes,
    sensitivities,
    overallScore,
    summary: buildSummary(tropes.length, sensitivities.length, overallScore),
  };
}
