/**
 * Tests: flashbackMemoryWeaver (WP 58.2 — Sensorischer Flashback-Weaver)
 */

import { describe, it, expect } from "vitest";
import {
  weaveFlashback,
  detectFlashbackTriggers,
  analyzeFlashbackFlow,
  SENSE_LABELS,
  PHASE_LABELS,
  type TriggerSense,
} from "./flashbackMemoryWeaver";

describe("flashbackMemoryWeaver — weaveFlashback", () => {
  it("erzeugt einen Flashback", () => {
    const f = weaveFlashback();
    expect(f.text.length).toBeGreaterThan(80);
    expect(f.wordCount).toBeGreaterThan(20);
  });

  it("hat drei Phasen", () => {
    const f = weaveFlashback();
    expect(f.segments.length).toBe(3);
    expect(f.segments.map((s) => s.phase)).toEqual(["slip", "memory", "snapback"]);
  });

  it("benennt die Phasen", () => {
    const f = weaveFlashback();
    expect(f.segments[0].label).toBe("Gleiten (Slip-Stream)");
    expect(f.segments[2].label).toBe("Snap-Back");
  });

  it("unterstützt alle vier Sinneskanäle", () => {
    const senses: TriggerSense[] = ["auditory", "smell", "taste", "touch"];
    senses.forEach((s) => {
      const f = weaveFlashback({ sense: s });
      expect(f.sense).toBe(s);
      expect(f.text.length).toBeGreaterThan(50);
    });
  });

  it("unterschiedliche Kanäle erzeugen unterschiedlichen Text", () => {
    const a = weaveFlashback({ sense: "auditory" });
    const b = weaveFlashback({ sense: "touch" });
    expect(a.text).not.toBe(b.text);
  });

  it("übernimmt den konkreten Trigger", () => {
    const f = weaveFlashback({ trigger: "das Knarren der dritten Diele" });
    expect(f.text).toContain("Knarren der dritten Diele");
  });

  it("übernimmt die Erinnerung", () => {
    const f = weaveFlashback({ memory: "Der Kuchen war verbrannt und niemand sagte es" });
    expect(f.text).toContain("Kuchen war verbrannt");
  });

  it("übernimmt die akute Gefahr im Snap-Back", () => {
    const f = weaveFlashback({ presentDanger: "Der Angreifer stand in der Tür" });
    expect(f.text).toContain("Angreifer stand in der Tür");
    expect(f.hasSnapBack).toBe(true);
  });

  it("übernimmt das Alter der Figur", () => {
    const f = weaveFlashback({ character: "Mira", memoryAge: "acht Jahre alt" });
    expect(f.text).toContain("Mira");
    expect(f.text).toContain("acht Jahre alt");
  });

  it("ist deterministisch", () => {
    const a = weaveFlashback({ sense: "smell", trigger: "Lavendel" });
    const b = weaveFlashback({ sense: "smell", trigger: "Lavendel" });
    expect(a.text).toBe(b.text);
  });

  it("trennt Phasen mit Leerzeile", () => {
    const f = weaveFlashback();
    expect(f.text.split("\n\n").length).toBe(3);
  });

  it("jeder Abschnitt endet mit Satzzeichen", () => {
    const f = weaveFlashback();
    f.segments.forEach((s) => {
      expect(/[.!?]$/.test(s.text.trim())).toBe(true);
    });
  });

  it("fällt bei unbekanntem Kanal auf smell zurück", () => {
    const f = weaveFlashback({ sense: "unbekannt" as never });
    expect(f.sense).toBe("smell");
  });

  it("kommt ohne Optionen zurecht", () => {
    const f = weaveFlashback();
    expect(f.segments.length).toBe(3);
  });

  it("kommt mit null zurecht", () => {
    expect(weaveFlashback(null).segments.length).toBe(3);
    expect(weaveFlashback(undefined).wordCount).toBeGreaterThan(10);
  });

  it("mutiert die Optionen nicht", () => {
    const opts = { sense: "taste" as TriggerSense, trigger: "Bitterer Tee" };
    const copy = { ...opts };
    weaveFlashback(opts);
    expect(opts).toEqual(copy);
  });

  it("exportiert die Kanal- und Phasen-Labels", () => {
    expect(SENSE_LABELS.auditory).toBe("Auditiv (Klang)");
    expect(PHASE_LABELS.memory).toBe("Vergangenheitsszene");
  });
});

