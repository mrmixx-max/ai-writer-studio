// Print-Preflight (WP 8.1): Buch-Titelei & Print-Layout-Prüfung.
//
// Lokal, deterministisch, ohne LLM. Der Service prüft Manuskripttext auf
// typografische Fehler (Anführungszeichen, Bindestrich vs. Gedankenstrich)
// und auf Satzfehler (Schusterjungen/Hurenkinder) und erzeugt die
// rechtssicheren Titelei-Bausteine (Impressum, Titelblatt) als Klartext.
//
// Entwurfsregeln:
// - Reine Funktionen, kein IO, keine Zufallswerte, keine LLM-Aufrufe.
// - Defensiv: leere/fehlende Eingaben liefern leere Ergebnisse bzw. Fallbacks,
//   die Funktionen werfen nie.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Art eines typografischen Befunds. */
export type TypographyIssueType = "quotation_mark" | "dash" | "other";

/** Ein typografischer Befund in einem Fließtext. */
export interface TypographyIssue {
  type: TypographyIssueType;
  /** Zeichen-Offset im übergebenen Text (0-basiert). */
  position: number;
  message: string;
  suggestion: string;
}

/** Art eines Satzfehlers (Schusterjunge/Hurenkind). */
export type WidowOrphanIssueType = "widow" | "orphan";

/**
 * Ein möglicher Satzfehler.
 *
 * widow  = Schusterjunge: allein stehende letzte Zeile eines Absatzes.
 * orphan = Hurenkind: allein stehende erste Zeile eines Absatzes.
 */
export interface WidowOrphanIssue {
  type: WidowOrphanIssueType;
  /** 1-basierte Zeilennummer im übergebenen Text. */
  lineNumber: number;
  /** Inhalt der betroffenen Zeile (getrimmt). */
  text: string;
}

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Deutsches öffnendes Anführungszeichen. */
const GERMAN_OPEN = "„";
/** Deutsches schließendes Anführungszeichen. */
const GERMAN_CLOSE = "“";
/** Halbgeviertstrich (deutscher Gedankenstrich). */
const EN_DASH = "–";
/** Geviertstrich (englischer Gedankenstrich / em dash). */
const EM_DASH = "—";
/** Auslassungszeichen (Ellipse). */
const ELLIPSIS = "…";

/**
 * Zeichen, nach denen ein gerades Anführungszeichen als *öffnend* gilt
 * (Textanfang, Leerraum, öffnende Klammer, bereits gesetztes Anführungszeichen
 * oder ein Gedankenstrich). Sonst wird es als *schließend* gewertet.
 */
