/**
 * Tests: multiAgentWritersRoom (WP 62.1 — Multi-Agent Writer's Room)
 */

import { describe, it, expect } from "vitest";
import {
  runWritersRoom,
  getPersonaProfile,
  getAllPersonas,
  analyzeConsensus,
  formatRoomProtocol,
  PERSONA_LABELS,
  type PersonaId,
} from "./multiAgentWritersRoom";

const PROBLEM = "Die Konfrontation im dritten Akt fühlt sich zu zahm an";

describe("multiAgentWritersRoom — runWritersRoom", () => {
  it("führt eine Sitzung durch", () => {
    const s = runWritersRoom(PROBLEM);
    expect(s.protocol.length).toBe(4);
    expect(s.consensus.length).toBeGreaterThan(30);
  });

  it("hat alle vier Personas", () => {
    const s = runWritersRoom(PROBLEM);
    const ids = s.protocol.map((p) => p.persona);
    expect(ids).toEqual(["showrunner", "punch-up", "lore-keeper", "empathy-advocate"]);
  });

  it("benennt die Personas", () => {
    const s = runWritersRoom(PROBLEM);
    expect(s.protocol[0].personaLabel).toBe("Der Showrunner");
    expect(s.protocol[1].personaLabel).toBe("Der Dialog-Punch-Up-Spezialist");
  });

  it("weist jedem Persona ein Anliegen zu", () => {
    const s = runWritersRoom(PROBLEM);
    expect(s.protocol[0].concern).toBe("pacing");
    expect(s.protocol[1].concern).toBe("dialogue");
    expect(s.protocol[2].concern).toBe("consistency");
    expect(s.protocol[3].concern).toBe("emotion");
  });

  it("jedes Persona äußert einen Einwand", () => {
    const s = runWritersRoom(PROBLEM);
    s.protocol.forEach((p) => {
      expect(p.statement.length).toBeGreaterThan(15);
    });
  });

  it("ist deterministisch", () => {
    const a = runWritersRoom(PROBLEM);
    const b = runWritersRoom(PROBLEM);
    expect(a.consensus).toBe(b.consensus);
    expect(a.protocol.map((p) => p.statement)).toEqual(b.protocol.map((p) => p.statement));
  });

  it("unterschiedliche Probleme erzeugen unterschiedliche Sitzungen", () => {
    const a = runWritersRoom("Problem A");
    const b = runWritersRoom("Problem B");
    expect(a.consensus).not.toBe(b.consensus);
  });

  it("nennt das Problem in der Synthese", () => {
    const s = runWritersRoom(PROBLEM);
    expect(s.consensus).toContain(PROBLEM);
  });

  it("berechnet den Konsens-Level", () => {
    const s = runWritersRoom(PROBLEM);
    expect(s.consensusLevel).toBeGreaterThan(0);
    expect(s.consensusLevel).toBeLessThanOrEqual(1);
  });

  it("Zustimmung bleibt zwischen 0 und 1", () => {
    const s = runWritersRoom(PROBLEM);
    s.protocol.forEach((p) => {
      expect(p.agreement).toBeGreaterThanOrEqual(0);
      expect(p.agreement).toBeLessThanOrEqual(1);
    });
  });

  it("berechnet die Wortzahl der Synthese", () => {
    const s = runWritersRoom(PROBLEM);
    expect(s.consensusWordCount).toBeGreaterThan(10);
  });

  it("zählt die Beiträge", () => {
    expect(runWritersRoom(PROBLEM).statementCount).toBe(4);
  });

  it("kommt ohne Problem zurecht", () => {
    const s = runWritersRoom();
    expect(s.protocol.length).toBe(4);
    expect(s.consensus.length).toBeGreaterThan(30);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    expect(runWritersRoom(null).protocol.length).toBe(4);
    expect(runWritersRoom(undefined).consensusWordCount).toBeGreaterThan(5);
    expect(runWritersRoom(42).problem).toBe("");
  });

  it("exportiert die Persona-Labels", () => {
    expect(PERSONA_LABELS.showrunner).toBe("Der Showrunner");
    expect(PERSONA_LABELS["lore-keeper"]).toBe("Der Lore- & Realismus-Hüter");
  });
});

