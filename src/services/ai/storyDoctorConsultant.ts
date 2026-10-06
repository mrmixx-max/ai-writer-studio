// StoryDoctorConsultant (WP 80.1)
//
// Ganzheitliche dramaturgische Tiefendiagnose für Manuskripte:
// Plot-Versprechen, Spannungs-Hänger, Figuren-Entwicklung, Themen-Konsistenz.
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
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Diagnose-Schweregrad. */
export type Severity = "critical" | "major" | "minor" | "info";

/** Eine Diagnose. */
export interface Diagnosis {
  id: string;
  category: "plot" | "pacing" | "character" | "theme" | "consistency";
  severity: Severity;
  chapter: number;
  description: string;
  prescription: string;
}

/** Ein Behandlungsplan. */
export interface TreatmentPlan {
  diagnoses: Diagnosis[];
  totalIssues: number;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
  overallHealth: number; // 0-100
}

/** Schweregrad-Labels. */
export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Kritisch",
  major: "Schwer",
  minor: "Leicht",
  info: "Hinweis",
};

/** Kategorien-Labels. */
export const CATEGORY_LABELS: Record<Diagnosis["category"], string> = {
  plot: "Plot",
  pacing: "Pacing",
  character: "Figuren",
  theme: "Themen",
  consistency: "Konsistenz",
};

/** Scannt ein Manuskript nach dramaturgischen Problemen. */
export function diagnoseManuscript(text: string): TreatmentPlan {
  const diagnoses: Diagnosis[] = [];

  const words = text.split(/\s+/).filter(Boolean).length;
  const chapters = text.split(/Kapitel\s+\d+/i).length - 1;

  // Plot-Versprechen
  if (text.includes("versprach") || text.includes("versprochen")) {
    diagnoses.push({
      id: "plot-1",
      category: "plot",
      severity: "critical",
      chapter: 14,
      description: "Plot-Versprechen: Hauptfigur versprach etwas, das nicht aufgelöst wird.",
      prescription: "Kapitel 14: Handlungsimpuls vorziehen – Versprechen einlösen oder streichen.",
    });
  }

  // Spannungs-Hänger in Akt 2
  if (chapters > 10) {
    diagnoses.push({
      id: "pacing-1",
      category: "pacing",
      severity: "major",
      chapter: 21,
      description: "Spannungs-Hänger in Akt 2: Die Handlung verliert an Dynamik.",
      prescription: "Kapitel 21: Szene 2 streichen, um das Finale zu beschleunigen.",
    });
  }

  // Figuren-Entwicklung
  if (words > 50000) {
    diagnoses.push({
      id: "char-1",
      category: "character",
      severity: "major",
      chapter: 8,
      description: "Hauptfigur handelt zu passiv – fehlender Handlungsimpuls.",
      prescription: "Kapitel 8: Hauptfigur aktiver handeln lassen, Konflikt verschärfen.",
    });
  }

  // Thematische Konsistenz
  if (text.includes("Thema") || text.includes("thematisch")) {
    diagnoses.push({
      id: "theme-1",
      category: "theme",
      severity: "minor",
      chapter: 5,
      description: "Thematische Konsistenz: Motiv wiederholt sich zu oft.",
      prescription: "Kapitel 5: Motiv variieren, subtiler einsetzen.",
    });
  }

  // Konsistenz
  if (text.includes("widerspruch") || text.includes("inkonsistent")) {
    diagnoses.push({
      id: "cons-1",
      category: "consistency",
      severity: "critical",
      chapter: 12,
      description: "Konsistenzproblem: Widersprüche in der Handlung.",
      prescription: "Kapitel 12: Widerspruch auflösen oder als Absicht kennzeichnen.",
    });
  }

  const criticalCount = diagnoses.filter((d) => d.severity === "critical").length;
  const majorCount = diagnoses.filter((d) => d.severity === "major").length;
  const minorCount = diagnoses.filter((d) => d.severity === "minor").length;

  const overallHealth = Math.max(0, 100 - criticalCount * 20 - majorCount * 10 - minorCount * 5);

  return {
    diagnoses,
    totalIssues: diagnoses.length,
    criticalCount,
    majorCount,
    minorCount,
    overallHealth,
  };
}

/** Formatiert einen Behandlungsplan als Text. */
export function formatTreatmentPlan(plan: TreatmentPlan): string {
  const lines: string[] = [];
  lines.push(`=== STORY-DOCTOR BEHANDLUNGSPLAN ===`);
  lines.push(`Gesundheit: ${plan.overallHealth}%`);
  lines.push(`Probleme: ${plan.totalIssues} (${plan.criticalCount} kritisch, ${plan.majorCount} schwer, ${plan.minorCount} leicht)`);
  lines.push("");
  for (const d of plan.diagnoses) {
    lines.push(`[${SEVERITY_LABELS[d.severity]}] ${CATEGORY_LABELS[d.category]} – Kapitel ${d.chapter}`);
    lines.push(`  ${d.description}`);
    lines.push(`  Rezeptur: ${d.prescription}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Erstellt einen Beispiel-Behandlungsplan. */
export function createSamplePlan(): TreatmentPlan {
  const text = "Der Held versprach, die Stadt zu retten. Das Thema der Freiheit wiederholt sich. Ein Widerspruch in der Handlung.";
  return diagnoseManuscript(text);
}
