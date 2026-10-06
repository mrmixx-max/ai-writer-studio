// DualTimelineMysteryLedger (WP 72.2)
//
// Verwaltet eine doppelte Zeitachse (Vergangenheit/Gegenwart) für Krimis
// und ein Indizien-Hauptbuch mit Beweisketten, Verdächtigen und Lösungslogik.
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

/** Zeitachse: Vergangenheit oder Gegenwart. */
export type Timeline = "past" | "present";

/** Ein Ereignis auf einer Zeitachse. */
export interface TimelineEvent {
  id: string;
  timeline: Timeline;
  chapter: number;
  title: string;
  description: string;
  involvedCharacters: string[];
  relatedEvidenceIds: string[];
}

/** Ein Indiz im Hauptbuch. */
export interface Evidence {
  id: string;
  name: string;
  description: string;
  foundAtChapter: number;
  timeline: Timeline;
  credibility: number; // 0-100
  relatedSuspectIds: string[];
  contradictsEvidenceIds: string[];
}

/** Ein Verdächtiger. */
export interface Suspect {
  id: string;
  name: string;
  motive: string;
  alibi: string;
  alibiStrength: number; // 0-100
  relatedEvidenceIds: string[];
  isGuilty: boolean;
}

/** Eine Beweiskette: Indiz A → Indiz B → Schlussfolgerung. */
export interface EvidenceChain {
  id: string;
  name: string;
  evidenceIds: string[];
  conclusion: string;
  strength: number; // 0-100
}

/** Das vollständige Indizien-Hauptbuch. */
export interface MysteryLedger {
  events: TimelineEvent[];
  evidence: Evidence[];
  suspects: Suspect[];
  chains: EvidenceChain[];
}

/** Fügt ein Ereignis hinzu. */
export function addEvent(ledger: MysteryLedger, event: TimelineEvent): MysteryLedger {
  return { ...ledger, events: [...ledger.events, event] };
}

/** Fügt ein Indiz hinzu. */
export function addEvidence(ledger: MysteryLedger, evidence: Evidence): MysteryLedger {
  return { ...ledger, evidence: [...ledger.evidence, evidence] };
}

/** Fügt einen Verdächtigen hinzu. */
export function addSuspect(ledger: MysteryLedger, suspect: Suspect): MysteryLedger {
  return { ...ledger, suspects: [...ledger.suspects, suspect] };
}

/** Fügt eine Beweiskette hinzu. */
export function addChain(ledger: MysteryLedger, chain: EvidenceChain): MysteryLedger {
  return { ...ledger, chains: [...ledger.chains, chain] };
}

/** Findet alle Ereignisse auf einer Zeitachse. */
export function getEventsByTimeline(ledger: MysteryLedger, timeline: Timeline): TimelineEvent[] {
  return ledger.events.filter((e) => e.timeline === timeline);
}

/** Findet alle Indizien auf einer Zeitachse. */
export function getEvidenceByTimeline(ledger: MysteryLedger, timeline: Timeline): Evidence[] {
  return ledger.evidence.filter((e) => e.timeline === timeline);
}

/** Findet Indizien, die ein bestimmtes Indiz widersprechen. */
export function getContradictions(ledger: MysteryLedger, evidenceId: string): Evidence[] {
  const ev = ledger.evidence.find((e) => e.id === evidenceId);
  if (!ev) return [];
  return ledger.evidence.filter((e) => ev.contradictsEvidenceIds.includes(e.id));
}

/** Findet alle Indizien, die mit einem Verdächtigen verknüpft sind. */
export function getEvidenceForSuspect(ledger: MysteryLedger, suspectId: string): Evidence[] {
  const suspect = ledger.suspects.find((s) => s.id === suspectId);
  if (!suspect) return [];
  return ledger.evidence.filter((e) => suspect.relatedEvidenceIds.includes(e.id));
}

/** Berechnet die Stärke einer Beweiskette. */
export function computeChainStrength(ledger: MysteryLedger, chain: EvidenceChain): number {
  const evidenceItems = chain.evidenceIds
    .map((id) => ledger.evidence.find((e) => e.id === id))
    .filter((e): e is Evidence => e !== undefined);

  if (evidenceItems.length === 0) return 0;

  const avgCredibility = evidenceItems.reduce((sum, e) => sum + e.credibility, 0) / evidenceItems.length;
  const lengthBonus = Math.min(20, evidenceItems.length * 5);
  return Math.min(100, Math.round(avgCredibility * 0.8 + lengthBonus));
}

/** Findet die stärkste Beweiskette. */
export function findStrongestChain(ledger: MysteryLedger): EvidenceChain | null {
  if (ledger.chains.length === 0) return null;
  return ledger.chains.reduce((best, chain) => {
    const bestStrength = computeChainStrength(ledger, best);
    const chainStrength = computeChainStrength(ledger, chain);
    return chainStrength > bestStrength ? chain : best;
  });
}

