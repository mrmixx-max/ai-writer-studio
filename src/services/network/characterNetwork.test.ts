// Character Network Tests (Sprint 27, Agent 3)
import { describe, it, expect } from "vitest";
import {
  buildCharacterNetwork,
  generateNetworkAscii,
} from "./characterNetwork";

describe("Character Network", () => {
  it("buildCharacterNetwork builds from text", () => {
    const text = "Max ging durch die Straße. Anna stand am Fenster. Max sah Anna.";
    const network = buildCharacterNetwork(text, []);
    expect(network.nodes.length).toBeGreaterThan(0);
  });

  it("buildCharacterNetwork counts density", () => {
    const text = "Max und Anna gingen spazieren.";
    const network = buildCharacterNetwork(text, []);
    expect(network.density).toBeGreaterThanOrEqual(0);
  });

  it("generateNetworkAscii returns string", () => {
    const text = "Max ging. Anna stand.";
    const network = buildCharacterNetwork(text, []);
    const ascii = generateNetworkAscii(network);
    expect(ascii.length).toBeGreaterThan(0);
  });

  it("mutiert das Eingabe-Array nicht (a3-sec)", () => {
    const chars = [
      { id: "a", name: "Max" },
      { id: "b", name: "Anna" },
    ];
    buildCharacterNetwork("Max und Anna gingen spazieren. Max sah Anna.", chars);
    expect(chars).toHaveLength(2);
  });

  it("mostConnected nennt einen Namen statt interner ext-ID (a3-sec)", () => {
    const network = buildCharacterNetwork("Max und Anna gingen spazieren. Max sah Anna.", []);
    if (network.mostConnected) {
      expect(network.mostConnected).not.toMatch(/^ext-/);
    }
  });
});
