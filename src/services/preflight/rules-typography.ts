// Typografie-Preflight (WP 8.1): Prüfung auf typografische Korrektheit.
//
// Prüft das Manuskript auf:
// - Typografische Anführungszeichen (DE „ " vs EN " " vs FR « »)
// - Bindestrich (-) vs. Gedankenstrich (– / —)
// - Schusterjungen & Hurenkinder (Witwen/Waisen im Blocksatz)
//
// Lokal, kein LLM nötig, deterministisch. Defensive Fallbacks bei fehlenden
// Daten (leere Kapitel, fehlende Texte).

import { finding, excerptAround, type PreflightInput, type RawFinding } from "./rules-base";

// ---------------------------------------------------------------------------
// Anführungszeichen
// ---------------------------------------------------------------------------

/**
 * Prüft auf typografisch korrekte Anführungszeichen.
 *
 * Deutsche Konvention: „Beispiel" (unten-offen, oben-geschlossen)
 * Englische Konvention: "Beispiel" (oben-offen, oben-geschlossen)
 * Französische Konvention: « Beispiel » (mit Leerzeichen)
 *
 * Gemischte Verwendung im selben Kapitel ist ein Hinweis.
 */
export function ruleQuotationMarks(input: PreflightInput): RawFinding[] {
  const out: RawFinding[] = [];

  for (const c of input.chapters) {
    const text = c.text;
    if (!text.trim()) continue;

    // Zähle Anführungszeichen-Typen
    // Deutsche Öffnung „ kann mit deutscher „ oder englischer " Schließung enden
    const germanQuotes = (text.match(/„[^“"]+[“"]/g) || []).length;
    const englishQuotes = (text.match(/"[^"]+"/g) || []).length;
    const frenchQuotes = (text.match(/«[^»]+»/g) || []).length;

    const totalQuotes = germanQuotes + englishQuotes + frenchQuotes;
    if (totalQuotes < 2) continue; // Weniger als 2 = kein Muster

    // Prüfe auf gemischte Verwendung
    const types = [
      { count: germanQuotes, name: "deutsch („…“)" },
      { count: englishQuotes, name: "englisch (\"…\")" },
      { count: frenchQuotes, name: "französisch («…»)" },
    ].filter((t) => t.count > 0);

    if (types.length < 2) continue; // Nur ein Typ = konsistent

    // Gemischte Verwendung gefunden
    const description = types.map((t) => `${t.count}× ${t.name}`).join(", ");
    const firstMixed = text.search(/„[^“]+“|"[^"]+"|«[^»]+»/);

    out.push(
      finding({
        ruleId: "typography.mixed-quotes",
        category: "typography",
        severity: "hint",
        kind: "possible",
        title: `Gemischte Anführungszeichen in „${c.title}“`,
        explanation:
          `Gefunden: ${description}. Die deutsche Konvention verwendet „…“, ` +
          `die englische "…". Gemischte Verwendung wirkt unruhig und deutet auf ` +
          `unterschiedliche Quellen hin.`,
        recommendation:
          "Einheitliche Anführungszeichen verwenden. Für deutsche Texte: „…“. " +
          "Für englische Texte: \"…\". Im Editor können Sie mit Suchen & Ersetzen " +
          "die Zeichen vereinheitlichen.",
        excerpt: firstMixed >= 0 ? excerptAround(text, firstMixed, firstMixed + 20) : null,
        charStart: firstMixed >= 0 ? firstMixed : null,
        charEnd: firstMixed >= 0 ? firstMixed + 20 : null,
        chapterId: c.id,
      }),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Bindestrich vs. Gedankenstrich
// ---------------------------------------------------------------------------

/**
 * Prüft auf korrekte Verwendung von Bindestrich und Gedankenstrich.
 *
 * Bindestrich (-): Worttrennung, z. B. "E-Mail", "zurück-kommen"
 * Gedankenstrich (–): Gedankenpausen, z. B. "Er kam – und ging wieder."
 * Doppelbindestrich (—): Alternative zum Gedankenstrich
 *
 * Ein einfacher Bindestrich (-) anstelle eines Gedankensstrichs (–) ist
 * ein häufiger Fehler.
 */
export function ruleDashes(input: PreflightInput): RawFinding[] {
  const out: RawFinding[] = [];

  for (const c of input.chapters) {
    const text = c.text;
    if (!text.trim()) continue;

    // Suche nach " - " (Leerzeichen-Bindestrich-Leerzeichen)
    // Das ist oft ein falsch verwendeter Gedankenstrich
    const correctDashes = text.match(/[–—]/g) || [];
    const simpleDashes = text.match(/ - /g) || [];

    // Wenn es bereits korrekte Gedankenstriche gibt, aber auch einfache Bindestriche
    // im gleichen Kontext, ist das ein Hinweis
    if (correctDashes.length > 0 && simpleDashes.length > 0) {
      const firstSimple = text.indexOf(" - ");

      out.push(
        finding({
          ruleId: "typography.mixed-dashes",
          category: "typography",
          severity: "hint",
          kind: "possible",
          title: `Gemischte Striche in „${c.title}“`,
          explanation:
            `Gefunden: ${correctDashes.length}× Gedankenstrich (–/—), ` +
            `${simpleDashes.length}× einfacher Bindestrich (-) mit Leerzeichen. ` +
            `Ein einfacher Bindestrich mit Leerzeichen ist oft ein falsch ` +
            `verwendeter Gedankenstrich.`,
          recommendation:
            "Gedankenstriche mit – oder — schreiben, nicht mit - . " +
            "Bindestriche nur für Worttrennungen (z. B. E-Mail) verwenden.",
          excerpt: firstSimple >= 0 ? excerptAround(text, firstSimple, firstSimple + 20) : null,
          charStart: firstSimple >= 0 ? firstSimple : null,
          charEnd: firstSimple >= 0 ? firstSimple + 20 : null,
          chapterId: c.id,
        }),
      );
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Schusterjungen & Hurenkinder
// ---------------------------------------------------------------------------

/**
 * Prüft auf Schusterjungen und Hurenkinder.
 *
 * Schusterjunge: Eine einzelne Zeile eines Absatzes am Ende einer Seite.
 * Hurenkind: Eine einzelne Zeile eines Absatzes am Anfang einer Seite.
 *
 * Diese Prüfung ist eine Heuristik: Wir prüfen auf sehr kurze Absätze
 * (1-2 Wörter), die am Ende eines längeren Textes stehen könnten.
 *
 * Hinweis: Diese Prüfung ist nur eine Einschätzung. Die tatsächliche
 * Seitenaufteilung hängt von Schriftgröße, Seitenformat und Rändern ab.
 */
export function ruleWidowsAndOrphans(input: PreflightInput): RawFinding[] {
  const out: RawFinding[] = [];

  for (const c of input.chapters) {
    const text = c.text;
    if (!text.trim()) continue;

    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
    if (paragraphs.length < 3) continue; // Zu kurz für sinnvolle Prüfung

    // Prüfe den letzten Absatz
    const lastPara = paragraphs[paragraphs.length - 1].trim();
    const lastWords = lastPara.split(/\s+/).filter(Boolean);

    // Schusterjunge: letzter Absatz hat nur 1-2 Wörter
    if (lastWords.length > 0 && lastWords.length <= 2) {
      out.push(
        finding({
          ruleId: "typography.possible-widow",
          category: "typography",
          severity: "hint",
          kind: "possible",
          title: `Möglicher Schusterjunge in „${c.title}“`,
          explanation:
            `Der letzte Absatz hat nur ${lastWords.length} Wort(e): „${lastPara}“. ` +
            `Dies kann im Blocksatz als einzelne Zeile am Seitenende erscheinen ` +
            `(Schusterjunge).`,
          recommendation:
            "Den letzten Absatz verlängern oder kürzen, damit er nicht als " +
            "einzelne Zeile endet. Alternativ: Absatz mit dem vorherigen zusammenführen.",
          excerpt: lastPara,
          chapterId: c.id,
        }),
      );
    }

    // Prüfe den ersten Absatz
    const firstPara = paragraphs[0].trim();
    const firstWords = firstPara.split(/\s+/).filter(Boolean);

    // Hurenkind: erster Absatz hat nur 1-2 Wörter
    if (firstWords.length > 0 && firstWords.length <= 2) {
      out.push(
        finding({
          ruleId: "typography.possible-orphan",
          category: "typography",
          severity: "hint",
          kind: "possible",
          title: `Mögliches Hurenkind in „${c.title}“`,
          explanation:
            `Der erste Absatz hat nur ${firstWords.length} Wort(e): „${firstPara}“. ` +
            `Dies kann im Blocksatz als einzelne Zeile am Seitenanfang erscheinen ` +
            `(Hurenkind).`,
          recommendation:
            "Den ersten Absatz verlängern oder kürzen, damit er nicht als " +
            "einzelne Zeile beginnt.",
          excerpt: firstPara,
          chapterId: c.id,
        }),
      );
    }
  }

  return out;
}

/** Alle Typografie-Regeln. */
export const TYPOGRAPHY_RULES = [
  ruleQuotationMarks,
  ruleDashes,
  ruleWidowsAndOrphans,
];
