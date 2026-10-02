// Tests: Ambient-Synthesizer-Service (WP 31.1 — Prozeduraler Ambient-Klangteppich).
//
// Deckt ab: generateAmbientSound, coupleSceneToSound, getBinauralBeats.
// Alles deterministisch, ohne LLM/Netzwerk/Audio-IO.
import { describe, it, expect } from "vitest";
import {
  generateAmbientSound,
  coupleSceneToSound,
  getBinauralBeats,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_DURATION_SEC,
  ALPHA_MIN_HZ,
  ALPHA_MAX_HZ,
  THETA_MIN_HZ,
  THETA_MAX_HZ,
} from "./ambientSynthesizer";

// ---------------------------------------------------------------------------
// generateAmbientSound
// ---------------------------------------------------------------------------

describe("generateAmbientSound", () => {
  it("generiert Regen-Sound mit korrekten Metadaten", () => {
    const sound = generateAmbientSound("rain", 5);
    expect(sound.type).toBe("rain");
    expect(sound.durationSec).toBe(5);
    expect(sound.sampleRate).toBe(DEFAULT_SAMPLE_RATE);
    expect(sound.data).toBeInstanceOf(Array);
    expect(sound.data.length).toBeGreaterThan(0);
  });

  it("generiert Feuer-Sound mit korrekten Metadaten", () => {
    const sound = generateAmbientSound("fire", 3);
    expect(sound.type).toBe("fire");
    expect(sound.durationSec).toBe(3);
    expect(sound.data.length).toBe(Math.floor(DEFAULT_SAMPLE_RATE * 3));
  });

  it("generiert Taverne-Sound mit korrekten Metadaten", () => {
    const sound = generateAmbientSound("tavern", 2);
    expect(sound.type).toBe("tavern");
    expect(sound.durationSec).toBe(2);
    expect(sound.data.length).toBe(Math.floor(DEFAULT_SAMPLE_RATE * 2));
  });

  it("generiert Sci-Fi-Sound mit korrekten Metadaten", () => {
    const sound = generateAmbientSound("scifi", 4);
    expect(sound.type).toBe("scifi");
    expect(sound.durationSec).toBe(4);
    expect(sound.data.length).toBe(Math.floor(DEFAULT_SAMPLE_RATE * 4));
  });

  it("generiert Binaural-Sound mit korrekten Metadaten", () => {
    const sound = generateAmbientSound("binaural", 6);
    expect(sound.type).toBe("binaural");
    expect(sound.durationSec).toBe(6);
    expect(sound.data.length).toBe(Math.floor(DEFAULT_SAMPLE_RATE * 6));
  });

  it("verwendet Default-Dauer bei ungültiger Eingabe", () => {
    const sound = generateAmbientSound("rain", -5);
    expect(sound.durationSec).toBe(DEFAULT_DURATION_SEC);
  });

  it("verwendet Default-Dauer bei NaN", () => {
    const sound = generateAmbientSound("rain", NaN);
    expect(sound.durationSec).toBe(DEFAULT_DURATION_SEC);
  });

  it("verwendet Default-Typ bei ungültigem Typ", () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const sound = generateAmbientSound("invalid", 5);
    expect(sound.type).toBe("rain");
  });

  it("verwendet Default-Typ bei null/undefined", () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const s1 = generateAmbientSound(null, 5);
    expect(s1.type).toBe("rain");

    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const s2 = generateAmbientSound(undefined, 5);
    expect(s2.type).toBe("rain");
  });

  it("ist deterministisch — gleiche Eingabe, gleiche Ausgabe", () => {
    const s1 = generateAmbientSound("rain", 1);
    const s2 = generateAmbientSound("rain", 1);
    expect(s1.data).toEqual(s2.data);
  });

  it("liefert Puffer ohne Buffer-Underruns (alle Samples gültig)", () => {
    const sound = generateAmbientSound("rain", 2);
    for (let i = 0; i < sound.data.length; i++) {
      const sample = sound.data[i];
      expect(Number.isFinite(sample)).toBe(true);
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });

  it("unterschiedliche Typen erzeugen unterschiedliche Daten", () => {
    const rain = generateAmbientSound("rain", 1);
    const fire = generateAmbientSound("fire", 1);
    expect(rain.data).not.toEqual(fire.data);
  });

  it("behandelt sehr kurze Dauer korrekt", () => {
    const sound = generateAmbientSound("rain", 0.1);
    expect(sound.data.length).toBeGreaterThan(0);
    expect(sound.data.length).toBeLessThanOrEqual(Math.floor(DEFAULT_SAMPLE_RATE * 0.1) + 1);
  });

  it("behandelt sehr lange Dauer mit Sicherheitsgrenze", () => {
    const sound = generateAmbientSound("rain", 600); // 10 Minuten
    expect(sound.data.length).toBeLessThanOrEqual(44100 * 60);
  });
});

// ---------------------------------------------------------------------------
// coupleSceneToSound
// ---------------------------------------------------------------------------

