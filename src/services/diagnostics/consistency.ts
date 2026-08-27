// Konsistenzprüfung — regelbasiert, ohne Modell.
//
// Prüft Manuskripttext gegen die im Projekt hinterlegten Figuren- und
// Ortsprofile sowie gegen sich selbst.
//
// Zentrale Unterscheidung, die deine Anforderung verlangt:
//   error       harter Widerspruch, etwa zwei Altersangaben zur selben Figur
//   possible    Auffälligkeit, die Absicht sein kann
//   intentional vom Autor als bewusst markiert
//
// Diese Achse ist unabhängig vom Schweregrad: Eine bewusste Abweichung kann
// durchaus kritisch aussehen. Deshalb zwei Felder statt eines.

import type { AnalyzedText } from "./textmodel";
import { excerptAt } from "./textmodel";
import type { CharacterProfile, LocationProfile } from "@/services/knowledge/profiles";

/** Ein Konsistenzbefund. */
export interface ConsistencyIssue {
  category: "character" | "world" | "timeline" | "pov" | "terminology";
  kind: "error" | "possible";
  /** Kurzbeschreibung. */
  message: string;
  /** Begründung: Was widerspricht was. */
  explanation: string;
  /** Betroffene Entität, etwa der Figurenname. */
  subject: string | null;
  start: number | null;
  end: number | null;
  snippet: string | null;
  /** 0..1 */
  weight: number;
}

// ---------------------------------------------------------------------------
//  Figurenkonsistenz
// ---------------------------------------------------------------------------

/** Zahlwörter, die als Altersangabe auftreten können. */
const NUMBER_WORDS: Record<string, number> = {
  zwanzig: 20, dreißig: 30, vierzig: 40, fünfzig: 50,
  sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90,
};

