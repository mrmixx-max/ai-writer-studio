// alliterativeKenningWeaver.ts (WP 97.1)
// Stabreim- & Altnordischer Kenning-Weaver

export interface AlliterativeKenningProfile {
  id: string;
  theme: "war" | "kingship" | "ships" | "death" | "love" | "nature" | "fate";
  kennings: Kenning[];
  alliterativeVerses: AlliterativeVerse[];
  speeches: OldNorseSpeech[];
  seed: number;
}

export interface Kenning {
  baseConcept: string;
  kenning: string;
  components: string[]; // the two parts of the kenning
  alliteration: string; // the alliterating sound
}

export interface AlliterativeVerse {
  line: string;
  firstHalf: string; // before caesura
  secondHalf: string; // after caesura
  alliteration: string;
  stressPattern: "AA|A" | "A|AA" | "AX|A"; // simplified notation
}

export interface OldNorseSpeech {
  type: "graveSpeech" | "warriorOath" | "prophecy" | "praisePoem";
  title: string;
  lines: string[];
}

const KENNING_BASES = {
  war: ["Schwert", "Schild", "Schlacht", "Krieger", "Blut", "Sieger", "Besiegter", "Pfeil", "Bogen", "Rüstung"],
  kingship: ["König", "Thron", "Krone", "Reich", "Gesetz", "Richter", "Gold", "Saal", "Diener", "Eid"],
  ships: ["Schiff", "Meer", "Welle", "Wind", "Ruder", "Mast", "Segel", "Steuermann", "Hafen", "Sturm"],
  death: ["Tod", "Grab", "Sarg", "Seele", "Jenseits", "Walküre", "Hel", "Aschen", "Knochen", "Schweigen"],
  love: ["Herz", "Liebste", "Treue", "Kuss", "Sehnsucht", "Ehe", "Bund", "Träne", "Versprechen", "Ewigkeit"],
  nature: ["Berg", "Wald", "Fluss", "Sonne", "Mond", "Stern", "Wolke", "Donner", "Eis", "Feuer"],
  fate: ["Schicksal", "Nornen", "Faden", "Webstuhl", "Schere", "Los", "Vorsehung", "Zeit", "Ende", "Anfang"],
};

const KENNING_MODIFIERS = {
  war: ["Blut-", "Eisen-", "Stahl-", "Kampf-", "Sieges-", "Todes-", "Helden-", "Wut-", "Schlacht-", "Waffen-"],
  kingship: ["Gold-", "Thron-", "Kronen-", "Reichs-", "Herrscher-", "Edel-", "Mächtig-", "Weise-", "Ewige-", "Heilige-"],
  ships: ["Wellen-", "Meeres-", "Sturm-", "Wind-", "Salz-", "Tiefen-", "Weiten-", "Nord-", "Eis-", "See-"],
  death: ["Grabes-", "Toten-", "Seelen-", "End-", "Aschen-", "Knochen-", "Schatten-", "Nacht-", "Ewige-", "Stille-"],
  love: ["Herzens-", "Seelen-", "Treue-", "Liebes-", "Sinn-", "Glut-", "Flammen-", "Zarte-", "Ewige-", "Heilige-"],
  nature: ["Ur-", "Uralt-", "Wilde-", "Freie-", "Ewige-", "Mächtige-", "Stille-", "Laute-", "Helle-", "Dunkle-"],
  fate: ["Nornen-", "Fadens-", "Webens-", "Schicksals-", "Unabwendbar-", "Ur-", "End-", "Anfangs-", "Zeit-", "Los-"],
};

const KENNING_SUFFIXES = {
  war: ["-träger", "-tänzer", "-sänger", "-bringer", "-hüter", "-wächter", "-meister", "-fürst", "-könig", "-gott"],
  kingship: ["-herr", "-wächter", "-hüter", "-richter", "-geber", "-nehmer", "-lenker", "-bauer", "-gründer", "-erhalter"],
  ships: ["-reiter", "-läufer", "-gleiter", "-tänzer", "-pfad", "-weg", "-straße", "-pfleger", "-hüter", "-freund"],
  death: ["-sammler", "-richter", "-begleiter", "-wärter", "-hüter", "-diener", "-bote", "-freund", "-feind", "-bruder"],
  love: ["-hüter", "-wächter", "-sänger", "-träger", "-geber", "-empfänger", "-sucher", "-finder", "-halter", "-verlierer"],
  nature: ["-wächter", "-hüter", "-sänger", "-kind", "-freund", "-diener", "-meister", "-gott", "-geist", "-dämon"],
  fate: ["-weber", "-schneider", "-spinner", "-leser", "-deuter", "-kenner", "-folger", "-fliehende", "-suchende", "-findende"],
};

const ALLITERATION_SOUNDS = [
  "b", "d", "f", "g", "h", "k", "l", "m", "n", "r", "s", "t", "w", "z",
  "st", "str", "sch", "tr", "dr", "br", "gr", "kr", "pr", "fr",
];

