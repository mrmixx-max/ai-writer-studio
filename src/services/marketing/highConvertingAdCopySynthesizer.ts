// highConvertingAdCopySynthesizer.ts — Marketing: High-Converting Ad & Blurb Synthesizer (Meta & Amazon Ads).
// Meilenstein 61.0 (v7.3.0). Lokal, deterministisch, keine LLM-Aufrufe. Defensive Fallbacks.

// ---------------------------------------------------------------------------
// Deterministische Kernfunktionen
// ---------------------------------------------------------------------------

/**
 * FNV-1a Hash — unsigned 32-bit.
 * Deterministisch, schnell, gut für Seed-Generierung.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash >>> 0; // unsigned 32-bit
}

/**
 * Mulberry32 PRNG — liefert [0, 1).
 * Deterministisch bei gleichem Seed.
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return function (): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Wählt ein zufälliges Element aus einem Array.
 * Wirft Fehler bei leerem Array.
 */
function pick<T>(arr: T[], rng: () => number): T {
  if (arr.length === 0) {
    throw new Error("pick() called with empty array");
  }
  const index = Math.floor(rng() * arr.length);
  return arr[index];
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function safe(value: string | undefined | null, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// ---------------------------------------------------------------------------
// 1. Bestseller-Klappentext-Architektur
// ---------------------------------------------------------------------------

export interface BlurbArchitectureInput {
  title: string;
  genre: string;
  protagonist: string;
  antagonist?: string;
  tropes?: string[];
}

export interface BlurbArchitecture {
  hook: string;
  characterConflict: string;
  dilemma: string;
  tropeBullets: string[];
  callToAction: string;
  fullBlurb: string;
  wordCount: number;
}

const GENRE_HOOKS: Record<string, string> = {
  krimi: "Ein Mord. Ein Verdächtiger. Eine Wahrheit, die niemand sehen will.",
  thriller: "Eine Verschwörung. Ein Countdown. Ein Mann, der allein dagegen steht.",
  fantasy: "Eine verborgene Welt. Eine uralte Prophezeiung. Eine Wahl, die alles verändert.",
  "science-fiction": "Eine Zukunft, die niemand wollte. Ein Geheimnis, das die Menschheit bedroht.",
  romantik: "Zwei Menschen. Ein Zufall. Eine Liebe, die nicht sein dürfte.",
  horror: "Ein Ort, an dem die Dunkelheit lebt. Ein Geist, der nicht ruhen lässt.",
  historisch: "Eine Epoche im Wandel. Eine Entscheidung, die Geschichte schreibt.",
  dystopie: "Eine Gesellschaft ohne Freiheit. Ein Funke Hoffnung, der alles aufs Spiel setzt.",
  default: "Eine Geschichte, die unter die Haut geht. Ein Konflikt, der keine Gnade kennt.",
};

const GENRE_CONFLICTS: Record<string, string> = {
  krimi: "Der Protagonist jagt den Mörder — doch der Mörder jagt zurück.",
  thriller: "Jeder Schritt bringt ihn der Wahrheit näher — und dem Gefahr näher.",
  fantasy: "Die Prophezeiung kennt ihn. Doch er weigert sich, ihr zu folgen.",
  "science-fiction": "Das System hat ihn verraten. Jetzt muss er sich gegen es stellen.",
  romantik: "Die Liebe ist verboten — doch das Herz hört nicht auf die Vernunft.",
  horror: "Die Dunkelheit kennt seinen Namen. Und sie wird nicht ruhen, bis sie ihn hat.",
  historisch: "Die Geschichte schreibt sich selbst — doch er will sie umschreiben.",
  dystopie: "Die Gesellschaft hat ihn vergessen. Doch er wird sie nicht vergessen.",
  default: "Ein Kampf, der alles fordert — und nichts garantiert.",
};

const GENRE_DILEMMAS: Record<string, string> = {
  krimi: "Soll er die Wahrheit ans Licht bringen — auch wenn es ihn alles kostet?",
  thriller: "Kann er der Verschwörung entkommen, ohne selbst zum Verbrecher zu werden?",
  fantasy: "Wird er der Auserwählte sein, oder kann er dem Schicksal entkommen?",
  "science-fiction": "Wird er die Menschheit retten — oder ist sie es nicht mehr wert?",
  romantik: "Wird er der Liebe folgen — auch wenn es sein Leben zerstört?",
  horror: "Kann er die Dunkelheit besiegen, ohne selbst zu verschwinden?",
  historisch: "Wird er die Geschichte verändern — oder wird sie ihn verändern?",
  dystopie: "Wird er die Gesellschaft stürzen — oder ist er bereits ein Teil von ihr?",
  default: "Wird er sich entscheiden — oder wird die Entscheidung ihn?",
};

const TROPE_TEMPLATES: Record<string, string[]> = {
  "enemies-to-lovers": [
    "Feinde, die sich nicht mehr leiden können — bis ein Blick alles verändert.",
    "Zwei Welten, ein Kampf — und eine Anziehung, die keiner kontrollieren kann.",
  ],
  "found-family": [
    "Zusammenhalt, der stärker ist als jede Blutsbande.",
    "Eine Familie, die man sich aussucht — und die einen nie aufgibt.",
  ],
  "chosen-one": [
    "Er ist der Auserwählte — doch er hat nie darum gebeten.",
    "Die Prophezeiung kennt ihn. Er kennt sich selbst nicht mehr.",
  ],
  "second-chance": [
    "Ein zweiter Anfang — doch die Vergangenheit lässt nicht los.",
    "Die Chance, alles noch einmal zu machen. Doch zu welchem Preis?",
  ],
  "secret-identity": [
    "Tagsüber ein Mensch, nachts ein anderer — und niemand darf es erfahren.",
    "Ein Geheimnis, das ihn definiert — und eines Tages zerstören könnte.",
  ],
  "slow-burn": [
    "Jede Berührung ein Versprechen. Jeder Blick ein Geheimnis.",
    "Die Spannung wächst — unaufhaltsam, unausweichlich, unvergesslich.",
  ],
  "morally-grey": [
    "Er ist kein Held. Doch manchmal sind es die Schatten, die das Licht tragen.",
    "Gut und Böse — die Grenze verschwimmt, je tiefer man blickt.",
  ],
  "forbidden-love": [
    "Eine Liebe, die nicht sein darf — und doch alles ist.",
    "Verboten, gefährlich, unaufhaltsam — und sie wird nicht aufgeben.",
  ],
};

const DEFAULT_TROPE_BULLETS: string[] = [
  "Eine Geschichte, die unter die Haut geht.",
  "Charaktere, die man nicht vergisst.",
  "Ein Plot, der bis zur letzten Seite fesselt.",
  "Emotionen, die zum Denken anregen.",
  "Ein Ende, das überrascht — und berührt.",
];

const CTA_TEMPLATES: string[] = [
  "Jetzt entdecken — die Geschichte beginnt hier.",
  "Sichern Sie sich Ihr Exemplar — nur für kurze Zeit verfügbar.",
  "Lesen Sie die ersten Kapitel kostenlos — und lassen Sie sich mitreißen.",
  "Verfügbar jetzt — in allen Buchhandlungen und online.",
  "Starten Sie Ihre Reise — kaufen Sie jetzt.",
];

export function buildBlurbArchitecture(
  input: BlurbArchitectureInput,
  seed: number
): BlurbArchitecture {
  const rng = createSeededRandom(hashString(`blurb:${input.title}:${input.genre}:${seed}`));

  const genre = safe(input.genre, "default").toLowerCase();
  const protagonist = safe(input.protagonist, "Der Protagonist");

  const hook = pick(
    [GENRE_HOOKS[genre] ?? GENRE_HOOKS.default, GENRE_HOOKS.default],
    rng
  );

  const characterConflict = pick(
    [GENRE_CONFLICTS[genre] ?? GENRE_CONFLICTS.default, GENRE_CONFLICTS.default],
    rng
  );

  const dilemma = pick(
    [GENRE_DILEMMAS[genre] ?? GENRE_DILEMMAS.default, GENRE_DILEMMAS.default],
    rng
  );

  // Tropen-Bullets
  const tropes = input.tropes ?? [];
  const tropeBullets: string[] = [];
  if (tropes.length > 0) {
    for (const trope of tropes) {
      const templates = TROPE_TEMPLATES[trope.toLowerCase()];
      if (templates && templates.length > 0) {
        tropeBullets.push(pick(templates, rng));
      }
    }
  }
  // Fülle auf mit Default-Bullets auf
  while (tropeBullets.length < 3) {
    const bullet = pick(DEFAULT_TROPE_BULLETS, rng);
    if (!tropeBullets.includes(bullet)) {
      tropeBullets.push(bullet);
    }
  }

  const callToAction = pick(CTA_TEMPLATES, rng);

  const fullBlurb = [
    hook,
    "",
    `${protagonist} — ${characterConflict}`,
    "",
    dilemma,
    "",
    ...tropeBullets.map((b) => `• ${b}`),
    "",
    callToAction,
  ].join("\n");

  const wordCount = fullBlurb.split(/\s+/).filter((w) => w.length > 0).length;

  return {
    hook,
    characterConflict,
    dilemma,
    tropeBullets,
    callToAction,
    fullBlurb,
    wordCount,
  };
}

// ---------------------------------------------------------------------------
// 2. Meta-Ad-Winkel
// ---------------------------------------------------------------------------

export interface AdAngle {
  id: string;
  name: string;
  description: string;
  targetAudience: string;
}

export const AD_ANGLES: AdAngle[] = [
  {
    id: "emotionalTrope",
    name: "Emotionaler Tropen-Hook",
    description:
      "Emotionale Ansprache über bekannte Tropen — spricht Leser an, die sich in der Geschichte wiedererkennen wollen.",
    targetAudience: "Leser, die emotionale, charaktergetriebene Geschichten suchen",
  },
  {
    id: "plotTwistTeaser",
    name: "Plottwist-Teaser",
    description:
      "Neugier wecken durch Andeutungen von Wendepunkten — ideal für Thriller, Krimis und Mystery.",
    targetAudience: "Leser, die von Überraschungen und unvorhersehbaren Handlungssträngen fasziniert werden",
  },
  {
    id: "socialProof",
    name: "Social-Proof-Winkel",
    description:
      "Vertrauen durch Empfehlungen und Erfolgsgeschichten aufbauen — besonders effektiv für neue Autoren.",
    targetAudience: "Leser, die sich auf Bewertungen und Empfehlungen verlassen",
  },
];

export interface MetaAdInput {
  title: string;
  genre: string;
  protagonist: string;
  antagonist?: string;
  tropes?: string[];
  authorName?: string;
}

export interface MetaAd {
  angleId: string;
  headline: string;
  primaryText: string;
  description: string;
  callToAction: string;
}

const META_HEADLINES: Record<string, string[]> = {
  emotionalTrope: [
    "Fühlen Sie sich wieder — wie in der besten Geschichte Ihres Lebens.",
    "Diese Geschichte wird Sie berühren — garantiert.",
    "Emotionen, die bleiben. Eine Geschichte, die Sie nicht vergessen werden.",
  ],
  plotTwistTeaser: [
    "Glauben Sie, Sie wissen, was als Nächstes kommt? Denken Sie noch einmal.",
    "Jede Seite eine Überraschung. Jede Wendung ein Schock.",
    "Die Wahrheit ist näher, als Sie denken — und gefährlicher.",
  ],
  socialProof: [
    "Leser lieben diese Geschichte — und Sie werden es auch.",
    "Tausende Leser haben bereits zugeschlagen. Jetzt sind Sie dran.",
    "Bewertungen sprechen für sich — entdecken Sie selbst, warum.",
  ],
};

const META_PRIMARY_TEXTS: Record<string, string[]> = {
  emotionalTrope: [
    "Tauchen Sie ein in eine Welt voller Leidenschaft, Schmerz und Hoffnung. Jede Seite ist ein Schlag ins Herz.",
    "Diese Geschichte ist mehr als Worte — sie ist ein Gefühl, das Sie nicht mehr loslässt.",
    "Erleben Sie eine Reise durch die Tiefen der menschlichen Seele. Mit jedem Kapitel werden Sie stärker berührt.",
  ],
  plotTwistTeaser: [
    "Nichts ist, wie es scheint. Jede Entscheidung hat Konsequenzen — und manchmal sind sie tödlich.",
    "Der Feind ist näher als Sie denken. Und der nächste Twist kommt, wenn Sie ihn am wenigsten erwarten.",
    "Vertrauen Sie niemandem. Nicht einmal dem Protagonisten. Die Wahrheit ist ein Puzzle — und Sie haben nur Teile davon.",
  ],
  socialProof: [
    "Mit über 500 fünf-Sterne-Bewertungen ist dieses Buch ein Muss für jeden Leser.",
    "Leser beschreiben es als 'unputdownbar' — und Sie werden verstehen, warum.",
    "Die Kritiker sind sich einig: Dieses Buch setzt neue Maßstäbe. Jetzt verfügbar.",
  ],
};

const META_DESCRIPTIONS: Record<string, string[]> = {
  emotionalTrope: [
    "Emotionaler Pageturner — jetzt erhältlich.",
    "Eine Geschichte, die Ihr Herz berühren wird.",
    "Gefühl, Spannung, unvergessliche Charaktere.",
  ],
  plotTwistTeaser: [
    "Unvorhersehbar bis zur letzten Seite.",
    "Twists, die Sie nicht kommen sehen.",
    "Ein Thriller, der Sie bis um Mitternacht wach hält.",
  ],
  socialProof: [
    "Bewertet mit 5 Sternen von über 500 Lesern.",
    "Der Bestseller, über den alle sprechen.",
    "Empfohlen von Lesern wie Ihnen.",
  ],
};

const META_CTAS: string[] = [
  "Jetzt kaufen",
  "Jetzt entdecken",
  "Jetzt lesen",
  "Jetzt bestellen",
  "Jetzt zugreifen",
];

export function generateMetaAds(
  input: MetaAdInput,
  seed: number
): MetaAd[] {
  const rng = createSeededRandom(hashString(`meta:${input.title}:${input.genre}:${seed}`));

  const title = safe(input.title, "Der Schatten der Wahrheit");
  const protagonist = safe(input.protagonist, "Der Protagonist");
  const authorName = safe(input.authorName, "Der Autor");

  return AD_ANGLES.map((angle) => {
    const headlines = META_HEADLINES[angle.id] ?? META_HEADLINES.emotionalTrope;
    const primaryTexts = META_PRIMARY_TEXTS[angle.id] ?? META_PRIMARY_TEXTS.emotionalTrope;
    const descriptions = META_DESCRIPTIONS[angle.id] ?? META_DESCRIPTIONS.emotionalTrope;

    const headline = pick(headlines, rng);
    const primaryText = pick(primaryTexts, rng);
    const description = pick(descriptions, rng);
    const callToAction = pick(META_CTAS, rng);

    return {
      angleId: angle.id,
      headline: `${title} — ${headline}`,
      primaryText: `${primaryText} ${protagonist} erlebt eine Reise, die Sie nicht vergessen werden.`,
      description: `${description} Von ${authorName}.`,
      callToAction,
    };
  });
}

// ---------------------------------------------------------------------------
// 3. Amazon Sponsored Ads
// ---------------------------------------------------------------------------

export interface AmazonAdInput {
  title: string;
  genre: string;
  protagonist: string;
  antagonist?: string;
  tropes?: string[];
  keywords?: string[];
}

export interface AmazonAd {
  headline: string;
  keywords: string[];
  matchType: string;
  description: string;
}

const AMAZON_HEADLINES: Record<string, string[]> = {
  krimi: [
    "Krimi-Thriller: Der Schatten der Wahrheit — Jetzt entdecken",
    "Mystery & Krimi: Eine Wahrheit, die niemand sehen will",
    "Krimi-Bestseller: Mord, Geheimnisse, unvorhersehbare Twists",
  ],
  thriller: [
    "Thriller: Verschwörung, Countdown, ein Mann gegen alle",
    "Spannung pur: Der Thriller, der Sie nicht loslässt",
    "Thriller-Bestseller: Jede Seite eine Überraschung",
  ],
  fantasy: [
    "Fantasy-Epos: Eine verborgene Welt, eine uralte Prophezeiung",
    "Fantasy-Abenteuer: Magie, Schicksal, unvergessliche Charaktere",
    "Fantasy-Bestseller: Tauchen Sie ein in eine andere Welt",
  ],
  "science-fiction": [
    "Sci-Fi: Eine Zukunft, die niemand wollte",
    "Science-Fiction: Das Geheimnis, das die Menschheit bedroht",
    "Sci-Fi-Thriller: Technologie, Intrigen, Überleben",
  ],
  romantik: [
    "Liebesroman: Zwei Menschen, ein Zufall, eine verbotene Liebe",
    "Romantik: Eine Liebe, die nicht sein dürf — und doch alles ist",
    "Liebesgeschichte: Emotionen, die bleiben",
  ],
  horror: [
    "Horror: Ein Ort, an dem die Dunkelheit lebt",
    "Horror-Thriller: Ein Geist, der nicht ruhen lässt",
    "Grusel & Horror: Schlaflos garantiert",
  ],
  historisch: [
    "Historischer Roman: Eine Epoche im Wandel",
    "Historische Fiction: Eine Entscheidung, die Geschichte schreibt",
    "Historischer Bestseller: Vergangenheit, die präsent bleibt",
  ],
  dystopie: [
    "Dystopie: Eine Gesellschaft ohne Freiheit",
    "Dystopischer Thriller: Ein Funke Hoffnung, der alles aufs Spiel setzt",
    "Dystopie-Bestseller: Zukunft, die Sie erschauern lässt",
  ],
  default: [
    "Bestseller-Roman: Eine Geschichte, die unter die Haut geht",
    "Pageturner: Unvorhersehbar bis zur letzten Seite",
    "Neuer Roman: Jetzt entdecken — Leser lieben es",
  ],
};

const AMAZON_KEYWORDS: Record<string, string[]> = {
  krimi: ["krimi", "thriller", "mord", "mystery", "ermittler", "tatort", "verdächtiger"],
  thriller: ["thriller", "verschwörung", "spannung", "countdown", "geheimnis", "intrieger"],
  fantasy: ["fantasy", "magie", "prophezeiung", "welt", "abenteuer", "epos", "zauber"],
  "science-fiction": ["sci-fi", "science-fiction", "zukunft", "technologie", "menschheit", "system"],
  romantik: ["liebesroman", "romantik", "liebe", "herz", "gefühl", "beziehung"],
  horror: ["horror", "grusel", "geist", "dunkelkeit", "schrecken", "nacht"],
  historisch: ["historisch", "geschichte", "epoche", "vergangenheit", "roman"],
  dystopie: ["dystopie", "gesellschaft", "freiheit", "zukunft", "thriller"],
  default: ["bestseller", "roman", "pageturner", "spannung", "geschichte"],
};

const AMAZON_MATCH_TYPES: string[] = ["exact", "phrase", "broad"];

const AMAZON_DESCRIPTIONS: Record<string, string[]> = {
  krimi: [
    "Ein Krimi, der bis zur letzten Seite fesselt. Mord, Geheimnisse und unvorhersehbare Twists.",
    "Tauchen Sie ein in eine Welt voller Intrigen und Gefahr. Jede Spur führt tiefer ins Dunkel.",
  ],
  thriller: [
    "Ein Thriller, der Sie nicht loslässt. Verschwörung, Countdown und ein Protagonist, der alles riskiert.",
    "Spannung pur: Jede Seite eine Überraschung, jede Wendung ein Schock.",
  ],
  fantasy: [
    "Ein Fantasy-Epos, das Sie in eine andere Welt entführt. Magie, Schicksal und unvergessliche Charaktere.",
    "Tauchen Sie ein in eine Welt voller Wunder und Gefahren. Eine Prophezeiung, die alles verändert.",
  ],
  "science-fiction": [
    "Ein Sci-Fi-Thriller, der die Zukunft der Menschheit in Frage stellt. Technologie, Intrigen, Überleben.",
    "Eine Zukunft, die niemand wollte. Ein Geheimnis, das alles verändert.",
  ],
  romantik: [
    "Ein Liebesroman, der Ihr Herz berühren wird. Zwei Menschen, ein Zufall, eine Liebe, die nicht sein darf.",
    "Emotionen, die bleiben. Eine Geschichte über die Kraft der Liebe.",
  ],
  horror: [
    "Ein Horror-Roman, der Sie schlaflos macht. Ein Ort, an dem die Dunkelheit lebt.",
    "Grusel und Spannung: Ein Geist, der nicht ruhen lässt, und ein Protagonist, der nicht aufgibt.",
  ],
  historisch: [
    "Ein historischer Roman, der die Vergangenheit lebendig werden lässt. Eine Epoche im Wandel.",
    "Geschichte, die präsent bleibt. Eine Entscheidung, die alles verändert.",
  ],
  dystopie: [
    "Ein dystopischer Thriller, der Sie erschauern lässt. Eine Gesellschaft ohne Freiheit.",
    "Ein Funke Hoffnung, der alles aufs Spiel setzt. Eine Zukunft, die Sie nicht vergessen werden.",
  ],
  default: [
    "Ein Roman, der unter die Haut geht. Unvorhersehbar, fesselnd, unvergesslich.",
    "Eine Geschichte, die Sie nicht vergessen werden. Jetzt entdecken.",
  ],
};

export function generateAmazonAds(
  input: AmazonAdInput,
  seed: number
): AmazonAd[] {
  const rng = createSeededRandom(hashString(`amazon:${input.title}:${input.genre}:${seed}`));

  const genre = safe(input.genre, "default").toLowerCase();

  const headlines = AMAZON_HEADLINES[genre] ?? AMAZON_HEADLINES.default;
  const keywords = AMAZON_KEYWORDS[genre] ?? AMAZON_KEYWORDS.default;
  const descriptions = AMAZON_DESCRIPTIONS[genre] ?? AMAZON_DESCRIPTIONS.default;

  const headline = pick(headlines, rng);
  const description = pick(descriptions, rng);
  const matchType = pick(AMAZON_MATCH_TYPES, rng);

  // Stelle sicher, dass die Headline unter 150 Zeichen bleibt
  const finalHeadline = headline.length < 150 ? headline : truncate(headline, 149);

  // Wähle 3-5 Keywords
  const numKeywords = 3 + Math.floor(rng() * 3); // 3-5
  const selectedKeywords: string[] = [];
  const availableKeywords = [...keywords];
  for (let i = 0; i < numKeywords && availableKeywords.length > 0; i++) {
    const idx = Math.floor(rng() * availableKeywords.length);
    selectedKeywords.push(availableKeywords[idx]);
    availableKeywords.splice(idx, 1);
  }

  return [
    {
      headline: finalHeadline,
      keywords: selectedKeywords,
      matchType,
      description,
    },
  ];
}

// ---------------------------------------------------------------------------
// Factory-Funktionen
// ---------------------------------------------------------------------------

export function createSampleAdBrief(): MetaAdInput {
  return {
    title: "Der Schatten der Wahrheit",
    genre: "thriller",
    protagonist: "Max Berger",
    antagonist: "Der Schatten",
    tropes: ["morally-grey", "slow-burn", "secret-identity"],
    authorName: "Anna Müller",
  };
}

export function createSampleAdSet(): {
  brief: MetaAdInput;
  blurb: BlurbArchitecture;
  metaAds: MetaAd[];
  amazonAds: AmazonAd[];
} {
  const brief = createSampleAdBrief();
  const seed = 42;

  const blurb = buildBlurbArchitecture(brief, seed);
  const metaAds = generateMetaAds(brief, seed);
  const amazonAds = generateAmazonAds(brief, seed);

  return {
    brief,
    blurb,
    metaAds,
    amazonAds,
  };
}
