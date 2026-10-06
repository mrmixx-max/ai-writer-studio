// AudiobookProductionSheet (WP 73.2)
//
// Master-Regiebogen für Hörbuch-Produktion nach ACX/Audible-Standards:
// Sprecher-Direktion, Pacing, Kapitel-Metadaten, QC-Checkliste.
//
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
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sprecher-Rolle. */
export type NarratorRole = "protagonist" | "antagonist" | "narrator" | "supporting";

/** Ein Sprecher-Profil. */
export interface NarratorProfile {
  id: string;
  name: string;
  role: NarratorRole;
  voiceDescription: string;
  pacingWpm: number; // Words per minute
  toneNotes: string;
}

/** Ein Kapitel im Regiebogen. */
export interface ProductionChapter {
  number: number;
  title: string;
  wordCount: number;
  estimatedDurationMin: number;
  narratorIds: string[];
  notes: string;
}

/** QC-Checklisten-Punkt. */
export interface QCCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: "critical" | "major" | "minor";
}

/** Der vollständige Regiebogen. */
export interface ProductionSheet {
  title: string;
  author: string;
  narrator: NarratorProfile;
  chapters: ProductionChapter[];
  qcChecks: QCCheck[];
  totalWordCount: number;
  totalDurationMin: number;
  acxMetadata: ACXMetadata;
}

/** ACX-Metadaten. */
export interface ACXMetadata {
  title: string;
  author: string;
  narrator: string;
  runtime: string;
  language: string;
  genre: string;
  keywords: string[];
  description: string;
}

/** Erstellt ein Sprecher-Profil. */
export function createNarratorProfile(
  id: string,
  name: string,
  role: NarratorRole,
  voiceDescription: string,
  pacingWpm: number = 150,
  toneNotes: string = "",
): NarratorProfile {
  return { id, name, role, voiceDescription, pacingWpm, toneNotes };
}

/** Berechnet die geschätzte Dauer eines Kapitels. */
export function estimateDuration(wordCount: number, pacingWpm: number = 150): number {
  if (pacingWpm <= 0) return 0;
  return Math.round((wordCount / pacingWpm) * 10) / 10;
}

/** Erstellt ein Kapitel. */
export function createChapter(
  number: number,
  title: string,
  wordCount: number,
  narratorIds: string[],
  notes: string = "",
  pacingWpm: number = 150,
): ProductionChapter {
  return {
    number,
    title,
    wordCount,
    estimatedDurationMin: estimateDuration(wordCount, pacingWpm),
    narratorIds,
    notes,
  };
}

/** Erstellt eine QC-Checkliste. */
export function createQCChecks(): QCCheck[] {
  return [
    { id: "qc-1", label: "Rauschfreiheit (Hiss, Knistern)", passed: true, severity: "critical" },
    { id: "qc-2", label: "Lautstärke-Konsistenz (±3 dB)", passed: true, severity: "critical" },
    { id: "qc-3", label: "Pacing konsistent (WPM-Schwankung < 10%)", passed: true, severity: "major" },
    { id: "qc-4", label: "Kapitel-Marken korrekt", passed: true, severity: "major" },
    { id: "qc-5", label: "Stille am Anfang/Ende (2-5s)", passed: true, severity: "minor" },
    { id: "qc-6", label: "Keine Mundgeräusche", passed: true, severity: "minor" },
    { id: "qc-7", label: "Keine Wiederholungen/Flüstern", passed: true, severity: "major" },
    { id: "qc-8", label: "ACX-Lautstärke-Standard (-23 LUFS)", passed: true, severity: "critical" },
  ];
}

