// CourtroomEvidenceDossier (Meilenstein 55.0, v6.7.0)
// Asservaten-Hauptbuch, Beweisverwertungs-Wächter, Gerichtsakten-Dossier
// und Ketten-Integritäts-Prüfer für Kriminalroman-Fiktion.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module, browser-kompatibel.

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

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Leeres Array");
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export type CustodyState = "secured" | "transferred" | "analyzed" | "stored" | "destroyed";

export interface EvidenceInput {
  id: string;
  description: string;
  foundLocation: string;
  securingOfficer: string;
}

export interface CustodyEntry {
  timestamp: string;
  officer: string;
  action: CustodyState;
  location: string;
  sealNumber: string;
  notes: string;
}

export interface CustodyRecord {
  evidenceId: string;
  chainOfCustody: CustodyEntry[];
}

export type AcquisitionMethod = "searchWarrant" | "consent" | "plainView" | "illegalSearch" | "wiretap";

export interface EvidenceAdmissibilityInput {
  id: string;
  acquisitionMethod: AcquisitionMethod;
  warrantNumber: string | null;
  chainOfCustodyComplete: boolean;
}

export type ExclusionRisk = "low" | "medium" | "high" | "critical";

export interface AdmissibilityResult {
  admissible: boolean;
  reason: string;
  exclusionRisk: ExclusionRisk;
  notes: string[];
  chainOfCustodyGaps: string[];
}

export interface DossierEvidenceInput {
  id: string;
  description: string;
  type: string;
}

export interface DossierEntry {
  exhibitId: string;
  evidenceId: string;
  description: string;
  admissibility: boolean;
  custodyStatus: CustodyState;
  chainOfCustody: CustodyEntry[];
}

export interface CourtDossier {
  caseNumber: string;
  evidenceList: DossierEntry[];
  charges: string[];
  prosecutor: string;
  defendant: string;
  exhibitCount: number;
  dossierMarkdown: string;
}

export interface ChainOfCustodyVerificationInput {
  timestamp: string;
  officer: string;
  action: string;
  sealNumber: string;
}

