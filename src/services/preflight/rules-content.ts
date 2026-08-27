// Frontmatter, Backmatter und Zeichenprüfung.
//
// Frontmatter/Backmatter sind optional prüfbar: Nicht jedes Projekt ist ein
// KDP-Buch. Die Regeln laufen nur, wenn der Autor sie eingeschaltet hat.

import { finding, excerptAround, describeChar, type PreflightInput, type RawFinding } from "./rules-base";

// ---------------------------------------------------------------------------
//  Frontmatter
// ---------------------------------------------------------------------------

/** Schlüsselwörter, an denen Frontmatter-Teile erkannt werden. */
const FRONTMATTER_MARKERS = {
  title: {
    label: "Titelseite",
    words: ["titelseite", "titel", "haupttitel", "schmutztitel"],
    why:
      "KDP erzeugt das Cover separat, aber die Titelseite im Buchinneren " +
      "erwartet der Leser. Ohne sie beginnt das Buch abrupt mit Kapitel 1.",
  },
  imprint: {
    label: "Impressum",
    words: ["impressum", "copyright", "urheberrecht", "alle rechte", "isbn", "herausgeber"],
    why:
      "Ein Impressum ist bei Veröffentlichung in Deutschland vorgeschrieben. " +
      "Es enthält üblicherweise Name, Anschrift, Jahr und Rechtevorbehalt.",
  },
  toc: {
    label: "Inhaltsverzeichnis",
    words: ["inhaltsverzeichnis", "inhalt", "übersicht", "kapitelübersicht"],
    why:
      "Bei Sachbüchern erwarten Leser ein Inhaltsverzeichnis. EPUB erzeugt " +
      "zusätzlich eine eigene Navigation aus den Kapitelüberschriften.",
  },
} as const;

/**
 * Prüft, ob Frontmatter-Teile vorhanden sind.
 *
 * Gesucht wird in Kapiteltiteln und in den ersten beiden Kapiteln — dort
 * steht Frontmatter üblicherweise. Eine Erwähnung mitten im Roman zählt nicht.
 */
