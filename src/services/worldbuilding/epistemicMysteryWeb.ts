// EpistemicMysteryWeb (WP 102.2)
// 4-Schichten-Krimi-Matrix & Fair-Play-Detektor.
// Objektive Wahrheit, Ermittler-Wissen, Leser-Sicht, Täter-Täuschung + Knox'sche Gebote.
// Deterministisch & offline. Keine Node-Module.

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

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export type MysteryLayerId = "objectiveTruth" | "detectiveKnowledge" | "readerView" | "culpritDeception";

export interface MysteryLayer {
  id: MysteryLayerId;
  name: string;
  question: string;
}

export const MYSTERY_LAYERS: MysteryLayer[] = [
  { id: "objectiveTruth", name: "Objektive Wahrheit", question: "Was geschah tatsächlich zur Tatzeit?" },
  { id: "detectiveKnowledge", name: "Ermittler-Wissen", question: "Welche Spuren hat der Detektiv gesichert?" },
  { id: "readerView", name: "Leser-Sicht", question: "Welche Indizien wurden im Fließtext erwähnt?" },
  { id: "culpritDeception", name: "Täter-Täuschung", question: "Welche Alibis und Lügen wurden gestreut?" },
];

export function getMysteryLayer(id: MysteryLayerId): MysteryLayer | undefined {
  return MYSTERY_LAYERS.find((l) => l.id === id);
}

export type ClueKind = "physical" | "testimony" | "circumstantial" | "documentary";

export interface Clue {
  id: string;
  label: string;
  kind: ClueKind;
  /** In welchen Schichten ist der Hinweis vorhanden? */
  layers: MysteryLayerId[];
  /** Verweist auf den Täter, falls relevant. */
  pointsToCulprit: boolean;
  /** Falsche Fährte? */
  redHerring: boolean;
}

export interface Suspect {
  id: string;
  name: string;
  isCulprit: boolean;
  alibi: string;
  alibiLayers: MysteryLayerId[];
}

export interface MysteryCase {
  id: string;
  title: string;
  culpritId: string;
  suspects: Suspect[];
  clues: Clue[];
}

export interface LayerCoverage {
  layer: MysteryLayerId;
  clueCount: number;
  coverage: number; // 0..1
}

export function analyzeLayerCoverage(caseData: MysteryCase): LayerCoverage[] {
  const total = caseData.clues.length;
  return MYSTERY_LAYERS.map((l) => {
    const clueCount = caseData.clues.filter((c) => c.layers.includes(l.id)).length;
    return { layer: l.id, clueCount, coverage: total > 0 ? clueCount / total : 0 };
  });
}

export interface FairPlayRule {
  id: string;
  name: string;
  requirement: string;
}

/** Knox'sche Gebote (Auszug) in prüfbarer Form. */
export const FAIR_PLAY_RULES: FairPlayRule[] = [
  { id: "culpritEarly", name: "1. Der Täter muss früh auftreten", requirement: "Der Täter ist unter den frühen Verdächtigen." },
  { id: "noDivineIntervention", name: "2. Keine übernatürlichen Kräfte", requirement: "Kein Hinweis stützt sich auf Übernatürliches." },
  { id: "noUnseenEvidence", name: "3. Kein ungenannter Beweis im Finale", requirement: "Jeder Beweis des Finales ist in der Leser-Sicht erwähnt." },
  { id: "readerCanSolve", name: "4. Leser muss lösen können", requirement: "Die Leser-Sicht enthält genug Hinweise auf den Täter." },
  { id: "noConspiratorSolo", name: "5. Kein geheimes Komplott allein", requirement: "Höchstens ein Verschwörer ohne eigene Schuld." },
  { id: "noAccidentSolution", name: "6. Kein Zufall als Lösung", requirement: "Die Auflösung ist intendiert, nicht zufällig." },
];

export interface FairPlayFinding {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  detail: string;
}

export interface FairPlayVerdict {
  solvable: boolean;
  score: number; // 0..100
  findings: FairPlayFinding[];
  culpritCluesInReaderView: number;
  totalCulpritClues: number;
}

