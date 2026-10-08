// EditorialContentCalendar (WP 111.1)
// 30-Tage-Launch-Redaktionskalender.
// 4 Kampagnen-Phasen, Redaktionsplan-Export (CSV & Markdown).
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
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type CampaignPhaseId = "preOrder" | "hypeCountdown" | "releaseWeek" | "postLaunch";

export interface CampaignPhase {
  id: CampaignPhaseId;
  name: string;
  startDay: number;
  endDay: number;
  focus: string;
}

export const CAMPAIGN_PHASES: CampaignPhase[] = [
  { id: "preOrder", name: "Pre-Order / Ankündigung", startDay: 1, endDay: 10, focus: "Cover-Reveal, Figuren-Steckbriefe, Vorbesteller-Goodies" },
  { id: "hypeCountdown", name: "Hype-Countdown", startDay: 11, endDay: 20, focus: "Leseproben-Zitate, Tropen-Bingo, Hörbuch-Hörproben" },
  { id: "releaseWeek", name: "Release-Week", startDay: 21, endDay: 25, focus: "Launch-Party-Livestream, Dankespost, Händler-Links" },
  { id: "postLaunch", name: "Post-Launch", startDay: 26, endDay: 30, focus: "Erste Leser-Rezensionen, Fan-Art, FAQ zur Fortsetzung" },
];

export function getCampaignPhase(id: CampaignPhaseId): CampaignPhase | undefined {
  return CAMPAIGN_PHASES.find((p) => p.id === id);
}

export function phaseForDay(day: number): CampaignPhase {
  const d = Math.max(1, Math.min(30, day));
  for (const phase of CAMPAIGN_PHASES) {
    if (d >= phase.startDay && d <= phase.endDay) return phase;
  }
  return CAMPAIGN_PHASES[CAMPAIGN_PHASES.length - 1];
}

export type ChannelId = "instagram" | "booktok" | "threads" | "newsletter" | "linkedin";

export interface Channel {
  id: ChannelId;
  name: string;
  bestTime: string;
  format: string;
}

export const CHANNELS: Channel[] = [
  { id: "instagram", name: "Instagram", bestTime: "18:00–20:00", format: "Karussell / Reel" },
  { id: "booktok", name: "BookTok", bestTime: "20:00–22:00", format: "Video (15–60 s)" },
  { id: "threads", name: "Threads / X", bestTime: "12:00–14:00", format: "Text-Thread" },
  { id: "newsletter", name: "Newsletter", bestTime: "08:00–09:00", format: "E-Mail" },
  { id: "linkedin", name: "LinkedIn", bestTime: "07:30–08:30", format: "Artikel / Post" },
];

export function getChannel(id: ChannelId): Channel | undefined {
  return CHANNELS.find((c) => c.id === id);
}

export interface CalendarEntry {
  day: number;
  phase: CampaignPhase;
  channel: Channel;
  title: string;
  description: string;
  hashtags: string[];
  cta: string;
}

const CONTENT_TITLES: Record<CampaignPhaseId, string[]> = {
  preOrder: [
    "Cover-Reveal: Das neue Buch",
    "Figurensteckbrief: Der Protagonist",
    "Vorbesteller-Goodie: Exklusives Wallpaper",
    "Warum ich dieses Buch geschrieben habe",
    "Das Universum: Eine Karte",
    "Leseprobe: Kapitel 1",
    "Charakter-Vorstellung: Die Antagonistin",
    "Playlists: Was ich beim Schreiben gehört habe",
    "Fan-Art-Aufruf: Zeig deine Vision",
    "Vorbesteller-Link ist live",
  ],
  hypeCountdown: [
    "Zitat der Woche: Der Satz, der alles ändert",
    "Tropen-Bingo: Markiere deine Lieblinge",
    "Hörprobe: Die ersten 3 Minuten",
    "10 Tage bis zum Release — Countdown startet",
    "Fan-Theorie: Was passiert im Finale?",
    "Hinter den Kulissen: Der Schreibprozess",
    "Buchstil: Dark Romance / Fantasy / Thriller",
    "5 Tage bis zum Release — letzte Chance",
    "Leser-Fragen: Ich antworte alles",
    "Morgen ist es soweit — letzter Countdown",
  ],
  releaseWeek: [
    "🎉 ES IST SO WEIT — Release-Day!",
    "Launch-Party-Livestream: Feiert mit mir",
    "Dankespost: Ihr habt das möglich gemacht",
    "Händler-Links: Jetzt kaufen",
    "Erste Rezensionen: Was Leser sagen",
  ],
  postLaunch: [
    "Leser-Rezension der Woche",
    "Fan-Art-Showcase: Eure Kunst",
    "FAQ: Wann kommt der nächste Band?",
    "Behind the Scenes: Die Entstehung",
    "Was kommt als Nächstes: Ein Ausblick",
  ],
};

