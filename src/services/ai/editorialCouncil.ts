/**
 * Editorial-Council-Service — WP 35.1 (Autonomer 4-Köpfe-Lektoren-Rat)
 *
 * Lokaler, deterministischer Service zur Durchführung von 4 Lektoren-Perspektiven
 * und Konsens-Synthese.
 * Keine LLM-Aufrufe.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LektorFinding {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  position?: number;
}

export interface CouncilReport {
  plotChirurg: LektorFinding[];
  figurenPsychologe: LektorFinding[];
  kontinuitaetsPedant: LektorFinding[];
  stilGourmet: LektorFinding[];
}

export interface ConsensusSummary {
  totalFindings: number;
  errors: number;
  warnings: number;
  infos: number;
  topIssues: string[];
}

// ─── Konstanten ──────────────────────────────────────────────────────────────

const PASSIV_PATTERN = /\b(wurde|wurden|wird|werden|ist|sind)\b/gi;
const FUELLWORT_PATTERN = /\b(eigentlich|grundsätzlich|im Grunde|sozusagen|gewissermaßen)\b/gi;


// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Führt 4 Lektoren-Perspektiven aus und synthetisiert Konsens.
 */
export function runEditorialCouncil(chapter: string): CouncilReport {
  if (!chapter || typeof chapter !== 'string') {
    return { plotChirurg: [], figurenPsychologe: [], kontinuitaetsPedant: [], stilGourmet: [] };
  }

  const plotChirurg: LektorFinding[] = [];
  const figurenPsychologe: LektorFinding[] = [];
  const kontinuitaetsPedant: LektorFinding[] = [];
  const stilGourmet: LektorFinding[] = [];
  const finding = (type: string, severity: 'error' | 'warning' | 'info', message: string): LektorFinding => ({ type, severity, message });


  // Plot-Chirurg: Pacing und Spannung
  const sentences = chapter.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  if (sentences.length > 20) {
    plotChirurg.push(finding('pacing', 'warning', 'Langer Textabschnitt ohne Pausen'));
  }

  // Figuren-Psychologe: Dialoge
  const dialogues = chapter.match(/„[^"»]+»/g) || [];
  if (dialogues.length > 5) {
    figurenPsychologe.push(finding('dialog', 'info', 'Viele Dialoge — prüfe Natürlichkeit'));
  }

  // Kontinuitäts-Pedant: Wiederholungen
  const words = chapter.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length > 0 && uniqueWords.size / words.length < 0.3) {
    kontinuitaetsPedant.push(finding('repetition', 'warning', 'Hohe Wortwiederholungsrate'));
  }

  // Stil-Gourmet: Passiv und Füllwörter
  const passivCount = (chapter.match(PASSIV_PATTERN) || []).length;
  if (passivCount > 3) {
    stilGourmet.push(finding('passive', 'warning', `${passivCount} Passivkonstruktionen gefunden`));
  }

  const fuellwortCount = (chapter.match(FUELLWORT_PATTERN) || []).length;
  if (fuellwortCount > 0) {
    stilGourmet.push(finding('filler', 'info', `${fuellwortCount} Füllwörter gefunden`));
  }

  return { plotChirurg, figurenPsychologe, kontinuitaetsPedant, stilGourmet };
}

/**
 * Fasst alle 4 Gutachten zusammen.
 */
export function getCouncilConsensus(report: CouncilReport): ConsensusSummary {
  if (!report || typeof report !== 'object') {
    return { totalFindings: 0, errors: 0, warnings: 0, infos: 0, topIssues: [] };
  }

  const all = [
    ...(report.plotChirurg || []),
    ...(report.figurenPsychologe || []),
    ...(report.kontinuitaetsPedant || []),
    ...(report.stilGourmet || []),
  ];

  const errors = all.filter((f) => f.severity === 'error').length;
  const warnings = all.filter((f) => f.severity === 'warning').length;
  const infos = all.filter((f) => f.severity === 'info').length;

  const topIssues = all
    .filter((f) => f.severity === 'error' || f.severity === 'warning')
    .slice(0, 5)
    .map((f) => f.message);

  return { totalFindings: all.length, errors, warnings, infos, topIssues };
}
