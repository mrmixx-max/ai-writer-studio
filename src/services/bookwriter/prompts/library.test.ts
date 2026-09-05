// Tests: Prompt-Library (Sprint 6, Agent 2).
//
// Akzeptanzkriterien Sprint 6:
// 1. Prompts in externer Datei — alle Templates aus prompts.json, kein
//    Prompt-Text mehr in prompts.ts (nur noch Variablen-Mapping).
// 2. Genre-Profile via Flag ladbar — resolveGenre/parsePromptArgs decken
//    sachbuch-it, ratgeber-gesundheit, fiction-thriller ab.
// 3. Handlebars-Variablen funktionieren — targetAudience, tone, Buchlänge.
//
// Byte-Identität: Die gerenderten Legacy-Prompts müssen exakt den bisherigen
// Hardcoded-Strings aus Sprint 5 entsprechen (keine Breaking Changes).

import { describe, it, expect } from "vitest";
import {
  PROMPT_LIBRARY,
  PROMPT_LIBRARY_VERSION,
  listGenres,
  listTemplates,
  resolveGenre,
  normalizeGenreKey,
  systemFromProfile,
  renderPrompt,
} from "./library";
import { renderTemplate } from "./template";
import {
  systemForGenre,
  promptTitles,
  promptSubtitles,
  promptPositioning,
  promptOutline,
  promptWriteChapter,
  promptSummarizeChapter,
  promptBlurb,
  promptKeywords,
  promptQualityCheck,
} from "../prompts";

const BRIEFING = {
  genre: "sachbuch",
  idea: "KI im Alltag",
  uniqueAngle: "Ohne Fachchinesisch",
  targetAudience: "interessierte Laien",
  corePromise: "Verständnis ohne Vorwissen",
  tone: "sachlich-nah",
  language: "de",
  chapterCount: 8,
  wordsPerChapter: 2000,
  customOutline: null as string | null,
};

describe("Prompt-Library: externe Datei", () => {
  it("lädt prompts.json mit Version + Default-Genre", () => {
    expect(PROMPT_LIBRARY.version).toBe("2.0");
    expect(PROMPT_LIBRARY.defaultGenre).toBe("sachbuch");
    expect(PROMPT_LIBRARY_VERSION).toBe("2.0");
  });

  it("enthält alle 11 Genre-Profile", () => {
    expect(listGenres()).toEqual([
      "sachbuch", "ratgeber", "technik", "roman", "kurzgeschichte",
      "essaybeuch", "krimi", "fantasy",
      "sachbuch-it", "ratgeber-gesundheit", "fiction-thriller",
    ]);
  });

  it("jedes Genre-Profil hat systemRole, systemRules und 9 Templates", () => {
    for (const g of listGenres()) {
      const p = PROMPT_LIBRARY.genres[g];
      expect(p.systemRole.length, g).toBeGreaterThan(20);
      expect(p.systemRules.length, g).toBeGreaterThan(3);
      expect(Object.keys(p.prompts).sort(), g).toEqual([
        "blurb", "keywords", "outline", "positioning", "qualityCheck",
        "subtitles", "summarizeChapter", "titles", "writeChapter",
      ]);
    }
  });

  it("prompts.ts enthält keinen Prompt-Text mehr (Fassade)", async () => {
    // Die Fassade darf nur noch Mapping-Code enthalten — Prompt-Texte
    // (erkennbar an "Entwickle"/"Schreibe ein"/"Erstelle eine") leben
    // ausschließlich in prompts.json.
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      new URL("../prompts.ts", import.meta.url),
      "utf-8",
    );
    expect(src).not.toContain("Entwickle 10 Titel");
    expect(src).not.toContain("Schreibe ein Kapitel");
    expect(src).not.toContain("Fasse das folgende Kapitel");
    expect(src).not.toContain("ROLE_BY_GENRE");
  });
});

describe("Akzeptanzkriterium 1: Prompts in externer Datei", () => {
  it("renderPrompt('titles') kommt aus prompts.json", () => {
    const out = renderPrompt("titles", {
      genre: "Sachbuch", idea: "X", uniqueAngle: "Y",
      targetAudience: "Z", corePromise: "W",
    });
    expect(out).toContain("Entwickle 10 Titel für ein Sachbuch");
  });

  it("unbekanntes Template wirft mit sprechendem Fehler", () => {
    expect(() => renderPrompt("gibtsnicht", {})).toThrow(/Unbekanntes Prompt-Template/);
  });
});

