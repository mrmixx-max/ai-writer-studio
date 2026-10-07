// SocialEtiquetteProtocol (WP 86.2)
// Hof-Etikette- & Protokoll-Wächter.
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

export type TitleRank = "kaiser" | "könig" | "erzherzog" | "herzog" | "markgraf" | "graf" | "freiherr" | "ritter" | "edelfrei" | "bürger" | "bäuerin" | "diener";

export interface Title {
  rank: TitleRank;
  addressForm: string;        // "Eure Majestät", "Eure Gnaden", "Mylord"
  bowDepth: number;           // 0-180 Grad
  gloveRequired: boolean;
  seatingOrder: number;       // niedriger = höherer Rang
  precedence: number;         // 1 = höchste
}

export interface CourtProtocol {
  name: string;
  culture: string;
  titles: Record<TitleRank, Title>;
  greetingRules: GreetingRule[];
  taboos: Taboo[];
  scandalThresholds: ScandalThreshold[];
}

export interface GreetingRule {
  fromRank: TitleRank;
  toRank: TitleRank;
  requiredAction: "kniefall" | "tiefer_bucks" | "leichter_bucks" | "kopfnicken" | "handkuss" | "keine_geste";
  requiredWords: string[];
  forbiddenWords: string[];
}

export interface Taboo {
  id: string;
  description: string;
  severity: "leicht" | "mittel" | "schwer" | "tödlich";
  affectedRanks: TitleRank[];
  context: "audienz" | "tafel" | "ball" | "rat" | "duell" | "allgemein";
}

export interface ScandalThreshold {
  violationType: "anrede" | "geste" | "kleidung" | "sitzordnung" | "duell" | "affäre" | "verrat";
  baseScore: number;
  rankModifier: Record<TitleRank, number>;
}

export interface ProtocolViolation {
  id: string;
  violator: string;
  violatorRank: TitleRank;
  victim: string;
  victimRank: TitleRank;
  violationType: ScandalThreshold["violationType"];
  description: string;
  context: Taboo["context"];
  severity: Taboo["severity"];
  scandalScore: number;
  gossipSpread: number;       // 0-100
  reputationDamage: number;   // 0-100
}

export interface CourtCharacter {
  name: string;
  rank: TitleRank;
  house: string;
  reputation: number;         // 0-100
  favor: Record<string, number>; // zu anderen Charakteren
  knownViolations: ProtocolViolation[];
}

