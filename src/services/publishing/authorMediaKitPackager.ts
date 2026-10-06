// AuthorMediaKitPackager (WP 77.2)
//
// Erstellt professionelle Pressemappen (EPK) mit Media One-Sheet,
// Autor-Biografien in 3 Längen und Interview-Leitfäden.
// Deterministisch: FNV-1a + mulberry32. Keine Node-Module.

export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^= (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Autor-Bio-Länge. */
export type BioLength = "short" | "medium" | "long";

/** Ein Media One-Sheet. */
export interface MediaOneSheet {
  title: string;
  logline: string;
  compTitles: string[];
  targetAudience: string;
  isbn: string;
  price: number;
  author: string;
  bio: string;
  interviewQuestions: string[];
}

/** Interview-Frage. */
export interface InterviewQuestion {
  question: string;
  talkingPoints: string[];
}

/** Erstellt eine Autor-Bio. */
export function generateBio(author: string, length: BioLength): string {
  const short = `${author} ist ein Autor aus Deutschland.`;
  const medium = `${author} ist ein Autor aus Deutschland. Er schreibt Fantasy und Science-Fiction. Seine Bücher erscheinen im Selbstverlag.`;
  const long = `${author} ist ein Autor aus Deutschland. Er schreibt Fantasy und Science-Fiction. Seine Bücher erscheinen im Selbstverlag. Er hat bereits mehrere Romane veröffentlicht und arbeitet an einer neuen Trilogie. In seiner Freizeit liest er gerne und wandert in der Natur.`;

  if (length === "short") return short;
  if (length === "medium") return medium;
  return long;
}

/** Erstellt Interview-Fragen. */
export function generateInterviewQuestions(title: string): InterviewQuestion[] {
  const questions: InterviewQuestion[] = [
    {
      question: `Was hat dich inspiriert, "${title}" zu schreiben?`,
      talkingPoints: ["Persönliche Erfahrungen", "Bücher, die mich beeinflusst haben", "Die Welt um mich herum"],
    },
    {
      question: "Wie lange hast du an dem Buch gearbeitet?",
      talkingPoints: ["Recherche", "Schreiben", "Überarbeiten"],
    },
    {
      question: "Was ist die zentrale Botschaft deines Buches?",
      talkingPoints: ["Hoffnung", "Freundschaft", "Selbstentdeckung"],
    },
    {
      question: "Für wen ist das Buch gedacht?",
      talkingPoints: ["Jugendliche", "Erwachsene", "Fantasy-Fans"],
    },
    {
      question: "Was kommt als Nächstes?",
      talkingPoints: ["Fortsetzung", "Neues Projekt", "Reisen und Recherche"],
    },
  ];
  return questions;
}

/** Erstellt ein Media One-Sheet. */
export function createMediaOneSheet(
  title: string,
  logline: string,
  author: string,
  isbn: string,
  price: number,
): MediaOneSheet {
  const bio = generateBio(author, "medium");
  const questions = generateInterviewQuestions(title);

  return {
    title,
    logline,
    compTitles: ["Der Herr der Ringe", "Game of Thrones", "Die Chroniken von Narnia"],
    targetAudience: "Fantasy-Fans ab 14 Jahren",
    isbn,
    price,
    author,
    bio,
    interviewQuestions: questions.map((q) => q.question),
  };
}

/** Formatiert ein Media One-Sheet als Text. */
export function formatMediaOneSheet(sheet: MediaOneSheet): string {
  const lines: string[] = [];
  lines.push(`=== MEDIA ONE-SHEET: ${sheet.title} ===`);
  lines.push("");
  lines.push(`Logline: ${sheet.logline}`);
  lines.push(`Autor: ${sheet.author}`);
  lines.push(`ISBN: ${sheet.isbn}`);
  lines.push(`Preis: ${sheet.price} EUR`);
  lines.push(`Zielgruppe: ${sheet.targetAudience}`);
  lines.push("");
  lines.push("Comp Titles:");
  for (const comp of sheet.compTitles) {
    lines.push(`  - ${comp}`);
  }
  lines.push("");
  lines.push("Bio:");
  lines.push(sheet.bio);
  lines.push("");
  lines.push("Interview-Fragen:");
  for (const q of sheet.interviewQuestions) {
    lines.push(`  - ${q}`);
  }
  return lines.join("\n");
}

/** Erstellt ein Beispiel-One-Sheet. */
export function createSampleOneSheet(): MediaOneSheet {
  return createMediaOneSheet(
    "Die Chroniken der Aetherie",
    "In einer Welt aus Licht und Schatten kämpft ein junger Held gegen eine uralte Dunkelheit.",
    "Erik Gieske",
    "978-3-123456-78-9",
    14.99,
  );
}