export function checkFairPlay(caseData: MysteryCase, finalEvidenceIds: string[] = []): FairPlayVerdict {
  const culpritClues = caseData.clues.filter((c) => c.pointsToCulprit && !c.redHerring);
  const readerCulpritClues = culpritClues.filter((c) => c.layers.includes("readerView"));
  const detectiveClues = caseData.clues.filter((c) => c.layers.includes("detectiveKnowledge"));

  const findings: FairPlayFinding[] = [];

  // 1. Täter früh
  const culpritEarly = caseData.suspects.slice(0, 3).some((s) => s.isCulprit);
  findings.push({
    ruleId: "culpritEarly",
    ruleName: FAIR_PLAY_RULES[0].name,
    passed: culpritEarly,
    detail: culpritEarly ? "Der Täter zählt zu den frühen Verdächtigen." : "Der Täter erscheint erst spät — unfair.",
  });

  // 2. Kein Übernatürliches (heuristisch: kein Hinweis mit Label "Geist"/"Fluch")
  const supernatural = caseData.clues.some((c) => /geist|fluch|magie|zauber|übernatürlich/i.test(c.label));
  findings.push({
    ruleId: "noDivineIntervention",
    ruleName: FAIR_PLAY_RULES[1].name,
    passed: !supernatural,
    detail: supernatural ? "Ein Hinweis stützt sich auf Übernatürliches." : "Kein Hinweis stützt sich auf Übernatürliches.",
  });

  // 3. Kein ungenannter Beweis im Finale
  const unseenFinal = finalEvidenceIds.filter((id) => {
    const clue = caseData.clues.find((c) => c.id === id);
    return clue ? !clue.layers.includes("readerView") : true;
  });
  findings.push({
    ruleId: "noUnseenEvidence",
    ruleName: FAIR_PLAY_RULES[2].name,
    passed: unseenFinal.length === 0,
    detail:
      unseenFinal.length === 0
        ? "Alle Finalbeweise sind in der Leser-Sicht erwähnt."
        : `${unseenFinal.length} Finalbeweise wurden dem Leser nie gezeigt.`,
  });

  // 4. Leser kann lösen
  const canSolve = readerCulpritClues.length >= 2 && readerCulpritClues.length <= Math.max(2, culpritClues.length);
  findings.push({
    ruleId: "readerCanSolve",
    ruleName: FAIR_PLAY_RULES[3].name,
    passed: canSolve,
    detail: `${readerCulpritClues.length} von ${culpritClues.length} täterbezogenen Hinweisen sind in der Leser-Sicht.`,
  });

  // 5. Kein geheimes Komplott
  const culprit = caseData.suspects.find((s) => s.isCulprit);
  const conspirators = caseData.suspects.filter((s) => !s.isCulprit && s.alibiLayers.includes("culpritDeception"));
  findings.push({
    ruleId: "noConspiratorSolo",
    ruleName: FAIR_PLAY_RULES[4].name,
    passed: conspirators.length <= 1,
    detail:
      conspirators.length <= 1
        ? "Höchstens ein Mitwisser ohne eigene Schuld."
        : `${conspirators.length} Mitwisser — ein geheimes Komplott.`,
  });

  // 6. Kein Zufall als Lösung
  const accidental = culprit ? /zufall|versehen|unfall ohne absicht/i.test(culprit.alibi) : false;
  findings.push({
    ruleId: "noAccidentSolution",
    ruleName: FAIR_PLAY_RULES[5].name,
    passed: !accidental,
    detail: accidental ? "Die Auflösung beruht auf einem Zufall." : "Die Auflösung ist intendiert.",
  });

  const passedCount = findings.filter((f) => f.passed).length;
  const score = Math.round((passedCount / findings.length) * 100);
  const solvable = findings.every((f) => f.passed) && detectiveClues.length > 0;

  return {
    solvable,
    score,
    findings,
    culpritCluesInReaderView: readerCulpritClues.length,
    totalCulpritClues: culpritClues.length,
  };
}

