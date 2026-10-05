/**
 * Tests: povReteller (WP 61.1 — Multi-POV-Perspektiven-Wechsler)
 */

import { describe, it, expect } from "vitest";
import {
  retellFromPov,
  buildPerceptionProfile,
  comparePerceptions,
  ARCHETYPE_LABELS,
  type ObserverArchetype,
} from "./povReteller";

const OPTS = {
  observer: "Raven",
  archetype: "warrior" as ObserverArchetype,
  subject: "Lady Isolde",
  scene: "Lady Isolde trat vor und sagte kein Wort.",
};

describe("povReteller — retellFromPov", () => {
  it("erzählt eine Szene neu", () => {
    const r = retellFromPov(OPTS);
    expect(r.text.length).toBeGreaterThan(50);
    expect(r.wordCount).toBeGreaterThan(15);
  });

  it("erzeugt drei Abschnitte", () => {
    const r = retellFromPov(OPTS);
    expect(r.sections.length).toBe(3);
    expect(r.sections.map((s) => s.kind)).toEqual(["observation", "misreading", "inner"]);
  });

  it("nennt den Beobachter", () => {
    const r = retellFromPov(OPTS);
    expect(r.text).toContain("Raven");
  });

  it("unterstützt alle fünf Archetypen", () => {
    const all: ObserverArchetype[] = ["warrior", "diplomat", "scholar", "thief", "healer"];
    all.forEach((a) => {
      const r = retellFromPov({ ...OPTS, archetype: a });
      expect(r.profile.archetype).toBe(a);
      expect(r.profile.archetypeLabel).toBe(ARCHETYPE_LABELS[a]);
    });
  });

  it("unterschiedliche Archetypen erzeugen unterschiedlichen Text", () => {
    const a = retellFromPov({ ...OPTS, archetype: "warrior" });
    const b = retellFromPov({ ...OPTS, archetype: "diplomat" });
    expect(a.text).not.toBe(b.text);
  });

  it("ist deterministisch", () => {
    const a = retellFromPov({ ...OPTS, archetype: "thief" });
    const b = retellFromPov({ ...OPTS, archetype: "thief" });
    expect(a.text).toBe(b.text);
  });

  it("enthält eine Fehldeutung", () => {
    const r = retellFromPov(OPTS);
    expect(r.misreadingCount).toBe(1);
  });

  it("die Fehldeutung ist wirklich eine Fehldeutung", () => {
    const r = retellFromPov(OPTS);
    const misreading = r.sections.find((s) => s.kind === "misreading");
    // Krieger deutet Zögern als Arroganz, Unsicherheit als Drohung …
    expect(misreading?.text).toMatch(/Arroganz|Drohung|Wut/);
  });

  it("nennt den Archetyp im Profil", () => {
    const r = retellFromPov(OPTS);
    expect(r.profile.character).toBe("Raven");
    expect(r.profile.focus.length).toBeGreaterThan(0);
    expect(r.profile.sensePriority.length).toBeGreaterThan(0);
  });

  it("Sinnes-Priorität ist archetyp-spezifisch", () => {
    const warrior = retellFromPov({ ...OPTS, archetype: "warrior" });
    const diplomat = retellFromPov({ ...OPTS, archetype: "diplomat" });
    expect(warrior.profile.sensePriority[0]).toBe("Berührung");
    expect(diplomat.profile.sensePriority[0]).toBe("Gehör");
  });

  it("trennt Abschnitte mit Leerzeile", () => {
    const r = retellFromPov(OPTS);
    expect(r.text.split("\n\n").length).toBe(3);
  });

  it("jeder Abschnitt endet mit Satzzeichen", () => {
    const r = retellFromPov(OPTS);
    r.sections.forEach((s) => {
      expect(/[.!?]$/.test(s.text.trim())).toBe(true);
    });
  });

  it("fällt bei unbekanntem Archetyp auf warrior zurück", () => {
    const r = retellFromPov({ ...OPTS, archetype: "unbekannt" as never });
    expect(r.profile.archetype).toBe("warrior");
  });

  it("kommt ohne Optionen zurecht", () => {
    const r = retellFromPov();
    expect(r.sections.length).toBe(3);
    expect(r.wordCount).toBeGreaterThan(10);
  });

  it("kommt mit null zurecht", () => {
    expect(retellFromPov(null).sections.length).toBe(3);
    expect(retellFromPov(undefined).misreadingCount).toBe(1);
  });

  it("mutiert die Optionen nicht", () => {
    const copy = { ...OPTS };
    retellFromPov(OPTS);
    expect(OPTS).toEqual(copy);
  });

  it("exportiert die Archetyp-Labels", () => {
    expect(ARCHETYPE_LABELS.warrior).toBe("Krieger");
    expect(ARCHETYPE_LABELS.diplomat).toBe("Diplomatin");
  });
});