export function ruleFrontmatter(input: PreflightInput): RawFinding[] {
  if (!input.checkFrontmatter || input.chapters.length === 0) return [];

  const front = input.chapters.slice(0, 3);
  const haystack = [
    ...input.chapters.map((c) => c.title.toLowerCase()),
    ...front.map((c) => c.text.slice(0, 2000).toLowerCase()),
  ].join("\n");

  const out: RawFinding[] = [];

  for (const [key, def] of Object.entries(FRONTMATTER_MARKERS)) {
    const present = def.words.some((w) => haystack.includes(w));
    if (present) continue;

    out.push(
      finding({
        ruleId: `frontmatter.missing-${key}`,
        category: "frontmatter",
        severity: key === "imprint" ? "warning" : "hint",
        kind: "possible",
        title: `${def.label} nicht gefunden`,
        explanation:
          `${def.why} Gesucht wurde in den Kapiteltiteln und am Anfang der ` +
          "ersten Kapitel.",
        recommendation:
          `Ein Kapitel „${def.label}“ vor dem ersten Textkapitel anlegen. ` +
          "Wenn du bewusst darauf verzichtest, markiere den Befund als bewusst.",
        structureHint: `Geprüft: Kapiteltitel und Anfang der ersten ${front.length} Kapitel`,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
//  Backmatter
// ---------------------------------------------------------------------------

const BACKMATTER_MARKERS = {
  author: {
    label: "Autorenseite",
    words: ["über den autor", "über die autorin", "zum autor", "zur autorin", "vita", "biografie"],
    why:
      "Eine Autorenseite am Buchende ist die wirksamste Stelle für " +
      "Leserbindung: Wer bis hierhin gelesen hat, interessiert sich für dich.",
  },
  moreBooks: {
    label: "Weitere Bücher",
    words: ["weitere bücher", "weitere titel", "mehr von", "ebenfalls erschienen", "auch erschienen"],
    why:
      "Ein Hinweis auf weitere Titel am Buchende erhöht den Absatz der " +
      "übrigen Bücher messbar. Bei einem Erstlingswerk entfällt das.",
  },
  contact: {
    label: "Hinweis oder Kontakt",
    words: ["kontakt", "newsletter", "webseite", "website", "danksagung", "feedback", "rezension"],
    why:
      "Eine Kontaktmöglichkeit oder ein Rezensionshinweis am Ende gibt dem " +
      "Leser einen nächsten Schritt.",
  },
} as const;

/** Prüft Backmatter in den letzten Kapiteln. */
export function ruleBackmatter(input: PreflightInput): RawFinding[] {
  if (!input.checkBackmatter || input.chapters.length === 0) return [];

  const back = input.chapters.slice(-3);
  const haystack = [
    ...input.chapters.map((c) => c.title.toLowerCase()),
    ...back.map((c) => c.text.slice(-2000).toLowerCase()),
  ].join("\n");

  const out: RawFinding[] = [];

  for (const [key, def] of Object.entries(BACKMATTER_MARKERS)) {
    if (def.words.some((w) => haystack.includes(w))) continue;

    out.push(
      finding({
        ruleId: `backmatter.missing-${key}`,
        category: "backmatter",
        severity: "hint",
        kind: "possible",
        title: `${def.label} nicht gefunden`,
        explanation: `${def.why} Gesucht wurde in den Kapiteltiteln und am Ende der letzten Kapitel.`,
        recommendation: `Ein Kapitel „${def.label}“ nach dem letzten Textkapitel anlegen.`,
        structureHint: `Geprüft: Kapiteltitel und Ende der letzten ${back.length} Kapitel`,
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
//  Zeichen und Steuerzeichen
// ---------------------------------------------------------------------------

/**
 * Unsichtbare und problematische Zeichen.
 *
 * Diese landen typischerweise beim Kopieren aus Webseiten, PDFs oder anderen
 * Textverarbeitungen im Manuskript. Im Export führen sie zu falschen
 * Umbrüchen, fehlenden Leerzeichen oder Darstellungsfehlern.
 */
const PROBLEM_CHARS = [
  "\u00a0", // geschütztes Leerzeichen
  "\u200a", // Haarspatium
  "\u200b", // Nullbreiten-Leerzeichen
  "\u200c",
  "\u200d",
  "\u200e",
  "\u200f",
  "\u202f", // schmales geschütztes Leerzeichen
  "\u2060",
  "\ufeff", // Byte-Order-Markierung
  "\u00ad", // bedingter Trennstrich
  "\u2028", // Zeilentrenner
  "\u2029", // Absatztrenner
  "\u000b",
  "\u000c",
];

/** Findet unsichtbare Zeichen und zählt sie je Art. */
export function ruleInvisibleChars(input: PreflightInput): RawFinding[] {
  const out: RawFinding[] = [];

  for (const c of input.chapters) {
    const counts = new Map<string, number>();
    let firstIndex = -1;

    for (let i = 0; i < c.text.length; i++) {
      const ch = c.text[i];
      if (PROBLEM_CHARS.includes(ch)) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
        if (firstIndex < 0) firstIndex = i;
      }
    }
    if (counts.size === 0) continue;

    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const list = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([ch, n]) => `${describeChar(ch)} ×${n}`)
      .join(", ");

    out.push(
      finding({
        ruleId: "characters.invisible",
        category: "characters",
        severity: "warning",
        kind: "possible",
        title: `${total} unsichtbare Zeichen in „${c.title}“`,
        explanation:
          `Gefunden: ${list}. Solche Zeichen entstehen beim Kopieren aus ` +
          "Webseiten oder PDFs. Sie sind im Editor nicht zu sehen, führen im " +
          "Export aber zu falschen Umbrüchen oder fehlenden Leerzeichen.",
        recommendation:
          "Betroffene Stellen neu tippen statt einzufügen, oder den Text " +
          "einmal über einen reinen Texteditor führen.",
        excerpt: firstIndex >= 0 ? excerptAround(c.text, firstIndex, firstIndex + 1) : null,
        structureHint: list,
        charStart: firstIndex >= 0 ? firstIndex : null,
        charEnd: firstIndex >= 0 ? firstIndex + 1 : null,
        chapterId: c.id,
      }),
    );
  }
  return out;
}

/**
 * Findet mögliche Reste aus Arbeitsnotizen.
 *
 * Bewusst konservativ: Nur Marker, die kein normaler Prosatext enthält.
 * Ein Werkzeug, das „TODO" in einem Dialog als Fehler meldet, wird abgeschaltet.
 */
const NOTE_MARKERS = [
  /\bTODO\b/,
  /\bFIXME\b/,
  /\bXXX\b/,
  /\bHIER WEITER\b/i,
  /\[\s*(einfügen|ergänzen|prüfen|recherchieren|nachtragen)\s*\]/i,
  /\?{3,}/,
  /\bLorem ipsum\b/i,
  /\bPlatzhalter\b/i,
  /\bBLABLA\b/i,
];

export function ruleWorkNotes(input: PreflightInput): RawFinding[] {
  const out: RawFinding[] = [];

  for (const c of input.chapters) {
    for (const re of NOTE_MARKERS) {
      const m = re.exec(c.text);
      if (!m) continue;

      out.push(
        finding({
          ruleId: "characters.work-notes",
          category: "characters",
          severity: "warning",
          kind: "possible",
          title: `Mögliche Arbeitsnotiz in „${c.title}“: ${m[0]}`,
          explanation:
            "Diese Markierung sieht nach einer Notiz an dich selbst aus. Im " +
            "veröffentlichten Buch wäre sie peinlich. Steht sie bewusst im " +
            "Text, markiere den Befund als bewusst.",
          recommendation: "Stelle prüfen und die Markierung entfernen.",
          excerpt: excerptAround(c.text, m.index, m.index + m[0].length),
          charStart: m.index,
          charEnd: m.index + m[0].length,
          chapterId: c.id,
        }),
      );
      break; // Ein Befund je Kapitel genügt als Hinweis.
    }
  }
  return out;
}

/**
 * Prüft die Absatzlogik auf Einheitlichkeit.
 *
 * Gemischte Einrückung (Tabulatoren, führende Leerzeichen) und gemischte
 * Absatztrennung führen im Export zu unruhigem Satz.
 */
export function ruleParagraphLogic(input: PreflightInput): RawFinding[] {
  const out: RawFinding[] = [];

  for (const c of input.chapters) {
    const lines = c.text.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 4) continue;

    const withTab = lines.filter((l) => /^\t/.test(l)).length;
    const withSpaces = lines.filter((l) => /^ {2,}/.test(l)).length;
    const plain = lines.length - withTab - withSpaces;

    // Nur melden, wenn wirklich gemischt wird — nicht bei durchgängiger
    // Einrückung, die eine bewusste Gestaltungsentscheidung sein kann.
    const styles = [withTab, withSpaces, plain].filter((n) => n > 0).length;
    if (styles < 2) continue;

    out.push(
      finding({
        ruleId: "characters.mixed-indent",
        category: "characters",
        severity: "hint",
        kind: "possible",
        title: `Uneinheitliche Einrückung in „${c.title}“`,
        explanation:
          `${withTab} Absätze mit Tabulator, ${withSpaces} mit Leerzeichen, ` +
          `${plain} ohne Einrückung. Im Export wird daraus unruhiger Satz, ` +
          "weil jedes Format Einrückungen anders behandelt.",
        recommendation:
          "Einrückung im Editor nicht von Hand setzen. Der Export erzeugt sie " +
          "einheitlich aus der Absatzformatierung.",
        structureHint: `Tabulator ${withTab}, Leerzeichen ${withSpaces}, ohne ${plain}`,
        affectedFormats: ["docx", "pdf", "epub"],
        chapterId: c.id,
      }),
    );
  }
  return out;
}

/** Alle Inhalts- und Zeichenregeln. */
export const CONTENT_RULES = [
  ruleFrontmatter,
  ruleBackmatter,
  ruleInvisibleChars,
  ruleWorkNotes,
  ruleParagraphLogic,
];
