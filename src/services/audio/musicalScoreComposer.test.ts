// Tests: Thematischer Soundtrack- & MIDI-Composer-Service (WP 48.2).
//
// Deckt ab: getScaleForEmotion, composeForEmotion, assignLeitmotif, exportAsMidi.
// Alles deterministisch, ohne LLM/Netzwerk/Audio-IO.
import { describe, it, expect } from "vitest";
import {
  getScaleForEmotion,
  composeForEmotion,
  assignLeitmotif,
  exportAsMidi,
  SCENE_EMOTIONS,
  DEFAULT_EMOTION,
  DEFAULT_TEMPO,
  MIDI_TICKS_PER_BEAT,
  type SceneEmotion,
  type MusicalScore,
} from "./musicalScoreComposer";

// --- Test-Helfer ---------------------------------------------------------------------

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Umgebungsunabhängiger Base64-Decoder für die Verifikation des MIDI-Exports. */
function fromBase64(str: string): number[] {
  const clean = str.replace(/=+$/, "");
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const idx = B64_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return out;
}

/** ASCII-String aus einem Byte-Array. */
function ascii(bytes: number[]): string {
  return bytes.map((b) => String.fromCharCode(b & 0xff)).join("");
}

/** true, wenn `needle` als zusammenhängende Teilfolge in `haystack` vorkommt. */
function containsSubsequence(haystack: number[], needle: number[]): boolean {
  if (needle.length === 0) return true;
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

const VALID_BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

// ---------------------------------------------------------------------------
// getScaleForEmotion
// ---------------------------------------------------------------------------

describe("getScaleForEmotion", () => {
  it("liefert D-Moll (Aeolian) für melancholy", () => {
    const scale = getScaleForEmotion("melancholy");
    expect(scale.name).toBe("D Minor");
    expect(scale.root).toBe("D");
    expect(scale.mode).toBe("aeolian");
    expect(scale.intervals).toEqual([0, 2, 3, 5, 7, 8, 10]);
  });

  it("liefert C-Dur (Ionian) für triumph", () => {
    const scale = getScaleForEmotion("triumph");
    expect(scale.name).toBe("C Major");
    expect(scale.root).toBe("C");
    expect(scale.mode).toBe("ionian");
    expect(scale.intervals).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it("liefert C#-Phrygisch für dread", () => {
    const scale = getScaleForEmotion("dread");
    expect(scale.name).toBe("C# Phrygian");
    expect(scale.root).toBe("C#");
    expect(scale.mode).toBe("phrygian");
    expect(scale.intervals).toEqual([0, 1, 3, 5, 7, 8, 10]);
  });

  it("liefert G-Dur für playful", () => {
    const scale = getScaleForEmotion("playful");
    expect(scale.name).toBe("G Major");
    expect(scale.root).toBe("G");
    expect(scale.mode).toBe("ionian");
  });

  it("liefert A-Dur für romantic", () => {
    const scale = getScaleForEmotion("romantic");
    expect(scale.name).toBe("A Major");
    expect(scale.root).toBe("A");
    expect(scale.mode).toBe("ionian");
  });

  it("liefert F#-Lydisch für mystery", () => {
    const scale = getScaleForEmotion("mystery");
    expect(scale.name).toBe("F# Lydian");
    expect(scale.root).toBe("F#");
    expect(scale.mode).toBe("lydian");
    expect(scale.intervals).toEqual([0, 2, 4, 6, 7, 9, 11]);
  });

  it("hat für jede bekannte Emotion 7 Skalenstufen", () => {
    for (const emotion of SCENE_EMOTIONS) {
      expect(getScaleForEmotion(emotion).intervals).toHaveLength(7);
    }
  });

  it("fällt bei unbekannter Emotion auf die Default-Emotion zurück", () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const scale = getScaleForEmotion("unknown");
    expect(scale.name).toBe(getScaleForEmotion(DEFAULT_EMOTION).name);
  });

  it("liefert eine frische Kopie (Mutation der Intervalle ist folgenlos)", () => {
    const first = getScaleForEmotion("triumph");
    first.intervals[0] = 99;
    const second = getScaleForEmotion("triumph");
    expect(second.intervals[0]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// composeForEmotion
// ---------------------------------------------------------------------------

describe("composeForEmotion", () => {
  it("erzeugt einen vollständigen Score mit 4 Akkorden und 16 Melodienoten", () => {
    const score = composeForEmotion("triumph");
    expect(score.emotion).toBe("triumph");
    expect(score.chords).toHaveLength(4);
    expect(score.melody).toHaveLength(16); // 4 Takte à 4 Beats
    expect(score.id).toContain("triumph");
  });

  it("verwendet das emotionsspezifische Standard-Tempo", () => {
    expect(composeForEmotion("triumph").tempo).toBe(120);
    expect(composeForEmotion("melancholy").tempo).toBe(60);
    expect(composeForEmotion("dread").tempo).toBe(48);
  });

  it("berechnet die Dauer aus Beats und Tempo", () => {
    const score = composeForEmotion("melancholy"); // 16 Beats, 60 BPM
    expect(score.duration).toBeCloseTo(16, 3);
    const fast = composeForEmotion("triumph"); // 16 Beats, 120 BPM
    expect(fast.duration).toBeCloseTo(8, 3);
  });

  it("übernimmt ein Tempo-Override", () => {
    const score = composeForEmotion("triumph", { tempo: 60 });
    expect(score.tempo).toBe(60);
    expect(score.duration).toBeCloseTo(16, 3);
  });

  it("übernimmt einen Grundton-Override", () => {
    const score = composeForEmotion("triumph", { key: "E" });
    expect(score.key).toBe("E Major");
    // Grundton des ersten Akkords wandert von C nach E.
    expect(score.chords[0].notes[0].startsWith("E")).toBe(true);
  });

  it("weist jedem Akkord drei Noten und die Dauer eines Takts zu", () => {
    const score = composeForEmotion("romantic");
    for (const chord of score.chords) {
      expect(chord.notes).toHaveLength(3);
      expect(chord.duration).toBe(4);
      expect(chord.name.length).toBeGreaterThan(0);
    }
  });

  it("bildet die triumph-Progression I–V–vi–IV korrekt ab", () => {
    const score = composeForEmotion("triumph");
    expect(score.chords.map((c) => c.name)).toEqual(["C", "G", "Am", "F"]);
  });

  it("bildet die melancholy-Progression i–iv–VI–v mit b-Notennamen ab", () => {
    const score = composeForEmotion("melancholy");
    expect(score.chords.map((c) => c.name)).toEqual(["Dm", "Gm", "Bb", "Am"]);
  });

  it("enthält den Dur-Moll-Wechsel für playful (I–vi–IV–V)", () => {
    const score = composeForEmotion("playful");
    expect(score.chords[1].name).toBe("Em"); // vi in G-Dur
  });

  it("setzt scale auf den Modus-Namen", () => {
    expect(composeForEmotion("melancholy").scale).toBe("aeolian");
    expect(composeForEmotion("mystery").scale).toBe("lydian");
  });

  it("fällt bei unbekannter Emotion auf die Default-Emotion zurück", () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const score = composeForEmotion("bogus");
    expect(score.emotion).toBe(DEFAULT_EMOTION);
    expect(score.chords).toHaveLength(4);
  });

  it("verwendet Default-Tempo bei ungültigem Override", () => {
    const score = composeForEmotion("triumph", { tempo: Number.NaN });
    expect(score.tempo).toBe(120);
    const negative = composeForEmotion("triumph", { tempo: -10 });
    expect(negative.tempo).toBe(120);
  });

  it("ist deterministisch — gleiche Eingabe, gleicher Score", () => {
    const a = composeForEmotion("mystery", { tempo: 100, instrument: "strings" });
    const b = composeForEmotion("mystery", { tempo: 100, instrument: "strings" });
    expect(a).toEqual(b);
  });

  it("erzeugt für unterschiedliche Emotionen unterschiedliche Melodien", () => {
    const triumph = composeForEmotion("triumph");
    const dread = composeForEmotion("dread");
    expect(triumph.melody).not.toEqual(dread.melody);
  });

  it("hält alle Melodienoten im gültigen Bereich", () => {
    for (const emotion of SCENE_EMOTIONS) {
      const score = composeForEmotion(emotion);
      for (const note of score.melody) {
        expect(note.pitch).toMatch(/^[A-G][#b]?\d$/);
        expect(note.duration).toBeGreaterThan(0);
        expect(note.velocity).toBeGreaterThanOrEqual(70);
        expect(note.velocity).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// assignLeitmotif
// ---------------------------------------------------------------------------

describe("assignLeitmotif", () => {
  it("erzeugt einen 8-Noten-Bogen (4 Takte)", () => {
    const motif = assignLeitmotif("Aria", "triumph");
    expect(motif.characterName).toBe("Aria");
    expect(motif.emotion).toBe("triumph");
    expect(motif.notes).toHaveLength(8);
  });

  it("erkennt eine steigende Kontur (triumph)", () => {
    expect(assignLeitmotif("Held", "triumph").contour).toBe("rising");
  });

  it("erkennt eine fallende Kontur (melancholy)", () => {
    expect(assignLeitmotif("Elegie", "melancholy").contour).toBe("falling");
  });

  it("erkennt eine fallende Kontur (dread)", () => {
    expect(assignLeitmotif("Schatten", "dread").contour).toBe("falling");
  });

  it("erkennt wellenförmige Konturen (playful, romantic, mystery)", () => {
    expect(assignLeitmotif("Puck", "playful").contour).toBe("wave");
    expect(assignLeitmotif("Liebende", "romantic").contour).toBe("wave");
    expect(assignLeitmotif("Rätsel", "mystery").contour).toBe("wave");
  });

  it("ist deterministisch für gleichen Charakter + Emotion", () => {
    const a = assignLeitmotif("Aria", "romantic");
    const b = assignLeitmotif("Aria", "romantic");
    expect(a).toEqual(b);
  });

  it("erzeugt für unterschiedliche Charaktere unterschiedliche Motive", () => {
    const a = assignLeitmotif("Aria", "triumph");
    const b = assignLeitmotif("Boromir", "triumph");
    expect(a.notes).not.toEqual(b.notes);
  });

  it("fällt bei unbekannter Emotion auf die Default-Emotion zurück", () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const motif = assignLeitmotif("Aria", "bogus");
    expect(motif.emotion).toBe(DEFAULT_EMOTION);
  });

  it("nutzt einen Fallback-Namen bei leerem/ungültigem Charakter", () => {
    expect(assignLeitmotif("   ", "romantic").characterName).toBe("Unbenannt");
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    expect(assignLeitmotif(null, "romantic").characterName).toBe("Unbenannt");
  });

  it("hält alle Noten im gültigen Bereich", () => {
    for (const emotion of SCENE_EMOTIONS) {
      const motif = assignLeitmotif("Aria", emotion);
      for (const note of motif.notes) {
        expect(note.pitch).toMatch(/^[A-G][#b]?\d$/);
        expect(note.velocity).toBeGreaterThanOrEqual(70);
        expect(note.velocity).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// exportAsMidi
// ---------------------------------------------------------------------------

describe("exportAsMidi", () => {
  it("liefert einen Base64-kodierten String mit gültigem MIDI-Header", () => {
    const score = composeForEmotion("triumph");
    const encoded = exportAsMidi(score);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
    expect(VALID_BASE64.test(encoded)).toBe(true);

    const bytes = fromBase64(encoded);
    expect(ascii(bytes.slice(0, 4))).toBe("MThd");
    expect(ascii(bytes).includes("MTrk")).toBe(true);
  });

  it("kodiert das Header-Chunk mit Format 0, einem Track und korrekter Division", () => {
    const bytes = fromBase64(exportAsMidi(composeForEmotion("romantic")));
    // MThd + Länge(6) + Format(0) + Tracks(1) + Division(480)
    expect(bytes.slice(4, 8)).toEqual([0, 0, 0, 6]);
    expect(bytes[8]).toBe(0x00);
    expect(bytes[9]).toBe(0x00);
    expect(bytes[10]).toBe(0x00);
    expect(bytes[11]).toBe(0x01);
    expect((bytes[12] << 8) | bytes[13]).toBe(MIDI_TICKS_PER_BEAT);
  });

  it("bettet das Tempo-Meta-Event korrekt ein (120 BPM = 500000 µs)", () => {
    const bytes = fromBase64(exportAsMidi(composeForEmotion("triumph")));
    // 500000 = 0x07A120 → 0xFF 0x51 0x03 0x07 0xA1 0x20
    expect(containsSubsequence(bytes, [0xff, 0x51, 0x03, 0x07, 0xa1, 0x20])).toBe(true);
  });

  it("enthält Note-On-Events (0x90) für die Melodie", () => {
    const bytes = fromBase64(exportAsMidi(composeForEmotion("mystery")));
    let noteOns = 0;
    for (let i = 0; i + 2 < bytes.length; i++) {
      if (bytes[i] === 0x90) noteOns++;
    }
    expect(noteOns).toBeGreaterThan(0);
  });

  it("endet mit einem End-of-Track-Event (0xFF 0x2F 0x00)", () => {
    const bytes = fromBase64(exportAsMidi(composeForEmotion("playful")));
    expect(containsSubsequence(bytes, [0xff, 0x2f, 0x00])).toBe(true);
  });

  it("ist deterministisch — gleicher Score, gleicher Export", () => {
    const score = composeForEmotion("dread");
    expect(exportAsMidi(score)).toBe(exportAsMidi(score));
  });

  it("liefert für unterschiedliche Scores unterschiedliche Ausgaben", () => {
    const a = exportAsMidi(composeForEmotion("triumph"));
    const b = exportAsMidi(composeForEmotion("dread"));
    expect(a).not.toBe(b);
  });

  it("erzeugt ohne gültigen Score eine valide, leere MIDI-Datei", () => {
    // @ts-expect-error — defensive Absicherung zur Laufzeit
    const bytes = fromBase64(exportAsMidi(null));
    expect(ascii(bytes.slice(0, 4))).toBe("MThd");
    expect(ascii(bytes).includes("MTrk")).toBe(true);
    expect(containsSubsequence(bytes, [0xff, 0x2f, 0x00])).toBe(true);
  });

  it("überspringt ungültige Noten defensiv, ohne zu werfen", () => {
    const broken: MusicalScore = {
      id: "x",
      emotion: "triumph",
      key: "C Major",
      tempo: 120,
      scale: "ionian",
      chords: [
        { name: "C", notes: ["C4", "not-a-note", "G4"], duration: 4 },
        // @ts-expect-error — defensiver Laufzeit-Test
        { name: "bad", notes: null, duration: 4 },
      ],
      melody: [{ pitch: "??", duration: 1, velocity: 80 }, { pitch: "E4", duration: 1, velocity: 90 }],
      duration: 8,
    };
    const bytes = fromBase64(exportAsMidi(broken));
    expect(ascii(bytes.slice(0, 4))).toBe("MThd");
    expect(containsSubsequence(bytes, [0xff, 0x2f, 0x00])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

describe("Konstanten", () => {
  it("MIDI_TICKS_PER_BEAT ist 480", () => {
    expect(MIDI_TICKS_PER_BEAT).toBe(480);
  });

  it("DEFAULT_TEMPO ist 120", () => {
    expect(DEFAULT_TEMPO).toBe(120);
  });

  it("listet alle sechs Emotionen", () => {
    const expected: SceneEmotion[] = [
      "melancholy",
      "triumph",
      "dread",
      "playful",
      "romantic",
      "mystery",
    ];
    expect([...SCENE_EMOTIONS]).toEqual(expected);
  });
});
