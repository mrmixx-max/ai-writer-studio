// Tests für Voice Profiling (WP 6.2).
//
// Kernaussage: Die Voice-Analyse ist lokal, deterministisch und defensiv.
// Sie extrahiert Dialogzeilen, berechnet Metriken und findet Abweichungen.

import { describe, it, expect } from "vitest";
import {
  extractQuotedSpeech,
  assignDialogueToCharacters,
  createVoiceProfile,
  findVoiceDeviations,
  analyzeVoiceProfiles,
  type VoiceProfile,
} from "./voiceProfiling";

describe("extractQuotedSpeech", () => {
  it("extrahiert deutsche Anführungszeichen", () => {
    const text = '„Hallo“, sagte er. „Wie geht es?“, fragte sie.';
    const speeches = extractQuotedSpeech(text);
    expect(speeches).toContain("Hallo");
    expect(speeches).toContain("Wie geht es?");
  });

  it("extrahiert englische Anführungszeichen", () => {
    const text = '"Hello", she said. "How are you?", he asked.';
    const speeches = extractQuotedSpeech(text);
    expect(speeches).toContain("Hello");
    expect(speeches).toContain("How are you?");
  });

  it("extrahiert französische Anführungszeichen", () => {
    const text = "»Bonjour«, dit-il. »Comment ça va?«";
    const speeches = extractQuotedSpeech(text);
    expect(speeches).toContain("Bonjour");
    expect(speeches).toContain("Comment ça va?");
  });

  it("gibt leeres Array für Text ohne Dialoge zurück", () => {
    expect(extractQuotedSpeech("Ein Text ohne Dialoge.")).toEqual([]);
  });
});

describe("assignDialogueToCharacters", () => {
  it("ordnet Dialoge Figuren zu", () => {
    const text = '„Hallo“, sagte Anna. „Wie geht es?“, fragte Bert.';
    const result = assignDialogueToCharacters(text);
    expect(result.has("Anna")).toBe(true);
    expect(result.has("Bert")).toBe(true);
    expect(result.get("Anna")).toContain("Hallo");
    expect(result.get("Bert")).toContain("Wie geht es?");
  });

  it("erkennt Name: Dialog-Muster", () => {
    const text = 'Anna: „Hallo“. Bert: „Hi“.';
    const result = assignDialogueToCharacters(text);
    expect(result.has("Anna")).toBe(true);
    expect(result.has("Bert")).toBe(true);
  });

  it("erkennt —... sagte Name-Muster", () => {
    const text = "—Hallo, sagte Anna. —Hi, sagte Bert.";
    const result = assignDialogueToCharacters(text);
    expect(result.has("Anna")).toBe(true);
    expect(result.has("Bert")).toBe(true);
  });

  it("ordnet mehrere Dialoge pro Zeile zu", () => {
    const text = '„Hallo“, sagte Anna. „Hi“, sagte Bert. „Wie geht es?“, fragte Anna.';
    const result = assignDialogueToCharacters(text);
    expect(result.get("Anna")).toHaveLength(2);
    expect(result.get("Bert")).toHaveLength(1);
  });

  it("nutzt Unbekannt als Fallback", () => {
    const text = '„Hallo Welt“.';
    const result = assignDialogueToCharacters(text);
    expect(result.has("Unbekannt")).toBe(true);
  });
});

describe("createVoiceProfile", () => {
  it("erstellt ein Profil für eine Figur", () => {
    const speeches = ["Hallo, wie geht es dir?", "Mir geht es gut, danke."];
    const profile = createVoiceProfile("Anna", speeches);
    expect(profile.character).toBe("Anna");
    expect(profile.totalLines).toBe(2);
    expect(profile.totalWords).toBeGreaterThan(0);
    expect(profile.averageSentenceLength).toBeGreaterThan(0);
  });

  it("berechnet Füllwort-Quote korrekt", () => {
    const speeches = ["Eigentlich ist das irgendwie halt total gut."];
    const profile = createVoiceProfile("Anna", speeches);
    expect(profile.fillerWordRatio).toBeGreaterThan(0);
  });

  it("berechnet Formalitätsgrad korrekt", () => {
    const formal = createVoiceProfile("Anna", ["Dieser Umstand ist von großer Bedeutung."]);
    const informal = createVoiceProfile("Bert", ["Das ist mega krass, alter!"]);
    expect(formal.formalityScore).toBeGreaterThan(informal.formalityScore);
  });
});

describe("findVoiceDeviations", () => {
  it("findet Abweichungen bei unterschiedlichen Satzlängen", () => {
    const profile: VoiceProfile = {
      character: "Anna",
      totalLines: 10,
      totalWords: 100,
      averageSentenceLength: 15,
      fillerWordRatio: 0.05,
      formalityScore: 0.7,
      dialectScore: 0.1,
      characteristicWords: [],
    };
    const comparison: VoiceProfile = {
      character: "Bert",
      totalLines: 10,
      totalWords: 100,
      averageSentenceLength: 5,
      fillerWordRatio: 0.05,
      formalityScore: 0.7,
      dialectScore: 0.1,
      characteristicWords: [],
    };
    const deviations = findVoiceDeviations(profile, comparison);
    expect(deviations.length).toBeGreaterThan(0);
    expect(deviations[0].type).toBe("sentence_length");
  });

  it("findet keine Abweichungen bei identischen Profilen", () => {
    const profile: VoiceProfile = {
      character: "Anna",
      totalLines: 10,
      totalWords: 100,
      averageSentenceLength: 10,
      fillerWordRatio: 0.05,
      formalityScore: 0.5,
      dialectScore: 0.1,
      characteristicWords: [],
    };
    const deviations = findVoiceDeviations(profile, profile);
    expect(deviations).toEqual([]);
  });
});

describe("analyzeVoiceProfiles", () => {
  it("analysiert Voice-Profile eines Texts", () => {
    const text = '„Hallo", sagte Anna. „Wie geht es?", fragte Bert. „Gut", sagte Anna.';
    const result = analyzeVoiceProfiles(text);
    expect(result.profiles.length).toBeGreaterThan(0);
    expect(result.profiles[0].character).toBe("Anna");
  });

  it("gibt leeres Ergebnis für Text ohne Dialoge zurück", () => {
    const result = analyzeVoiceProfiles("Ein Text ohne Dialoge.");
    expect(result.profiles).toEqual([]);
    expect(result.deviations).toEqual([]);
  });
});
