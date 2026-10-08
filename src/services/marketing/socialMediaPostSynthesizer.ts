// SocialMediaPostSynthesizer (WP 110.1)
// Multi-Plattform-Post-Synthesizer für BookTok, Instagram, Threads/X, LinkedIn.
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

function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("Empty array");
  return arr[Math.floor(rng() * arr.length)];
}

export type PlatformId = "booktok" | "instagram" | "threads" | "linkedin";

export interface Platform {
  id: PlatformId;
  name: string;
  /** Maximale Zeichenzahl je Post. */
  maxChars: number;
  /** Empfohlene Hashtag-Anzahl. */
  hashtagCount: number;
  tone: string;
}

export const PLATFORMS: Platform[] = [
  { id: "booktok", name: "BookTok / Reels", maxChars: 150, hashtagCount: 5, tone: "Energisch, direkt, mit 3-Sekunden-Hook" },
  { id: "instagram", name: "Instagram-Karussell", maxChars: 2200, hashtagCount: 15, tone: "Visuell, emotional, mit Call-to-Action" },
  { id: "threads", name: "Threads & X", maxChars: 280, hashtagCount: 3, tone: "Persönlich, storygetrieben, provokant" },
  { id: "linkedin", name: "LinkedIn / Substack", maxChars: 3000, hashtagCount: 5, tone: "Professionell, reflektiert, handwerklich" },
];

export function getPlatform(id: PlatformId): Platform | undefined {
  return PLATFORMS.find((p) => p.id === id);
}

const BOOKTOK_HOOKS = [
  "Scroll nicht weiter, wenn du Enemies-to-Lovers liebst, wo er für sie die Welt niederbrennt...",
  "Dieses Buch hat mich um 3 Uhr morgens weinen lassen — und ich bereue nichts.",
  "POV: Du liest das erste Kapitel und kannst nicht mehr aufhören.",
  "Wenn du Dark Romance mit einem Buchstaben magst, ist das dein nächstes Obsession.",
  "Ich habe dieses Buch in einem Rutsch gelesen — und sofort nochmal angefangen.",
];

const INSTAGRAM_SLIDES = [
  "Folie 1: Hook-Zitat — der Satz, der dich nicht loslässt",
  "Folie 2: Tropen — was dieses Buch ausmacht",
  "Folie 3: Moodboard — die Welt zwischen den Zeilen",
  "Folie 4: Figuren — wer dich erwartet",
  "Folie 5: Klappentext — die Geschichte in einem Satz",
  "Folie 6: Call-to-Action — jetzt vorbestellen",
];

const THREADS_STEPS = [
  "1/5: Ich habe dieses Buch in 6 Monaten geschrieben. Hier ist, was ich gelernt habe...",
  "2/5: Der erste Entwurf war 80.000 Wörter lang. Der zweite war ein Komplett-Neuanfang.",
  "3/5: Mein Lieblingszitat aus dem Buch — und warum es mich zum Weinen gebracht hat.",
  "4/5: Die Figur, die ich am liebsten hasse — und warum sie trotzdem wichtig ist.",
  "5/5: Das Buch ist jetzt erhältlich. Link in der Bio. Danke, dass du mich begleitet hast.",
];

const LINKEDIN_POSTS = [
  "Nach 50.000 Wörtern und 12 Entwürfen habe ich mein Buch veröffentlicht. Hier sind die 3 wichtigsten Lektionen...",
  "Viele Autoren fragen mich, wie ich den Schreibprozess strukturiere. Meine Antwort: Routine schlägt Motivation.",
  "Der Unterschied zwischen einem Manuskript und einem Buch heißt: Lektorat. Und der ist kein Luxus.",
  "Ich habe 300 abgelehnte Anfragen bekommen, bevor ein Verlagsvertrag kam. Die Ablehnung war Teil des Prozesses.",
  "Self-Publishing ist kein Plan B. Es ist eine bewusste Entscheidung — mit eigenen Regeln und eigenen Risiken.",
];

const HASHTAG_POOL = [
  "#BookTok", "#BookTokGermany", "#DarkRomanceBooks", "#FantasyAutor", "#IndieAuthor",
  "#Bookstagram", "#Lesen", "#Bücherliebe", "#BookRecommendations", "#MustRead",
  "#AmReading", "#BookReview", "#AuthorLife", "#WritingCommunity", "#BookLover",
  "#DeutscheBücher", "#Roman", "#Thriller", "#Liebesroman", "#Sachbuch",
];