export interface ChainOfCustodyVerificationResult {
  intact: boolean;
  gaps: string[];
  brokenAt: number | null;
  sealIntegrity: boolean;
  notes: string;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

export const EVIDENCE_CUSTODY_STATES: CustodyState[] = [
  "secured",
  "transferred",
  "analyzed",
  "stored",
  "destroyed",
];

const OFFICERS = [
  "Kriminalkommissar Weber",
  "Kriminalkommissar Brandt",
  "Kriminalhauptkommissar Adler",
  "Kriminalmeister Falk",
  "Kriminalkommissar Yilmaz",
  "Kriminalhauptkommissar Roth",
];

const LOCATIONS = [
  "Polizeipräsidium, Asservatenraum 3",
  "Kriminaltechnisches Labor",
  "Staatsanwaltschaft, Asservatenlager",
  "Landeskriminalamt, Asservatenarchiv",
  "Polizeipräsidium, Nachschubraum 12",
  "Gerichtsvollzieher-Asservat",
];

const CUSTODY_NOTES = [
  "Asservat mit Siegelnummer dokumentiert.",
  "Fotografisch erfasst und ins Hauptbuch eingetragen.",
  "Transportbegleitpapier mitgegeben.",
  "Analyseauftrag amtlich versehen.",
  "Raumtemperatur und Luftfeuchtigkeit protokolliert.",
  "Zweite Person bei Übergabe anwesend.",
  "Asservat unbeschadet übernommen.",
  "Siegelbruch ausgeschlossen, Verpackung intakt.",
];

const SEAL_PREFIX = "S";

// ---------------------------------------------------------------------------
// WP 115.2.1 — Asservaten-Hauptbuch
// ---------------------------------------------------------------------------

/**
 * Erzeugt einen Asservate-Hauptbuch-Eintrag mit 3 bis 5 Ketteinträgen.
 * Deterministisch bei gleichem Seed.
 */
export function addCustodyEntry(evidence: EvidenceInput, seed: number): CustodyRecord {
  const rng = createSeededRandom(hashString(`custody:${evidence.id}:${seed}`));
  const entryCount = 3 + Math.floor(rng() * 3); // 3 bis 5 Einträge
  const chain: CustodyEntry[] = [];
  const now = Date.UTC(2026, 5, 15, 8, 0, 0); // fester Referenzzeitstempel für Determinismus

  for (let i = 0; i < entryCount; i++) {
    const timestamp = new Date(now + i * 6 * 3600 * 1000 + Math.floor(rng() * 3 * 3600 * 1000));
    const officer = i === 0 ? evidence.securingOfficer : pick(OFFICERS, rng);
    const action = i === 0 ? "secured" : i === entryCount - 1 ? pick(EVIDENCE_CUSTODY_STATES.slice(0, 4), rng) : pick(EVIDENCE_CUSTODY_STATES.slice(0, 4), rng);
    const location = pick(LOCATIONS, rng);
    const sealNumber = `${SEAL_PREFIX}-${(hashString(`${evidence.id}:${i}`) % 9000 + 1000).toString()}`;
    const notes = pick(CUSTODY_NOTES, rng);
    chain.push({
      timestamp: timestamp.toISOString(),
      officer,
      action,
      location,
      sealNumber,
      notes,
    });
  }

  return {
    evidenceId: evidence.id,
    chainOfCustody: chain,
  };
}

// ---------------------------------------------------------------------------
// WP 115.2.2 — Beweisverwertungs-Wächter (Fruit of the Poisonous Tree)
// ---------------------------------------------------------------------------

/**
 * Prüft die Beweisverwertbarkeit nach der „Fruit of the Poisonous Tree"-Doktrin.
 * Illegale Suche ohne Haftbefehl = unverwertbar.
 * Lücken in der Asservatenkette = mittleres/hohes Risiko.
 */
export function validateEvidenceAdmissibility(
  evidence: EvidenceAdmissibilityInput
): AdmissibilityResult {
  const notes: string[] = [];
  const chainOfCustodyGaps: string[] = [];
  let admissible = true;
  let reason = "Beweis ist verwertbar.";
  let exclusionRisk: ExclusionRisk = "low";

  // 1. Illegale Suche ohne Haftbefehl → unverwertbar
  if (evidence.acquisitionMethod === "illegalSearch" && !evidence.warrantNumber) {
    admissible = false;
    reason = "Beweis wurde durch rechtswidrige Beschlagnahme ohne Haftbefehl erlangt. Beweisverwertungsverbot (Fruit of the Poisonous Tree).";
    exclusionRisk = "critical";
    notes.push("Rechtswidrige Beschlagnahme ohne richterliche Anordnung.");
    notes.push("Ausschluss der Beweisverwertung gemäß § 136a StPO analog.");
  }

  // 2. Haftbefehl ohne Nummer → hoch
  if ((evidence.acquisitionMethod === "searchWarrant" || evidence.acquisitionMethod === "wiretap") && !evidence.warrantNumber) {
    admissible = false;
    reason = `${evidence.acquisitionMethod === "wiretap" ? "Lauschangriff" : "Haftbefehl"} wurde ohne Nummer dokumentiert → Beweisverwertbarkeit nicht gegeben.`;
    exclusionRisk = "high";
    notes.push("Fehlende richterliche Kontrolldokumentation.");
  }

  // 3. Plain View → grundsätzlich verwertbar, aber Risiko prüfen
  if (evidence.acquisitionMethod === "plainView") {
    notes.push("Beweis durch sichtbare Feststellung erlangt – grundsätzlich verwertbar.");
    exclusionRisk = "low";
  }

  // 4. Einwilligung → verwertbar
  if (evidence.acquisitionMethod === "consent") {
    notes.push("Beweis auf Grundlage freiwilliger Einwilligung erlangt.");
    exclusionRisk = "low";
  }

  // 5. Kette unvollständig → Risiko erhöhen
  if (!evidence.chainOfCustodyComplete) {
    chainOfCustodyGaps.push("Asservatenkette ist unvollständig.");
    notes.push("Die Asservatenkette weist Lücken auf; Integrität ist nicht sicherstellbar.");
    const riskOrder = ["low", "medium", "high", "critical"] as const;
    const currentIdx = riskOrder.indexOf(exclusionRisk);
    if (currentIdx >= 0 && currentIdx < riskOrder.length - 1) {
      exclusionRisk = riskOrder[currentIdx + 1];
    }
    if (admissible) {
      reason = "Beweis ist formal verwertbar, aber die Asservatenkette weist Lücken auf – hohe Ausschlussrisiko.";
    }
  } else {
    notes.push("Asservatenkette ist vollständig dokumentiert.");
  }

  // 6. Zusammenfassende Notizen
  if (admissible && exclusionRisk === "low") {
    notes.push("Keine erheblichen Beweisverwertungshindernisse erkennbar.");
  } else if (admissible && exclusionRisk === "medium") {
    notes.push("Beweis ist verwertbar, aber mit restlichem Risiko behaftet.");
  }

  return {
    admissible,
    reason,
    exclusionRisk,
    notes,
    chainOfCustodyGaps,
  };
}

// ---------------------------------------------------------------------------
// WP 115.2.3 — Gerichtsakten-Dossier
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein Gerichtsakten-Dossier mit Asservatenliste, Anklagepunkten
 * und formatiertem Markdown-Export.
 */
export function generateCourtDossier(
  caseNumber: string,
  evidence: DossierEvidenceInput[],
  charges: string[],
  prosecutor: string,
  defendant: string,
  seed: number
): CourtDossier {
  const rng = createSeededRandom(hashString(`dossier:${caseNumber}:${seed}`));
  const evidenceList: DossierEntry[] = [];

  for (let i = 0; i < evidence.length; i++) {
    const ev = evidence[i];
    const custodyRecord = addCustodyEntry(
      { id: ev.id, description: ev.description, foundLocation: "Tatort", securingOfficer: pick(OFFICERS, rng) },
      seed + i
    );
    const acquisitionMethod: AcquisitionMethod = pick(
      ["searchWarrant", "consent", "plainView", "wiretap", "illegalSearch"] as AcquisitionMethod[],
      rng
    );
    const warrantNumber = acquisitionMethod === "searchWarrant" || acquisitionMethod === "wiretap"
      ? `HF-${(hashString(ev.id) % 9000 + 1000).toString()}`
      : null;
    const admissibilityResult = validateEvidenceAdmissibility({
      id: ev.id,
      acquisitionMethod,
      warrantNumber,
      chainOfCustodyComplete: rng() > 0.25,
    });

    const custodyStatus: CustodyState =
      custodyRecord.chainOfCustody.length > 0
        ? custodyRecord.chainOfCustody[custodyRecord.chainOfCustody.length - 1].action
        : "stored";

    evidenceList.push({
      exhibitId: `AST-${(i + 1).toString().padStart(3, "0")}`,
      evidenceId: ev.id,
      description: ev.description,
      admissibility: admissibilityResult.admissible,
      custodyStatus,
      chainOfCustody: custodyRecord.chainOfCustody,
    });
  }

  const exhibitCount = evidenceList.length;
  const dossierMarkdown = renderDossierMarkdown(caseNumber, evidenceList, charges, prosecutor, defendant);

  return {
    caseNumber,
    evidenceList,
    charges,
    prosecutor,
    defendant,
    exhibitCount,
    dossierMarkdown,
  };
}

function renderDossierMarkdown(
  caseNumber: string,
  evidenceList: DossierEntry[],
  charges: string[],
  prosecutor: string,
  defendant: string
): string {
  const lines: string[] = [];
  lines.push(`# ⚖️ GERICHTSAKTEN-DOSSIER ⚖️`);
  lines.push(``);
  lines.push(`> **AKTENZEICHEN:** ${caseNumber}`);
  lines.push(`> **STaatsanwaltschaft:** ${prosecutor}`);
  lines.push(`> **Beschuldigter:** ${defendant}`);
  lines.push(`> **ERMITTLUNGSVERMERK:** ${new Date(Date.UTC(2026, 5, 15, 8, 0, 0)).toISOString().slice(0, 10)}`);
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## ANKLAGEPUNKTE`);
  lines.push(``);
  for (const charge of charges) {
    lines.push(`- ${charge}`);
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## ASSERVATENVERZEICHNIS`);
  lines.push(``);
  lines.push(`| Nr. | Asservat-ID | Beschreibung | Verwertbarkeit | Asservatenstatus | Kette |`);
  lines.push(`|-----|-------------|--------------|----------------|-------------------|-------|`);
  for (const entry of evidenceList) {
    const admissibilityLabel = entry.admissibility ? "✅ Verwertbar" : "❌ Unverwertbar";
    lines.push(
      `| ${entry.exhibitId} | ${entry.evidenceId} | ${entry.description} | ${admissibilityLabel} | ${entry.custodyStatus} | ${entry.chainOfCustody.length} Einträge |`
    );
  }
  lines.push(``);
  lines.push(`---`);
  lines.push(``);
  lines.push(`## RECHTLICHE HINWEISE`);
  lines.push(``);
  lines.push(`1. Alle Asservaten müssen laut § 94 StPO gesichert und zuverlässig verwahrt werden.`);
  lines.push(`2. Die Beweisverwertbarkeit richtet sich nach der richterlichen Überprüfung der Erhebungsbedingungen.`);
  lines.push(`3. Unverwertbare Beweise sind nach § 244 Abs. 3 StPO im Urteil zu berücksichtigen.`);
  lines.push(`4. Die Asservatenkette ist lückenlos zu dokumentieren; fehlende Einträge führen zu Beweisverwertungsverboten.`);
  lines.push(`5. Dieses Dossier dient ausschließlich der Romanfiktion und ist keine Rechtsberatung.`);
  lines.push(``);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// WP 115.2.4 — Ketten-Integritäts-Prüfer
// ---------------------------------------------------------------------------

/**
 * Prüft die Asservatenkette auf Integrität:
 * - keine Zeitlücken > 24 Stunden
 * - keine fehlenden Beamten
 * - fortlaufende Siegelnummern
 */
export function verifyChainOfCustody(
  entries: ChainOfCustodyVerificationInput[]
): ChainOfCustodyVerificationResult {
  const gaps: string[] = [];
  let brokenAt: number | null = null;
  let sealIntegrity = true;

  if (entries.length === 0) {
    return {
      intact: false,
      gaps: ["Kette ist leer – keine Einträge vorhanden."],
      brokenAt: null,
      sealIntegrity: false,
      notes: "Keine Asservatenkette dokumentiert. Integrität nicht prüfbar.",
    };
  }

  let prevTimestamp = Date.parse(entries[0].timestamp);
  let prevSealNum = parseSealNumber(entries[0].sealNumber);

  for (let i = 1; i < entries.length; i++) {
    const current = entries[i];
    const currentTimestamp = Date.parse(current.timestamp);

    // 1. Zeitlücken > 24h prüfen
    if (currentTimestamp - prevTimestamp > 24 * 3600 * 1000) {
      const gapHours = Math.round((currentTimestamp - prevTimestamp) / 3600000);
      gaps.push(`Zeitlücke von ${gapHours} Stunden zwischen Eintrag ${i} und ${i + 1}.`);
      if (brokenAt === null) brokenAt = i;
    }

    // 2. Fehlender Beamter prüfen
    if (!current.officer || current.officer.trim() === "") {
      gaps.push(`Eintrag ${i + 1}: fehlende Beamtenangabe.`);
      if (brokenAt === null) brokenAt = i;
    }

    // 3. Siegelnummern-Prüfung
    const currentSealNum = parseSealNumber(current.sealNumber);
    if (currentSealNum !== null && prevSealNum !== null) {
      if (currentSealNum !== prevSealNum + 1 && currentSealNum !== prevSealNum) {
        sealIntegrity = false;
        gaps.push(`Siegelnummern-Sprung: ${prevSealNum} → ${currentSealNum} (Eintrag ${i + 1}).`);
        if (brokenAt === null) brokenAt = i;
      }
    }

    prevTimestamp = currentTimestamp;
    prevSealNum = currentSealNum;
  }

  const intact = gaps.length === 0 && sealIntegrity;
  const notes = intact
    ? "Asservatenkette ist lückenlos dokumentiert; Siegelnummern fortlaufend, Zeitraum ohne Lücken > 24h."
    : `Asservatenkette weist ${gaps.length}(en) Fehler auf. Siegel-Integrität: ${sealIntegrity ? "intakt" : "beeinträchtigt"}.`;

  return { intact, gaps, brokenAt, sealIntegrity, notes };
}

function parseSealNumber(seal: string): number | null {
  const match = seal.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

// ---------------------------------------------------------------------------
// Factory-Funktionen
// ---------------------------------------------------------------------------

export function createSampleCustodyEntry(): CustodyRecord {
  return addCustodyEntry(
    {
      id: "BE-001",
      description: "Blutiger Handschuh am Tatort",
      foundLocation: "Tat Wohnzimmer, Parkettboden",
      securingOfficer: "Kriminalkommissar Weber",
    },
    42
  );
}

export function createSampleCourtDossier(): CourtDossier {
  return generateCourtDossier(
    "Js 123/26",
    [
      { id: "BE-001", description: "Blutiger Handschuh", type: "Dermal evidence" },
      { id: "BE-002", description: "Mobiltelefon des Beschuldigten", type: "Digital evidence" },
      { id: "BE-003", description: "Küchenmesser mit Fingerabdrücken", type: "Weapon" },
      { id: "BE-004", description: "Fotografien der Wohnung", type: "Photographic evidence" },
    ],
    ["Mord § 212 StGB", "Verletzung von Persönlichkeitsrechten § 201 StGB"],
    "Staatsanwaltschaft Berlin-Mitte, Staatsanwalt Dr. Krüger",
    "Max Mustermann",
    42
  );
}