const DEFAULT_PROTOCOL: CourtProtocol = {
  name: "Kaiserlicher Hofprotokoll",
  culture: "Mitteleuropäisch-Feudal",
  titles: {
    kaiser: { rank: "kaiser", addressForm: "Eure Majestät", bowDepth: 90, gloveRequired: true, seatingOrder: 1, precedence: 1 },
    könig: { rank: "könig", addressForm: "Eure Majestät", bowDepth: 75, gloveRequired: true, seatingOrder: 2, precedence: 2 },
    erzherzog: { rank: "erzherzog", addressForm: "Eure Kaiserliche Hoheit", bowDepth: 60, gloveRequired: true, seatingOrder: 3, precedence: 3 },
    herzog: { rank: "herzog", addressForm: "Eure Gnaden", bowDepth: 45, gloveRequired: true, seatingOrder: 4, precedence: 4 },
    markgraf: { rank: "markgraf", addressForm: "Eure Hochwohlgeboren", bowDepth: 30, gloveRequired: true, seatingOrder: 5, precedence: 5 },
    graf: { rank: "graf", addressForm: "Eure Hochwohlgeboren", bowDepth: 30, gloveRequired: false, seatingOrder: 6, precedence: 6 },
    freiherr: { rank: "freiherr", addressForm: "Euer Wohlgeboren", bowDepth: 15, gloveRequired: false, seatingOrder: 7, precedence: 7 },
    ritter: { rank: "ritter", addressForm: "Mylord / Mylady", bowDepth: 10, gloveRequired: false, seatingOrder: 8, precedence: 8 },
    edelfrei: { rank: "edelfrei", addressForm: "Edler Herr / Edle Frau", bowDepth: 5, gloveRequired: false, seatingOrder: 9, precedence: 9 },
    bürger: { rank: "bürger", addressForm: "Meister / Bürger", bowDepth: 0, gloveRequired: false, seatingOrder: 10, precedence: 10 },
    bäuerin: { rank: "bäuerin", addressForm: "Guter Mann / Gute Frau", bowDepth: 0, gloveRequired: false, seatingOrder: 11, precedence: 11 },
    diener: { rank: "diener", addressForm: "Du / Ihr", bowDepth: 0, gloveRequired: false, seatingOrder: 12, precedence: 12 },
  },
  greetingRules: [
    { fromRank: "ritter", toRank: "herzog", requiredAction: "tiefer_bucks", requiredWords: ["Eure Gnaden"], forbiddenWords: ["Du", "Ihr", "Hey"] },
    { fromRank: "graf", toRank: "könig", requiredAction: "kniefall", requiredWords: ["Eure Majestät"], forbiddenWords: ["Eure Gnaden", "Mylord"] },
    { fromRank: "herzog", toRank: "kaiser", requiredAction: "kniefall", requiredWords: ["Eure Majestät"], forbiddenWords: [] },
    { fromRank: "freiherr", toRank: "graf", requiredAction: "leichter_bucks", requiredWords: ["Eure Hochwohlgeboren"], forbiddenWords: ["Du"] },
    { fromRank: "bürger", toRank: "ritter", requiredAction: "kopfnicken", requiredWords: ["Mylord"], forbiddenWords: ["Du", "Alter"] },
    { fromRank: "diener", toRank: "freiherr", requiredAction: "keine_geste", requiredWords: ["Euer Wohlgeboren"], forbiddenWords: ["Mylord", "Eure Gnaden"] },
  ],
  taboos: [
    { id: "duzen_ohne_erlaubnis", description: "Duz-Einladung nicht erhalten, aber 'Du' verwendet", severity: "schwer", affectedRanks: ["kaiser", "könig", "erzherzog", "herzog", "markgraf", "graf", "freiherr", "ritter"], context: "allgemein" },
    { id: "falsche_anrede", description: "Falsche Anredeform verwendet (z. B. 'Eure Gnaden' für Kaiser)", severity: "mittel", affectedRanks: ["kaiser", "könig", "erzherzog"], context: "audienz" },
    { id: "handschuh_fehlt", description: "Handschufe bei Audienz nicht getragen", severity: "leicht", affectedRanks: ["kaiser", "könig", "erzherzog", "herzog", "markgraf", "graf"], context: "audienz" },
    { id: "sitzordnung_verletzt", description: "Platz eingenommen, der höherem Rang zusteht", severity: "schwer", affectedRanks: ["herzog", "markgraf", "graf", "freiherr", "ritter"], context: "tafel" },
    { id: "könig_unterbrechen", description: "Dem Monarchen ins Wort gefallen", severity: "tödlich", affectedRanks: ["kaiser", "könig"], context: "rat" },
    { id: "duell_verweigert", description: "Ehrenhafte Duellforderung ohne triftigen Grund abgelehnt", severity: "schwer", affectedRanks: ["herzog", "markgraf", "graf", "freiherr", "ritter"], context: "duell" },
    { id: "affäre_mit_hohem_rang", description: "Unstandesgemäße Liaison mit höchstem Adel", severity: "schwer", affectedRanks: ["kaiser", "könig", "erzherzog", "herzog"], context: "allgemein" },
    { id: "geheimnis_verraten", description: "Staatsgeheimnis oder Hofklatsch an Feind weitergegeben", severity: "tödlich", affectedRanks: ["kaiser", "könig", "erzherzog", "herzog", "markgraf", "graf"], context: "rat" },
  ],
  scandalThresholds: [
    { violationType: "anrede", baseScore: 15, rankModifier: { kaiser: 3, könig: 3, erzherzog: 2, herzog: 2, markgraf: 1.5, graf: 1.5, freiherr: 1, ritter: 1, edelfrei: 1, bürger: 0.5, bäuerin: 0.5, diener: 0.2 } },
    { violationType: "geste", baseScore: 20, rankModifier: { kaiser: 3, könig: 3, erzherzog: 2, herzog: 2, markgraf: 1.5, graf: 1.5, freiherr: 1, ritter: 1, edelfrei: 1, bürger: 0.5, bäuerin: 0.5, diener: 0.2 } },
    { violationType: "kleidung", baseScore: 10, rankModifier: { kaiser: 2, könig: 2, erzherzog: 1.5, herzog: 1.5, markgraf: 1, graf: 1, freiherr: 1, ritter: 1, edelfrei: 0.5, bürger: 0.5, bäuerin: 0.5, diener: 0.2 } },
    { violationType: "sitzordnung", baseScore: 25, rankModifier: { kaiser: 3, könig: 3, erzherzog: 2, herzog: 2, markgraf: 1.5, graf: 1.5, freiherr: 1, ritter: 1, edelfrei: 1, bürger: 0.5, bäuerin: 0.5, diener: 0.2 } },
    { violationType: "duell", baseScore: 30, rankModifier: { kaiser: 3, könig: 3, erzherzog: 2, herzog: 2, markgraf: 1.5, graf: 1.5, freiherr: 1, ritter: 1, edelfrei: 0.5, bürger: 0.2, bäuerin: 0.2, diener: 0.1 } },
    { violationType: "affäre", baseScore: 35, rankModifier: { kaiser: 3, könig: 3, erzherzog: 2.5, herzog: 2, markgraf: 1.5, graf: 1.5, freiherr: 1, ritter: 1, edelfrei: 0.5, bürger: 0.5, bäuerin: 0.5, diener: 0.2 } },
    { violationType: "verrat", baseScore: 100, rankModifier: { kaiser: 3, könig: 3, erzherzog: 2, herzog: 2, markgraf: 1.5, graf: 1.5, freiherr: 1, ritter: 1, edelfrei: 0.5, bürger: 0.2, bäuerin: 0.2, diener: 0.1 } },
  ],
};