const VERSE_TEMPLATES = {
  war: [
    "{allit}Blitzend bricht das {base} im {mod}{suffix}",
    "{allit}Stark steht der {base} im {mod}{suffix}",
    "{allit}Wütend wallt das {base} zum {mod}{suffix}",
  ],
  kingship: [
    "{allit}Weise waltet der {base} als {mod}{suffix}",
    "{allit}Ewig ehrt das {base} den {mod}{suffix}",
    "{allit}Mächtig mahnt der {base} den {mod}{suffix}",
  ],
  ships: [
    "{allit}Sanft segelt das {base} zum {mod}{suffix}",
    "{allit}Wild wallt das {base} gen {mod}{suffix}",
    "{allit}Fest findet das {base} den {mod}{suffix}",
  ],
  death: [
    "{allit}Still sinkt der {base} zum {mod}{suffix}",
    "{allit}Endlich endet der {base} im {mod}{suffix}",
    "{allit}Schwer schreitet der {base} zum {mod}{suffix}",
  ],
  love: [
    "{allit}Zart sucht das {base} den {mod}{suffix}",
    "{allit}Ewig eint das {base} mit {mod}{suffix}",
    "{allit}Heiß haftet das {base} am {mod}{suffix}",
  ],
  nature: [
    "{allit}Ur-alte {base} wacht als {mod}{suffix}",
    "{allit}Wild webt die {base} zum {mod}{suffix}",
    "{allit}Ewig endet die {base} im {mod}{suffix}",
  ],
  fate: [
    "{allit}Unabwendbar webt das {base} zum {mod}{suffix}",
    "{allit}Sicher schneidet das {base} den {mod}{suffix}",
    "{allit}Endlich endet das {base} als {mod}{suffix}",
  ],
};

const SPEECH_TEMPLATES = {
  graveSpeech: {
    titles: ["Grabrede für einen Gefallenen", "Abschiedsworte am offenen Grab", "Letzter Gruß an den Verblichenen"],
    lines: [
      "Hier ruht {name}, der {kenning1} war",
      "Sein {kenning2} hallt noch in den Hallen wider",
      "Die {kenning3} tragen seinen Namen gen {kenning4}",
      "Kein {kenning5} vermag sein Andenken zu tilgen",
      "Ruhe sanft, du {kenning6}, bis die Welt neu erwacht",
    ],
  },
  warriorOath: {
    titles: ["Krieger-Eid vor der Schlacht", "Schwur auf das heilige Schwert", "Blutbund der Bruderschaft"],
    lines: [
      "Bei {kenning1} und {kenning2} schwöre ich",
      "Mein {kenning3} soll nie zerspringen",
      "Gegen {kenning4} und {kenning5} stelle ich mich",
      "Mein {kenning6} ist mein Zeuge",
      "So wahr mir die {kenning7} helfe",
    ],
  },
  prophecy: {
    titles: ["Weissagung der Nornen", "Vision am Weltenbaum", "Traumdeutung des Sehers"],
    lines: [
      "Wenn {kenning1} das {kenning2} berührt",
      "Wird {kenning3} den {kenning4} zerreißen",
      "Dann steigt {kenning5} aus der {kenning6}",
      "Und {kenning7} wird das neue {kenning8} sein",
      "So spricht das {kenning9}, so webt das {kenning10}",
    ],
  },
  praisePoem: {
    titles: ["Lobpreis auf den König", "Preislied für den Helden", "Dankgesang für den Sieg"],
    lines: [
      "Preiset {name}, den {kenning1}!",
      "Sein {kenning2} leuchtet wie {kenning3}",
      "Kein {kenning4} vermag ihm zu widerstehen",
      "Die {kenning5} singen sein {kenning6}",
      "Ewig sei sein {kenning7} in unseren {kenning8}",
    ],
  },
};

export function hashString(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), 0x2c9b3d);
    z = Math.imul(z ^ (z >>> 13), 0x29712d);
    return ((z ^ (z >>> 16)) >>> 0) / 4294967296;
  };
}

function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  if (!arr || arr.length === 0) return undefined as unknown as T;
  const idx = Math.min(Math.floor(rng() * arr.length), arr.length - 1);
  return arr[idx];
}

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateKennings(theme: AlliterativeKenningProfile["theme"], rng: () => number): Kenning[] {
  const bases = KENNING_BASES[theme];
  const modifiers = KENNING_MODIFIERS[theme];
  const suffixes = KENNING_SUFFIXES[theme];
  const sounds = ALLITERATION_SOUNDS;
  const kennings: Kenning[] = [];
  const numKennings = 5 + Math.floor(rng() * 5);

  for (let i = 0; i < numKennings; i++) {
    const base = pickRandom(bases, rng) || bases[0];
    const modifier = pickRandom(modifiers, rng) || modifiers[0];
    const suffix = pickRandom(suffixes, rng) || suffixes[0];
    const sound = pickRandom(sounds, rng) || sounds[0];

    // Create kenning with alliteration
    const kenning = `${modifier}${base}${suffix}`;
    const components = [modifier.replace("-", ""), base, suffix.replace("-", "")];

    kennings.push({
      baseConcept: base,
      kenning,
      components,
      alliteration: sound,
    });
  }
  return kennings;
}