export interface SocialMediaPost {
  id: string;
  platform: Platform;
  content: string;
  hashtags: string[];
  /** Charakterzahl des Posts. */
  charCount: number;
  /** Empfohlene Bild-/Video-Begleitung. */
  visualHint: string;
}

export function generatePost(platformId: PlatformId, seed: number = 42): SocialMediaPost {
  const platform = getPlatform(platformId) || PLATFORMS[0];
  const rng = createSeededRandom(hashString(`post:${platformId}:${seed}`));

  let content = "";
  let visualHint = "";

  switch (platformId) {
    case "booktok":
      content = pick(BOOKTOK_HOOKS, rng);
      visualHint = "B-Roll: Buch in den Händen, schnelle Schnitte, On-Screen-Text mit Hook";
      break;
    case "instagram":
      content = INSTAGRAM_SLIDES.map((s) => s).join("\n");
      visualHint = "Karussell mit 6 Folien: Hook-Zitat, Tropen, Moodboard, Figuren, Klappentext, CTA";
      break;
    case "threads":
      content = THREADS_STEPS.join("\n\n");
      visualHint = "Text-Thread mit 5 Posts, persönlicher Ton, kein Bild nötig";
      break;
    case "linkedin":
      content = pick(LINKEDIN_POSTS, rng);
      visualHint = "Professionelles Portrait oder Buchcover als Beitragsbild";
      break;
  }

  const hashtags = [...HASHTAG_POOL].sort(() => rng() - 0.5).slice(0, platform.hashtagCount);

  return {
    id: `POST-${hashString(`${platformId}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    platform,
    content,
    hashtags,
    charCount: content.length,
    visualHint,
  };
}

export interface CarouselSlide {
  slideNumber: number;
  title: string;
  body: string;
  /** Design-Hinweis für die Folie. */
  designHint: string;
}

export function generateCarousel(seed: number = 42): CarouselSlide[] {
  const rng = createSeededRandom(hashString(`carousel:${seed}`));
  return INSTAGRAM_SLIDES.map((s, i) => {
    const [title, body] = s.split(" — ");
    return {
      slideNumber: i + 1,
      title: title || `Folie ${i + 1}`,
      body: body || "",
      designHint: pick([
        "Großer Text, zentriert, Kontrast zum Hintergrund",
        "Zitat in Anführungszeichen, dekorative Linien",
        "Buchcover rechts, Text links, asymmetrisch",
        "Hintergrundbild mit Overlay, Text in der Mitte",
        "Minimalistisch: nur Text und ein Akzent",
        "Call-to-Action-Button unten, zentriert",
      ], rng),
    };
  });
}

export interface HashtagSet {
  primary: string[];
  secondary: string[];
  niche: string[];
}

export function curateHashtags(genre: string, seed: number = 42): HashtagSet {
  const rng = createSeededRandom(hashString(`hashtags:${genre}:${seed}`));
  const shuffled = [...HASHTAG_POOL].sort(() => rng() - 0.5);
  return {
    primary: shuffled.slice(0, 5),
    secondary: shuffled.slice(5, 12),
    niche: shuffled.slice(12, 15),
  };
}

export interface MultiPlatformCampaign {
  id: string;
  posts: SocialMediaPost[];
  carousel: CarouselSlide[];
  hashtags: HashtagSet;
}

export function generateCampaign(genre: string = "Dark Romance", seed: number = 42): MultiPlatformCampaign {
  const posts = PLATFORMS.map((p) => generatePost(p.id, seed));
  const carousel = generateCarousel(seed);
  const hashtags = curateHashtags(genre, seed);
  return {
    id: `CAMPAIGN-${hashString(`${genre}:${seed}`).toString(16).padStart(8, "0").toUpperCase()}`,
    posts,
    carousel,
    hashtags,
  };
}

export function createSamplePost(): SocialMediaPost {
  return generatePost("booktok", 42);
}

export function createSampleCampaign(): MultiPlatformCampaign {
  return generateCampaign("Dark Romance", 42);
}
