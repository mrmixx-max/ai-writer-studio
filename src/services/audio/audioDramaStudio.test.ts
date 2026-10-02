// Tests: Hörspiel-Studio-Service (WP 20.1 — Soundscape & Foley).
//
// Deckt ab: Regieanweisungs-Parser, Mehrspur-Timeline (Dialoge/SFX/Musik)
// und Stereo-Mixdown mit -12-dB-Ducking und Spitzenwert-Limiter (-0.5 dB).
// Alles deterministisch, ohne LLM/Netzwerk/Audio-IO.
import { describe, it, expect } from "vitest";
import {
  parseAudioCues,
  buildMultiTrackTimeline,
  calculateMixdown,
  parseTimeMs,
  parseVolume,
  parsePan,
  MIXDOWN_RESOLUTION_MS,
  DUCKING_GAIN,
  LIMITER_LINEAR,
  LIMITER_DB,
  type AudioCue,
} from "./audioDramaStudio";

// --- Hilfsfunktionen -----------------------------------------------------------------

function cue(partial: Partial<AudioCue> & { type: AudioCue["type"] }): AudioCue {
  return {
    id: partial.id ?? "c",
    type: partial.type,
    startTime: partial.startTime ?? 0,
    duration: partial.duration ?? 1000,
    volume: partial.volume ?? 1,
    pan: partial.pan ?? 0,
    label: partial.label ?? "x",
    metadata: partial.metadata,
  };
}

// ---------------------------------------------------------------------------
// parseAudioCues
// ---------------------------------------------------------------------------

describe("parseAudioCues", () => {
  it("erkennt ambience/sfx/music-Anweisungen mit Attributen", () => {
    const text =
      "[ambience: regensturm volume=40%] [sfx: tuerschlag pan=-0.7] [music: kampf_intro fade=2s]";
    const cues = parseAudioCues(text);

    expect(cues).toHaveLength(3);

    expect(cues[0].type).toBe("ambience");
    expect(cues[0].label).toBe("regensturm");
    expect(cues[0].volume).toBeCloseTo(0.4, 5);
    expect(cues[0].pan).toBe(0);

    expect(cues[1].type).toBe("sfx");
    expect(cues[1].label).toBe("tuerschlag");
    expect(cues[1].pan).toBeCloseTo(-0.7, 5);

    expect(cues[2].type).toBe("music");
    expect(cues[2].label).toBe("kampf_intro");
    expect(cues[2].metadata?.fadeMs).toBe(2000);
  });

  it("legt Cues sequenziell ab und vergibt fortlaufende IDs", () => {
    const cues = parseAudioCues("[sfx: a duration=1s] [sfx: b duration=2s]");
    expect(cues[0].id).toBe("cue-0");
    expect(cues[0].startTime).toBe(0);
    expect(cues[1].id).toBe("cue-1");
    expect(cues[1].startTime).toBe(1000); // Ende des ersten Cues
  });

  it("respektiert explizites start= (überschreibt die Sequenz)", () => {
    const cues = parseAudioCues("[sfx: a duration=1s] [music: theme start=5s]");
    expect(cues[1].startTime).toBe(5000);
  });

  it("defaultet fehlende Werte je Typ defensiv", () => {
    const cues = parseAudioCues("[music: nur_label]");
    expect(cues).toHaveLength(1);
    expect(cues[0].duration).toBeGreaterThan(0);
    expect(cues[0].volume).toBeGreaterThan(0);
    expect(cues[0].pan).toBe(0);
  });

  it("gibt bei leerem oder ungültigem Text ein leeres Array zurück", () => {
    expect(parseAudioCues("")).toEqual([]);
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    expect(parseAudioCues(null)).toEqual([]);
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    expect(parseAudioCues(undefined)).toEqual([]);
    expect(parseAudioCues("Kein einziger Cue im Text.")).toEqual([]);
  });

  it("ignoriert unbekannte Direktiven, parst aber deren Nachbarn", () => {
    const cues = parseAudioCues("[foo: bar] [sfx: treffer]");
    expect(cues).toHaveLength(1);
    expect(cues[0].label).toBe("treffer");
  });
});

// ---------------------------------------------------------------------------
// buildMultiTrackTimeline
// ---------------------------------------------------------------------------