describe("povReteller — buildPerceptionProfile", () => {
  it("baut ein Profil", () => {
    const p = buildPerceptionProfile("Raven", "warrior");
    expect(p.character).toBe("Raven");
    expect(p.archetype).toBe("warrior");
  });

  it("liefert archetyp-spezifische Foki", () => {
    const warrior = buildPerceptionProfile("A", "warrior");
    const healer = buildPerceptionProfile("B", "healer");
    expect(warrior.focus[0]).toContain("Hände");
    expect(healer.focus[0]).toContain("Atmung");
  });

  it("liefert eine typische Fehldeutung", () => {
    const p = buildPerceptionProfile("A", "scholar");
    expect(p.misreading.length).toBeGreaterThan(10);
  });

  it("nutzt einen Standardnamen", () => {
    expect(buildPerceptionProfile().character).toBe("Die Figur");
    expect(buildPerceptionProfile(null, null).archetype).toBe("warrior");
  });

  it("gibt frische Arrays zurück", () => {
    const a = buildPerceptionProfile("A", "warrior");
    const b = buildPerceptionProfile("A", "warrior");
    expect(a.focus).not.toBe(b.focus);
    expect(a.focus).toEqual(b.focus);
  });
});

describe("povReteller — comparePerceptions", () => {
  it("vergleicht zwei Profile", () => {
    const a = buildPerceptionProfile("Raven", "warrior");
    const b = buildPerceptionProfile("Isolde", "diplomat");
    const c = comparePerceptions(a, b);
    expect(c.divergence).toBeGreaterThan(0);
  });

  it("divergence ist 0 bei identischem Profil", () => {
    const a = buildPerceptionProfile("X", "warrior");
    const b = buildPerceptionProfile("Y", "warrior");
    const c = comparePerceptions(a, b);
    expect(c.divergence).toBe(0);
  });

  it("nennt gemeinsame Foki", () => {
    const a = buildPerceptionProfile("X", "warrior");
    const b = buildPerceptionProfile("Y", "warrior");
    const c = comparePerceptions(a, b);
    expect(c.sharedFocus.length).toBe(a.focus.length);
  });

  it("divergence bleibt zwischen 0 und 1", () => {
    const c = comparePerceptions(
      buildPerceptionProfile("A", "warrior"),
      buildPerceptionProfile("B", "healer"),
    );
    expect(c.divergence).toBeGreaterThanOrEqual(0);
    expect(c.divergence).toBeLessThanOrEqual(1);
  });

  it("baut Profile aus Strings", () => {
    const c = comparePerceptions("Raven", "Isolde");
    expect(c.a.character).toBe("Raven");
    expect(c.b.character).toBe("Isolde");
  });

  it("kommt mit ungültigem Input zurecht", () => {
    const c = comparePerceptions(null, undefined);
    expect(c.divergence).toBeGreaterThanOrEqual(0);
    expect(c.a.character).toBe("A");
  });
});