/** Findet Altersangaben im Umfeld eines Namens. */
function findAgeMentions(
  text: string,
  name: string,
): Array<{ age: number; index: number; snippet: string }> {
  const out: Array<{ age: number; index: number; snippet: string }> = [];
  const nameRe = new RegExp(escapeRe(name), "gi");
  let m: RegExpExecArray | null;

  while ((m = nameRe.exec(text)) !== null) {
    // Fenster um den Namen: 120 Zeichen davor und danach.
    const from = Math.max(0, m.index - 120);
    const to = Math.min(text.length, m.index + name.length + 120);
    const window = text.slice(from, to);

    // "48 Jahre", "achtundvierzigjährig", "mit 48"
    const numeric = window.matchAll(/\b(\d{1,3})\s*(?:Jahre|jährig|Jahren)\b/gi);
    for (const n of numeric) {
      const age = Number(n[1]);
      if (age > 0 && age < 130) {
        out.push({ age, index: from + (n.index ?? 0), snippet: n[0] });
      }
    }

    for (const [word, value] of Object.entries(NUMBER_WORDS)) {
      const wRe = new RegExp(`\\b${word}\\s*(?:Jahre|jährig|Jahren)\\b`, "gi");
      const wm = wRe.exec(window);
      if (wm) out.push({ age: value, index: from + wm.index, snippet: wm[0] });
    }
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Prüft Figurenangaben im Text gegen die Profile.
 *
 * Gefunden werden: widersprüchliche Altersangaben im Text, Abweichungen vom
 * Profil, und Namen, die dem Profil ähneln, aber nicht gleich sind
 * (Tippfehler oder unabsichtliche Umbenennung).
 */
export function checkCharacters(
  a: AnalyzedText,
  characters: CharacterProfile[],
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const c of characters) {
    const mentions = findAgeMentions(a.raw, c.name);

    // Widerspruch innerhalb des Textes.
    const distinct = [...new Set(mentions.map((m) => m.age))];
    if (distinct.length > 1) {
      issues.push({
        category: "character",
        kind: "error",
        message: `Widersprüchliche Altersangaben zu ${c.name}: ${distinct.join(" und ")}`,
        explanation:
          `Im Text stehen ${distinct.length} verschiedene Altersangaben in der Nähe ` +
          `des Namens ${c.name}. Das lässt sich nicht beides stimmen — es sei denn, ` +
          "zwischen den Stellen liegt erzählte Zeit. Prüfe die Zeitlinie.",
        subject: c.name,
        start: mentions[0]?.index ?? null,
        end: mentions[0] ? mentions[0].index + mentions[0].snippet.length : null,
        snippet: mentions.map((m) => m.snippet).join(" / "),
        weight: 0.9,
      });
    }

    // Abweichung vom Profil.
    if (c.age && distinct.length > 0) {
      const profileAge = Number(String(c.age).match(/\d{1,3}/)?.[0] ?? NaN);
      if (!Number.isNaN(profileAge)) {
        const off = distinct.filter((d) => d !== profileAge);
        if (off.length > 0) {
          issues.push({
            category: "character",
            kind: "possible",
            message: `${c.name}: Text nennt ${off.join("/")}, Profil sagt ${profileAge}`,
            explanation:
              `Das Figurenprofil führt ${profileAge} Jahre. Im Text steht ` +
              `${off.join(" bzw. ")}. Entweder ist das Profil veraltet, oder die ` +
              "Textstelle. Bei erzählter Zeitspanne kann beides richtig sein.",
            subject: c.name,
            start: mentions[0]?.index ?? null,
            end: mentions[0] ? mentions[0].index + mentions[0].snippet.length : null,
            snippet: mentions[0]?.snippet ?? null,
            weight: 0.6,
          });
        }
      }
    }

    // Beruf im Profil, aber ein anderer im Text? Nur prüfen, wenn das Profil
    // einen Beruf führt — sonst gibt es keine Referenz.
    if (c.occupation) {
      const occ = c.occupation.toLowerCase();
      const nameIdx = a.raw.toLowerCase().indexOf(c.name.toLowerCase());
      if (nameIdx >= 0 && !a.raw.toLowerCase().includes(occ)) {
        // Das ist keine Beanstandung, nur ein Hinweis — der Beruf muss nicht
        // im Text vorkommen. Deshalb sehr geringes Gewicht und "possible".
        issues.push({
          category: "character",
          kind: "possible",
          message: `Beruf von ${c.name} kommt im Text nicht vor`,
          explanation:
            `Das Profil nennt „${c.occupation}". Im geprüften Text wird das ` +
            "nicht erwähnt. Das ist unproblematisch, solange es an anderer " +
            "Stelle steht — der Hinweis dient nur der Übersicht.",
          subject: c.name,
          start: null,
          end: null,
          snippet: null,
          weight: 0.15,
        });
      }
    }
  }

  return issues;
}

/**
 * Prüft Ortsangaben gegen die Ortsprofile.
 * Meldet Ortsnamen aus Profilen, die im Text in abweichender Schreibweise
 * auftauchen.
 */
export function checkWorld(
  a: AnalyzedText,
  locations: LocationProfile[],
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const lower = a.raw.toLowerCase();

  for (const l of locations) {
    if (!l.name) continue;
    const canonical = l.name.toLowerCase();
    if (lower.includes(canonical)) continue;

    // Ähnliche Schreibweise im Text? Dann liegt vermutlich ein Tippfehler vor.
    const words = lower.match(/\p{L}{4,}/gu) ?? [];
    const near = words.find(
      (w) => w !== canonical && levenshtein(w, canonical) <= 2,
    );

    if (near) {
      const idx = lower.indexOf(near);
      issues.push({
        category: "world",
        kind: "possible",
        message: `Ortsname „${l.name}" erscheint als „${near}"`,
        explanation:
          `Das Ortsprofil führt „${l.name}", im Text steht „${near}". ` +
          "Wahrscheinlich ein Tippfehler oder eine uneinheitliche Schreibweise. " +
          "Ist die Abweichung gewollt, markiere den Befund als bewusst.",
        subject: l.name,
        start: idx,
        end: idx + near.length,
        snippet: excerptAt(a.raw, idx, idx + near.length),
        weight: 0.7,
      });
    }
  }

  return issues;
}

/** Levenshtein-Distanz, für Tippfehler-Erkennung. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

// ---------------------------------------------------------------------------
//  Perspektivkonsistenz
// ---------------------------------------------------------------------------

/**
 * Prüft die Erzählperspektive auf Sprünge.
 *
 * Vorgehen: Für jeden Absatz wird gezählt, ob Ich- oder Er/Sie-Formen
 * überwiegen. Wechselt das Bild mitten im Text, liegt vermutlich ein
 * POV-Sprung vor.
 *
 * Wörtliche Rede wird ausgenommen — dort ist „ich" normal und sagt nichts
 * über die Erzählperspektive. Ohne diese Ausnahme wäre jeder Dialog ein
 * Fehlalarm.
 */
export function checkPointOfView(a: AnalyzedText): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  const FIRST = /\b(ich|mir|mich|mein|meine|meinem|meinen|meiner|wir|uns|unser)\b/gi;
  const THIRD = /\b(er|sie|ihn|ihm|ihr|ihre|ihrem|ihren|seiner|seine|seinen|seinem)\b/gi;

  type Verdict = "first" | "third" | "neutral";
  const perParagraph: Array<{ index: number; verdict: Verdict; start: number }> = [];

  for (const p of a.paragraphs) {
    if (p.isHeading) continue;

    // Nur Erzähltext betrachten: Dialogsätze dieses Absatzes ausschließen.
    const narrative = a.sentences
      .filter((s) => s.paragraphIndex === p.index && !s.isDialogue)
      .map((s) => s.text)
      .join(" ");

    if (!narrative.trim()) continue;

    const first = (narrative.match(FIRST) ?? []).length;
    const third = (narrative.match(THIRD) ?? []).length;

    let verdict: Verdict = "neutral";
    // Deutliche Mehrheit verlangen, sonst ist die Aussage Zufall.
    if (first >= 2 && first > third * 2) verdict = "first";
    else if (third >= 2 && third > first * 2) verdict = "third";

    perParagraph.push({ index: p.index, verdict, start: p.start });
  }

  const decided = perParagraph.filter((x) => x.verdict !== "neutral");
  if (decided.length < 2) return issues;

  // Vorherrschende Perspektive bestimmen.
  const firstCount = decided.filter((x) => x.verdict === "first").length;
  const thirdCount = decided.length - firstCount;
  const dominant: Verdict = firstCount >= thirdCount ? "first" : "third";
  const label = dominant === "first" ? "Ich-Perspektive" : "Er/Sie-Perspektive";
  const otherLabel = dominant === "first" ? "Er/Sie-Form" : "Ich-Form";

  for (const p of decided) {
    if (p.verdict === dominant) continue;
    issues.push({
      category: "pov",
      kind: "possible",
      message: `Perspektivwechsel in Absatz ${p.index + 1}: ${otherLabel}`,
      explanation:
        `Der Text ist überwiegend in ${label} erzählt. Dieser Absatz nutzt die ` +
        `${otherLabel}. Bei mehreren Erzählebenen kann das gewollt sein — dann ` +
        "markiere den Befund als bewusst. Sonst liegt ein Perspektivsprung vor.",
      subject: null,
      start: p.start,
      end: null,
      snippet: excerptAt(a.raw, p.start, p.start + 60),
      weight: 0.65,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
//  Begriffsdrift
// ---------------------------------------------------------------------------

/**
 * Findet wechselnde Begriffe für dieselbe Sache.
 *
 * Erkannt werden zwei Muster:
 *   1. Ähnliche Wörter mit geringer Editierdistanz („Archiv"/„Archief")
 *   2. Uneinheitliche Schreibweise mit und ohne Bindestrich
 *      („Nachtwache"/„Nacht-Wache")
 *
 * Bewusst konservativ: Es werden nur Wörter ab sechs Zeichen betrachtet und
 * nur solche, die mehrfach vorkommen. Sonst würde jede Flexionsform gemeldet.
 */
export function checkTerminology(a: AnalyzedText): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  const counts = new Map<string, number>();
  for (const w of a.raw.match(/\p{Lu}\p{L}{5,}/gu) ?? []) {
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }

  const terms = [...counts.entries()].filter(([, n]) => n >= 2).map(([w]) => w);
  const reported = new Set<string>();

  for (let i = 0; i < terms.length; i++) {
    for (let j = i + 1; j < terms.length; j++) {
      const x = terms[i];
      const y = terms[j];
      const key = [x, y].sort().join("|");
      if (reported.has(key)) continue;

      const dist = levenshtein(x.toLowerCase(), y.toLowerCase());
      // Distanz 1–2 bei ähnlicher Länge: sehr wahrscheinlich dieselbe Sache.
      const lenDiff = Math.abs(x.length - y.length);
      if (dist >= 1 && dist <= 2 && lenDiff <= 2) {
        reported.add(key);
        const idx = a.raw.indexOf(y);
        issues.push({
          category: "terminology",
          kind: "possible",
          message: `Uneinheitliche Begriffe: „${x}" und „${y}"`,
          explanation:
            `Beide Formen kommen mehrfach vor (${counts.get(x)}× und ` +
            `${counts.get(y)}×). Wahrscheinlich ist dieselbe Sache gemeint. ` +
            "Entscheide dich für eine Schreibweise, oder markiere den Befund " +
            "als bewusst, wenn die Varianten Absicht sind.",
          subject: x,
          start: idx >= 0 ? idx : null,
          end: idx >= 0 ? idx + y.length : null,
          snippet: `${x} / ${y}`,
          weight: 0.55,
        });
      }
    }
  }

  // Bindestrich-Varianten desselben Kompositums.
  //
  // Wichtig: Der Vergleich muss ohne Rücksicht auf Groß-/Kleinschreibung
  // erfolgen. "Nacht-Wache" ohne Bindestrich ergibt "NachtWache" mit großem W,
  // im Text steht aber "Nachtwache". Ein direkter Vergleich findet nichts —
  // genau dieser Fehler ist beim Testen aufgefallen.
  const lowerRaw = a.raw.toLowerCase();
  const hyphenated = a.raw.match(/\p{Lu}\p{L}+-\p{Lu}?\p{L}+/gu) ?? [];

  for (const h of new Set(hyphenated)) {
    const joinedLower = h.replace(/-/g, "").toLowerCase();
    const pos = lowerRaw.indexOf(joinedLower);
    if (pos < 0) continue;

    const idx = a.raw.indexOf(h);
    // Die im Text tatsächlich verwendete Schreibweise zeigen, nicht die
    // konstruierte — sonst nennt die Meldung ein Wort, das nirgends steht.
    const actual = a.raw.slice(pos, pos + joinedLower.length);

    issues.push({
      category: "terminology",
      kind: "possible",
      message: `Mit und ohne Bindestrich: „${h}" und „${actual}"`,
      explanation:
        "Dasselbe Wort erscheint in beiden Schreibweisen. Uneinheitliche " +
        "Bindestriche fallen im Druck auf und wirken unsauber.",
      subject: actual,
      start: idx >= 0 ? idx : pos,
      end: (idx >= 0 ? idx : pos) + h.length,
      snippet: `${h} / ${actual}`,
      weight: 0.5,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
//  Zeitlinie
// ---------------------------------------------------------------------------

const MONTHS = [
  "januar", "februar", "märz", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "dezember",
];

/**
 * Prüft Jahresangaben auf Reihenfolge.
 *
 * Konservativ: Gemeldet wird nur, wenn Jahre im Text rückwärts laufen UND
 * kein Rückblick-Signalwort in der Nähe steht. Literatur springt ständig in
 * der Zeit — ohne diese Einschränkung wäre jeder Roman voller Fehlalarme.
 */
export function checkTimeline(a: AnalyzedText): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  const FLASHBACK = /\b(damals|früher|einst|zuvor|davor|erinnerte|Erinnerung|Rückblick|als Kind|vor Jahren|Jahre zuvor|seinerzeit)\b/i;

  const years: Array<{ year: number; index: number; snippet: string }> = [];
  for (const m of a.raw.matchAll(/\b(1[5-9]\d{2}|20[0-4]\d)\b/g)) {
    years.push({ year: Number(m[1]), index: m.index ?? 0, snippet: m[0] });
  }

  for (let i = 1; i < years.length; i++) {
    const prev = years[i - 1];
    const curr = years[i];
    if (curr.year >= prev.year) continue;

    // Fenster vor der Jahresangabe auf Rückblick-Signale prüfen.
    const from = Math.max(0, curr.index - 150);
    const window = a.raw.slice(from, curr.index + 20);
    if (FLASHBACK.test(window)) continue;

    issues.push({
      category: "timeline",
      kind: "possible",
      message: `Jahresangabe läuft zurück: ${prev.year} → ${curr.year}`,
      explanation:
        `Nach ${prev.year} folgt ${curr.year}, ohne dass ein Rückblick ` +
        "angekündigt wird. Bei einem Zeitsprung genügt ein Signalwort wie " +
        "„damals“ oder „Jahre zuvor“ — dann ist der Befund erledigt.",
      subject: null,
      start: curr.index,
      end: curr.index + curr.snippet.length,
      snippet: excerptAt(a.raw, curr.index, curr.index + 4),
      weight: 0.5,
    });
  }

  // Widersprüchliche Monatsangaben im selben Absatz.
  for (const p of a.paragraphs) {
    if (p.isHeading) continue;
    const found = MONTHS.filter((mo) =>
      new RegExp(`\\b${mo}\\b`, "i").test(p.text),
    );
    if (found.length >= 2) {
      issues.push({
        category: "timeline",
        kind: "possible",
        message: `Zwei Monatsangaben in einem Absatz: ${found.join(", ")}`,
        explanation:
          "Mehrere Monate in einem Absatz können auf eine unklare Zeitangabe " +
          "hindeuten. Bei einer Zeitspanne ist das korrekt — prüfe, ob die " +
          "Reihenfolge stimmt.",
        subject: null,
        start: p.start,
        end: null,
        snippet: excerptAt(a.raw, p.start, p.start + 80),
        weight: 0.35,
      });
    }
  }

  return issues;
}