describe("coupleSceneToSound", () => {
  it("erkennt Regen-Tags", () => {
    expect(coupleSceneToSound(["regen", "gewitter"])).toBe("rain");
    expect(coupleSceneToSound(["rain", "storm"])).toBe("rain");
  });

  it("erkennt Feuer-Tags", () => {
    expect(coupleSceneToSound(["feuer", "lagerfeuer"])).toBe("fire");
    expect(coupleSceneToSound(["kamin", "brand"])).toBe("fire");
  });

  it("erkennt Taverne-Tags", () => {
    expect(coupleSceneToSound(["taverne", "wirtshaus"])).toBe("tavern");
    expect(coupleSceneToSound(["kneipe", "bar"])).toBe("tavern");
  });

  it("erkennt Sci-Fi-Tags", () => {
    expect(coupleSceneToSound(["scifi", "weltraum"])).toBe("scifi");
    expect(coupleSceneToSound(["cyberpunk", "space"])).toBe("scifi");
  });

  it("erkennt Binaural-Tags", () => {
    expect(coupleSceneToSound(["binaural", "meditation"])).toBe("binaural");
    expect(coupleSceneToSound(["entspannung", "schlaf"])).toBe("binaural");
  });

  it("gibt Fallback bei leerem Array zurück", () => {
    expect(coupleSceneToSound([])).toBe("rain");
  });

  it("gibt Fallback bei null/undefined zurück", () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    expect(coupleSceneToSound(null)).toBe("rain");
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    expect(coupleSceneToSound(undefined)).toBe("rain");
  });

  it("gibt Fallback bei unbekannten Tags zurück", () => {
    expect(coupleSceneToSound(["unbekannt", "xyz"])).toBe("rain");
  });

  it("berücksichticht Groß-/Kleinschreibung", () => {
    expect(coupleSceneToSound(["REGEN", "FEUER", "FEUER"])).toBe("fire");
  });

  it("trimmt Leerzeichen in Tags", () => {
    expect(coupleSceneToSound(["  regen  ", "  feuer  "])).toBe("rain");
  });

  it("wählt den Typ mit den meisten Vorkommen", () => {
    expect(coupleSceneToSound(["regen", "regen", "feuer"])).toBe("rain");
  });

  it("filtert ungültige Array-Elemente aus", () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    expect(coupleSceneToSound(["regen", 123, null, "feuer", "feuer"])).toBe("fire");
  });
});

// ---------------------------------------------------------------------------
// getBinauralBeats
// ---------------------------------------------------------------------------

describe("getBinauralBeats", () => {
  it("generiert Alpha-Konfiguration im korrekten Bereich", () => {
    const config = getBinauralBeats("alpha");
    expect(config.beatFrequency).toBeGreaterThanOrEqual(ALPHA_MIN_HZ);
    expect(config.beatFrequency).toBeLessThanOrEqual(ALPHA_MAX_HZ);
    expect(config.baseFrequency).toBeGreaterThan(0);
    expect(config.durationSec).toBeGreaterThan(0);
  });

  it("generiert Theta-Konfiguration im korrekten Bereich", () => {
    const config = getBinauralBeats("theta");
    expect(config.beatFrequency).toBeGreaterThanOrEqual(THETA_MIN_HZ);
    expect(config.beatFrequency).toBeLessThanOrEqual(THETA_MAX_HZ);
    expect(config.baseFrequency).toBeGreaterThan(0);
    expect(config.durationSec).toBeGreaterThan(0);
  });

  it("Alpha und Theta haben unterschiedliche Beat-Frequenzen", () => {
    const alpha = getBinauralBeats("alpha");
    const theta = getBinauralBeats("theta");
    expect(alpha.beatFrequency).not.toBe(theta.beatFrequency);
  });

  it("verwendet Default bei ungültiger Eingabe", () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const config = getBinauralBeats("invalid");
    expect(config.beatFrequency).toBeGreaterThanOrEqual(ALPHA_MIN_HZ);
    expect(config.beatFrequency).toBeLessThanOrEqual(ALPHA_MAX_HZ);
  });

  it("ist deterministisch — gleiche Eingabe, gleiche Ausgabe", () => {
    const c1 = getBinauralBeats("alpha");
    const c2 = getBinauralBeats("alpha");
    expect(c1).toEqual(c2);
  });
});

// ---------------------------------------------------------------------------
// Konstanten-Tests
// ---------------------------------------------------------------------------

describe("Konstanten", () => {
  it("DEFAULT_SAMPLE_RATE ist 44100", () => {
    expect(DEFAULT_SAMPLE_RATE).toBe(44100);
  });

  it("DEFAULT_DURATION_SEC ist 10", () => {
    expect(DEFAULT_DURATION_SEC).toBe(10);
  });

  it("Alpha-Bereich ist 8-12 Hz", () => {
    expect(ALPHA_MIN_HZ).toBe(8);
    expect(ALPHA_MAX_HZ).toBe(12);
  });

  it("Theta-Bereich ist 4-8 Hz", () => {
    expect(THETA_MIN_HZ).toBe(4);
    expect(THETA_MAX_HZ).toBe(8);
  });
});