describe("buildMultiTrackTimeline", () => {
  it("verteilt Cues auf getrennte Spuren (ambience → SFX)", () => {
    const cues = [
      cue({ type: "dialogue", label: "d" }),
      cue({ type: "sfx", label: "s" }),
      cue({ type: "ambience", label: "a" }),
      cue({ type: "music", label: "m" }),
    ];
    const timeline = buildMultiTrackTimeline(cues);

    expect(timeline.tracks).toHaveLength(3);
    const dialogue = timeline.tracks.find((t) => t.type === "dialogue")!;
    const sfx = timeline.tracks.find((t) => t.type === "sfx")!;
    const music = timeline.tracks.find((t) => t.type === "music")!;

    expect(dialogue.cues.map((c) => c.label)).toEqual(["d"]);
    expect(sfx.cues.map((c) => c.label).sort()).toEqual(["a", "s"]);
    expect(music.cues.map((c) => c.label)).toEqual(["m"]);
  });

  it("sortiert Cues je Spur nach Startzeit und berechnet die Gesamtdauer", () => {
    const cues = [
      cue({ type: "sfx", startTime: 5000, duration: 1000 }),
      cue({ type: "sfx", startTime: 1000, duration: 500 }),
      cue({ type: "music", startTime: 0, duration: 9000 }),
    ];
    const timeline = buildMultiTrackTimeline(cues);

    const sfx = timeline.tracks.find((t) => t.type === "sfx")!;
    expect(sfx.cues.map((c) => c.startTime)).toEqual([1000, 5000]);
    expect(timeline.durationMs).toBe(9000);
  });

  it("erzeugt auch bei leerer Eingabe drei leere Spuren (stabile Struktur)", () => {
    const timeline = buildMultiTrackTimeline([]);
    expect(timeline.tracks).toHaveLength(3);
    expect(timeline.tracks.every((t) => t.cues.length === 0)).toBe(true);
    expect(timeline.durationMs).toBe(0);
  });

  it("sanitisiert unvollständige Cues statt zu werfen", () => {
    const broken = [{ type: "dialogue" } as unknown as AudioCue];
    const timeline = buildMultiTrackTimeline(broken);
    const dialogue = timeline.tracks.find((t) => t.type === "dialogue")!;
    expect(dialogue.cues).toHaveLength(1);
    expect(Number.isFinite(dialogue.cues[0].duration)).toBe(true);
    expect(dialogue.cues[0].duration).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// calculateMixdown
// ---------------------------------------------------------------------------

describe("calculateMixdown", () => {
  it("erzeugt einen Peak je Mixdown-Block und die korrekte Dauer", () => {
    const timeline = buildMultiTrackTimeline([
      cue({ type: "dialogue", startTime: 0, duration: 1000, volume: 1 }),
    ]);
    const mix = calculateMixdown(timeline);
    expect(mix.durationMs).toBe(1000);
    expect(mix.peaks).toHaveLength(Math.ceil(1000 / MIXDOWN_RESOLUTION_MS));
  });

  it("duckt Musik um -12 dB, sobald Sprache aktiv ist", () => {
    const timeline = buildMultiTrackTimeline([
      cue({ type: "dialogue", startTime: 0, duration: 1000, volume: 1 }),
      cue({ type: "music", startTime: 0, duration: 1000, volume: 1 }),
    ]);
    const mix = calculateMixdown(timeline);
    expect(mix.duckingApplied).toBe(true);
    // Sprache (1.0) + geduckte Musik (0.2512) je cos45 → ~0.8847, unter dem Limiter.
    expect(mix.peaks[0]).toBeGreaterThan(Math.cos(Math.PI / 4)); // mehr als nur Sprache
    expect(mix.peaks[0]).toBeLessThanOrEqual(LIMITER_LINEAR + 1e-9);
  });

  it("duckt Musik NICHT, wenn keine Sprache aktiv ist", () => {
    const timeline = buildMultiTrackTimeline([
      cue({ type: "music", startTime: 0, duration: 1000, volume: 1 }),
    ]);
    const mix = calculateMixdown(timeline);
    expect(mix.duckingApplied).toBe(false);
    // Nur Musik, kein Ducking: cos45 ≈ 0.7071.
    expect(mix.peaks[0]).toBeCloseTo(Math.cos(Math.PI / 4), 3);
  });

  it("duckt erst in Blöcken mit Sprache (Ducking nur dort)", () => {
    const timeline = buildMultiTrackTimeline([
      cue({ type: "music", startTime: 0, duration: 2000, volume: 1 }),
      cue({ type: "dialogue", startTime: 1000, duration: 1000, volume: 1 }),
    ]);
    const mix = calculateMixdown(timeline);
    expect(mix.duckingApplied).toBe(true);
    // Block 0 (0..1000): nur Musik → ungeduckt (cos45).
    expect(mix.peaks[0]).toBeCloseTo(Math.cos(Math.PI / 4), 3);
    // Block 10 (1000..1100): Musik + Sprache → geduckt, höher als reine Musik.
    expect(mix.peaks[10]).toBeGreaterThan(mix.peaks[0]);
  });

  it("begrenzt die Spitze auf den Limiter (-0.5 dB) — kein Clipping", () => {
    // Viele laute Cues im selben Block → Summe weit über 1.0.
    const loud: AudioCue[] = [];
    for (let i = 0; i < 12; i += 1) {
      loud.push(cue({ id: `l${i}`, type: "sfx", startTime: 0, duration: 1000, volume: 1 }));
    }
    const mix = calculateMixdown(buildMultiTrackTimeline(loud));

    expect(mix.peaks[0]).toBeLessThanOrEqual(LIMITER_LINEAR + 1e-9);
    expect(mix.peaks[0]).toBeLessThan(1); // kein Clipping
    expect(LIMITER_DB).toBe(-0.5);
    // Jede Spitze bleibt unter dem Clip-Pegel.
    for (const peak of mix.peaks) {
      expect(peak).toBeLessThanOrEqual(LIMITER_LINEAR + 1e-9);
    }
  });

  it("liefert bei leerer Timeline ein leeres, ducking-freies Ergebnis", () => {
    const mix = calculateMixdown(buildMultiTrackTimeline([]));
    expect(mix.durationMs).toBe(0);
    expect(mix.peaks).toEqual([]);
    expect(mix.duckingApplied).toBe(false);
  });

  it("ist deterministisch — gleiche Eingabe, gleiches Ergebnis", () => {
    const cues = [
      cue({ type: "dialogue", startTime: 0, duration: 800, volume: 0.9 }),
      cue({ type: "music", startTime: 0, duration: 1600, volume: 0.7 }),
      cue({ type: "sfx", startTime: 400, duration: 400, volume: 0.5, pan: -0.4 }),
    ];
    const a = calculateMixdown(buildMultiTrackTimeline(cues));
    const b = calculateMixdown(buildMultiTrackTimeline(cues));
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Parsing-Helfer (Randfälle)
// ---------------------------------------------------------------------------

describe("Parsing-Helfer", () => {
  it("parseTimeMs versteht s/ms und Sekunden-Default", () => {
    expect(parseTimeMs("2s")).toBe(2000);
    expect(parseTimeMs("1.5s")).toBe(1500);
    expect(parseTimeMs("500ms")).toBe(500);
    expect(parseTimeMs("3")).toBe(3000);
    expect(parseTimeMs(undefined)).toBeUndefined();
    expect(parseTimeMs("abc")).toBeUndefined();
  });

  it("parseVolume versteht Prozent und Faktoren", () => {
    expect(parseVolume("40%")).toBeCloseTo(0.4, 5);
    expect(parseVolume("0.4")).toBeCloseTo(0.4, 5);
    expect(parseVolume("40")).toBeCloseTo(0.4, 5);
    expect(parseVolume("150%")).toBe(1); // geklemmt
    expect(parseVolume("nope")).toBeUndefined();
  });

  it("parsePan klemmt auf -1..1", () => {
    expect(parsePan("-0.7")).toBeCloseTo(-0.7, 5);
    expect(parsePan("2")).toBe(1);
    expect(parsePan("-9")).toBe(-1);
    expect(parsePan("x")).toBeUndefined();
  });

  it("DUCKING_GAIN entspricht -12 dB", () => {
    expect(DUCKING_GAIN).toBeCloseTo(10 ** (-12 / 20), 6);
  });
});