const OPENING_CONTEXT = /[\s([{„«–—-]/;

/**
 * Höchstzahl Wörter, bis zu der eine Zeile als allein stehend gilt.
 * Klassische Satzregel: eine Seite darf nicht mit einem einzelnen Wort
 * eines Absatzes enden (Schusterjunge) bzw. damit beginnen (Hurenkind).
 */
const WIDOW_ORPHAN_MAX_WORDS = 1;

const FALLBACK_AUTHOR = "Unbekannter Autor";
const FALLBACK_TITLE = "Ohne Titel";

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Liefert einen bereinigten String oder einen Fallback (defensiv). */
function clean(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

/** Zählt Wörter einer Zeile (Leerraum-getrennt). */
function countWords(line: string): number {
  return line.split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// 1) Typografie
// ---------------------------------------------------------------------------

/**
 * Prüft einen Text auf typografische Fehler.
 *
 * Geprüft werden:
 * - gerade Anführungszeichen (`"`) statt deutscher `„…“`
 * - Bindestrich mit Leerzeichen (` - `) bzw. doppelter Bindestrich (`--`)
 *   statt Gedankenstrich (`–` / `—`)
 * - sonstige Satzfehler: mehrfache Leerzeichen, Leerzeichen vor Satzzeichen,
 *   drei Punkte statt Auslassungszeichen
 *
 * Die Befunde sind nach Zeichenposition aufsteigend sortiert und damit
 * deterministisch. Leerer Text liefert ein leeres Ergebnis.
 */
export function checkTypography(text: string): TypographyIssue[] {
  const issues: TypographyIssue[] = [];
  if (typeof text !== "string" || text.length === 0) return issues;

  // --- Anführungszeichen -----------------------------------------------------
  for (let i = 0; i < text.length; i++) {
    if (text.charAt(i) !== '"') continue;
    const opening = i === 0 || OPENING_CONTEXT.test(text.charAt(i - 1));
    issues.push({
      type: "quotation_mark",
      position: i,
      message: 'Gerades Anführungszeichen (") gefunden.',
      suggestion: opening
        ? `Deutsches öffnendes Anführungszeichen verwenden: ${GERMAN_OPEN}`
        : `Deutsches schließendes Anführungszeichen verwenden: ${GERMAN_CLOSE}`,
    });
  }

  // --- Striche ---------------------------------------------------------------
  // " - " (Bindestrich mit Leerzeichen) ist meist ein falscher Gedankenstrich.
  for (const match of text.matchAll(/ - /g)) {
    issues.push({
      type: "dash",
      position: match.index ?? 0,
      message: "Bindestrich (-) mit umgebenden Leerzeichen statt Gedankenstrich.",
      suggestion: `Gedankenstrich verwenden: " ${EN_DASH} ".`,
    });
  }
  // "--" / "---" statt Gedankenstrich.
  for (const match of text.matchAll(/-{2,}/g)) {
    issues.push({
      type: "dash",
      position: match.index ?? 0,
      message: `Doppelter Bindestrich ("${match[0]}") statt Gedankenstrich.`,
      suggestion: `Geviertstrich "${EM_DASH}" oder Halbgeviertstrich "${EN_DASH}" verwenden.`,
    });
  }

  // --- Sonstiges -------------------------------------------------------------
  for (const match of text.matchAll(/ {2,}/g)) {
    issues.push({
      type: "other",
      position: match.index ?? 0,
      message: `${match[0].length} aufeinanderfolgende Leerzeichen.`,
      suggestion: "Ein einzelnes Leerzeichen verwenden.",
    });
  }
  for (const match of text.matchAll(/ +([,.;:!?])/g)) {
    issues.push({
      type: "other",
      position: match.index ?? 0,
      message: `Leerzeichen vor Satzzeichen "${match[1]}".`,
      suggestion: `Leerzeichen entfernen: "${match[1]}".`,
    });
  }
  for (const match of text.matchAll(/\.\.\./g)) {
    issues.push({
      type: "other",
      position: match.index ?? 0,
      message: "Drei Punkte (...) statt Auslassungszeichen.",
      suggestion: `Auslassungszeichen verwenden: "${ELLIPSIS}".`,
    });
  }

  issues.sort((a, b) => a.position - b.position);
  return issues;
}

// ---------------------------------------------------------------------------
// 2) Schusterjungen & Hurenkinder
// ---------------------------------------------------------------------------

/**
 * Prüft einen Text auf mögliche Schusterjungen (widows) und Hurenkinder
 * (orphans).
 *
 * Der Text wird in Zeilen zerlegt; aufeinanderfolgende nicht-leere Zeilen
 * bilden einen Absatz (Leerzeile = Absatzgrenze). Innerhalb eines Absatzes
 * mit mindestens zwei Zeilen gilt:
 * - erste Zeile mit nur einem Wort  → Hurenkind (orphan)
 * - letzte Zeile mit nur einem Wort → Schusterjunge (widow)
 *
 * Einzeilige Absätze werden bewusst nicht gewertet: dort ist kein Umbruch
 * erkennbar, jede kurze Zeile würde sonst als Fehlalarm erscheinen. Das
 * Ergebnis ist deterministisch (Absatz- und Zeilenreihenfolge).
 */
export function checkWidowsAndOrphans(text: string): WidowOrphanIssue[] {
  const issues: WidowOrphanIssue[] = [];
  if (typeof text !== "string" || text.trim().length === 0) return issues;

  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i += 1;
      continue;
    }
    const start = i;
    while (i < lines.length && lines[i].trim() !== "") i += 1;
    const end = i - 1; // inklusiv
    const paragraph = lines.slice(start, end + 1);
    if (paragraph.length < 2) continue;

    const first = paragraph[0].trim();
    if (first.length > 0 && countWords(first) <= WIDOW_ORPHAN_MAX_WORDS) {
      issues.push({ type: "orphan", lineNumber: start + 1, text: first });
    }

    const last = paragraph[paragraph.length - 1].trim();
    if (last.length > 0 && countWords(last) <= WIDOW_ORPHAN_MAX_WORDS) {
      issues.push({ type: "widow", lineNumber: end + 1, text: last });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// 3) Impressum
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein rechtssicheres Impressum als Klartext.
 *
 * Enthalten sind die vier Pflichtbausteine:
 * - Urheberrecht (Copyright-Vermerk + Verwertungsverbot)
 * - Selbstverleger-Angaben (§ 5 DDG, mit auszufüllenden Platzhaltern)
 * - Haftungsausschluss (Haftung für Inhalte und für Links)
 * - EU-Richtlinien-Hinweis (OS-Verordnung (EU) Nr. 524/2013)
 *
 * @param author Name des Selbstverlegers
 * @param title  Buchtitel
 * @param year   Erscheinungsjahr (Default: aktuelles Jahr)
 */
export function generateImpressum(author: string, title: string, year?: number): string {
  const safeAuthor = clean(author, FALLBACK_AUTHOR);
  const safeTitle = clean(title, FALLBACK_TITLE);
  const safeYear =
    typeof year === "number" && Number.isFinite(year)
      ? Math.trunc(year)
      : new Date().getFullYear();

  return [
    "Impressum",
    "",
    safeTitle,
    safeAuthor,
    `Erste Auflage ${safeYear}`,
    "",
    "Urheberrecht",
    `© ${safeYear} ${safeAuthor}. Alle Rechte vorbehalten.`,
    "Dieses Werk einschließlich seiner Inhalte ist urheberrechtlich geschützt.",
    "Jede Verwertung außerhalb der Grenzen des Urheberrechtsgesetzes ist ohne",
    "Zustimmung des Autors unzulässig und strafbar. Das gilt insbesondere für",
    "Vervielfältigungen, Übersetzungen, Mikroverfilmungen sowie die",
    "Einspeicherung und Verarbeitung in elektronischen Systemen.",
    "",
    "Angaben gemäß § 5 DDG (Selbstverleger)",
    "Herausgeber, Verlag und für den Inhalt verantwortlich ist:",
    safeAuthor,
    "[Straße und Hausnummer]",
    "[Postleitzahl und Ort]",
    "[Land]",
    "E-Mail: [E-Mail-Adresse]",
    "Website: [Website-Adresse, optional]",
    "",
    "Haftungsausschluss",
    "Haftung für Inhalte:",
    "Die Inhalte dieses Werkes wurden mit größter Sorgfalt erstellt. Für die",
    "Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch keine",
    "Gewähr übernommen werden. Als Diensteanbieter ist der Autor gemäß § 7",
    "Abs. 1 DDG für eigene Inhalte nach den allgemeinen Gesetzen verantwortlich.",
    "",
    "Haftung für Links:",
    "Dieses Werk enthält gegebenenfalls Verweise auf externe Websites Dritter,",
    "auf deren Inhalte kein Einfluss besteht. Für die Inhalte der verlinkten",
    "Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.",
    "",
    "EU-Richtlinien-Hinweis",
    "Hinweis gemäß Verordnung (EU) Nr. 524/2013 über die Online-Beilegung",
    "verbraucherrechtlicher Streitigkeiten (OS-Verordnung): Die Europäische",
    "Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:",
    "https://ec.europa.eu/consumers/odr",
    "Der Autor ist nicht verpflichtet und nicht bereit, an einem",
    "Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle",
    "teilzunehmen.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// 4) Titelblatt
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine Titelei (Titelblatt) als Klartext.
 *
 * Aufbau: Titel, optionaler Untertitel, Autor. Ohne Untertitel entfällt der
 * entsprechende Block; die Funktion ist rein deterministisch (kein Datum).
 */
export function generateTitlePage(title: string, author: string, subtitle?: string): string {
  const safeTitle = clean(title, FALLBACK_TITLE);
  const safeAuthor = clean(author, FALLBACK_AUTHOR);
  const safeSubtitle = typeof subtitle === "string" ? subtitle.trim() : "";

  const lines: string[] = [safeTitle, ""];
  if (safeSubtitle.length > 0) {
    lines.push(safeSubtitle, "");
  }
  lines.push(`von ${safeAuthor}`);

  return lines.join("\n");
}
