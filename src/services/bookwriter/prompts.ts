// Prompt-Templates für den Bookwriter.
//
// Versioniert und an einer Stelle: Ein Bookwriter lebt davon, dass die
// Prompts gut sind. Wären sie verstreut in der Codebase, würde jeder sie
// anders schreiben und die Qualität würde schwanken.

export const PROMPT_VERSION = "1.0";

/** Bauen einen System-Prompt je nach Genre. */
export function systemForGenre(genre: string, tone: string, language: string): string {
  const langNote = language === "en"
    ? "Write all output in English."
    : "Schreibe alle Ausgaben auf Deutsch.";

  const role = ROLE_BY_GENRE[genre] ?? ROLE_BY_GENRE.sachbuch;

  return `${role}

Tonalität: ${tone}
${langNote}

Regeln:
- Schreibe in klarem, literarischem Deutsch, nicht in Bulletpoints.
- Vermeide Füllwörter, Abschweifungen und leere Floskeln.
- Jede Aussage muss einen konkreten Inhalt haben.
- Stelle nie Tatsachen auf, die du nicht prüfen kannst. Wo unsicher, formuliere vage oder markiere den Punkt.
- Keine Platzhalter wie [hier einfügen], keine unvollständigen Sätze.
- Keine Selbstreferenzen wie "in diesem Kapitel" oder "wie oben erwähnt".`;
}

const ROLE_BY_GENRE: Record<string, string> = {
  sachbuch:
    "Du bist ein erfahrener Sachbuchautor und Lektor. Du erklärst komplexe " +
    "Themen so, dass sie ein interessierter Laienleser versteht, ohne sie zu " +
    "vereinfachen. Deine Sätze sind präzise, deine Beispiele anschaulich.",
  ratgeber:
    "Du bist ein erfahrener Ratgeberautor. Du sprichst den Leser direkt an, " +
    "gibst handfeste Ratschläge und vermeidest abstrakte Theorien ohne " +
    "Anwendung. Jeder Abschnitt sollte dem Leser etwas mitgeben.",
  technik:
    "Du bist ein technischer Autor und Dozent. Du erklärst Verfahren, " +
    "Konzepte und Zusammenhänge strukturiert, mit korrekter Terminologie " +
    "und nachvollziehbaren Beispielen.",
  roman:
    "Du bist ein erzählender Romanautor. Du schreibst szenisch, mit " +
    "konkreten Bilden, Dialogen und inneren Konflikten. Zeige statt zu " +
    "erklären. Jede Szene hat ein Ziel und eine Wendung.",
  kurzgeschichte:
    "Du bist ein Autor literarischer Kurzprosa. Du arbeitest mit " +
    "dichter Charakterisierung, präzisen Bilden und einem klaren " +
    "Handlungsbogen. Jeder Satz muss tragen.",
  essaybuch:
    "Du bist ein Essayist. Du verbindest persönliche Reflexion mit " +
    "gesellschaftlichem Blick. Dein Stil ist nah, literarisch und " +
    "gedanklich anspruchsvoll, ohne akademisch trocken zu sein.",
  krimi:
    "Du bist ein Thriller-Autor. Du baust systematisch Spannung auf, " +
    "kontrollierst den Informationsfluss und setzt Cliffhanger gezielt ein. " +
    "Jedes Kapitel endet mit einem Grund, weiterzulesen.",
  fantasy:
    "Du bist ein Fantasy- oder Science-Fiction-Autor. Du baust eine " +
    "konsistente Welt auf, ohne sie zu überladen. Magie und Technik haben " +
    "klare Regeln. Die Perspektive bleibt nah an den Figuren.",
};