describe("multiAgentWritersRoom — getPersonaProfile", () => {
  it("liefert ein Profil", () => {
    const p = getPersonaProfile("showrunner");
    expect(p.label).toBe("Der Showrunner");
    expect(p.focus.length).toBeGreaterThan(0);
  });

  it("liefert für alle vier Personas ein Profil", () => {
    const all: PersonaId[] = ["showrunner", "punch-up", "lore-keeper", "empathy-advocate"];
    all.forEach((id) => {
      const p = getPersonaProfile(id);
      expect(p.id).toBe(id);
      expect(p.role.length).toBeGreaterThan(20);
      expect(p.typicalObjection.length).toBeGreaterThan(10);
    });
  });

  it("fällt bei unbekannter ID auf den Showrunner zurück", () => {
    expect(getPersonaProfile("unbekannt").id).toBe("showrunner");
    expect(getPersonaProfile().id).toBe("showrunner");
  });

  it("gibt frische Arrays zurück", () => {
    const a = getPersonaProfile("punch-up");
    const b = getPersonaProfile("punch-up");
    expect(a.focus).not.toBe(b.focus);
    expect(a.focus).toEqual(b.focus);
  });

  it("liefert alle Personas", () => {
    const all = getAllPersonas();
    expect(all.length).toBe(4);
    expect(all.map((p) => p.id)).toEqual([
      "showrunner", "punch-up", "lore-keeper", "empathy-advocate",
    ]);
  });
});

describe("multiAgentWritersRoom — analyzeConsensus", () => {
  it("analysiert eine Sitzung", () => {
    const s = runWritersRoom(PROBLEM);
    const a = analyzeConsensus(s);
    expect(a.level).toBeGreaterThan(0);
  });

  it("meldet erreichten Konsens bei hoher Zustimmung", () => {
    const s = runWritersRoom(PROBLEM);
    const a = analyzeConsensus({
      ...s,
      protocol: s.protocol.map((p) => ({ ...p, agreement: 0.9 })),
    });
    expect(a.reached).toBe(true);
    expect(a.recommendation).toContain("Konsens");
  });

  it("meldet fehlenden Konsens bei niedriger Zustimmung", () => {
    const s = runWritersRoom(PROBLEM);
    const a = analyzeConsensus({
      ...s,
      protocol: s.protocol.map((p) => ({ ...p, agreement: 0.2 })),
    });
    expect(a.reached).toBe(false);
  });

  it("listet Abweichler", () => {
    const s = runWritersRoom(PROBLEM);
    const a = analyzeConsensus({
      ...s,
      protocol: s.protocol.map((p, i) => ({ ...p, agreement: i === 0 ? 0.1 : 0.9 })),
    });
    expect(a.dissenters.length).toBe(1);
    expect(a.dissenters[0]).toBe("Der Showrunner");
  });

  it("meldet zu viele Einwände", () => {
    const s = runWritersRoom(PROBLEM);
    const a = analyzeConsensus({
      ...s,
      protocol: s.protocol.map((p) => ({ ...p, agreement: 0.1 })),
    });
    expect(a.recommendation).toContain("Einwände");
  });

  it("liefert eine Empfehlung", () => {
    const a = analyzeConsensus(runWritersRoom(PROBLEM));
    expect(a.recommendation.length).toBeGreaterThan(10);
  });

  it("kommt mit ungültigem Input zurecht", () => {
    const a = analyzeConsensus(null);
    expect(a.level).toBe(0);
    expect(a.recommendation).toContain("Keine Sitzung");
    expect(analyzeConsensus(undefined).reached).toBe(false);
    expect(analyzeConsensus({ protocol: [] } as never).dissenters).toEqual([]);
  });
});

describe("multiAgentWritersRoom — formatRoomProtocol", () => {
  it("formatiert das Protokoll", () => {
    const s = runWritersRoom(PROBLEM);
    const text = formatRoomProtocol(s);
    expect(text).toContain("Der Showrunner");
    expect(text).toContain("KONSENS:");
  });

  it("nennt die Anliegen", () => {
    const text = formatRoomProtocol(runWritersRoom(PROBLEM));
    expect(text).toContain("[pacing]");
    expect(text).toContain("[consistency]");
  });

  it("kommt mit leerem Input zurecht", () => {
    expect(formatRoomProtocol(null)).toBe("");
    expect(formatRoomProtocol(undefined)).toBe("");
  });
});
