// Unit-Tests für den Hörbuch-Master-Service (WP 18.1).
//
// Rein deterministisch: keine LLM-Calls, keine Netzwerk-/Tauri-Abhängigkeit.
// Alle Timecodes/Byte-Layouts werden exakt geprüft.

import { describe, it, expect } from "vitest";
import {
  DEFAULT_WPM,
  DATA_TYPE_BINARY,
  DATA_TYPE_UTF8,
  DATA_TYPE_JPEG,
  DATA_TYPE_PNG,
  NERO_TIME_SCALE,
  generateChapterMarkers,
  buildM4bMetadata,
  cutSampleSnippet,
  clampSampleMinutes,
  countWords,
  normalizeContent,
  encodeChplBody,
  encodeChplAtom,
  encodeTagAtom,
  encodeIlstAtom,
  serializeM4bAtoms,
  totalDurationMs,
  type ChapterInput,
  type ChapterMarker,
  type M4bMetadata,
} from "./audiobookMaster";

/** n Wörter als Klartext. */
const words = (n: number): string => "wort ".repeat(n).trim();

const chapter = (id: string, title: string, content: string): ChapterInput => ({ id, title, content });

const findAtom = (meta: M4bMetadata, type: string) => meta.atoms.find((a) => a.type === type);

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false);

const readBigUint64 = (bytes: Uint8Array, offset: number): bigint =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(offset, false);

const ascii = (bytes: Uint8Array, start: number, len: number): string =>
  String.fromCharCode(...bytes.slice(start, start + len));

// ---------------------------------------------------------------------------
// generateChapterMarkers
// ---------------------------------------------------------------------------

describe("generateChapterMarkers", () => {
  it("berechnet kumulative Start- und Dauer-Timecodes bei 150 wpm", () => {
    const markers = generateChapterMarkers([
      chapter("1", "Eins", words(300)),
      chapter("2", "Zwei", words(150)),
      chapter("3", "Drei", ""),
    ]);

    expect(markers).toHaveLength(3);
    expect(markers[0]).toMatchObject({ title: "Eins", startTimeMs: 0, durationMs: 120000, wordCount: 300 });
    expect(markers[1]).toMatchObject({ title: "Zwei", startTimeMs: 120000, durationMs: 60000, wordCount: 150 });
    expect(markers[2]).toMatchObject({ title: "Drei", startTimeMs: 180000, durationMs: 0, wordCount: 0 });
  });

  it("skaliert die Dauer mit der Sprechgeschwindigkeit", () => {
    const slow = generateChapterMarkers([chapter("1", "A", words(300))], DEFAULT_WPM);
    const fast = generateChapterMarkers([chapter("1", "A", words(300))], 300);
    expect(slow[0].durationMs).toBe(120000);
    expect(fast[0].durationMs).toBe(60000);
  });

  it("zählt Wörter robust über Satzzeichen und Whitespace hinweg", () => {
    const [marker] = generateChapterMarkers([chapter("1", "A", "Hallo   Welt,\n\nwie geht es dir?")]);
    expect(marker.wordCount).toBe(6);
    // 6 Wörter / 150 wpm * 60000 = 2400 ms
    expect(marker.durationMs).toBe(2400);
  });

  it("fällt bei ungültigem wpm auf 150 zurück", () => {
    const fallback = generateChapterMarkers([chapter("1", "A", words(300))], 0);
    const nan = generateChapterMarkers([chapter("1", "A", words(300))], Number.NaN);
    const negative = generateChapterMarkers([chapter("1", "A", words(300))], -10);
    expect(fallback[0].durationMs).toBe(120000);
    expect(nan[0].durationMs).toBe(120000);
    expect(negative[0].durationMs).toBe(120000);
  });

  it("liefert [] bei leerer oder ungültiger Kapitelliste", () => {
    expect(generateChapterMarkers([])).toEqual([]);
    expect(generateChapterMarkers(undefined as unknown as ChapterInput[])).toEqual([]);
  });

  it("nutzt defensive Fallbacks für fehlende Titel und Inhalte", () => {
    const markers = generateChapterMarkers([{ id: "1", title: "   ", content: "" } as ChapterInput]);
    expect(markers[0].title).toBe("Kapitel");
    expect(markers[0].wordCount).toBe(0);
    expect(markers[0].durationMs).toBe(0);
  });

  it("extrahiert Wörter aus TipTap/ProseMirror-JSON", () => {
    const json = JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Eins zwei drei" }] },
        { type: "paragraph", content: [{ type: "text", text: "vier fünf" }] },
      ],
    });
    const [marker] = generateChapterMarkers([chapter("1", "K", json)]);
    expect(marker.wordCount).toBe(5);
  });

  it("ist deterministisch (gleiche Eingabe ⇒ gleiche Ausgabe)", () => {
    const input = [chapter("1", "Eins", words(200)), chapter("2", "Zwei", words(50))];
    expect(generateChapterMarkers(input)).toEqual(generateChapterMarkers(input));
  });
});