/** Prompt: Titel generieren. */
export function promptTitles(briefing: {
  genre: string;
  idea: string;
  uniqueAngle: string;
  targetAudience: string;
  corePromise: string;
}): string {
  return `Entwickle 10 Titel für ein ${briefing.genre} mit dieser Idee:

${briefing.idea}

Alleinstellungsmerkmal: ${briefing.uniqueAngle}
Zielgruppe: ${briefing.targetAudience}
Kernversprechen: ${briefing.corePromise}

Die Titel sollen:
- Neugier wecken, nicht alles verraten
- Für das Genre typisch sein, aber nicht klischeehaft
- 3–8 Wörter lang sein
- Keine Doppelpunkte oder Untertitel enthalten (das kommt danach)

Gib nur die Titel, einer pro Zeile, ohne Nummerierung.`;
}

/** Prompt: Untertitel generieren. */
export function promptSubtitles(title: string, briefing: {
  genre: string;
  corePromise: string;
  targetAudience: string;
}): string {
  return `Entwickle 10 Untertitel für den Titel „${title}" (${briefing.genre}).

Kernversprechen: ${briefing.corePromise}
Zielgruppe: ${briefing.targetAudience}

Ein guter Untertitel ergänzt den Titel, ohne ihn zu wiederholen. Er kann
einen Nutzen benennen, eine Zielgruppe ansprechen oder eine Spannung
aufbauen.

Gib nur die Untertitel, einer pro Zeile, ohne Nummerierung.`;
}

/** Prompt: Positionierung entwickeln. */
export function promptPositioning(briefing: {
  genre: string;
  idea: string;
  uniqueAngle: string;
  targetAudience: string;
}): string {
  return `Entwickle 5 Positionierungen für ein ${briefing.genre}.

Idee: ${briefing.idea}
Alleinstellungsmerkmal: ${briefing.uniqueAngle}
Zielgruppe: ${briefing.targetAudience}

Eine Positionierung ist ein Satz, der dem Leser sagt: Warum dieses Buch
und nicht die hundert anderen. Sie ist spezifisch, glaubwürdig und
unterscheidet sich von der Konkurrenz.

Gib nur die Sätze, einer pro Zeile.`;
}

/** Prompt: Gliederung generieren. */
export function promptOutline(briefing: {
  genre: string;
  idea: string;
  uniqueAngle: string;
  corePromise: string;
  chapterCount: number;
  wordsPerChapter: number;
  targetAudience: string;
  tone: string;
  customOutline: string | null;
}): string {
  const custom = briefing.customOutline
    ? `\nDer Nutzer hat diese Gliederung vorgegeben. Entwickle sie weiter, fülle sie aus, behalte die Struktur bei:\n${briefing.customOutline}\n`
    : "";

  return `Erstelle eine vollständige Gliederung für ein ${briefing.genre}.

Idee: ${briefing.idea}
Alleinstellungsmerkmal: ${briefing.uniqueAngle}
Kernversprechen: ${briefing.corePromise}
Zielgruppe: ${briefing.targetAudience}
Tonalität: ${briefing.tone}
Umfang: ${briefing.chapterCount} Kapitel, je ca. ${briefing.wordsPerChapter} Wörter
${custom}
Für jedes Kapitel gib:
- Titel
- Ziel des Kapitels (ein Satz)
- Kernfrage oder Konflikt
- Ergebnis / Erkenntnis am Ende
- Geschätzte Wortzahl
- Perspektive (erste Person, dritte Person auktorial, etc.)
- 2–4 Recherchepunkte, falls nötig
- 2–4 Unterkapitel mit eigenen Titeln

Antworte als JSON-Array. Kein Markdown drumherum. Beispiel:
[
  {
    "title": "...",
    "goal": "...",
    "conflict": "...",
    "outcome": "...",
    "estimatedWords": 2000,
    "pov": "dritte Person",
    "research": ["..."],
    "subchapters": ["..."]
  }
]`;
}