function generateAlliterativeVerses(theme: AlliterativeKenningProfile["theme"], kennings: Kenning[], rng: () => number): AlliterativeVerse[] {
  const templates = VERSE_TEMPLATES[theme];
  const verses: AlliterativeVerse[] = [];
  const numVerses = 4 + Math.floor(rng() * 4);

  for (let i = 0; i < numVerses; i++) {
    const template = pickRandom(templates, rng) || templates[0];
    const kenning = pickRandom(kennings, rng);
    const sound = kenning?.alliteration || pickRandom(ALLITERATION_SOUNDS, rng) || "b";

    const base = kenning?.baseConcept || pickRandom(KENNING_BASES[theme], rng) || "Ding";
    const mod = pickRandom(KENNING_MODIFIERS[theme], rng) || "Ur-";
    const suffix = pickRandom(KENNING_SUFFIXES[theme], rng) || "-wächter";

    const line = template
      .replace("{allit}", sound.toUpperCase())
      .replace("{base}", base)
      .replace("{mod}", mod)
      .replace("{suffix}", suffix);

    // Split at caesura (roughly middle)
    const words = line.split(" ");
    const mid = Math.floor(words.length / 2);
    const firstHalf = words.slice(0, mid).join(" ");
    const secondHalf = words.slice(mid).join(" ");

    verses.push({
      line,
      firstHalf,
      secondHalf,
      alliteration: sound,
      stressPattern: "AA|A",
    });
  }
  return verses;
}

function generateSpeeches(kennings: Kenning[], rng: () => number): OldNorseSpeech[] {
  const speechTypes = ["graveSpeech", "warriorOath", "prophecy", "praisePoem"] as const;
  const speeches: OldNorseSpeech[] = [];
  const numSpeeches = 1 + Math.floor(rng() * 2);

  for (let i = 0; i < numSpeeches; i++) {
    const type = pickRandom(speechTypes, rng);
    const template = SPEECH_TEMPLATES[type];
    if (!template) continue;
    const title = pickRandom(template.titles, rng) || template.titles[0];
    const shuffledKennings = shuffleArray([...kennings], rng);

    const lines = template.lines.map(line => {
      let result = line;
      const kenningMatches = line.match(/{kenning\d+}/g) || [];
      kenningMatches.forEach((match, idx) => {
        const kenning = shuffledKennings[idx % shuffledKennings.length];
        result = result.replace(match, kenning?.kenning || "das Unbenannte");
      });
      result = result.replace("{name}", "der Held");
      return result;
    });

    speeches.push({ type, title, lines });
  }
  return speeches;
}

export function createAlliterativeKenningProfile(
  theme: "war" | "kingship" | "ships" | "death" | "love" | "nature" | "fate" = "war",
  seed: number = 42
): AlliterativeKenningProfile {
  const rng = createSeededRandom(hashString(theme + seed));
  const kennings = generateKennings(theme, rng);
  const alliterativeVerses = generateAlliterativeVerses(theme, kennings, rng);
  const speeches = generateSpeeches(kennings, rng);

  return {
    id: `KENN-${hashString(theme + seed).toString(16).padStart(8, "0").toUpperCase()}`,
    theme,
    kennings,
    alliterativeVerses,
    speeches,
    seed,
  };
}

export function formatAlliterativeKenningProfile(profile: AlliterativeKenningProfile): string {
  const lines = [
    `═══ STABREIM & KENNING-WEBER ═══`,
    `ID: ${profile.id}`,
    `Thema: ${profile.theme}`,
    `Seed: ${profile.seed}`,
    `═══ KENNINGAR ═══`,
  ];

  for (const kenning of profile.kennings) {
    lines.push(`${kenning.kenning} (für ${kenning.baseConcept}) — Alliteration: ${kenning.alliteration} — Bestandteile: ${kenning.components.join(" + ")}`);
  }

  lines.push(`\n═══ STABREIM-VERSE ═══`);
  for (const verse of profile.alliterativeVerses) {
    lines.push(`${verse.firstHalf} || ${verse.secondHalf}`);
    lines.push(`  [Alliteration: ${verse.alliteration} | Metrum: ${verse.stressPattern}]`);
  }

  lines.push(`\n═══ REDEN & SCHWÜRE ═══`);
  for (const speech of profile.speeches) {
    lines.push(`\n--- ${speech.title} (${speech.type}) ---`);
    for (const line of speech.lines) {
      lines.push(line);
    }
  }

  return lines.join("\n");
}

export function createSampleProfile(): AlliterativeKenningProfile {
  return createAlliterativeKenningProfile("war", 777);
}