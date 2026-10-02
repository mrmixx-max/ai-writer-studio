// Tests: Voice-Casting-Service (WP 27.2 — Sprecher-Casting & Timbre-Direktor).
//
// Deckt ab: createVoiceProfile, generateAuditionMonologue, exportCastingBriefing.
// Alles deterministisch, ohne LLM/Netzwerk/Audio-IO.
import { describe, it, expect } from "vitest";
import {
  createVoiceProfile,
  generateAuditionMonologue,
  exportCastingBriefing,
  DEFAULT_SPEECH_RATE,
  DEFAULT_PITCH_HZ,
  DEFAULT_ACCENT,
  AUDITION_TARGET_SECONDS,
  type VoiceConfig,
  type VoiceProfile,
} from "./voiceCasting";

// --- Hilfsfunktionen -----------------------------------------------------------------

function validConfig(overrides: Partial<VoiceConfig> = {}): VoiceConfig {
  return {
    pitchHz: 120,
    voiceType: "baritone",
    timbre: "velvety",
    speechRate: 150,
    accent: "de-DE",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createVoiceProfile
// ---------------------------------------------------------------------------

describe("createVoiceProfile", () => {
  it("erstellt ein vollständiges Profil mit gegebenen Werten", () => {
    const profile = createVoiceProfile("Hamlet", validConfig({ pitchHz: 110, voiceType: "tenor" }));
    expect(profile.character).toBe("Hamlet");
    expect(profile.config.pitchHz).toBe(110);
    expect(profile.config.voiceType).toBe("tenor");
    expect(profile.config.timbre).toBe("velvety");
    expect(profile.config.speechRate).toBe(150);
    expect(profile.config.accent).toBe("de-DE");
  });

  it("verwendet Defaults bei fehlender Config", () => {
    const profile = createVoiceProfile("Ophelia", null);
    expect(profile.character).toBe("Ophelia");
    expect(profile.config.voiceType).toBe("baritone");
    expect(profile.config.pitchHz).toBe(DEFAULT_PITCH_HZ.baritone);
    expect(profile.config.speechRate).toBe(DEFAULT_SPEECH_RATE);
    expect(profile.config.accent).toBe(DEFAULT_ACCENT);
  });

  it("verwendet Defaults bei leerer Config", () => {
    const profile = createVoiceProfile("Lear", {});
    expect(profile.config.voiceType).toBe("baritone");
    expect(profile.config.timbre).toBe("velvety");
  });

  it("sanitisiert ungültige pitchHz (NaN, negativ, 0)", () => {
    const p1 = createVoiceProfile("A", validConfig({ pitchHz: NaN }));
    expect(p1.config.pitchHz).toBe(DEFAULT_PITCH_HZ.baritone);

    const p2 = createVoiceProfile("B", validConfig({ pitchHz: -10 }));
    expect(p2.config.pitchHz).toBe(DEFAULT_PITCH_HZ.baritone);

    const p3 = createVoiceProfile("C", validConfig({ pitchHz: 0 }));
    expect(p3.config.pitchHz).toBe(DEFAULT_PITCH_HZ.baritone);
  });

  it("sanitisiert ungültige speechRate (NaN, zu hoch, zu niedrig)", () => {
    const p1 = createVoiceProfile("A", validConfig({ speechRate: NaN }));
    expect(p1.config.speechRate).toBe(DEFAULT_SPEECH_RATE);

    const p2 = createVoiceProfile("B", validConfig({ speechRate: 9999 }));
    expect(p2.config.speechRate).toBe(400);

    const p3 = createVoiceProfile("C", validConfig({ speechRate: 10 }));
    expect(p3.config.speechRate).toBe(50);
  });

  it("sanitisiert ungültigen voiceType und timbre", () => {
    const p1 = createVoiceProfile("A", validConfig({ voiceType: "invalid" as VoiceConfig["voiceType"] }));
    expect(p1.config.voiceType).toBe("baritone");

    const p2 = createVoiceProfile("B", validConfig({ timbre: "invalid" as VoiceConfig["timbre"] }));
    expect(p2.config.timbre).toBe("velvety");
  });

  it("verwendet Default-Charaktername bei leerem String", () => {
    const profile = createVoiceProfile("", validConfig());
    expect(profile.character).toBe("Unbekannt");
  });

  it("verwendet Default-Charaktername bei null/undefined", () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const p1 = createVoiceProfile(null, validConfig());
    expect(p1.character).toBe("Unbekannt");

    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const p2 = createVoiceProfile(undefined, validConfig());
    expect(p2.character).toBe("Unbekannt");
  });

  it("trimmt Leerzeichen im Charakternamen", () => {
    const profile = createVoiceProfile("  Macbeth  ", validConfig());
    expect(profile.character).toBe("Macbeth");
  });
});

// ---------------------------------------------------------------------------
// generateAuditionMonologue
// ---------------------------------------------------------------------------

describe("generateAuditionMonologue", () => {
  it("generiert einen Monolog aus den längsten Dialogen", () => {
    const dialogues = [
      "Kurzer Satz.",
      "Dies ist ein viel längerer Satz, der mehr Text enthält und damit die bevorzugte Wahl für den Audition-Monolog sein sollte.",
      "Mittlerer Satz mit ein bisschen mehr Inhalt.",
    ];
    const result = generateAuditionMonologue("Waldemar", dialogues);
    expect(result).toContain("Waldemar");
    expect(result).toContain("viel längerer Satz");
  });

  it("gibt Fallback bei leerem Dialog-Array zurück", () => {
    const result = generateAuditionMonologue("Anna", []);
    expect(result).toContain("Anna");
    expect(result).toContain("Keine Dialoge");
  });

  it("gibt Fallback bei null/undefined zurück", () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const r1 = generateAuditionMonologue("Anna", null);
    expect(r1).toContain("Keine Dialoge");

    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const r2 = generateAuditionMonologue("Anna", undefined);
    expect(r2).toContain("Keine Dialoge");
  });

  it("filtert leere Strings aus den Dialogen", () => {
    const dialogues = ["", "   ", "Gültiger Satz.", ""];
    const result = generateAuditionMonologue("Bernd", dialogues);
    expect(result).toContain("Gültiger Satz");
  });

  it("verwendet Default-Charakter bei leerem Namen", () => {
    const result = generateAuditionMonologue("", ["Ein Satz."]);
    expect(result).toContain("Unbekannt");
  });

  it("ist deterministisch — gleiche Eingabe, gleiche Ausgabe", () => {
    const dialogues = ["Satz eins.", "Satz zwei ist länger.", "Satz drei."];
    const r1 = generateAuditionMonologue("Chris", dialogues);
    const r2 = generateAuditionMonologue("Chris", dialogues);
    expect(r1).toBe(r2);
  });

  it("behandelt einen einzelnen zu langen Dialog korrekt", () => {
    const long = "A".repeat(5000);
    const result = generateAuditionMonologue("Dora", [long]);
    expect(result).toContain("Dora");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// exportCastingBriefing
// ---------------------------------------------------------------------------

describe("exportCastingBriefing", () => {
  it("exportiert ein Briefing mit allen Profilen", () => {
    const profiles: VoiceProfile[] = [
      createVoiceProfile("Hamlet", validConfig({ voiceType: "tenor", pitchHz: 140 })),
      createVoiceProfile("Ophelia", validConfig({ voiceType: "soprano", pitchHz: 240 })),
    ];
    const briefing = exportCastingBriefing(profiles);
    expect(briefing).toContain("CASTING-BRIEFING");
    expect(briefing).toContain("Hamlet");
    expect(briefing).toContain("Ophelia");
    expect(briefing).toContain("tenor");
    expect(briefing).toContain("soprano");
    expect(briefing).toContain("140 Hz");
    expect(briefing).toContain("240 Hz");
  });

  it("gibt Fallback bei leerem Array zurück", () => {
    const briefing = exportCastingBriefing([]);
    expect(briefing).toContain("Keine Profile");
  });

  it("gibt Fallback bei null/undefined zurück", () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const b1 = exportCastingBriefing(null);
    expect(b1).toContain("Keine Profile");

    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const b2 = exportCastingBriefing(undefined);
    expect(b2).toContain("Keine Profile");
  });

  it("behandelt unvollständige Profile defensiv", () => {
    const broken = [
      { character: "Test", config: null },
      { character: "", config: validConfig() },
      null,
    ] as unknown as VoiceProfile[];
    const briefing = exportCastingBriefing(broken);
    expect(briefing).toContain("CASTING-BRIEFING");
    expect(briefing).toContain("Test");
    expect(briefing).toContain("Charakter 2");
  });

  it("ist deterministisch — gleiche Eingabe, gleiche Ausgabe", () => {
    const profiles = [
      createVoiceProfile("A", validConfig()),
      createVoiceProfile("B", validConfig({ voiceType: "bass" })),
    ];
    const b1 = exportCastingBriefing(profiles);
    const b2 = exportCastingBriefing(profiles);
    expect(b1).toBe(b2);
  });

  it("enthält Beispiel-Dialog wenn vorhanden", () => {
    const profile = createVoiceProfile("Romeo", validConfig());
    profile.sampleDialogue = "O Romeo, Romeo!";
    const briefing = exportCastingBriefing([profile]);
    expect(briefing).toContain("O Romeo, Romeo!");
  });
});

// ---------------------------------------------------------------------------
// Konstanten-Tests
// ---------------------------------------------------------------------------

describe("Konstanten", () => {
  it("AUDITION_TARGET_SECONDS ist 60", () => {
    expect(AUDITION_TARGET_SECONDS).toBe(60);
  });

  it("DEFAULT_SPEECH_RATE ist 150", () => {
    expect(DEFAULT_SPEECH_RATE).toBe(150);
  });

  it("DEFAULT_PITCH_HZ enthält alle VoiceTypes", () => {
    expect(Object.keys(DEFAULT_PITCH_HZ)).toHaveLength(6);
    expect(DEFAULT_PITCH_HZ.bass).toBe(85);
    expect(DEFAULT_PITCH_HZ.soprano).toBe(240);
  });

  it("DEFAULT_ACCENT ist de-DE", () => {
    expect(DEFAULT_ACCENT).toBe("de-DE");
  });
});