describe("flashbackMemoryWeaver — detectFlashbackTriggers", () => {
  it("erkennt einen auditiven Reiz", () => {
    const r = detectFlashbackTriggers("Die Glocke läutete zweimal.");
    expect(r.senseCounts.auditory).toBeGreaterThan(0);
  });

  it("erkennt einen Geruch", () => {
    const r = detectFlashbackTriggers("Der Geruch von Lavendel lag im Raum.");
    expect(r.senseCounts.smell).toBeGreaterThan(0);
  });

  it("erkennt einen Geschmack", () => {
    const r = detectFlashbackTriggers("Der Tee schmeckte bitter.");
    expect(r.senseCounts.taste).toBeGreaterThan(0);
  });

  it("erkennt eine Berührung", () => {
    const r = detectFlashbackTriggers("Die Kante schnitt in die Fingerkuppe.");
    expect(r.senseCounts.touch).toBeGreaterThan(0);
  });

  it("zählt mehrere Reize", () => {
    const r = detectFlashbackTriggers("Die Glocke läutete. Der Tee schmeckte bitter. Es war kalt.");
    expect(r.total).toBeGreaterThanOrEqual(2);
  });

  it("liefert die Signalwörter mit", () => {
    const r = detectFlashbackTriggers("Die Glocke läutete.");
    expect(r.findings[0].signals.length).toBeGreaterThan(0);
  });

  it("findet nichts in neutralem Text", () => {
    const r = detectFlashbackTriggers("Er ging über den Hof und dachte nach.");
    expect(r.total).toBe(0);
  });

  it("kommt mit leerem Input zurecht", () => {
    expect(detectFlashbackTriggers("").total).toBe(0);
    expect(detectFlashbackTriggers(null).findings).toEqual([]);
    expect(detectFlashbackTriggers(undefined).senseCounts.auditory).toBe(0);
  });

  it("erkennt die eigenen Flashbacks", () => {
    const f = weaveFlashback({ sense: "auditory", trigger: "eine Glocke, die läutete" });
    const r = detectFlashbackTriggers(f.text);
    expect(r.total).toBeGreaterThan(0);
  });
});

describe("flashbackMemoryWeaver — analyzeFlashbackFlow", () => {
  it("bewertet einen guten Flashback positiv", () => {
    const f = weaveFlashback({ presentDanger: "Der Schuss kam" });
    const r = analyzeFlashbackFlow(f.text);
    expect(r.quality).toBeGreaterThan(0.5);
  });

  it("erkennt Gleit-Marker", () => {
    const r = analyzeFlashbackFlow("Die Gegenwart verblasste, und damals kam alles zurück.");
    expect(r.slipQuality).toBeGreaterThan(0);
  });

  it("erkennt Snap-Marker", () => {
    const r = analyzeFlashbackFlow("Dann der Schlag. Plötzlich riss alles entzwei.");
    expect(r.snapQuality).toBeGreaterThan(0);
  });

  it("belohnt kurze Sätze für den Snap-Back", () => {
    const withShort = analyzeFlashbackFlow("Dann der Schlag. Und dann war da Blut.");
    const withoutShort = analyzeFlashbackFlow(
      "Dann kam ein sehr langer Satz mit vielen Wörtern und reichlich Details darin.",
    );
    expect(withShort.snapQuality).toBeGreaterThan(withoutShort.snapQuality);
  });

  it("Qualität bleibt zwischen 0 und 1", () => {
    const r = analyzeFlashbackFlow("Dann der Schlag. Alles verblasste. Kurz.");
    expect(r.quality).toBeGreaterThanOrEqual(0);
    expect(r.quality).toBeLessThanOrEqual(1);
  });

  it("listet die Marker auf", () => {
    const r = analyzeFlashbackFlow("Dann der Schlag, und alles verblasste.");
    expect(r.markers.length).toBeGreaterThan(0);
  });

  it("kommt mit leerem Input zurecht", () => {
    const r = analyzeFlashbackFlow("");
    expect(r.quality).toBe(0);
    expect(r.markers).toEqual([]);
    expect(analyzeFlashbackFlow(null).slipQuality).toBe(0);
    expect(analyzeFlashbackFlow(undefined).snapQuality).toBe(0);
  });
});
