// Strukturprüfung: Kapitel, Überschriften, Umbrüche, Szenentrenner.
//
// Alle Regeln laufen ohne Modell. Schwellwerte sind großzügig gewählt: Ein
// Preflight, das bei jedem Kapitel meckert, wird übergangen — und dann fällt
// der eine echte Blocker auch nicht mehr auf.

import { finding, excerptAround, type PreflightInput, type RawFinding } from "./rules-base";

/** Schwellwerte der Strukturprüfung. */
export const STRUCTURE_LIMITS = {
  /** Kapitel unter dieser Wortzahl sind auffällig kurz. */
  shortChapter: 300,
  /** Kapitel über dieser Wortzahl sind für EPUB/KDP unhandlich. */
  longChapter: 12000,
  /** Ab so vielen Leerzeilen hintereinander wird gemeldet. */
  blankLines: 3,
  /** Ab so vielen aufeinanderfolgenden Umbrüchen im Absatz. */
  hardBreaks: 2,
};

/** Kapitel vorhanden? */
export function ruleNoChapters(input: PreflightInput): RawFinding[] {
  if (input.chapters.length > 0) return [];
  return [
    finding({
      ruleId: "structure.no-chapters",
      category: "structure",
      severity: "blocker",
      kind: "error",
      title: "Das Projekt hat keine Kapitel",
      explanation:
        "Ein Export ohne Kapitel erzeugt eine leere Datei. Alle Formate " +
        "brauchen mindestens ein Kapitel mit Inhalt.",
      recommendation: "Lege in der Seitenleiste ein Kapitel an und schreibe hinein.",
      structureHint: `Projekt „${input.projectName}“: 0 Kapitel`,
    }),
  ];
}

/** Leere Kapitel. */
export function ruleEmptyChapters(input: PreflightInput): RawFinding[] {
  return input.chapters
    .filter((c) => c.text.trim().length === 0)
    .map((c) =>
      finding({
        ruleId: "structure.empty-chapter",
        category: "structure",
        severity: "blocker",
        kind: "error",
        title: `Kapitel „${c.title}“ ist leer`,
        explanation:
          "Leere Kapitel erzeugen im Export eine Überschrift ohne Text. In " +
          "EPUB entsteht dadurch eine leere Seite, die Prüfprogramme monieren.",
        recommendation: "Kapitel füllen oder löschen.",
        structureHint: `Kapitel ${c.orderIndex + 1} von ${input.chapters.length}, 0 Wörter`,
        chapterId: c.id,
      }),
    );
}

/** Kapitel ohne Titel. */
export function ruleUntitledChapters(input: PreflightInput): RawFinding[] {
  return input.chapters
    .filter((c) => !c.title.trim() || /^(kapitel|neues kapitel|unbenannt|ohne titel)\s*\d*$/i.test(c.title.trim()))
    .map((c) =>
      finding({
        ruleId: "structure.untitled-chapter",
        category: "structure",
        severity: "warning",
        kind: "possible",
        title: c.title.trim()
          ? `Kapitel hat einen Platzhaltertitel: „${c.title}“`
          : `Kapitel ${c.orderIndex + 1} hat keinen Titel`,
        explanation:
          "Der Kapiteltitel erscheint im Inhaltsverzeichnis und in der " +
          "EPUB-Navigation. Platzhalter wie „Neues Kapitel“ landen so im " +
          "veröffentlichten Buch.",
        recommendation: "Einen aussagekräftigen Titel vergeben.",
        structureHint: `Kapitel ${c.orderIndex + 1} von ${input.chapters.length}`,
        chapterId: c.id,
      }),
    );
}

/** Doppelte Kapitelüberschriften. */
export function ruleDuplicateTitles(input: PreflightInput): RawFinding[] {
  const seen = new Map<string, string[]>();
  for (const c of input.chapters) {
    const key = c.title.trim().toLowerCase();
    if (!key) continue;
    seen.set(key, [...(seen.get(key) ?? []), c.title]);
  }

  const out: RawFinding[] = [];
  for (const [key, titles] of seen) {
    if (titles.length < 2) continue;
    const affected = input.chapters.filter((c) => c.title.trim().toLowerCase() === key);
    out.push(
      finding({
        ruleId: "structure.duplicate-title",
        category: "structure",
        severity: "warning",
        kind: "possible",
        title: `Kapitelüberschrift „${titles[0]}“ kommt ${titles.length}× vor`,
        explanation:
          "Gleiche Überschriften machen das Inhaltsverzeichnis unbrauchbar: " +
          "Der Leser kann die Einträge nicht unterscheiden. In EPUB erzeugen " +
          "sie zusätzlich mehrdeutige Navigationspunkte.",
        recommendation: "Überschriften eindeutig machen, etwa durch Nummerierung.",
        structureHint: `Betroffen: Kapitel ${affected.map((c) => c.orderIndex + 1).join(", ")}`,
        chapterId: affected[0].id,
      }),
    );
  }
  return out;
}