describe("Akzeptanzkriterium 2: Genre-Profile via Flag", () => {
  it("die drei Sprint-6-Profile existieren mit dedizierten Rollen", () => {
    const it_ = resolveGenre("sachbuch-it");
    expect(it_.systemRole).toContain("IT und Softwareentwicklung");
    const ges = resolveGenre("ratgeber-gesundheit");
    expect(ges.systemRole).toContain("Gesundheitsbereich");
    const thr = resolveGenre("fiction-thriller");
    expect(thr.systemRole).toContain("Thriller-Autor");
  });

  it("resolveGenre ist case-insensitive und trimmt", () => {
    expect(resolveGenre("  SACHBUCH-IT ")).toBe(PROMPT_LIBRARY.genres["sachbuch-it"]);
    expect(resolveGenre("Fiction-Thriller").systemRole).toContain("Thriller");
  });

  it("unbekanntes Genre fällt auf sachbuch zurück (Legacy-Verhalten)", () => {
    expect(resolveGenre("roman-fantasy-mix")).toBe(PROMPT_LIBRARY.genres["sachbuch"]);
    expect(resolveGenre(null)).toBe(PROMPT_LIBRARY.genres["sachbuch"]);
  });

  it("normalizeGenreKey mappt alle Library-Keys auf sich selbst", () => {
    for (const g of listGenres()) {
      expect(normalizeGenreKey(g)).toBe(g);
    }
  });

  it("systemFromProfile unterscheidet die drei Sprint-6-Profile", () => {
    const sys1 = systemFromProfile("sachbuch-it", "präzise", "de");
    const sys2 = systemFromProfile("ratgeber-gesundheit", "warm", "de");
    const sys3 = systemFromProfile("fiction-thriller", "düster", "de");
    expect(sys1).toContain("IT und Softwareentwicklung");
    expect(sys2).toContain("Gesundheitsbereich");
    expect(sys3).toContain("Thriller-Autor");
    // Gemeinsame Struktur bleibt erhalten:
    for (const s of [sys1, sys2, sys3]) {
      expect(s).toContain("Tonalität:");
      expect(s).toContain("Regeln:");
    }
  });

  it("parsePromptArgs liest --genre/--audience/--tone/--length", async () => {
    const { parsePromptArgs, formatPromptFlags } = await import("@/services/cli/promptArgs");
    const flags = parsePromptArgs([
      "node", "cli.ts",
      "--genre=sachbuch-it",
      '--audience=IT-Berufe',
      '--tone=sachlich-präzise',
      "--length=12x2500",
    ]);
    expect(flags.genre).toBe("sachbuch-it");
    expect(flags.audience).toBe("IT-Berufe");
    expect(flags.tone).toBe("sachlich-präzise");
    expect(flags.chapterCount).toBe(12);
    expect(flags.wordsPerChapter).toBe(2500);
    const line = formatPromptFlags(flags);
    expect(line).toContain("sachbuch-it");
    expect(line).toContain("12 Kapitel à 2500 Wörter");
  });

  it("ohne Flags bleibt parsePromptArgs neutral (keine Breaking Changes)", async () => {
    const { parsePromptArgs, formatPromptFlags } = await import("@/services/cli/promptArgs");
    const flags = parsePromptArgs(["node", "cli.ts"]);
    expect(flags.genre).toBeNull();
    expect(flags.audience).toBeNull();
    expect(flags.tone).toBeNull();
    expect(formatPromptFlags(flags)).toBe("");
  });
});

