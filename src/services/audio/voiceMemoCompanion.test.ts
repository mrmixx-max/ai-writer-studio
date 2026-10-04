// Tests: Voice-Memo-Companion-Service (WP 43.1 — Diktat als Schreib-Asset).
//
// Deckt ab: createVoiceMemo, analyzeMemoContent (Smart-Tagger),
// formatMemoForChapter, formatMemoForCharacter, formatMemoForCodex,
// sortMemosByDate. Alles deterministisch, ohne LLM/Netzwerk/Audio-IO.
import { describe, it, expect } from "vitest";
import {
  createVoiceMemo,
  analyzeMemoContent,
  formatMemoForChapter,
  formatMemoForCharacter,
  formatMemoForCodex,
  sortMemosByDate,
  type VoiceMemo,
  type MemoContext,
} from "./voiceMemoCompanion";

// --- Hilfsfunktionen -----------------------------------------------------------------

/** Fester Zeitstempel: 2026-10-04 08:30 UTC. */
const T_0830 = Date.UTC(2026, 9, 4, 8, 30, 0);

function emptyContext(overrides: Partial<MemoContext> = {}): MemoContext {
  return { chapters: [], characters: [], codexTopics: [], ...overrides };
}

// ---------------------------------------------------------------------------
// createVoiceMemo
// ---------------------------------------------------------------------------