function _pickRandom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function createProtocol(name: string = "Standard", seed: number = 42): CourtProtocol {
  const rng = createSeededRandom(seed);
  const protocol = { ...DEFAULT_PROTOCOL, name: `${DEFAULT_PROTOCOL.name} — ${name}` };
  protocol.greetingRules = shuffleArray(protocol.greetingRules, rng);
  protocol.taboos = shuffleArray(protocol.taboos, rng);
  return protocol;
}

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function checkGreeting(
  protocol: CourtProtocol,
  fromRank: TitleRank,
  toRank: TitleRank,
  action: string,
  words: string[]
): { valid: boolean; errors: string[] } {
  const rule = protocol.greetingRules.find(r => r.fromRank === fromRank && r.toRank === toRank);
  if (!rule) return { valid: true, errors: [] };

  const errors: string[] = [];
  if (action !== rule.requiredAction) {
    errors.push(`Falsche Geste: ${action} statt ${rule.requiredAction}`);
  }
  for (const req of rule.requiredWords) {
    if (!words.some(w => w.toLowerCase().includes(req.toLowerCase()))) {
      errors.push(`Fehlende Anrede: "${req}"`);
    }
  }
  for (const forb of rule.forbiddenWords) {
    if (words.some(w => w.toLowerCase().includes(forb.toLowerCase()))) {
      errors.push(`Verbotene Anrede: "${forb}"`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function scanTextForViolations(
  protocol: CourtProtocol,
  text: string,
  speaker: string,
  speakerRank: TitleRank,
  addressee: string,
  addresseeRank: TitleRank,
  context: Taboo["context"]
): ProtocolViolation[] {
  const violations: ProtocolViolation[] = [];
  const lower = text.toLowerCase();
  const rng = createSeededRandom(hashString(text + speaker + addressee + context));

  for (const taboo of protocol.taboos) {
    if (!taboo.affectedRanks.includes(speakerRank)) continue;
    if (taboo.context !== "allgemein" && taboo.context !== context) continue;

    let triggered = false;
    switch (taboo.id) {
      case "duzen_ohne_erlaubnis":
        if (/\bdu\b/i.test(lower) || /\bdein\b/i.test(lower) || /\bdir\b/i.test(lower)) triggered = true;
        break;
      case "falsche_anrede": {
              const correctForm = protocol.titles[addresseeRank].addressForm.toLowerCase();
              if (!lower.includes(correctForm) && (lower.includes("eure") || lower.includes("eurer"))) triggered = true;
              break;
            }
      case "könig_unterbrechen":
        if (speakerRank !== "kaiser" && speakerRank !== "könig" && addresseeRank === "könig" && lower.includes("aber")) triggered = true;
        break;
    }
    if (triggered) {
      const threshold = protocol.scandalThresholds.find(t => t.violationType === mapTabooToType(taboo.id));
      const modifier = threshold?.rankModifier[speakerRank] ?? 1;
      const baseScore = threshold?.baseScore ?? 10;
      const scandalScore = Math.round(baseScore * modifier * (0.8 + rng() * 0.4));
      const gossipSpread = Math.min(100, scandalScore * (1.2 + rng() * 0.6));
      const reputationDamage = Math.min(100, scandalScore * (0.8 + rng() * 0.4));

      violations.push({
        id: `viol-${hashString(taboo.id + speaker + addressee + rng()).toString(16).padStart(8, "0")}`,
        violator: speaker,
        violatorRank: speakerRank,
        victim: addressee,
        victimRank: addresseeRank,
        violationType: mapTabooToType(taboo.id),
        description: taboo.description,
        context,
        severity: taboo.severity,
        scandalScore,
        gossipSpread: Math.round(gossipSpread),
        reputationDamage: Math.round(reputationDamage),
      });
    }
  }
  return violations;
}

function mapTabooToType(id: string): ScandalThreshold["violationType"] {
  const map: Record<string, ScandalThreshold["violationType"]> = {
    duzen_ohne_erlaubnis: "anrede",
    falsche_anrede: "anrede",
    handschuh_fehlt: "kleidung",
    sitzordnung_verletzt: "sitzordnung",
    könig_unterbrechen: "anrede",
    duell_verweigert: "duell",
    affäre_mit_hohem_rang: "affäre",
    geheimnis_verraten: "verrat",
  };
  return map[id] ?? "anrede";
}

export function calculateScandalIndex(violations: ProtocolViolation[]): number {
  if (violations.length === 0) return 0;
  const total = violations.reduce((sum, v) => sum + v.scandalScore, 0);
  const maxGossip = Math.max(...violations.map(v => v.gossipSpread));
  return Math.min(1000, Math.round(total * (1 + maxGossip / 100)));
}

export function createCourtCharacter(name: string, rank: TitleRank, house: string, seed: number): CourtCharacter {
  const rng = createSeededRandom(hashString(name + rank + house + seed));
  return {
    name,
    rank,
    house,
    reputation: 50 + Math.floor(rng() * 40),
    favor: {},
    knownViolations: [],
  };
}

export function createSampleProtocol(): CourtProtocol {
  return createProtocol("Beispiel", 42);
}

export function createSampleViolation(): ProtocolViolation {
  const protocol = createSampleProtocol();
  const violations = scanTextForViolations(protocol, "Du bist ein Narr, Eure Gnaden!", "Ritter Falk", "ritter", "Herzog Aldric", "herzog", "audienz");
  return violations[0] ?? {
    id: "viol-sample",
    violator: "Ritter Falk",
    violatorRank: "ritter",
    victim: "Herzog Aldric",
    victimRank: "herzog",
    violationType: "anrede",
    description: "Duz-Einladung nicht erhalten, aber 'Du' verwendet",
    context: "audienz",
    severity: "schwer",
    scandalScore: 20,
    gossipSpread: 30,
    reputationDamage: 15,
  };
}

export function createSampleCharacter(): CourtCharacter {
  return createCourtCharacter("Graf Valerius", "graf", "Haus Falkenhorst", 123);
}