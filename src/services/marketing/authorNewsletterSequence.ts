// AuthorNewsletterSequence (WP 111.2)
// Autoren-Newsletter- & Launch-Sequenz.
// 5-teilige automatisierte E-Mail-Sequenz mit Betreffzeilen-Splitter.
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

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export type EmailStepId = "welcome" | "originStory" | "coverReveal" | "releaseDay" | "readingCircle";

export interface EmailStep {
  id: EmailStepId;
  name: string;
  /** Tag nach dem Trigger. */
  dayOffset: number;
  subjectLines: string[];
  body: string;
  cta: string;
}

export const EMAIL_STEPS: EmailStep[] = [
  {
    id: "welcome",
    name: "Willkommen & Reader-Magnet",
    dayOffset: 0,
    subjectLines: [
      "Dein Bonus-Kapitel ist da 🎁",
      "Willkommen — hier ist dein Exklusiv-Kapitel",
      "Das versprochene Bonus-Kapitel ist angekommen",
    ],
    body: "Herzlich willkommen! Hier ist dein exklusives Bonus-Kapitel / deine Prequel-Kurzgeschichte. Viel Spaß beim Lesen — und danke, dass du dabei bist.",
    cta: "Bonus-Kapitel jetzt herunterladen",
  },
  {
    id: "originStory",
    name: "Die Entstehungsgeschichte",
    dayOffset: 3,
    subjectLines: [
      "Warum ich dieses Buch geschrieben habe",
      "Die Geschichte hinter dem Buch",
      "Es begann mit einem einzigen Satz...",
    ],
    body: "Jedes Buch hat eine Entstehungsgeschichte. Hier erfährst du, warum ich dieses geschrieben habe, was mich motiviert hat und welche Momente den Prozess geprägt haben.",
    cta: "Mehr über den Autor erfahren",
  },
  {
    id: "coverReveal",
    name: "Cover-Reveal & Exklusiver Vorverkauf",
    dayOffset: 7,
    subjectLines: [
      "Das Cover ist enthüllt! 🎨",
      "Exklusiv: Das Cover + Vorverkauf startet",
      "Schau her — das Cover ist da!",
    ],
    body: "Endlich: Das Cover! Und der exklusive Vorverkauf startet — mit limitierter Signierung für die ersten Besteller. Sicher dir dein Exemplar, bevor es ausverkauft ist.",
    cta: "Jetzt vorbestellen — limitierte Signierung",
  },
  {
    id: "releaseDay",
    name: "Der Veröffentlichungstag",
    dayOffset: 14,
    subjectLines: [
      "🎉 HEUTE IST ES SOWEIT!",
      "Das Buch ist da — jetzt kaufen!",
      "Release-Day: Jetzt in allen Shops",
    ],
    body: "Es ist soweit — das Buch ist veröffentlicht! Feier mit mir und sichere dir dein Exemplar in deinem Lieblingsshop. Danke, dass du diesen Weg mit mir gegangen bist.",
    cta: "Jetzt kaufen — alle Shops im Überblick",
  },
  {
    id: "readingCircle",
    name: "Lese-Runde & Rezensions-Bitte",
    dayOffset: 21,
    subjectLines: [
      "Wie hat es dir gefallen? 📚",
      "Deine Meinung zählt — und eine Bitte",
      "Lese-Runde: Austausch & Rezension",
    ],
    body: "Ich hoffe, das Buch hat dir gefallen! Wenn ja, würde ich mich über eine Bewertung auf Amazon oder Goodreads freuen. Und wenn du Lust hast, dich mit anderen Lesern auszutauschen — komm in unsere Lese-Runde.",
    cta: "Bewertung abgeben / Lese-Runde beitreten",
  },
];

export function getEmailStep(id: EmailStepId): EmailStep | undefined {
  return EMAIL_STEPS.find((s) => s.id === id);
}

export interface NewsletterSequence {
  id: string;
  steps: EmailStep[];
  totalDays: number;
}

export function generateNewsletterSequence(seed: number = 42): NewsletterSequence {
  const rng = createSeededRandom(hashString(`newsletter:${seed}`));
  const steps = EMAIL_STEPS.map((s) => ({
    ...s,
    subjectLines: [...s.subjectLines].sort(() => rng() - 0.5),
  }));
  return {
    id: `NEWSLETTER-${hashString(`newsletter:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    steps,
    totalDays: Math.max(...steps.map((s) => s.dayOffset)),
  };
}

export interface SubjectLineVariant {
  step: EmailStepId;
  stepName: string;
  variants: string[];
  /** Empfohlene Variante (höchste Klickwahrscheinlichkeit). */
  recommended: string;
}

export function splitSubjectLines(seed: number = 42): SubjectLineVariant[] {
  const rng = createSeededRandom(hashString(`subjects:${seed}`));
  return EMAIL_STEPS.map((s) => {
    const shuffled = [...s.subjectLines].sort(() => rng() - 0.5);
    return {
      step: s.id,
      stepName: s.name,
      variants: shuffled,
      recommended: shuffled[0],
    };
  });
}

export interface EmailPreview {
  step: EmailStep;
  subject: string;
  body: string;
  cta: string;
  dayOffset: number;
}

export function previewEmailSequence(seed: number = 42): EmailPreview[] {
  const rng = createSeededRandom(hashString(`preview:${seed}`));
  return EMAIL_STEPS.map((s) => ({
    step: s,
    subject: pick(s.subjectLines, rng),
    body: s.body,
    cta: s.cta,
    dayOffset: s.dayOffset,
  }));
}

export function createSampleEmailStep(): EmailStep {
  return EMAIL_STEPS[0];
}

export function createSampleNewsletterSequence(): NewsletterSequence {
  return generateNewsletterSequence(42);
}