/** Erstellt einen vollständigen Regiebogen. */
export function createProductionSheet(
  title: string,
  author: string,
  narrator: NarratorProfile,
  chapters: ProductionChapter[],
): ProductionSheet {
  const totalWordCount = chapters.reduce((sum, c) => sum + c.wordCount, 0);
  const totalDurationMin = chapters.reduce((sum, c) => sum + c.estimatedDurationMin, 0);
  const qcChecks = createQCChecks();

  const hours = Math.floor(totalDurationMin / 60);
  const minutes = Math.round(totalDurationMin % 60);
  const runtime = `${hours}h ${minutes}min`;

  const acxMetadata: ACXMetadata = {
    title,
    author,
    narrator: narrator.name,
    runtime,
    language: "Deutsch",
    genre: "Belletristik",
    keywords: ["Hörbuch", "Krimi", "Thriller"],
    description: `${title} von ${author}, gesprochen von ${narrator.name}.`,
  };

  return {
    title,
    author,
    narrator,
    chapters,
    qcChecks,
    totalWordCount,
    totalDurationMin,
    acxMetadata,
  };
}

/** Prüft, ob alle kritischen QC-Checks bestanden sind. */
export function allCriticalChecksPassed(sheet: ProductionSheet): boolean {
  return sheet.qcChecks
    .filter((c) => c.severity === "critical")
    .every((c) => c.passed);
}

/** Prüft, ob alle QC-Checks bestanden sind. */
export function allChecksPassed(sheet: ProductionSheet): boolean {
  return sheet.qcChecks.every((c) => c.passed);
}

/** Zählt die bestandenen Checks. */
export function countPassedChecks(sheet: ProductionSheet): number {
  return sheet.qcChecks.filter((c) => c.passed).length;
}

/** Berechnert den QC-Score (0-100). */
export function computeQCScore(sheet: ProductionSheet): number {
  if (sheet.qcChecks.length === 0) return 0;
  const passed = countPassedChecks(sheet);
  return Math.round((passed / sheet.qcChecks.length) * 100);
}

/** Formatiert den Regiebogen als Text. */
export function formatProductionSheet(sheet: ProductionSheet): string {
  const lines: string[] = [];
  lines.push(`=== HOERBUCH-REGIEBOGEN ===`);
  lines.push(`Titel: ${sheet.title}`);
  lines.push(`Autor: ${sheet.author}`);
  lines.push(`Sprecher: ${sheet.narrator.name} (${sheet.narrator.role})`);
  lines.push(`Stimmbeschreibung: ${sheet.narrator.voiceDescription}`);
  lines.push(`Pacing: ${sheet.narrator.pacingWpm} WPM`);
  lines.push(`Gesamt: ${sheet.totalWordCount} Wörter, ${sheet.totalDurationMin} Minuten`);
  lines.push("");
  lines.push("KAPITEL:");
  for (const ch of sheet.chapters) {
    lines.push(`  §${ch.number}: ${ch.title} (${ch.wordCount} Wörter, ${ch.estimatedDurationMin} Min)`);
  }
  lines.push("");
  lines.push("QC-CHECKLISTE:");
  for (const qc of sheet.qcChecks) {
    lines.push(`  [${qc.passed ? "✓" : "✗"}] ${qc.label} (${qc.severity})`);
  }
  lines.push("");
  lines.push(`QC-SCORE: ${computeQCScore(sheet)}%`);
  lines.push(`KRITISCHE CHECKS: ${allCriticalChecksPassed(sheet) ? "ALLE BESTANDEN" : "FEHLER"}`);
  return lines.join("\n");
}

/** Erstellt einen Beispiel-Regiebogen für Tests und Demo. */
export function createSampleProductionSheet(): ProductionSheet {
  const narrator = createNarratorProfile(
    "narr-1",
    "Thomas Schmidt",
    "narrator",
    "Tiefe, warme Stimme mit leiser Textur",
    155,
    "Ruhig, bedächtig, mit deutlicher Artikulation",
  );

  const chapters = [
    createChapter(1, "Der Anfang", 3500, ["narr-1"], "Langsamer Einstieg", 155),
    createChapter(2, "Die Entdeckung", 4200, ["narr-1"], "Spannung steigt", 155),
    createChapter(3, "Der Wendepunkt", 3800, ["narr-1"], "Schnelleres Pacing", 160),
    createChapter(4, "Die Auflösung", 4000, ["narr-1"], "Ruhiger Abschluss", 150),
  ];

  return createProductionSheet("Der Schatten des Vergessens", "Maria Müller", narrator, chapters);
}