/**
 * Überschriftenhierarchie innerhalb der Kapitel.
 *
 * Geprüft wird auf Sprünge: Eine H4 direkt unter einer H2 ist für
 * Bildschirmleser und EPUB-Navigation ein Fehler.
 */
export function ruleHeadingHierarchy(input: PreflightInput): RawFinding[] {
  const out: RawFinding[] = [];

  for (const c of input.chapters) {
    let levels: number[];
    try {
      const doc = JSON.parse(c.raw) as { content?: Array<{ type?: string; attrs?: { level?: number } }> };
      levels = (doc.content ?? [])
        .filter((n) => n.type === "heading")
        .map((n) => Number(n.attrs?.level ?? 1));
    } catch {
      continue; // Kein gültiges JSON — andere Regel meldet das.
    }
    if (levels.length < 2) continue;

    for (let i = 1; i < levels.length; i++) {
      const jump = levels[i] - levels[i - 1];
      if (jump > 1) {
        out.push(
          finding({
            ruleId: "structure.heading-jump",
            category: "structure",
            severity: "warning",
            kind: "possible",
            title: `Übersprungene Überschriftenebene in „${c.title}“`,
            explanation:
              `Nach Ebene ${levels[i - 1]} folgt Ebene ${levels[i]}. ` +
              "Übersprungene Ebenen brechen die Dokumentstruktur: Das " +
              "Inhaltsverzeichnis wird falsch verschachtelt, und EPUB-" +
              "Prüfprogramme melden es als Verstoß.",
            recommendation: `Ebene ${levels[i]} auf ${levels[i - 1] + 1} ändern.`,
            structureHint: `Ebenenfolge: ${levels.join(" → ")}`,
            affectedFormats: ["docx", "epub", "pdf"],
            chapterId: c.id,
          }),
        );
        break; // Ein Befund je Kapitel genügt.
      }
    }
  }
  return out;
}

/** Sehr kurze Kapitel. */
export function ruleShortChapters(input: PreflightInput): RawFinding[] {
  // Bei einem Projekt mit nur einem Kapitel ist Kürze keine Auffälligkeit.
  if (input.chapters.length < 2) return [];

  return input.chapters
    .filter((c) => c.wordCount > 0 && c.wordCount < STRUCTURE_LIMITS.shortChapter)
    .map((c) =>
      finding({
        ruleId: "structure.short-chapter",
        category: "structure",
        severity: "hint",
        kind: "possible",
        title: `Kapitel „${c.title}“ ist sehr kurz: ${c.wordCount} Wörter`,
        explanation:
          `Unter ${STRUCTURE_LIMITS.shortChapter} Wörtern wirkt ein Kapitel im ` +
          "gedruckten Buch wie ein Fragment. Als Zwischenspiel oder Prolog kann " +
          "das gewollt sein — dann lasse den Befund als bewusst stehen.",
        recommendation: "Mit einem Nachbarkapitel zusammenlegen oder ausbauen.",
        structureHint: `${c.wordCount} Wörter (Kapitel ${c.orderIndex + 1})`,
        chapterId: c.id,
      }),
    );
}

/** Sehr lange Kapitel. */
export function ruleLongChapters(input: PreflightInput): RawFinding[] {
  return input.chapters
    .filter((c) => c.wordCount > STRUCTURE_LIMITS.longChapter)
    .map((c) =>
      finding({
        ruleId: "structure.long-chapter",
        category: "structure",
        severity: "warning",
        kind: "possible",
        title: `Kapitel „${c.title}“ ist sehr lang: ${c.wordCount.toLocaleString("de-DE")} Wörter`,
        explanation:
          `Über ${STRUCTURE_LIMITS.longChapter.toLocaleString("de-DE")} Wörter je ` +
          "Kapitel wird die EPUB-Datei träge: Lesegeräte laden ein Kapitel als " +
          "Einheit. Auch für den Leser fehlt eine natürliche Pause.",
        recommendation: "In zwei Kapitel oder Abschnitte teilen.",
        structureHint: `${c.wordCount.toLocaleString("de-DE")} Wörter`,
        affectedFormats: ["epub"],
        chapterId: c.id,
      }),
    );
}