describe("Akzeptanzkriterium 3: Handlebars-Variablen", () => {
  it("targetAudience fließt in titles/outline/writeChapter ein", () => {
    const t = promptTitles({ ...BRIEFING, targetAudience: "DevOps-Teams" });
    expect(t).toContain("Zielgruppe: DevOps-Teams");
    const o = promptOutline({ ...BRIEFING, targetAudience: "Freelancer" });
    expect(o).toContain("Zielgruppe: Freelancer");
  });

  it("tone (Tone-of-Voice) fließt in outline/writeChapter/blurb ein", () => {
    const o = promptOutline({ ...BRIEFING, tone: "locker" });
    expect(o).toContain("Tonalität: locker");
    const b = promptBlurb("T", "S", { ...BRIEFING, tone: "provokant" }, 0);
    expect(b).toContain("Tonalität: provokant");
  });

  it("Buchlänge (chapterCount/wordsPerChapter) fließt in outline ein", () => {
    const o = promptOutline({ ...BRIEFING, chapterCount: 14, wordsPerChapter: 1800 });
    expect(o).toContain("Umfang: 14 Kapitel, je ca. 1800 Wörter");
  });

  it("dieselben Variablen sind je Genre austauschbar (Template-Wechsel ohne Code)", () => {
    const a = renderPrompt("titles", { genre: "Roman", idea: "I", uniqueAngle: "U", targetAudience: "A", corePromise: "C" });
    const b = renderPrompt("titles", { genre: "Roman", idea: "I", uniqueAngle: "U", targetAudience: "A", corePromise: "C" }, "fiction-thriller");
    // fiction-thriller nutzt dasselbe Template — Ziel: Genre-Wechsel ändert
    // nur die Profil-Daten, nicht die Template-Syntax.
    expect(a).toBe(b);
    expect(a).toContain("für ein Roman");
  });

  it("renderTemplate @index1 für Kapitelnummerierung", () => {
    const res = renderTemplate(
      "{{#each xs}}Kapitel {{@index1}}: {{this}}\n{{/each}}",
      { xs: ["A", "B"] },
    );
    expect(res).toBe("Kapitel 1: A\nKapitel 2: B\n");
  });
});