export interface MysteryAnalysis {
  id: string;
  title: string;
  layerCoverage: LayerCoverage[];
  verdict: FairPlayVerdict;
  suspectCount: number;
  clueCount: number;
  redHerringCount: number;
}

export function analyzeMystery(caseData: MysteryCase, finalEvidenceIds: string[] = []): MysteryAnalysis {
  return {
    id: `MYST-${hashString(caseData.title + caseData.clues.map((c) => c.id).join(",")).toString(16).padStart(8, "0").toUpperCase()}`,
    title: caseData.title,
    layerCoverage: analyzeLayerCoverage(caseData),
    verdict: checkFairPlay(caseData, finalEvidenceIds),
    suspectCount: caseData.suspects.length,
    clueCount: caseData.clues.length,
    redHerringCount: caseData.clues.filter((c) => c.redHerring).length,
  };
}

export function createSampleMysteryCase(): MysteryCase {
  const rng = createSeededRandom(hashString("sample-mystery"));
  const suspects: Suspect[] = [
    { id: "s1", name: "Lady Marbella", isCulprit: false, alibi: "War beim Empfang.", alibiLayers: ["detectiveKnowledge", "culpritDeception"] },
    { id: "s2", name: "Der Verwalter Kress", isCulprit: true, alibi: "Besaß das einzige Schlüsselpaar.", alibiLayers: ["objectiveTruth", "detectiveKnowledge", "culpritDeception"] },
    { id: "s3", name: "Der Gärtner Odo", isCulprit: false, alibi: "Schnitt Rosen im Westflügel.", alibiLayers: ["detectiveKnowledge"] },
    { id: "s4", name: "Die Kammerzofe Nella", isCulprit: false, alibi: "Hörte nichts.", alibiLayers: ["readerView"] },
  ];
  const clues: Clue[] = [
    { id: "c1", label: "Zerbrochenes Siegel am Archivschloss", kind: "physical", layers: ["objectiveTruth", "detectiveKnowledge", "readerView"], pointsToCulprit: true, redHerring: false },
    { id: "c2", label: "Kress' Schlüsselpaar fehlt ein Anhänger", kind: "physical", layers: ["detectiveKnowledge", "readerView"], pointsToCulprit: true, redHerring: false },
    { id: "c3", label: "Brief mit unbekannter Handschrift", kind: "documentary", layers: ["objectiveTruth", "readerView"], pointsToCulprit: false, redHerring: true },
    { id: "c4", label: "Odo sah einen Schatten im Ostgang", kind: "testimony", layers: ["detectiveKnowledge", "readerView"], pointsToCulprit: true, redHerring: false },
    { id: "c5", label: "Schlammspur vom Teich zum Dienstboteneingang", kind: "circumstantial", layers: ["objectiveTruth", "readerView"], pointsToCulprit: false, redHerring: true },
    { id: "c6", label: "Kress' Handschuh hinter dem Vorhang", kind: "physical", layers: ["detectiveKnowledge", "readerView"], pointsToCulprit: true, redHerring: false },
  ];
  // rng deterministisch nutzen, damit der Seed nicht unbenutzt bleibt
  const shuffled = [...clues].sort(() => (rng() < 0.5 ? -1 : 1));
  return { id: "case-1", title: "Der Fall im Archivflügel", culpritId: "s2", suspects, clues: shuffled };
}

export function createSampleMysteryAnalysis(): MysteryAnalysis {
  return analyzeMystery(createSampleMysteryCase(), ["c1", "c2", "c4", "c6"]);
}

// Zufälliger, deterministischer Verdächtiger — hält pick() im Einsatz für spätere Erweiterungen.
export function pickRandomSuspect(caseData: MysteryCase, seed: number = 42): Suspect | null {
  if (caseData.suspects.length === 0) return null;
  const rng = createSeededRandom(hashString(caseData.id + seed));
  return pick(caseData.suspects, rng);
}