/** Mehrfache Leerzeilen. */
export function ruleBlankLines(input: PreflightInput): RawFinding[] {
  const out: RawFinding[] = [];
  const re = new RegExp(`\\n[ \\t]*\\n[ \\t]*(\\n[ \\t]*){${STRUCTURE_LIMITS.blankLines - 2},}`, "g");

  for (const c of input.chapters) {
    const matches = [...c.text.matchAll(re)];
    if (matches.length === 0) continue;
    const first = matches[0];
    out.push(
      finding({
        ruleId: "structure.blank-lines",
        category: "structure",
        severity: "hint",
        kind: "possible",
        title: `${matches.length}× mehrfache Leerzeilen in „${c.title}“`,
        explanation:
          "Leerzeilen als Gestaltungsmittel funktionieren im Export nicht " +
          "zuverlässig: DOCX und EPUB behandeln sie unterschiedlich, PDF " +
          "verschluckt sie am Seitenende ganz.",
        recommendation:
          "Für Szenenwechsel einen sichtbaren Trenner verwenden, etwa * * *.",
        excerpt: excerptAround(c.text, first.index ?? 0, (first.index ?? 0) + 10),
        charStart: first.index ?? null,
        charEnd: first.index !== undefined ? first.index + first[0].length : null,
        affectedFormats: ["docx", "pdf", "epub"],
        chapterId: c.id,
      }),
    );
  }
  return out;
}

/** Uneinheitliche Szenentrenner. */
export function ruleSceneBreaks(input: PreflightInput): RawFinding[] {
  // Gängige Trenner. Erkannt wird eine Zeile, die nur daraus besteht.
  const PATTERNS: Array<{ re: RegExp; label: string }> = [
    { re: /^\s*\*\s*\*\s*\*\s*$/m, label: "* * *" },
    { re: /^\s*\*{3,}\s*$/m, label: "***" },
    { re: /^\s*#\s*#\s*#\s*$/m, label: "# # #" },
    { re: /^\s*-{3,}\s*$/m, label: "---" },
    { re: /^\s*_{3,}\s*$/m, label: "___" },
    { re: /^\s*~{3,}\s*$/m, label: "~~~" },
    { re: /^\s*<>\s*$/m, label: "<>" },
    { re: /^\s*§\s*$/m, label: "§" },
    { re: /^\s*•\s*•\s*•\s*$/m, label: "• • •" },
  ];

  const found = new Map<string, number>();
  const whole = input.chapters.map((c) => c.text).join("\n\n");

  for (const p of PATTERNS) {
    const all = whole.match(new RegExp(p.re.source, "gm"));
    if (all) found.set(p.label, all.length);
  }

  if (found.size < 2) return [];

  const list = [...found.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => `„${label}“ (${n}×)`)
    .join(", ");

  return [
    finding({
      ruleId: "structure.mixed-scene-breaks",
      category: "structure",
      severity: "warning",
      kind: "possible",
      title: `${found.size} verschiedene Szenentrenner im Manuskript`,
      explanation:
        `Verwendet werden: ${list}. Uneinheitliche Trenner fallen im ` +
        "gedruckten Buch sofort auf und wirken unsauber.",
      recommendation: "Einen Trenner wählen und durchgängig verwenden.",
      structureHint: list,
    }),
  ];
}

/** Harte Umbrüche innerhalb von Absätzen. */
export function ruleHardBreaks(input: PreflightInput): RawFinding[] {
  const out: RawFinding[] = [];

  for (const c of input.chapters) {
    let count = 0;
    try {
      const doc = JSON.parse(c.raw) as { content?: Array<{ content?: Array<{ type?: string }> }> };
      for (const node of doc.content ?? []) {
        const breaks = (node.content ?? []).filter((n) => n.type === "hardBreak").length;
        if (breaks >= STRUCTURE_LIMITS.hardBreaks) count++;
      }
    } catch {
      continue;
    }
    if (count === 0) continue;

    out.push(
      finding({
        ruleId: "structure.hard-breaks",
        category: "structure",
        severity: "warning",
        kind: "possible",
        title: `${count} Absätze mit mehreren harten Umbrüchen in „${c.title}“`,
        explanation:
          "Harte Umbrüche (Shift+Enter) statt echter Absätze brechen im " +
          "Export den Textfluss: Bei anderer Schriftgröße stehen die Zeilen " +
          "an unerwarteten Stellen. In EPUB ist die Zeilenlänge variabel, " +
          "manuelle Umbrüche sind dort immer falsch.",
        recommendation: "Absätze mit Enter trennen statt mit Shift+Enter.",
        structureHint: `${count} betroffene Absätze`,
        affectedFormats: ["epub", "pdf", "docx"],
        chapterId: c.id,
      }),
    );
  }
  return out;
}

/** Alle Strukturregeln. */
export const STRUCTURE_RULES = [
  ruleNoChapters,
  ruleEmptyChapters,
  ruleUntitledChapters,
  ruleDuplicateTitles,
  ruleHeadingHierarchy,
  ruleShortChapters,
  ruleLongChapters,
  ruleBlankLines,
  ruleSceneBreaks,
  ruleHardBreaks,
];
