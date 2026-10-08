// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  hashString,
  createSeededRandom,
  EVIDENCE_CUSTODY_STATES,
  addCustodyEntry,
  validateEvidenceAdmissibility,
  generateCourtDossier,
  verifyChainOfCustody,
  createSampleCustodyEntry,
  createSampleCourtDossier,
  type EvidenceInput,
  type EvidenceAdmissibilityInput,
  type ChainOfCustodyVerificationInput,
} from "./courtroomEvidenceDossier";

describe("hashString", () => {
  it("ist deterministisch", () => {
    expect(hashString("asservat")).toBe(hashString("asservat"));
  });

  it("liefert eine vorzeichenlose 32-Bit-Ganzzahl", () => {
    const h = hashString("Beweismittel");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  it("unterschiedliche Strings erzeugen unterschiedliche Hashes", () => {
    expect(hashString("a")).not.toBe(hashString("b"));
    expect(hashString("BE-001")).not.toBe(hashString("BE-002"));
    expect(hashString("secured")).not.toBe(hashString("destroyed"));
  });

  it("leerer String liefert einen stabilen Wert", () => {
    expect(hashString("")).toBe(hashString(""));
  });
});

describe("createSeededRandom", () => {
  it("ist deterministisch für gleichen Seed", () => {
    const r1 = createSeededRandom(42);
    const r2 = createSeededRandom(42);
    for (let i = 0; i < 20; i++) {
      expect(r1()).toBe(r2());
    }
  });

  it("liefert Werte im Bereich [0,1)", () => {
    const r = createSeededRandom(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("unterschiedliche Seeds erzeugen unterschiedliche Folgen", () => {
    const a = createSeededRandom(1);
    const b = createSeededRandom(2);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });
});

describe("EVIDENCE_CUSTODY_STATES", () => {
  it("enthält fünf Zustände", () => {
    expect(EVIDENCE_CUSTODY_STATES).toHaveLength(5);
  });

  it("enthält genau die erwarteten Zustände", () => {
    expect(EVIDENCE_CUSTODY_STATES).toEqual([
      "secured",
      "transferred",
      "analyzed",
      "stored",
      "destroyed",
    ]);
  });
});

describe("addCustodyEntry", () => {
  const evidence: EvidenceInput = {
    id: "BE-100",
    description: "Blutige Kleidung",
    foundLocation: "Tatort Küche",
    securingOfficer: "Kriminalkommissar Weber",
  };

  it("gibt die evidenceId zurück", () => {
    const rec = addCustodyEntry(evidence, 1);
    expect(rec.evidenceId).toBe("BE-100");
  });

  it("enthält eine Asservatenkette mit 3 bis 5 Einträgen", () => {
    for (let seed = 0; seed < 20; seed++) {
      const rec = addCustodyEntry(evidence, seed);
      expect(Array.isArray(rec.chainOfCustody)).toBe(true);
      expect(rec.chainOfCustody.length).toBeGreaterThanOrEqual(3);
      expect(rec.chainOfCustody.length).toBeLessThanOrEqual(5);
    }
  });

  it("jeder Eintrag hat timestamp, officer, action, location, sealNumber und notes", () => {
    const rec = addCustodyEntry(evidence, 5);
    for (const entry of rec.chainOfCustody) {
      expect(typeof entry.timestamp).toBe("string");
      expect(Number.isNaN(Date.parse(entry.timestamp))).toBe(false);
      expect(typeof entry.officer).toBe("string");
      expect(entry.officer.length).toBeGreaterThan(0);
      expect(EVIDENCE_CUSTODY_STATES).toContain(entry.action);
      expect(typeof entry.location).toBe("string");
      expect(entry.location.length).toBeGreaterThan(0);
      expect(entry.sealNumber).toMatch(/^S-\d+$/);
      expect(typeof entry.notes).toBe("string");
      expect(entry.notes.length).toBeGreaterThan(0);
    }
  });

  it("der erste Eintrag ist der Sicherungsvorgang (secured) durch den sichernden Beamten", () => {
    const rec = addCustodyEntry(evidence, 3);
    expect(rec.chainOfCustody[0].action).toBe("secured");
    expect(rec.chainOfCustody[0].officer).toBe(evidence.securingOfficer);
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = addCustodyEntry(evidence, 42);
    const b = addCustodyEntry(evidence, 42);
    expect(a).toEqual(b);
  });

  it("unterschiedliche Seeds erzeugen unterschiedliche Ketten", () => {
    const a = addCustodyEntry(evidence, 1);
    const b = addCustodyEntry(evidence, 999);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe("validateEvidenceAdmissibility", () => {
  function input(overrides: Partial<EvidenceAdmissibilityInput>): EvidenceAdmissibilityInput {
    return {
      id: "BE-001",
      acquisitionMethod: "searchWarrant",
      warrantNumber: "HF-1234",
      chainOfCustodyComplete: true,
      ...overrides,
    };
  }

  it("searchWarrant mit Haftbefehl ist verwertbar", () => {
    const res = validateEvidenceAdmissibility(input({ acquisitionMethod: "searchWarrant", warrantNumber: "HF-1234" }));
    expect(res.admissible).toBe(true);
    expect(res.exclusionRisk).toBe("low");
    expect(res.chainOfCustodyGaps).toEqual([]);
  });

  it("illegalSearch ohne Haftbefehl ist unverwertbar", () => {
    const res = validateEvidenceAdmissibility(
      input({ acquisitionMethod: "illegalSearch", warrantNumber: null })
    );
    expect(res.admissible).toBe(false);
    expect(res.exclusionRisk).toBe("critical");
    expect(res.notes.length).toBeGreaterThan(0);
  });

  it("searchWarrant ohne Haftbefehlsnummer ergibt hohes Risiko", () => {
    const res = validateEvidenceAdmissibility(
      input({ acquisitionMethod: "searchWarrant", warrantNumber: null })
    );
    expect(res.admissible).toBe(false);
    expect(res.exclusionRisk).toBe("high");
  });

  it("exclusionRisk low bei vollständiger Kette und Einwilligung", () => {
    const res = validateEvidenceAdmissibility(
      input({ acquisitionMethod: "consent", warrantNumber: null, chainOfCustodyComplete: true })
    );
    expect(res.admissible).toBe(true);
    expect(res.exclusionRisk).toBe("low");
  });

  it("exclusionRisk medium bei unvollständiger Kette ohne sonstige Hindernisse", () => {
    const res = validateEvidenceAdmissibility(
      input({ acquisitionMethod: "consent", warrantNumber: null, chainOfCustodyComplete: false })
    );
    expect(res.exclusionRisk).toBe("medium");
    expect(res.chainOfCustodyGaps.length).toBeGreaterThan(0);
  });

  it("chainOfCustodyGaps ist leer bei vollständiger Kette", () => {
    const res = validateEvidenceAdmissibility(input({ chainOfCustodyComplete: true }));
    expect(Array.isArray(res.chainOfCustodyGaps)).toBe(true);
    expect(res.chainOfCustodyGaps).toHaveLength(0);
  });

  it("chainOfCustodyGaps listet Lücken bei unvollständiger Kette", () => {
    const res = validateEvidenceAdmissibility(input({ chainOfCustodyComplete: false }));
    expect(res.chainOfCustodyGaps.length).toBeGreaterThan(0);
    expect(res.chainOfCustodyGaps.every((g) => typeof g === "string")).toBe(true);
  });

  it("gibt stets reason, notes und exclusionRisk zurück", () => {
    const res = validateEvidenceAdmissibility(input({ acquisitionMethod: "plainView", warrantNumber: null }));
    expect(typeof res.reason).toBe("string");
    expect(res.reason.length).toBeGreaterThan(0);
    expect(Array.isArray(res.notes)).toBe(true);
    expect(["low", "medium", "high", "critical"]).toContain(res.exclusionRisk);
  });
});

describe("generateCourtDossier", () => {
  const evidence = [
    { id: "BE-001", description: "Blutiger Handschuh", type: "Dermal evidence" },
    { id: "BE-002", description: "Mobiltelefon", type: "Digital evidence" },
    { id: "BE-003", description: "Küchenmesser", type: "Weapon" },
  ];
  const charges = ["Mord § 212 StGB", "Diebstahl § 242 StGB"];

  it("übernimmt caseNumber, charges, prosecutor und defendant", () => {
    const dossier = generateCourtDossier(
      "Js 42/26",
      evidence,
      charges,
      "Staatsanwalt Dr. Krüger",
      "Max Mustermann",
      42
    );
    expect(dossier.caseNumber).toBe("Js 42/26");
    expect(dossier.charges).toEqual(charges);
    expect(dossier.prosecutor).toBe("Staatsanwalt Dr. Krüger");
    expect(dossier.defendant).toBe("Max Mustermann");
  });

  it("enthält eine evidenceList mit einem Eintrag je Beweismittel", () => {
    const dossier = generateCourtDossier("Js 42/26", evidence, charges, "P", "D", 42);
    expect(Array.isArray(dossier.evidenceList)).toBe(true);
    expect(dossier.evidenceList).toHaveLength(evidence.length);
    expect(dossier.evidenceList.map((e) => e.evidenceId)).toEqual(evidence.map((e) => e.id));
  });

  it("exhibitCount entspricht der Anzahl der Beweismittel", () => {
    const dossier = generateCourtDossier("Js 42/26", evidence, charges, "P", "D", 42);
    expect(dossier.exhibitCount).toBe(evidence.length);
    expect(dossier.exhibitCount).toBe(dossier.evidenceList.length);
  });

  it("vergibt fortlaufende Asservat-IDs (AST-001 ...)", () => {
    const dossier = generateCourtDossier("Js 42/26", evidence, charges, "P", "D", 42);
    expect(dossier.evidenceList[0].exhibitId).toBe("AST-001");
    expect(dossier.evidenceList[1].exhibitId).toBe("AST-002");
    expect(dossier.evidenceList[2].exhibitId).toBe("AST-003");
  });

  it("jeder Eintrag hat admissibility, custodyStatus und eine Kette", () => {
    const dossier = generateCourtDossier("Js 42/26", evidence, charges, "P", "D", 42);
    for (const entry of dossier.evidenceList) {
      expect(typeof entry.admissibility).toBe("boolean");
      expect(EVIDENCE_CUSTODY_STATES).toContain(entry.custodyStatus);
      expect(entry.chainOfCustody.length).toBeGreaterThanOrEqual(3);
      expect(entry.chainOfCustody.length).toBeLessThanOrEqual(5);
    }
  });

  it("dossierMarkdown ist ein nicht-leerer String mit den Kernelementen", () => {
    const dossier = generateCourtDossier("Js 42/26", evidence, charges, "P", "D", 42);
    expect(typeof dossier.dossierMarkdown).toBe("string");
    expect(dossier.dossierMarkdown.length).toBeGreaterThan(0);
    expect(dossier.dossierMarkdown).toContain("GERICHTSAKTEN-DOSSIER");
    expect(dossier.dossierMarkdown).toContain("Js 42/26");
    expect(dossier.dossierMarkdown).toContain("ASSERVATENVERZEICHNIS");
  });

  it("ist deterministisch bei gleichem Seed", () => {
    const a = generateCourtDossier("Js 42/26", evidence, charges, "P", "D", 7);
    const b = generateCourtDossier("Js 42/26", evidence, charges, "P", "D", 7);
    expect(a).toEqual(b);
  });
});

describe("verifyChainOfCustody", () => {
  const intactChain: ChainOfCustodyVerificationInput[] = [
    { timestamp: "2026-06-15T08:00:00.000Z", officer: "Weber", action: "secured", sealNumber: "S-100" },
    { timestamp: "2026-06-15T12:00:00.000Z", officer: "Brandt", action: "transferred", sealNumber: "S-101" },
    { timestamp: "2026-06-16T08:00:00.000Z", officer: "Adler", action: "analyzed", sealNumber: "S-102" },
  ];

  it("meldet eine lückenlose Kette als intakt", () => {
    const res = verifyChainOfCustody(intactChain);
    expect(res.intact).toBe(true);
    expect(res.gaps).toEqual([]);
    expect(res.brokenAt).toBeNull();
    expect(res.sealIntegrity).toBe(true);
    expect(typeof res.notes).toBe("string");
    expect(res.notes.length).toBeGreaterThan(0);
  });

  it("behandelt eine leere Kette als nicht intakt", () => {
    const res = verifyChainOfCustody([]);
    expect(res.intact).toBe(false);
    expect(res.gaps.length).toBeGreaterThan(0);
    expect(res.brokenAt).toBeNull();
    expect(res.sealIntegrity).toBe(false);
  });

  it("erkennt eine Zeitlücke von mehr als 24 Stunden", () => {
    const res = verifyChainOfCustody([
      { timestamp: "2026-06-15T08:00:00.000Z", officer: "Weber", action: "secured", sealNumber: "S-100" },
      { timestamp: "2026-06-17T09:00:00.000Z", officer: "Brandt", action: "transferred", sealNumber: "S-101" },
    ]);
    expect(res.intact).toBe(false);
    expect(res.gaps.length).toBeGreaterThan(0);
    expect(res.brokenAt).toBe(1);
  });

  it("erkennt eine fehlende Beamtenangabe", () => {
    const res = verifyChainOfCustody([
      { timestamp: "2026-06-15T08:00:00.000Z", officer: "Weber", action: "secured", sealNumber: "S-100" },
      { timestamp: "2026-06-15T09:00:00.000Z", officer: "   ", action: "transferred", sealNumber: "S-101" },
    ]);
    expect(res.intact).toBe(false);
    expect(res.gaps.some((g) => g.includes("Beamtenangabe"))).toBe(true);
    expect(res.brokenAt).toBe(1);
  });

  it("erkennt einen Siegelnummern-Sprung und meldet beeinträchtigte Siegelintegrität", () => {
    const res = verifyChainOfCustody([
      { timestamp: "2026-06-15T08:00:00.000Z", officer: "Weber", action: "secured", sealNumber: "S-100" },
      { timestamp: "2026-06-15T09:00:00.000Z", officer: "Brandt", action: "transferred", sealNumber: "S-105" },
    ]);
    expect(res.intact).toBe(false);
    expect(res.sealIntegrity).toBe(false);
    expect(res.brokenAt).toBe(1);
  });

  it("akzeptiert gleiche Siegelnummern als fortlaufend", () => {
    const res = verifyChainOfCustody([
      { timestamp: "2026-06-15T08:00:00.000Z", officer: "Weber", action: "secured", sealNumber: "S-100" },
      { timestamp: "2026-06-15T09:00:00.000Z", officer: "Brandt", action: "transferred", sealNumber: "S-100" },
    ]);
    expect(res.sealIntegrity).toBe(true);
    expect(res.intact).toBe(true);
  });
});

describe("createSampleCustodyEntry", () => {
  it("liefert einen gültigen Asservaten-Hauptbucheintrag", () => {
    const rec = createSampleCustodyEntry();
    expect(rec.evidenceId).toBe("BE-001");
    expect(rec.chainOfCustody.length).toBeGreaterThanOrEqual(3);
    expect(rec.chainOfCustody.length).toBeLessThanOrEqual(5);
    expect(rec.chainOfCustody[0].action).toBe("secured");
    for (const entry of rec.chainOfCustody) {
      expect(entry.sealNumber).toMatch(/^S-\d+$/);
      expect(EVIDENCE_CUSTODY_STATES).toContain(entry.action);
    }
  });

  it("ist deterministisch", () => {
    expect(createSampleCustodyEntry()).toEqual(createSampleCustodyEntry());
  });
});

describe("createSampleCourtDossier", () => {
  it("liefert ein gültiges Gerichtsakten-Dossier", () => {
    const dossier = createSampleCourtDossier();
    expect(dossier.caseNumber).toBe("Js 123/26");
    expect(dossier.evidenceList).toHaveLength(4);
    expect(dossier.exhibitCount).toBe(4);
    expect(dossier.charges.length).toBeGreaterThan(0);
    expect(typeof dossier.prosecutor).toBe("string");
    expect(dossier.prosecutor.length).toBeGreaterThan(0);
    expect(typeof dossier.defendant).toBe("string");
    expect(dossier.defendant.length).toBeGreaterThan(0);
    expect(typeof dossier.dossierMarkdown).toBe("string");
    expect(dossier.dossierMarkdown).toContain("Js 123/26");
    expect(dossier.dossierMarkdown).toContain("ASSERVATENVERZEICHNIS");
  });

  it("ist deterministisch", () => {
    expect(createSampleCourtDossier()).toEqual(createSampleCourtDossier());
  });
});