/** Prompt: Kapitel schreiben. */
export function promptWriteChapter(briefing: {
  genre: string;
  tone: string;
  idea: string;
  corePromise: string;
  targetAudience: string;
}, chapter: {
  title: string;
  goal: string;
  conflict: string;
  outcome: string;
  estimatedWords: number;
  pov: string;
  subchapters: string[];
}, context: {
  previousSummaries: string[];
  researchNotes: string[];
}): string {
  const prev = context.previousSummaries.length > 0
    ? `\nBisherige Kapitel (Zusammenfassungen):\n${context.previousSummaries.map((s, i) => `Kapitel ${i + 1}: ${s}`).join("\n")}\n`
    : "";

  const research = context.researchNotes.length > 0
    ? `\nRechercheergebnisse:\n${context.researchNotes.join("\n")}\n`
    : "";

  return `Schreibe ein Kapitel für ein ${briefing.genre}.

Buchidee: ${briefing.idea}
Kernversprechen: ${briefing.corePromise}
Zielgruppe: ${briefing.targetAudience}
Tonalität: ${briefing.tone}

Kapitel: ${chapter.title}
Ziel: ${chapter.goal}
Konflikt/Kernfrage: ${chapter.conflict}
Ergebnis am Ende: ${chapter.outcome}
Perspektive: ${chapter.pov}
Gewünschte Länge: ca. ${chapter.estimatedWords} Wörter

Unterkapitel, die enthalten sein müssen:
${chapter.subchapters.map((s) => `- ${s}`).join("\n")}
${prev}${research}
Schreibe das Kapitel als Fließtext. Keine Überschriften im Text, keine
Zusammenfassung am Ende, keine Selbstreferenzen. Nur der reine Kapiteltext.`;
}

/** Prompt: Kapitel zusammenfassen. */
export function promptSummarizeChapter(title: string, content: string): string {
  return `Fasse das folgende Kapitel „${title}" in 3–5 Sätzen zusammen.
Die Zusammenfassung soll Handlung, Figuren und Kernthematik abdecken,
damit sie als Kontext für die nächsten Kapitel dienen kann.

Kapitel:
${content.slice(0, 4000)}

Nur die Zusammenfassung, sonst nichts.`;
}

/** Prompt: Klappentext. */
export function promptBlurb(title: string, subtitle: string, briefing: {
  genre: string;
  idea: string;
  corePromise: string;
  targetAudience: string;
  tone: string;
}, variant: number): string {
  const styles = [
    "Spannend und mitreißend, endet mit einer direkten Frage an den Leser.",
    "Ruhig und reflektiert, spricht den Nutzen für den Leser an.",
    "Provokant und pointiert, stellt eine unbequeme Frage.",
  ];
  const style = styles[variant % styles.length];

  return `Schreibe einen Klappentext für „${title}" (${subtitle}).
Genre: ${briefing.genre}
Idee: ${briefing.idea}
Kernversprechen: ${briefing.corePromise}
Zielgruppe: ${briefing.targetAudience}
Tonalität: ${briefing.tone}

Stil dieser Variante: ${style}

Der Klappentext soll 150–200 Wörter lang sein, den Leser neugierig machen
und nicht alles verraten. Nur der Text, keine Überschriften.`;
}

/** Prompt: Keywords. */
export function promptKeywords(title: string, briefing: {
  genre: string;
  idea: string;
  targetAudience: string;
}): string {
  return `Entwickle 7 Keywords für KDP für das Buch „${title}".
Genre: ${briefing.genre}
Idee: ${briefing.idea}
Zielgruppe: ${briefing.targetAudience}

Jeder Keyword-String darf bis zu 50 Zeichen lang sein. Mache eine Mischung
aus spezifischen Phrasen (2–3 Wörtern) und einzelnen Begriffen.

Gib nur die Keywords, einer pro Zeile.`;
}

/** Prompt: Qualitätsbewertung. */
export function promptQualityCheck(dimension: string, chapter: {
  title: string;
  goal: string;
  content: string;
}): string {
  return `Bewerte das folgende Kapitel in der Dimension „${dimension}".

Kapitel: ${chapter.title}
Ziel: ${chapter.goal}

Inhalt:
${chapter.content.slice(0, 3000)}

Antworte als JSON-Objekt:
{
  "score": <0–100>,
  "level": "<green|yellow|red>",
  "details": "<ein Satz, was auffällt oder gut ist>"
}

Nur das JSON, sonst nichts.`;
}