const CONTENT_DESCRIPTIONS: Record<CampaignPhaseId, string[]> = {
  preOrder: [
    "Zeig das Cover und erkläre, warum es perfekt zur Geschichte passt.",
    "Stell die Hauptfigur vor: Name, Alter, Motivation, Geheimnis.",
    "Biete ein exklusives Goodie für Vorbesteller an.",
    "Erzähle die persönliche Geschichte hinter dem Buch.",
    "Teil eine Karte oder Illustration der Welt.",
    "Zitiere den ersten Absatz und lass Neugier aufkommen.",
    "Stell die Antagonistin vor: Was treibt sie an?",
    "Teil eine Playlist, die zur Stimmung des Buches passt.",
    "Fordere Leser auf, Fan-Art zu erstellen und zu teilen.",
    "Erinnere an den Vorbesteller-Link und die Goodies.",
  ],
  hypeCountdown: [
    "Zitiere einen prägnanten Satz aus dem Buch.",
    "Erstelle ein Bingo-Raster mit Tropen aus dem Genre.",
    "Teil ein Hörprobe-Audio oder Video.",
    "Zähle die Tage bis zum Release herunter.",
    "Diskutiere eine Fan-Theorie über das Ende.",
    "Zeig den Schreibprozess: Entwürfe, Notizen, Routine.",
    "Beschreibe den Stil des Buches mit Beispielen.",
    "Erinnere an die letzte Chance zu vorbestellen.",
    "Beantworte Leser-Fragen aus den Kommentaren.",
    "Erwarte den Release und teil deine Vorfreude.",
  ],
  releaseWeek: [
    "Feier den Release mit deinen Lesern.",
    "Lade zu einem Livestream ein und interagiere live.",
    "Danke deinen Lesern und Unterstützern.",
    "Teil Links zu allen Händlern und Plattformen.",
    "Zitiert positive Rezensionen und lass Lob wirken.",
  ],
  postLaunch: [
    "Teil eine Leser-Rezension und danke dem Autor.",
    "Zeig Fan-Art und erwähne die Künstler.",
    "Beantworte FAQs zur Fortsetzung.",
    "Hinter den Kulissen: Wie das Buch entstand.",
    "Gib einen Ausblick auf zukünftige Projekte.",
  ],
};

const CONTENT_CTAS: Record<CampaignPhaseId, string[]> = {
  preOrder: [
    "Vorbestellen und Goodie sichern",
    "Link in der Bio klicken",
    "Kommentieren, was dich am meisten erwartet",
    "Teilen mit einem Freund, der das Buch lieben würde",
    "Speichern für später",
    "Leseprobe lesen und Meinung sagen",
    "Fragen zur Figur stellen",
    "Playlist folgen und teilen",
    "Fan-Art posten und taggen",
    "Jetzt vorbestellen — Goodies sind limitiert",
  ],
  hypeCountdown: [
    "Zitat teilen und taggen",
    "Bingo-Karte ausdrucken und posten",
    "Hörprobe anhören und Feedback geben",
    "Countdown teilen und Freunde einladen",
    "Theorie kommentieren und diskutieren",
    "Schreibprozess teilen und inspirieren",
    "Stil beschreiben und vergleichen",
    "Vorbestellen, solange es geht",
    "Fragen stellen und antworten lassen",
    "Morgen nicht verpassen — Benachrichtigung aktivieren",
  ],
  releaseWeek: [
    "Jetzt kaufen und feiern",
    "Livestream beitreten und chatten",
    "Danke sagen und teilen",
    "Link kaufen und bewerten",
    "Rezension lesen und selbst schreiben",
  ],
  postLaunch: [
    "Rezension teilen und taggen",
    "Fan-Art posten und erwähnen",
    "FAQ lesen und Fragen stellen",
    "Behind-the-Sciences-Post teilen",
    "Folgen für Updates und neue Projekte",
  ],
};