/** Findet den wahrscheinlichsten Täter basierend auf Indizien und Motiv. */
export function findPrimeSuspect(ledger: MysteryLedger): Suspect | null {
  if (ledger.suspects.length === 0) return null;

  const scored = ledger.suspects.map((suspect) => {
    const evidence = getEvidenceForSuspect(ledger, suspect.id);
    const totalCredibility = evidence.reduce((sum, e) => sum + e.credibility, 0);
    const evidenceCount = evidence.length;
    const alibiPenalty = suspect.alibiStrength * 0.3;
    const score = totalCredibility + evidenceCount * 10 - alibiPenalty;
    return { suspect, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].suspect;
}

/** Prüft, ob ein Verdächtiger ein widersprüchliches Alibi hat. */
export function hasContradictoryAlibi(ledger: MysteryLedger, suspectId: string): boolean {
  const suspect = ledger.suspects.find((s) => s.id === suspectId);
  if (!suspect) return false;

  const evidence = getEvidenceForSuspect(ledger, suspectId);
  return evidence.some((e) => e.credibility > 70 && suspect.alibiStrength < 50);
}

/** Erstellt eine leere Mystery-Ledger-Struktur. */
export function createEmptyLedger(): MysteryLedger {
  return { events: [], evidence: [], suspects: [], chains: [] };
}

/** Erstellt eine Beispiel-Ledger für Tests und Demo. */
export function createSampleLedger(): MysteryLedger {
  let ledger = createEmptyLedger();

  ledger = addEvent(ledger, {
    id: "ev-1",
    timeline: "past",
    chapter: 1,
    title: "Der Mord im Salon",
    description: "Das Opfer wird im Salon gefunden.",
    involvedCharacters: ["Opfer", "Butler"],
    relatedEvidenceIds: ["clue-1"],
  });

  ledger = addEvent(ledger, {
    id: "ev-2",
    timeline: "present",
    chapter: 5,
    title: "Die Ermittlung beginnt",
    description: "Der Detektiv erreicht das Anwesen.",
    involvedCharacters: ["Detektiv"],
    relatedEvidenceIds: [],
  });

  ledger = addEvidence(ledger, {
    id: "clue-1",
    name: "Blutiger Handschuh",
    description: "Ein Handschuh mit Blutspuren im Salon.",
    foundAtChapter: 1,
    timeline: "past",
    credibility: 85,
    relatedSuspectIds: ["suspect-1"],
    contradictsEvidenceIds: [],
  });

  ledger = addEvidence(ledger, {
    id: "clue-2",
    name: "Zerbrochenes Glas",
    description: "Scherben am Fenster, möglicher Fluchtweg.",
    foundAtChapter: 2,
    timeline: "past",
    credibility: 60,
    relatedSuspectIds: ["suspect-2"],
    contradictsEvidenceIds: [],
  });

  ledger = addEvidence(ledger, {
    id: "clue-3",
    name: "Falsches Alibi",
    description: "Der Butler behauptete, im Garten gewesen zu sein.",
    foundAtChapter: 3,
    timeline: "present",
    credibility: 90,
    relatedSuspectIds: ["suspect-1"],
    contradictsEvidenceIds: ["clue-1"],
  });

  ledger = addSuspect(ledger, {
    id: "suspect-1",
    name: "Der Butler",
    motive: "Erbe",
    alibi: "War im Garten",
    alibiStrength: 30,
    relatedEvidenceIds: ["clue-1", "clue-3"],
    isGuilty: true,
  });

  ledger = addSuspect(ledger, {
    id: "suspect-2",
    name: "Die Sekretärin",
    motive: "Rache",
    alibi: "War im Büro",
    alibiStrength: 70,
    relatedEvidenceIds: ["clue-2"],
    isGuilty: false,
  });

  ledger = addChain(ledger, {
    id: "chain-1",
    name: "Butlers Schuld",
    evidenceIds: ["clue-1", "clue-3"],
    conclusion: "Der Butler hat ein widersprüchliches Alibi und belastende Indizien.",
    strength: 0,
  });

  return ledger;
}

/** Generiert einen textuellen Bericht der Beweislage. */
export function formatLedgerReport(ledger: MysteryLedger): string {
  const lines: string[] = [];

  lines.push("=== INDIZIEN-HAUPTBUCH ===");
  lines.push("");

  lines.push("EREIGNISSE:");
  for (const ev of ledger.events) {
    lines.push(`  [${ev.timeline === "past" ? "Vergangenheit" : "Gegenwart"}] §${ev.chapter}: ${ev.title}`);
  }
  lines.push("");

  lines.push("INDIZIEN:");
  for (const ev of ledger.evidence) {
    lines.push(`  ${ev.name} (Glaubwürdigkeit: ${ev.credibility}%)`);
  }
  lines.push("");

  lines.push("VERDÄCHTIGE:");
  for (const s of ledger.suspects) {
    lines.push(`  ${s.name} — Motiv: ${s.motive}, Alibi: ${s.alibi} (${s.alibiStrength}%)`);
  }
  lines.push("");

  const prime = findPrimeSuspect(ledger);
  if (prime) {
    lines.push(`HAUPTVERDÄCHTIGER: ${prime.name}`);
  }

  const strongest = findStrongestChain(ledger);
  if (strongest) {
    lines.push(`STERKSTE BEWEISKETTE: ${strongest.name} (Stärke: ${computeChainStrength(ledger, strongest)}%)`);
  }

  return lines.join("\n");
}
