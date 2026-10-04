// Tests für den Guest-Review-Portal-Service (WP 42.2).
// Rein lokal, deterministisch — kein LLM, kein DB, kein Netzwerk.
import { describe, it, expect, beforeEach } from "vitest";
import {
  createReviewSession,
  generateReviewLink,
  generateReviewQrCode,
  submitReviewComment,
  importReviewComments,
  isSessionExpired,
  __setClock,
  __reset,
  __qrTestHooks,
  type ReviewChapter,
  type ReviewComment,
} from "./guestReviewPortal";

const CHAPTERS: ReviewChapter[] = [
  { id: "ch-1", title: "Der dunkle Wald", content: "Es war einmal ein dunkler Wald." },
  { id: "ch-2", title: "Die Lichtung", content: "Am Ende lag eine weite Lichtung." },
];

function comment(over: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: "c-1",
    chapterId: "ch-1",
    text: "Starke Szene!",
    author: "Lektorin",
    position: 12,
    createdAt: 1000,
    ...over,
  };
}

beforeEach(() => {
  __reset();
});

// ---------------------------------------------------------------------------
// createReviewSession
// ---------------------------------------------------------------------------

describe("createReviewSession", () => {
  it("erstellt eine Session mit allen Feldern und Kapiteln", () => {
    __setClock(() => 5_000_000);
    const s = createReviewSession(CHAPTERS);
    expect(s.id).toMatch(/^rs-/);
    expect(typeof s.token).toBe("string");
    expect(s.token).toHaveLength(32);
    expect(s.chapters).toEqual(CHAPTERS);
    expect(s.comments).toEqual([]);
    expect(s.createdAt).toBe(5_000_000);
  });

  it("nutzt Defaults: commentable und 24h Ablauf", () => {
    __setClock(() => 1_000);
    const s = createReviewSession(CHAPTERS);
    expect(s.mode).toBe("commentable");
    expect(s.expiresAt).toBe(1_000 + 24 * 60 * 60 * 1000);
  });

  it("respektiert mode: readonly und expiresInMinutes", () => {
    __setClock(() => 2_000);
    const s = createReviewSession(CHAPTERS, { mode: "readonly", expiresInMinutes: 30 });
    expect(s.mode).toBe("readonly");
    expect(s.expiresAt).toBe(2_000 + 30 * 60_000);
  });

  it("ist deterministisch: gleiche Eingabe + Uhr → gleiche ID und Token", () => {
    __setClock(() => 42_000);
    __reset();
    __setClock(() => 42_000);
    const a = createReviewSession(CHAPTERS);
    __reset();
    __setClock(() => 42_000);
    const b = createReviewSession(CHAPTERS);
    expect(a.id).toBe(b.id);
    expect(a.token).toBe(b.token);
  });

  it("ist defensiv: ungültige chapters → leere Liste, kein Throw", () => {
    expect(() => createReviewSession(null as unknown as ReviewChapter[])).not.toThrow();
    const s = createReviewSession(undefined as unknown as ReviewChapter[]);
    expect(s.chapters).toEqual([]);
    expect(s.id).toMatch(/^rs-/);
  });

  it("filtert kaputte Kapitel heraus, vergibt aber Fallback-IDs", () => {
    const s = createReviewSession([
      { id: "", title: "Ohne ID", content: "x" },
      null as unknown as ReviewChapter,
    ]);
    expect(s.chapters).toHaveLength(1);
    expect(s.chapters[0].id).toBe("ch-0");
  });

  it("klemmt negative/ungültige expiresInMinutes auf den Default", () => {
    __setClock(() => 0);
    const s = createReviewSession(CHAPTERS, { expiresInMinutes: -5 });
    expect(s.expiresAt).toBe(24 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// generateReviewLink
// ---------------------------------------------------------------------------

describe("generateReviewLink", () => {
  it("baut einen lokalen Link mit Token und QR-Code", () => {
    const s = createReviewSession(CHAPTERS);
    const link = generateReviewLink(s, "192.168.0.42:3000");
    expect(link.url).toBe(`http://192.168.0.42:3000/review/${s.id}?token=${s.token}`);
    expect(link.token).toBe(s.token);
    expect(link.qrCodeSvg.startsWith("<svg")).toBe(true);
  });

  it("normalisiert Host mit Protokoll und Pfad", () => {
    const s = createReviewSession(CHAPTERS);
    expect(generateReviewLink(s, "https://mein-host.local:8080/app/").url).toContain(
      "http://mein-host.local:8080/review/",
    );
  });

  it("fällt bei leerem/ungültigem Host auf localhost zurück", () => {
    const s = createReviewSession(CHAPTERS);
    expect(generateReviewLink(s, "").url).toContain("http://localhost/review/");
    expect(generateReviewLink(s, "   ").url).toContain("http://localhost/review/");
  });

  it("ist defensiv bei ungültiger Session (kein Throw, Link bleibt wohlgeformt)", () => {
    const link = generateReviewLink(null as unknown as ReturnType<typeof createReviewSession>, "h");
    expect(link.url).toMatch(/^http:\/\/h\/review\/[^?]+\?token=/);
    expect(link.token).toHaveLength(32);
  });
});

// ---------------------------------------------------------------------------
// generateReviewQrCode — Struktur & Determinismus
// ---------------------------------------------------------------------------

describe("generateReviewQrCode", () => {
  it("liefert ein strukturell vollständiges SVG", () => {
    const svg = generateReviewQrCode("http://localhost/review/rs-1?token=abc");
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("viewBox=");
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<rect width="100%" height="100%" fill="#ffffff"/>');
    expect(svg).toMatch(/<path d="M[^"]+" fill="#000000"\/>/);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("ist deterministisch (gleiche Eingabe → identische Ausgabe)", () => {
    const a = generateReviewQrCode("identisch");
    const b = generateReviewQrCode("identisch");
    expect(a).toBe(b);
  });

  it("ist defensiv: Nicht-String-Eingaben erzeugen trotzdem gültiges SVG", () => {
    const svg = generateReviewQrCode(undefined as unknown as string);
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("nutzt Version 1 (21 Module) für kurze Eingaben", () => {
    const r = __qrTestHooks.encode("hi");
    expect(r.version).toBe(1);
    expect(r.size).toBe(21);
    expect(r.modules.length).toBe(21);
    expect(r.modules.every((row) => row.length === 21)).toBe(true);
  });

  it("wählt die kleinste passende Version (Längengrenzen)", () => {
    expect(__qrTestHooks.encode("x".repeat(__qrTestHooks.maxBytesFor(1))).version).toBe(1);
    expect(__qrTestHooks.encode("x".repeat(__qrTestHooks.maxBytesFor(2))).version).toBe(2);
    expect(__qrTestHooks.encode("x".repeat(__qrTestHooks.maxBytesFor(3))).version).toBe(3);
    expect(__qrTestHooks.encode("x".repeat(__qrTestHooks.maxBytesFor(4))).version).toBe(4);
  });

  it("kürzt zu lange Eingaben deterministisch und markiert truncated", () => {
    const r = __qrTestHooks.encode("A".repeat(500));
    expect(r.version).toBe(4);
    expect(r.truncated).toBe(true);
    expect(r.dataCodewords).toHaveLength(80);
  });

  it("zeichnet die drei Finder-Patterns korrekt", () => {
    const m = __qrTestHooks.encode("finder").modules;
    const size = m.length;
    // Vertikaler Schnitt durch das obere linke Finder-Zentrum (Spalte 3):
    // dunkel, hell, dunkel, dunkel, dunkel, hell, dunkel
    expect([0, 1, 2, 3, 4, 5, 6].map((y) => m[y][3])).toEqual([
      true,
      false,
      true,
      true,
      true,
      false,
      true,
    ]);
    // Zentren aller drei Finder dunkel
    expect(m[3][3]).toBe(true);
    expect(m[3][size - 4]).toBe(true);
    expect(m[size - 4][3]).toBe(true);
  });

  it("weist das dunkle Modul der Format-Info auf", () => {
    const m = __qrTestHooks.encode("format").modules;
    const size = m.length;
    expect(m[size - 8][8]).toBe(true); // immer dunkles Modul
  });
});

// ---------------------------------------------------------------------------
// QR-Encoder — mathematische Korrektheit (Reed-Solomon / GF(256))
// ---------------------------------------------------------------------------

describe("QR-Encoder Korrektheit", () => {
  it("GF(256)-Tabellen sind konsistent (α^255 = 1, log(exp) invertiert)", () => {
    expect(__qrTestHooks.gfExp(0)).toBe(1);
    expect(__qrTestHooks.gfExp(255)).toBe(1);
    // Multiplikation ist assoziativ-neutral: a * 1 = a
    for (const a of [0, 1, 2, 7, 255]) {
      expect(__qrTestHooks.gfMul(a, 1)).toBe(a);
    }
    // a * a^{-1} = 1 für a ≠ 0, verifiziert über die exp-Tabelle
    const a = 53;
    const inv = __qrTestHooks.gfExp(255 - (() => {
      let i = 0;
      while (__qrTestHooks.gfExp(i) !== a) i++;
      return i;
    })());
    expect(__qrTestHooks.gfMul(a, inv)).toBe(1);
  });

  it("Generatorpolynom verschwindet an den Wurzeln α^0 … α^(ec-1)", () => {
    for (const ec of [7, 10, 15, 20]) {
      const gen = __qrTestHooks.rsGenerator(ec);
      expect(gen).toHaveLength(ec + 1);
      for (let i = 0; i < ec; i++) {
        expect(__qrTestHooks.evalPoly(gen, __qrTestHooks.gfExp(i))).toBe(0);
      }
    }
  });

  it("Reed-Solomon-Codewort ist durch das Generatorpolynom teilbar", () => {
    // Definierende Eigenschaft: das vollständige Codewort (Daten ⊕ EC) hat an
    // allen ec Wurzeln des Generatorpolynoms den Wert 0.
    for (const text of ["A", "Hello, Welt!", "http://localhost/review/x?token=abc"]) {
      const r = __qrTestHooks.encode(text);
      const full = r.dataCodewords.concat(r.ecCodewords);
      for (let i = 0; i < r.ecCodewords.length; i++) {
        expect(__qrTestHooks.evalPoly(full, __qrTestHooks.gfExp(i))).toBe(0);
      }
    }
  });

  it("erzeugt die korrekte Anzahl Daten- und EC-Codewords je Version", () => {
    const expected: Record<number, [number, number]> = {
      1: [19, 7],
      2: [34, 10],
      3: [55, 15],
      4: [80, 20],
    };
    for (const v of [1, 2, 3, 4]) {
      const r = __qrTestHooks.encode("x".repeat(__qrTestHooks.maxBytesFor(v)));
      expect(r.version).toBe(v);
      expect(r.dataCodewords).toHaveLength(expected[v][0]);
      expect(r.ecCodewords).toHaveLength(expected[v][1]);
      expect(r.codewords).toHaveLength(expected[v][0] + expected[v][1]);
    }
  });

  it("erzeugt unabhängig vom Inhalt immer ein quadratisches Raster", () => {
    for (const text of ["", "a", "äöü ß €", "x".repeat(200)]) {
      const r = __qrTestHooks.encode(text);
      expect(r.modules.length).toBe(r.size);
      expect(r.modules.every((row) => row.length === r.size)).toBe(true);
      expect((r.size - 17) % 4).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// submitReviewComment
// ---------------------------------------------------------------------------

describe("submitReviewComment", () => {
  it("hängt einen Kommentar an und liefert eine neue Session", () => {
    const s = createReviewSession(CHAPTERS);
    const updated = submitReviewComment(s, comment());
    expect(updated.comments).toHaveLength(1);
    expect(updated.comments[0].text).toBe("Starke Szene!");
    expect(updated).not.toBe(s); // Immutability
    expect(s.comments).toHaveLength(0); // Original unverändert
  });

  it("ist ein No-op im readonly-Modus", () => {
    const s = createReviewSession(CHAPTERS, { mode: "readonly" });
    const updated = submitReviewComment(s, comment());
    expect(updated.comments).toHaveLength(0);
  });

  it("ist ein No-op bei abgelaufener Session", () => {
    __setClock(() => 0);
    const s = createReviewSession(CHAPTERS, { expiresInMinutes: 10 });
    __setClock(() => 11 * 60_000);
    const updated = submitReviewComment(s, comment());
    expect(updated.comments).toHaveLength(0);
  });

  it("ignoriert leere Kommentare (fehlende chapterId oder leerer Text)", () => {
    const s = createReviewSession(CHAPTERS);
    expect(submitReviewComment(s, comment({ text: "   " })).comments).toHaveLength(0);
    expect(submitReviewComment(s, comment({ chapterId: "" })).comments).toHaveLength(0);
    expect(submitReviewComment(s, null as unknown as ReviewComment).comments).toHaveLength(0);
  });

  it("vergibt eine Fallback-ID und klemmt negative Positionen auf 0", () => {
    const s = createReviewSession(CHAPTERS);
    const updated = submitReviewComment(
      s,
      comment({ id: "", position: -3, author: "" }),
    );
    expect(updated.comments[0].id).toMatch(/^rc-/);
    expect(updated.comments[0].position).toBe(0);
    expect(updated.comments[0].author).toBe("Gast");
  });

  it("ist defensiv bei ungültiger Session (kein Throw)", () => {
    const result = submitReviewComment(undefined as never, comment());
    expect(result.comments).toEqual([]);
    expect(result.id).toBe("rs-invalid");
  });
});

// ---------------------------------------------------------------------------
// importReviewComments
// ---------------------------------------------------------------------------

describe("importReviewComments", () => {
  it("liefert neue Kommentare genau einmal", () => {
    let s = createReviewSession(CHAPTERS);
    s = submitReviewComment(s, comment({ id: "a" }));
    s = submitReviewComment(s, comment({ id: "b" }));

    const first = importReviewComments(s);
    expect(first.map((c) => c.id)).toEqual(["a", "b"]);

    const second = importReviewComments(s);
    expect(second).toEqual([]);
  });

  it("liefert nach einem weiteren Kommentar nur den neuen", () => {
    let s = createReviewSession(CHAPTERS);
    s = submitReviewComment(s, comment({ id: "a" }));
    expect(importReviewComments(s)).toHaveLength(1);
    s = submitReviewComment(s, comment({ id: "b" }));
    const fresh = importReviewComments(s);
    expect(fresh.map((c) => c.id)).toEqual(["b"]);
  });

  it("liefert bei ungültiger Session eine leere Liste", () => {
    expect(importReviewComments(null as never)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isSessionExpired
// ---------------------------------------------------------------------------

describe("isSessionExpired", () => {
  it("ist vor Ablauf false und ab Ablauf true (Grenze inklusive)", () => {
    __setClock(() => 0);
    const s = createReviewSession(CHAPTERS, { expiresInMinutes: 10 });
    __setClock(() => 10 * 60_000 - 1);
    expect(isSessionExpired(s)).toBe(false);
    __setClock(() => 10 * 60_000);
    expect(isSessionExpired(s)).toBe(true);
  });

  it("ist defensiv: ungültige Session → false", () => {
    expect(isSessionExpired(null as never)).toBe(false);
    expect(isSessionExpired({} as never)).toBe(false);
  });
});