export function generateCalendarEntry(day: number, seed: number = 42): CalendarEntry {
  const d = Math.max(1, Math.min(30, day));
  const phase = phaseForDay(d);
  const rng = createSeededRandom(hashString(`calendar:${d}:${seed}`));

  const channel = CHANNELS[d % CHANNELS.length];
  const titles = CONTENT_TITLES[phase.id];
  const descriptions = CONTENT_DESCRIPTIONS[phase.id];
  const ctas = CONTENT_CTAS[phase.id];

  const title = titles[(d - phase.startDay) % titles.length];
  const description = descriptions[(d - phase.startDay) % descriptions.length];
  const cta = ctas[(d - phase.startDay) % ctas.length];

  const hashtags = ["#BookTok", "#BookRelease", "#NewBook", "#AuthorLife", "#BookLover"].sort(() => rng() - 0.5).slice(0, 3);

  return {
    day: d,
    phase,
    channel,
    title,
    description,
    hashtags,
    cta,
  };
}

export interface EditorialCalendar {
  id: string;
  entries: CalendarEntry[];
  phases: CampaignPhase[];
  channels: Channel[];
}

export function generateEditorialCalendar(seed: number = 42): EditorialCalendar {
  const entries = Array.from({ length: 30 }, (_, i) => generateCalendarEntry(i + 1, seed));
  return {
    id: `CALENDAR-${hashString(`calendar:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    entries,
    phases: [...CAMPAIGN_PHASES],
    channels: [...CHANNELS],
  };
}

export interface CsvExport {
  header: string;
  rows: string[];
  content: string;
}

export function exportCalendarToCsv(calendar: EditorialCalendar): CsvExport {
  const header = "Tag;Phase;Kanal;Titel;Beschreibung;Hashtags;Call-to-Action";
  const rows = calendar.entries.map((e) =>
    [e.day, e.phase.name, e.channel.name, e.title, e.description, e.hashtags.join(" "), e.cta]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(";")
  );
  return { header, rows, content: [header, ...rows].join("\n") };
}

export interface MarkdownExport {
  title: string;
  sections: string[];
  content: string;
}

export function exportCalendarToMarkdown(calendar: EditorialCalendar): MarkdownExport {
  const title = `# 30-Tage-Launch-Redaktionskalender\n\nGeneriert am ${new Date().toISOString().split("T")[0]}\n`;
  const sections = calendar.phases.map((phase) => {
    const entries = calendar.entries.filter((e) => e.phase.id === phase.id);
    const lines = entries.map(
      (e) => `### Tag ${e.day} — ${e.title}\n\n- **Kanal:** ${e.channel.name} (${e.channel.bestTime})\n- **Beschreibung:** ${e.description}\n- **Hashtags:** ${e.hashtags.join(" ")}\n- **CTA:** ${e.cta}\n`
    );
    return `## ${phase.name} (Tag ${phase.startDay}–${phase.endDay})\n\n**Fokus:** ${phase.focus}\n\n${lines.join("\n")}`;
  });
  return { title, sections, content: [title, ...sections].join("\n") };
}

export function createSampleCalendarEntry(): CalendarEntry {
  return generateCalendarEntry(15, 42);
}

export function createSampleEditorialCalendar(): EditorialCalendar {
  return generateEditorialCalendar(42);
}