// ---------------------------------------------------------------------------
// countWords / normalizeContent
// ---------------------------------------------------------------------------

describe("countWords / normalizeContent", () => {
  it("zählt Wörter und entfernt HTML-Tags", () => {
    expect(countWords("<p>Hallo <b>Welt</b></p>")).toBe(2);
    expect(countWords(words(1234))).toBe(1234);
    expect(countWords("")).toBe(0);
    expect(countWords(null)).toBe(0);
    expect(normalizeContent("  a   b  ")).toBe("a b");
  });
});

// ---------------------------------------------------------------------------
// buildM4bMetadata
// ---------------------------------------------------------------------------

describe("buildM4bMetadata", () => {
  it("erzeugt die Basis-Tags ©nam, ©ART und ©alb (Serie fällt auf Titel zurück)", () => {
    const meta = buildM4bMetadata("Mein Buch", "Erika Muster");
    expect(findAtom(meta, "©nam")).toMatchObject({ value: "Mein Buch", dataType: DATA_TYPE_UTF8, scope: "ilst" });
    expect(findAtom(meta, "©ART")).toMatchObject({ value: "Erika Muster", scope: "ilst" });
    expect(findAtom(meta, "©alb")).toMatchObject({ value: "Mein Buch", scope: "ilst" });
    expect(meta.series).toBeUndefined();
  });

  it("übernimmt die Serie in ©alb und ins Ergebnis", () => {
    const meta = buildM4bMetadata("Mein Buch", "Erika Muster", "Die Chroniken");
    expect(findAtom(meta, "©alb")?.value).toBe("Die Chroniken");
    expect(meta.series).toBe("Die Chroniken");
  });

  it("setzt defensive Fallbacks bei leeren Titel-/Autorangaben", () => {
    const meta = buildM4bMetadata("", "   ");
    expect(meta.title).toBe("Unbenanntes Hörbuch");
    expect(meta.author).toBe("Unbekannter Autor");
    expect(findAtom(meta, "©alb")?.value).toBe("Unbenanntes Hörbuch");
  });

  it("hängt das chpl-Kapitelatom als udta-Atom an und summiert die Dauer", () => {
    const markers = generateChapterMarkers([chapter("1", "Eins", words(300)), chapter("2", "Zwei", words(150))]);
    const meta = buildM4bMetadata("Titel", "Autor", undefined, undefined, markers);

    const chpl = findAtom(meta, "chpl");
    expect(chpl?.scope).toBe("udta");
    expect(chpl?.dataType).toBe(DATA_TYPE_BINARY);
    expect(chpl?.value).toBeInstanceOf(Uint8Array);
    expect(meta.chapterMarkers).toHaveLength(2);
    expect(meta.totalDurationMs).toBe(180000);
  });

  it("kodiert ein PNG-Cover (Data-URL) als covr mit Datentyp 14", () => {
    // base64 der PNG-Signatur 89 50 4E 47 0D 0A 1A 0A
    const meta = buildM4bMetadata("T", "A", undefined, "data:image/png;base64,iVBORw0KGgo=");
    const covr = findAtom(meta, "covr");
    expect(covr?.dataType).toBe(DATA_TYPE_PNG);
    expect((covr?.value as Uint8Array).length).toBe(8);
  });

  it("erkennt PNG anhand der Magic-Bytes auch ohne Data-URL-Präfix", () => {
    const meta = buildM4bMetadata("T", "A", undefined, "iVBORw0KGgo=");
    expect(findAtom(meta, "covr")?.dataType).toBe(DATA_TYPE_PNG);
  });

  it("erkennt JPEG anhand des MIME-Typs als covr mit Datentyp 13", () => {
    const meta = buildM4bMetadata("T", "A", undefined, "data:image/jpeg;base64,/9j/4A==");
    expect(findAtom(meta, "covr")?.dataType).toBe(DATA_TYPE_JPEG);
  });

  it("ignoriert leere/ungültige Cover-Angaben ohne covr-Atom", () => {
    expect(findAtom(buildM4bMetadata("T", "A", undefined, ""), "covr")).toBeUndefined();
    expect(findAtom(buildM4bMetadata("T", "A", undefined, "data:image/png;base64,   "), "covr")).toBeUndefined();
    expect(findAtom(buildM4bMetadata("T", "A"), "covr")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Atom-Bytes (chpl / viercc / ilst)
// ---------------------------------------------------------------------------

describe("Atom-Serialisierung", () => {
  it("kodiert das chpl-Atom byte-genau (version, count, 100-ns-Startzeiten)", () => {
    const markers: ChapterMarker[] = [
      { title: "Eins", startTimeMs: 0, durationMs: 1000, wordCount: 1 },
      { title: "Zwei", startTimeMs: 1000, durationMs: 2000, wordCount: 2 },
    ];
    const body = encodeChplBody(markers);

    expect(body[0]).toBe(1); // version
    expect(body[4]).toBe(2); // chapter count
    // Erster Eintrag beginnt bei Offset 5: Start 0, Titel "Eins"
    expect(readBigUint64(body, 5)).toBe(0n);
    expect(body[13]).toBe(4);
    expect(ascii(body, 14, 4)).toBe("Eins");
    // Zweiter Eintrag: Start 1s → 10.000.000 Einheiten (100-ns-Ticks)
    const secondOffset = 5 + (9 + 4);
    expect(readBigUint64(body, secondOffset)).toBe(BigInt(NERO_TIME_SCALE));
    expect(body[secondOffset + 8]).toBe(4);
    expect(ascii(body, secondOffset + 9, 4)).toBe("Zwei");
    expect(body.length).toBe(5 + 13 + 13);
  });

  it("schreibt das vollständige chpl-Atom mit Größenfeld und FourCC", () => {
    const atom = encodeChplAtom([{ title: "K", startTimeMs: 0, durationMs: 1, wordCount: 1 }]);
    expect(readUint32(atom, 0)).toBe(atom.length);
    expect(ascii(atom, 4, 4)).toBe("chpl");
    expect(atom.length).toBe(8 + encodeChplBody([{ title: "K", startTimeMs: 0, durationMs: 1, wordCount: 1 }]).length);
  });

  it("kodiert das Copyright-Zeichen als Latin-1 (0xA9), nicht UTF-8", () => {
    const atom = encodeTagAtom("©nam", "Titel", DATA_TYPE_UTF8);
    expect(atom[4]).toBe(0xa9); // ©
    expect(atom[5]).toBe(0x6e); // n
    expect(atom[6]).toBe(0x61); // a
    expect(atom[7]).toBe(0x6d); // m
    expect(ascii(atom, 4, 4)).not.toBe("\u00c2\u00a9");
  });

  it("kürzt überlange Kapiteltitel im chpl-Atom auf ≤ 255 Bytes", () => {
    const longTitle = "A".repeat(300);
    const body = encodeChplBody([{ title: longTitle, startTimeMs: 0, durationMs: 0, wordCount: 0 }]);
    // Offset 5 = Start (8 Bytes), danach das Längenbyte bei 13
    expect(body[13]).toBe(255);
    expect(body.length).toBe(5 + 9 + 255);
  });

  it("serialisiert ilst + chpl und findet beide FourCCs im Bündel", () => {
    const markers = generateChapterMarkers([chapter("1", "Eins", words(300))]);
    const meta = buildM4bMetadata("T", "A", undefined, undefined, markers);

    const ilst = encodeIlstAtom(meta);
    expect(ascii(ilst, 4, 4)).toBe("ilst");

    const bundle = serializeM4bAtoms(meta);
    expect(bundle.length).toBeGreaterThan(ilst.length);
    const haystack = Array.from(bundle);
    const indexOfChpl = (() => {
      const needle = [0x63, 0x68, 0x70, 0x6c]; // "chpl"
      for (let i = 0; i <= haystack.length - 4; i += 1) {
        if (needle.every((b, j) => haystack[i + j] === b)) return i;
      }
      return -1;
    })();
    expect(indexOfChpl).toBeGreaterThan(0);
    expect(ascii(bundle, indexOfChpl, 4)).toBe("chpl");
  });
});

// ---------------------------------------------------------------------------
// cutSampleSnippet
// ---------------------------------------------------------------------------

describe("cutSampleSnippet", () => {
  const longBook = [
    chapter("1", "Eins", words(400)),
    chapter("2", "Zwei", words(400)),
    chapter("3", "Drei", words(400)),
  ];

  it("exportiert standardmäßig eine 5-minütige Hörprobe (750 Wörter)", () => {
    const snippet = cutSampleSnippet(longBook);
    expect(snippet).toHaveLength(2);
    const totalWords = snippet.reduce((sum, c) => sum + countWords(c.content), 0);
    expect(totalWords).toBe(750);
    expect(countWords(snippet[1].content)).toBe(350);
  });

  it("respektiert die gewünschte Länge (3 Minuten ⇒ 450 Wörter)", () => {
    const snippet = cutSampleSnippet(longBook, 3);
    const totalWords = snippet.reduce((sum, c) => sum + countWords(c.content), 0);
    expect(totalWords).toBe(450);
  });

  it("begrenzt die Länge auf 3–5 Minuten", () => {
    expect(clampSampleMinutes(1)).toBe(3);
    expect(clampSampleMinutes(10)).toBe(5);
    expect(clampSampleMinutes(4)).toBe(4);
    expect(clampSampleMinutes(0)).toBe(5);
    expect(clampSampleMinutes(Number.NaN)).toBe(5);

    const tooShort = cutSampleSnippet(longBook, 1); // → 3 min
    const tooLong = cutSampleSnippet(longBook, 99); // → 5 min
    expect(tooShort.reduce((s, c) => s + countWords(c.content), 0)).toBe(450);
    expect(tooLong.reduce((s, c) => s + countWords(c.content), 0)).toBe(750);
  });

  it("behält alle Kapitel, wenn sie exakt die Zielwortzahl ergeben", () => {
    const exact = [chapter("1", "Eins", words(400)), chapter("2", "Zwei", words(350))];
    const snippet = cutSampleSnippet(exact, 5);
    expect(snippet).toHaveLength(2);
    expect(snippet.reduce((s, c) => s + countWords(c.content), 0)).toBe(750);
  });

  it("schneidet ein zu langes Kapitel wortgenau ab", () => {
    const snippet = cutSampleSnippet([chapter("1", "Eins", words(1000))], 5);
    expect(snippet).toHaveLength(1);
    expect(countWords(snippet[0].content)).toBe(750);
  });

  it("liefert [] bei leerer oder ungültiger Kapitelliste", () => {
    expect(cutSampleSnippet([])).toEqual([]);
    expect(cutSampleSnippet(undefined as unknown as ChapterInput[])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// totalDurationMs
// ---------------------------------------------------------------------------

describe("totalDurationMs", () => {
  it("summiert die Dauern und ignoriert ungültige Werte", () => {
    expect(
      totalDurationMs([
        { title: "A", startTimeMs: 0, durationMs: 1000, wordCount: 1 },
        { title: "B", startTimeMs: 1000, durationMs: 2000, wordCount: 2 },
      ]),
    ).toBe(3000);
    expect(totalDurationMs([])).toBe(0);
    expect(totalDurationMs(undefined as unknown as ChapterMarker[])).toBe(0);
  });
});