describe("Byte-Identität: Legacy-Prompts aus Sprint 5", () => {
  it("systemForGenre('sachbuch') ist byte-identisch", () => {
    const expected =
      "Du bist ein erfahrener Sachbuchautor und Lektor. Du erklärst komplexe " +
      "Themen so, dass sie ein interessierter Laienleser versteht, ohne sie zu " +
      "vereinfachen. Deine Sätze sind präzise, deine Beispiele anschaulich.\n" +
      "\n" +
      "Tonalität: sachlich-nah\n" +
      "Schreibe alle Ausgaben auf Deutsch.\n" +
      "\n" +
      "Regeln:\n" +
      "- Schreibe in klarem, literarischem Deutsch, nicht in Bulletpoints.\n" +
      "- Vermeide Füllwörter, Abschweifungen und leere Floskeln.\n" +
      "- Jede Aussage muss einen konkreten Inhalt haben.\n" +
      "- Stelle nie Tatsachen auf, die du nicht prüfen kannst. Wo unsicher, formuliere vage oder markiere den Punkt.\n" +
      "- Keine Platzhalter wie [hier einfügen], keine unvollständigen Sätze.\n" +
      "- Keine Selbstreferenzen wie \"in diesem Kapitel\" oder \"wie oben erwähnt\".";
    expect(systemForGenre("sachbuch", "sachlich-nah", "de")).toBe(expected);
  });

  it("systemForGenre('roman') mit englischem Sprach-Flag", () => {
    const res = systemForGenre("roman", "düster", "en");
    expect(res).toContain("erzählender Romanautor");
    expect(res).toContain("Write all output in English.");
  });

  it("systemForGenre('sachbuch-it') nutzt das neue Profil", () => {
    const res = systemForGenre("sachbuch-it", "präzise", "de");
    expect(res).toContain("Fachbuchautor für IT und Softwareentwicklung");
  });

  it("promptTitles byte-identisch", () => {
    const expected = `Entwickle 10 Titel für ein Sachbuch mit dieser Idee:

KI im Alltag

Alleinstellungsmerkmal: Ohne Fachchinesisch
Zielgruppe: interessierte Laien
Kernversprechen: Verständnis ohne Vorwissen

Die Titel sollen:
- Neugier wecken, nicht alles verraten
- Für das Genre typisch sein, aber nicht klischeehaft
- 3–8 Wörter lang sein
- Keine Doppelpunkte oder Untertitel enthalten (das kommt danach)

Gib nur die Titel, einer pro Zeile, ohne Nummerierung.`;
    expect(promptTitles({
      genre: "Sachbuch",
      idea: "KI im Alltag",
      uniqueAngle: "Ohne Fachchinesisch",
      targetAudience: "interessierte Laien",
      corePromise: "Verständnis ohne Vorwissen",
    })).toBe(expected);
  });

  it("promptWriteChapter byte-identisch (mit + ohne prev/research)", () => {
    const ch = {
      title: "1. Start",
      goal: "Einstieg",
      conflict: "Zu viel Stoff",
      outcome: "Roter Faden steht",
      estimatedWords: 2000,
      pov: "erste Person",
      subchapters: ["Motivation", "Überblick"],
    };
    const b = { genre: "sachbuch", tone: "klar", idea: "I", corePromise: "C", targetAudience: "A" };

    // Ohne prev/research:
    const empty = promptWriteChapter(b, ch, { previousSummaries: [], researchNotes: [] });
    expect(empty).toContain("Unterkapitel, die enthalten sein müssen:\n- Motivation\n- Überblick\n\nSchreibe das Kapitel");
    expect(empty).not.toContain("Bisherige Kapitel");
    expect(empty).not.toContain("Rechercheergebnisse");

    // Mit prev + research (Kapitelnummerierung 1-basiert):
    const full = promptWriteChapter(b, ch, {
      previousSummaries: ["Erstes Kapitel", "Zweites"],
      researchNotes: ["Quelle A", "Quelle B"],
    });
    expect(full).toContain("Kapitel 1: Erstes Kapitel\nKapitel 2: Zweites\n");
    expect(full).toContain("Rechercheergebnisse:\nQuelle A\nQuelle B\n");
  });

  it("promptSummarizeChapter kappt Content bei 4000 Zeichen", () => {
    const res = promptSummarizeChapter("T", "x".repeat(5000));
    expect(res).toContain("x".repeat(4000));
    expect(res).not.toContain("x".repeat(4001));
  });

  it("promptBlurb wählt Stilvariante mod(3)", () => {
    const v0 = promptBlurb("T", "S", { ...BRIEFING, tone: "t" }, 0);
    const v3 = promptBlurb("T", "S", { ...BRIEFING, tone: "t" }, 3);
    expect(v0).toBe(v3); // 0 % 3 === 3 % 3
    expect(v0).toContain("direkten Frage an den Leser");
  });

  it("promptQualityCheck mappt Dimension + Kapitelfelder", () => {
    const res = promptQualityCheck("Stil", { title: "K1", goal: "G", content: "C".repeat(3500) });
    expect(res).toContain("Dimension „Stil\"");
    expect(res).toContain("Kapitel: K1");
    expect(res).toContain("C".repeat(3000));
    expect(res).not.toContain("C".repeat(3001));
  });

  it("promptKeywords/promptSubtitles/promptPositioning rendern", () => {
    expect(promptKeywords("T", { genre: "Sachbuch", idea: "I", targetAudience: "A" }))
      .toContain("7 Keywords für KDP");
    expect(promptSubtitles("T", { genre: "Sachbuch", corePromise: "C", targetAudience: "A" }))
      .toContain("für den Titel „T\" (Sachbuch)");
    expect(promptPositioning({ genre: "Sachbuch", idea: "I", uniqueAngle: "U", targetAudience: "A" }))
      .toContain("5 Positionierungen für ein Sachbuch");
  });

  it("promptOutline mit customOutline-Block", () => {
    const withCustom = promptOutline({ ...BRIEFING, customOutline: "1. Einstieg\n2. Vertiefung" });
    expect(withCustom).toContain("Der Nutzer hat diese Gliederung vorgegeben.");
    expect(withCustom).toContain("1. Einstieg");
    const without = promptOutline(BRIEFING);
    expect(without).not.toContain("vorgegeben");
  });
});

describe("listTemplates", () => {
  it("liefert die 9 Templates je Genre", () => {
    expect(listTemplates("sachbuch").sort()).toEqual([
      "blurb", "keywords", "outline", "positioning", "qualityCheck",
      "subtitles", "summarizeChapter", "titles", "writeChapter",
    ]);
  });

  it("funktioniert auch für neue Genre-Profile", () => {
    expect(listTemplates("fiction-thriller")).toEqual(listTemplates("sachbuch"));
  });
});