describe("createVoiceMemo", () => {
  it("erstellt ein vollständiges Memo inkl. berechneter Wortzahl", () => {
    const memo = createVoiceMemo("Der Held trifft Anna im Wald.", 30, T_0830);

    expect(memo.transcript).toBe("Der Held trifft Anna im Wald.");
    expect(memo.durationSec).toBe(30);
    expect(memo.recordedAt).toBe(T_0830);
    expect(memo.wordCount).toBe(6);
    expect(memo.id).toMatch(/^vm_[0-9a-f]{8}$/);
  });

  it("erzeugt eine deterministische ID (gleiche Eingabe ⇒ gleiche ID)", () => {
    const a = createVoiceMemo("Gleicher Text", 12, T_0830);
    const b = createVoiceMemo("Gleicher Text", 12, T_0830);

    expect(a.id).toBe(b.id);
  });

  it("vergibt unterschiedliche IDs für unterschiedlichen Inhalt", () => {
    const a = createVoiceMemo("Text A", 12, T_0830);
    const b = createVoiceMemo("Text B", 12, T_0830);

    expect(a.id).not.toBe(b.id);
  });

  it("fällt bei ungültiger Dauer defensiv auf 0 zurück", () => {
    const negative = createVoiceMemo("Hallo Welt", -5, T_0830);
    const nan = createVoiceMemo("Hallo Welt", Number.NaN, T_0830);
    const infinite = createVoiceMemo("Hallo Welt", Number.POSITIVE_INFINITY, T_0830);

    expect(negative.durationSec).toBe(0);
    expect(nan.durationSec).toBe(0);
    expect(infinite.durationSec).toBe(0);
  });

  it("fällt bei nicht-string Transkript auf leeren String zurück", () => {
    const memo = createVoiceMemo(null as unknown as string, 10, T_0830);

    expect(memo.transcript).toBe("");
    expect(memo.wordCount).toBe(0);
  });

  it("nutzt bei ungültigem recordedAt einen endlichen Fallback-Zeitstempel", () => {
    const memo = createVoiceMemo("Test", 5, Number.NaN);

    expect(Number.isFinite(memo.recordedAt)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// analyzeMemoContent — Smart-Tagger
// ---------------------------------------------------------------------------

describe("analyzeMemoContent", () => {
  it("erkennt einen genannten Figurennamen (Wortgrenze)", () => {
    const memo = createVoiceMemo("Anna kommt zurück ins Dorf.", 10, T_0830);
    const targets = analyzeMemoContent(memo, emptyContext({ characters: ["Anna"] }));

    const character = targets.find((t) => t.kind === "character");
    expect(character).toBeDefined();
    expect(character?.targetLabel).toBe("Anna");
    expect(character?.confidence).toBeGreaterThan(0);
  });

  it("matcht Figurennamen nicht innerhalb anderer Wörter", () => {
    const memo = createVoiceMemo("Annas Ananas ist reif.", 10, T_0830);
    const targets = analyzeMemoContent(memo, emptyContext({ characters: ["Anna"] }));

    expect(targets.some((t) => t.kind === "character")).toBe(false);
  });

  it("erkennt ein Kapitel über Keyword-Overlap", () => {
    const memo = createVoiceMemo("Der Wald ist tief und still.", 10, T_0830);
    const targets = analyzeMemoContent(
      memo,
      emptyContext({ chapters: [{ id: "ch1", title: "Im Wald", content: "" }] }),
    );

    const chapter = targets.find((t) => t.kind === "chapter");
    expect(chapter).toBeDefined();
    expect(chapter?.targetId).toBe("ch1");
    expect(chapter?.targetLabel).toBe("Im Wald");
  });

  it("gewichtet den Kapitel-Titel höher als den Kapitel-Inhalt", () => {
    const memo = createVoiceMemo("Der Wald ist dunkel und gefährlich.", 10, T_0830);
    const targets = analyzeMemoContent(
      memo,
      emptyContext({
        chapters: [
          { id: "cA", title: "Wald", content: "" },
          { id: "cB", title: "Irgendwo", content: "Wald" },
        ],
      }),
    );

    const a = targets.find((t) => t.targetId === "cA");
    const b = targets.find((t) => t.targetId === "cB");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.confidence).toBeGreaterThan(b!.confidence);
  });

  it("erkennt ein Codex-Thema über Keyword-Overlap", () => {
    const memo = createVoiceMemo("Das Artefakt pulsiert im Verborgenen.", 10, T_0830);
    const targets = analyzeMemoContent(memo, emptyContext({ codexTopics: ["Artefakt"] }));

    const codex = targets.find((t) => t.kind === "codex");
    expect(codex).toBeDefined();
    expect(codex?.targetLabel).toBe("Artefakt");
  });

  it("sortiert die Vorschläge nach Konfidenz absteigend", () => {
    const memo = createVoiceMemo(
      "Anna geht durch den Wald und findet das Artefakt.",
      12,
      T_0830,
    );
    const targets = analyzeMemoContent(
      memo,
      emptyContext({
        characters: ["Anna"],
        chapters: [{ id: "ch1", title: "Wald", content: "" }],
        codexTopics: ["Artefakt"],
      }),
    );

    expect(targets.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < targets.length; i += 1) {
      expect(targets[i - 1].confidence).toBeGreaterThanOrEqual(targets[i].confidence);
    }
    // Figurenname ist das stärkste Signal.
    expect(targets[0].kind).toBe("character");
  });

  it("liefert bei einem Memo aus reinen Stoppwörtern keine Ziele", () => {
    const memo = createVoiceMemo("der die das und oder aber", 5, T_0830);
    const targets = analyzeMemoContent(
      memo,
      emptyContext({
        characters: ["Anna"],
        chapters: [{ id: "ch1", title: "der das", content: "und oder" }],
        codexTopics: ["der die"],
      }),
    );

    expect(targets).toEqual([]);
  });

  it("liefert bei leerem Transkript ein leeres Ergebnis", () => {
    const memo = createVoiceMemo("", 0, T_0830);
    const targets = analyzeMemoContent(memo, emptyContext({ characters: ["Anna"] }));

    expect(targets).toEqual([]);
  });

  it("ist defensiv bei fehlendem/null-Kontext", () => {
    const memo = createVoiceMemo("Anna und der Wald", 5, T_0830);

    expect(analyzeMemoContent(memo, null as unknown as MemoContext)).toEqual([]);
    expect(analyzeMemoContent(null as unknown as VoiceMemo, emptyContext())).toEqual([]);
  });

  it("ignoriert leere Einträge in Kapiteln, Figuren und Codex", () => {
    const memo = createVoiceMemo("Anna im Wald", 5, T_0830);
    const targets = analyzeMemoContent(
      memo,
      emptyContext({
        characters: ["", "  "],
        chapters: [{ id: "ch1", title: "", content: "" }],
        codexTopics: [""],
      }),
    );

    // Kapitel ohne jeden Inhalt wird übersprungen; nur echte Treffer zählen.
    expect(targets.every((t) => t.targetId.trim().length > 0)).toBe(true);
  });

  it("liefert alle Konfidenzwerte im gültigen Bereich [0, 1]", () => {
    const memo = createVoiceMemo("Anna findet das Artefakt im Wald.", 8, T_0830);
    const targets = analyzeMemoContent(
      memo,
      emptyContext({
        characters: ["Anna"],
        chapters: [{ id: "ch1", title: "Wald", content: "Artefakt" }],
        codexTopics: ["Artefakt"],
      }),
    );

    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      expect(target.confidence).toBeGreaterThanOrEqual(0);
      expect(target.confidence).toBeLessThanOrEqual(1);
      expect(target.reason.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// formatMemoForChapter / formatMemoForCharacter / formatMemoForCodex
// ---------------------------------------------------------------------------

describe("formatMemoForChapter", () => {
  it("formatiert das Memo als Randnotiz mit Datum und Transkript", () => {
    const memo = createVoiceMemo("Die Szene braucht mehr Spannung.", 20, T_0830);
    const out = formatMemoForChapter(memo);

    expect(out).toContain("Voice-Memo");
    expect(out).toContain("2026-10-04 08:30 UTC");
    expect(out).toContain("Die Szene braucht mehr Spannung.");
    // Randnotiz im Blockquote-Stil.
    expect(out.startsWith(">")).toBe(true);
  });

  it("ist defensiv bei ungültigem Memo", () => {
    const out = formatMemoForChapter(null as unknown as VoiceMemo);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});

describe("formatMemoForCharacter", () => {
  it("formatiert das Memo als Figurenprofil-Eintrag", () => {
    const memo = createVoiceMemo("Anna verliert ihren Mut.", 15, T_0830);
    const out = formatMemoForCharacter(memo, "Anna");

    expect(out).toContain("### Anna");
    expect(out).toContain("Anna verliert ihren Mut.");
    expect(out).toContain("2026-10-04 08:30 UTC");
  });

  it("nutzt einen Fallback-Namen bei leerem Figurennamen", () => {
    const memo = createVoiceMemo("Text", 5, T_0830);
    const out = formatMemoForCharacter(memo, "   ");

    expect(out).toContain("Unbekannt");
  });
});

describe("formatMemoForCodex", () => {
  it("formatiert das Memo als Codex-Eintrag", () => {
    const memo = createVoiceMemo("Die Magie folgt festen Regeln.", 12, T_0830);
    const out = formatMemoForCodex(memo);

    expect(out).toContain("Voice-Memo");
    expect(out).toContain("Die Magie folgt festen Regeln.");
    expect(out).toContain("2026-10-04 08:30 UTC");
  });

  it("ist defensiv bei ungültigem Memo", () => {
    const out = formatMemoForCodex(undefined as unknown as VoiceMemo);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// sortMemosByDate
// ---------------------------------------------------------------------------

describe("sortMemosByDate", () => {
  it("sortiert Memos chronologisch aufsteigend", () => {
    const later = createVoiceMemo("später", 5, T_0830 + 10_000);
    const earlier = createVoiceMemo("früher", 5, T_0830);
    const middle = createVoiceMemo("mitte", 5, T_0830 + 5_000);

    const sorted = sortMemosByDate([later, earlier, middle]);

    expect(sorted.map((m) => m.transcript)).toEqual(["früher", "mitte", "später"]);
  });

  it("bleibt bei gleichem Zeitstempel stabil (Eingabereihenfolge)", () => {
    const first = createVoiceMemo("erster", 5, T_0830);
    const second = createVoiceMemo("zweiter", 5, T_0830);

    const sorted = sortMemosByDate([first, second]);

    expect(sorted.map((m) => m.transcript)).toEqual(["erster", "zweiter"]);
  });

  it("mutiert das Eingabe-Array nicht", () => {
    const later = createVoiceMemo("später", 5, T_0830 + 10_000);
    const earlier = createVoiceMemo("früher", 5, T_0830);
    const input = [later, earlier];

    sortMemosByDate(input);

    expect(input.map((m) => m.transcript)).toEqual(["später", "früher"]);
  });

  it("ist defensiv bei keinem Array und verwirft ungültige Einträge", () => {
    expect(sortMemosByDate(null as unknown as VoiceMemo[])).toEqual([]);
    expect(sortMemosByDate(undefined as unknown as VoiceMemo[])).toEqual([]);

    const valid = createVoiceMemo("gültig", 5, T_0830);
    const cleaned = sortMemosByDate([null as unknown as VoiceMemo, valid, undefined as unknown as VoiceMemo]);

    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].transcript).toBe("gültig");
  });
});
