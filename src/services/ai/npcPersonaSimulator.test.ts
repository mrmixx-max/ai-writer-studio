/**
 * Tests: npcPersonaSimulator (WP 69.1)
 */

import { describe, it, expect } from "vitest";
import {
  startInterrogation,
  applyMove,
  buildGameMasterDossier,
  runInterrogation,
  ALIGNMENT_LABELS,
  type NpcPersona,
  type InterrogationMove,
} from "./npcPersonaSimulator";

const PERSONA: NpcPersona = {
  name: "Der Wirt",
  alignment: "neutral",
  motivation: "Er will seine Schänke schützen.",
  baseResistance: 40,
  secrets: [
    {
      id: "geheim-1",
      content: "Er hat den Brandstifter gesehen.",
      pressureThreshold: 70,
      sympathyThreshold: 75,
      requiresEvidence: "brandbeschleuniger",
      emotionalLevers: ["tochter", "familie"],
    },
    {
      id: "geheim-2",
      content: "Er hat das Geld genommen.",
      pressureThreshold: 90,
      sympathyThreshold: 95,
    },
  ],
  deflection: "Ich weiß von nichts.",
};

describe("npcPersonaSimulator", () => {
  describe("startInterrogation", () => {
    it("erzeugt einen Anfangszustand", () => {
      const s = startInterrogation(PERSONA);
      expect(s.pressure).toBeGreaterThan(0);
      expect(s.sympathy).toBeGreaterThan(0);
      expect(s.evidence).toEqual([]);
      expect(s.revealed).toEqual([]);
    });

    it("startet widerständige Figuren misstrauischer", () => {
      const low = startInterrogation({ ...PERSONA, baseResistance: 10 });
      const high = startInterrogation({ ...PERSONA, baseResistance: 90 });
      expect(high.pressure).toBeGreaterThan(low.pressure);
      expect(high.sympathy).toBeLessThan(low.sympathy);
    });

    it("kommt ohne Persona zurecht", () => {
      const s = startInterrogation(null);
      expect(s.pressure).toBeGreaterThanOrEqual(0);
    });

    it("ist deterministisch", () => {
      expect(JSON.stringify(startInterrogation(PERSONA))).toBe(JSON.stringify(startInterrogation(PERSONA)));
    });
  });

  describe("applyMove", () => {
    it("erhöht den Druck bei Druck-Ausübung", () => {
      const s = startInterrogation(PERSONA);
      const { state } = applyMove(PERSONA, s, { kind: "pressure", value: "Ich warne dich." });
      expect(state.pressure).toBeGreaterThan(s.pressure);
    });

    it("senkt die Sympathie bei Druck-Ausübung", () => {
      const s = startInterrogation(PERSONA);
      const { state } = applyMove(PERSONA, s, { kind: "pressure", value: "Rede!" });
      expect(state.sympathy).toBeLessThan(s.sympathy);
    });

    it("erhöht die Sympathie bei Empathie", () => {
      const s = startInterrogation(PERSONA);
      const { state } = applyMove(PERSONA, s, { kind: "empathy", value: "Ich verstehe dich." });
      expect(state.sympathy).toBeGreaterThan(s.sympathy);
    });

    it("legt Beweise vor", () => {
      const s = startInterrogation(PERSONA);
      const { state } = applyMove(PERSONA, s, { kind: "evidence", value: "brandbeschleuniger" });
      expect(state.evidence).toContain("brandbeschleuniger");
    });

    it("öffnet ein Geheimnis sofort bei passendem Beweis", () => {
      const s = startInterrogation(PERSONA);
      const { response } = applyMove(PERSONA, s, { kind: "evidence", value: "brandbeschleuniger" });
      expect(response.kind).toBe("confession");
      expect(response.revealedSecretId).toBe("geheim-1");
      expect(response.text).toContain("Brandstifter");
    });

    it("öffnet ein Geheimnis über einen emotionalen Hebel", () => {
      const s = startInterrogation(PERSONA);
      const { response } = applyMove(PERSONA, s, {
        kind: "empathy",
        value: "Denk an deine Tochter.",
      });
      expect(response.kind).toBe("confession");
      expect(response.revealedSecretId).toBe("geheim-1");
    });

    it("öffnet ein Geheimnis über anhaltenden Druck", () => {
      let s = startInterrogation(PERSONA);
      let response = applyMove(PERSONA, s, { kind: "pressure", value: "a" }).response;
      s = applyMove(PERSONA, s, { kind: "pressure", value: "a" }).state;
      s = applyMove(PERSONA, s, { kind: "pressure", value: "b" }).state;
      // Nach mehreren Druck-Zügen (Start ~12 + 3×25 = 87) fällt geheim-1.
      for (let i = 0; i < 3 && response.kind !== "confession"; i++) {
        const r = applyMove(PERSONA, s, { kind: "pressure", value: `c${i}` });
        s = r.state;
        response = r.response;
      }
      expect(response.kind).toBe("confession");
    });

    it("blockt ab, wenn nichts greift", () => {
      const s = startInterrogation({ ...PERSONA, baseResistance: 0 });
      const { response } = applyMove(PERSONA, s, { kind: "question", value: "Wie geht es dir?" });
      expect(["deflection", "partial"]).toContain(response.kind);
    });

    it("gibt dasselbe Geheimnis nicht zweimal preis", () => {
      let s = startInterrogation(PERSONA);
      const first = applyMove(PERSONA, s, { kind: "evidence", value: "brandbeschleuniger" });
      s = first.state;
      const second = applyMove(PERSONA, s, { kind: "evidence", value: "brandbeschleuniger" });
      expect(second.response.revealedSecretId).not.toBe("geheim-1");
    });

    it("mutiert den Eingabezustand nicht", () => {
      const s = startInterrogation(PERSONA);
      const before = JSON.stringify(s);
      applyMove(PERSONA, s, { kind: "pressure", value: "x" });
      expect(JSON.stringify(s)).toBe(before);
    });

    it("begrenzt Druck und Sympathie auf 100", () => {
      let s = startInterrogation(PERSONA);
      for (let i = 0; i < 10; i++) {
        s = applyMove(PERSONA, s, { kind: "pressure", value: `p${i}` }).state;
      }
      expect(s.pressure).toBeLessThanOrEqual(100);
    });

    it("kommt mit null-Zug zurecht", () => {
      const { response } = applyMove(PERSONA, startInterrogation(PERSONA), null);
      expect(typeof response.text).toBe("string");
    });

    it("kommt ohne Persona zurecht", () => {
      const { response } = applyMove(null, null, { kind: "question", value: "Hallo" });
      expect(typeof response.text).toBe("string");
    });

    it("ist deterministisch", () => {
      const s = startInterrogation(PERSONA);
      const a = applyMove(PERSONA, s, { kind: "pressure", value: "x" });
      const b = applyMove(PERSONA, s, { kind: "pressure", value: "x" });
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });

  describe("buildGameMasterDossier", () => {
    it("erzeugt ein Dossier", () => {
      const d = buildGameMasterDossier(PERSONA);
      expect(d.name).toBe("Der Wirt");
      expect(d.alignment).toBe("Neutral");
      expect(d.secrets.length).toBe(2);
    });

    it("formatiert das Dossier für den Spielleiter", () => {
      const d = buildGameMasterDossier(PERSONA);
      expect(d.formatted).toContain("SPIELLEITER-DOSSIER");
      expect(d.formatted).toContain("Einschüchtern");
      expect(d.formatted).toContain("brandbeschleuniger");
    });

    it("nennt emotionale Hebel", () => {
      const d = buildGameMasterDossier(PERSONA);
      expect(d.formatted).toContain("tochter");
    });

    it("kommt ohne Persona zurecht", () => {
      const d = buildGameMasterDossier(null);
      expect(d.name.length).toBeGreaterThan(0);
    });

    it("ist deterministisch", () => {
      expect(buildGameMasterDossier(PERSONA).formatted).toBe(buildGameMasterDossier(PERSONA).formatted);
    });
  });

  describe("runInterrogation", () => {
    it("führt eine Zugfolge aus", () => {
      const moves: InterrogationMove[] = [
        { kind: "question", value: "Was weißt du?" },
        { kind: "evidence", value: "brandbeschleuniger" },
      ];
      const r = runInterrogation(PERSONA, moves);
      expect(r.confessionCount).toBe(1);
      expect(r.transcript).toContain("SPIELLEITER".slice(0, 5) === "SPIEL" ? "Verhör" : "Verhör");
    });

    it("protokolliert das Endstand", () => {
      const r = runInterrogation(PERSONA, [{ kind: "pressure", value: "Rede!" }]);
      expect(r.transcript).toContain("Endstand");
    });

    it("kommt mit leerer Zugfolge zurecht", () => {
      const r = runInterrogation(PERSONA, []);
      expect(r.confessionCount).toBe(0);
      expect(r.transcript).toContain("Verhör");
    });

    it("kommt mit null zurecht", () => {
      const r = runInterrogation(null, null);
      expect(typeof r.transcript).toBe("string");
    });

    it("ist deterministisch", () => {
      const moves: InterrogationMove[] = [{ kind: "pressure", value: "x" }];
      expect(runInterrogation(PERSONA, moves).transcript).toBe(runInterrogation(PERSONA, moves).transcript);
    });
  });

  describe("ALIGNMENT_LABELS", () => {
    it("enthält alle Gesinnungen", () => {
      expect(Object.keys(ALIGNMENT_LABELS).length).toBe(5);
    });
  });
});
