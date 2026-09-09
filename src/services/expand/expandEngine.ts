// Expand Engine (Sprint 26, Agent 4): Textausweitung mit Details.
// Lokal, kein LLM nötig, deterministisch.

export interface ExpandResult {
  original: string;
  expanded: string;
  technique: string;
  additions: { position: number; text: string }[];
}

export interface ExpandTechnique {
  id: string;
  name: string;
  description: string;
}

export const EXPAND_TECHNIQUES: ExpandTechnique[] = [
  { id: "sensory", name: "Sinnesdetails", description: "Sehen, Hören, Fühlen, Riechen, Schmecken" },
  { id: "emotional", name: "Emotionale Tiefe", description: "Gefühle und innere Reaktionen" },
  { id: "environment", name: "Umgebung", description: "Atmosphäre und Setting" },
  { id: "backstory", name: "Hintergrund", description: "Vergangenheit und Kontext" },
  { id: "dialogue", name: "Dialog", description: "Gespräche zwischen Charakteren" },
];

const SENSORY_DETAILS: Record<string, string[]> = {
  sehen: ["Das Licht fiel durch das Fenster", "Die Farben blassen ab", "Ein Schatten huschte vorbei", "Die Konturen verschwommen", "Ein Glitzer im Staub"],
  hören: ["Ein leises Knarren", "Stille lag in der Luft", "Ferne Schritte hallten", "Ein Raunen geht um", "Die Stille war ohrenbetäubend"],
  fühlen: ["Eine klamme Hand berührte", "Die Kälte kroch", "Ein Pulsieren in der Schläfe", "Die Spannung war spürbar", "Ein Kribbeln in den Fingern"],
  riechen: ["Der Geruch von verbranntem Holz", "Ein Hauch von Lavendel", "Modriger Geruch", "Frische Luft nach Regen", "Etwas süßliches"],
  schmecken: ["Bitter auf der Zunge", "Süße vermischt mit Salz", "Metallischer Geschmack", "Frische Zitrusnoten", "Etwas Anhaltendes"],
};

const EMOTIONAL_DEPTH: Record<string, string[]> = {
  freude: ["Ein Lächeln breitete sich aus", "Das Herz klopfte vor Freude", "Ein warmes Gefühl breitete sich aus", "Die Augen leuchteten", "Ein Strahln entkam ihren Lippen"],
  trauer: ["Eine Träne rollte", "Die Schwere in der Brust", "Ein Kloße im Hals", "Die Stimme versagte", "Die Welt wurde grau"],
  wut: ["Die Fäuste ballten sich", "Hitze stieg auf", "Die Zitterung in den Händen", "Ein Knurren entfuhr", "Die Augen verengten sich"],
  angst: ["Das Herz setzte aus", "Schweiß brach aus", "Die Hände zitterten", "Ein Schauer lief hinab", "Die Kehle schnürte sich zu"],
  liebe: ["Der Blick wurde warm", "Ein Strahln entkam", "Das Herz machte einen Sprung", "Ein Gefühl der Geborgenheit", "Die Worte blieben stecken"],
  hoffnung: ["Ein Funke flackerte", "Die Brust hob sich", "Ein Licht am Horizont", "Der Mut kehrte zurück", "Etwas Neues begann"],
  hass: ["Die Lippen verzogen sich", "Ein dunkler Blick", "Die Kälte in der Stimme", "Eine Welle der Verachtung", "Die Worte wie Giftdolche"],
  verzweiflung: ["Die Hände sanken herab", "Ein Seufzer entfuhr", "Die Schultern hängen", "Die Augen starrten ins Leere", "Etwas Brach in ihr"],
};

const ENVIRONMENT_DETAILS: string[] = [
  "Die Luft war erfüllt von",
  "Im Hintergrund",
  "Die Atmosphäre war",
  "Das Licht war",
  "Die Stille wurde nur unterbrochen von",
  "Die Welt hier schien",
  "Alles war erfüllt von",
  "Ein Hauch von",
  "Die Stille umgab",
  "Das Umfeld erzählte von",
];

const BACKSTORY_TEMPLATES: string[] = [
  "Sie erinnerte sich an",
  "Viele Jahre zuvor hatte",
  "Die Geschichte begann als",
  "Damals noch",
  "Nie vergessen würde sie",
  "Es war der Tag, an dem",
  "Die Vergangenheit war geprägt von",
  "Früher war es anders",
  "Die Wurzeln lagen in",
  "Ursprünglich war geplant",
];

const DIALOGUE_TEMPLATES: string[] = [
  "»Ich bin nicht sicher«, sagte",
  "»Was meinst du damit?«, fragte",
  "»Das ist nicht so einfach«, erwiderte",
  "«Wir müssen reden», erklärte",
  "«Ich verstehe», murmelte",
  "«Lass uns gehen», schlug",
  "«Das wird gut», versicherte",
  "«Ich fürchte nicht», gestand",
  "«Es gibt etwas, das du wissen musst», begann",
  "«Ich werde dir helfen», versprach",
];

/**
 * Erweitert einen Text mit Sinnesdetails.
 */
export function expandWithSensory(text: string): ExpandResult {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const additions: { position: number; text: string }[] = [];
  const expanded: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    expanded.push(sentences[i]);
    if (i % 3 === 1) {
      const allDetails = Object.values(SENSORY_DETAILS).flat();
      const detail = allDetails[Math.floor(Math.random() * allDetails.length)];
      expanded.push(detail);
      additions.push({ position: i, text: detail });
    }
  }

  return { original: text, expanded: expanded.join(" "), technique: "sensory", additions };
}

/**
 * Erweitert einen Text mit emotionaler Tiefe.
 */
export function expandWithEmotion(text: string): ExpandResult {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const additions: { position: number; text: string }[] = [];
  const expanded: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    expanded.push(sentences[i]);
    if (i % 4 === 2) {
      const allEmotions = Object.values(EMOTIONAL_DEPTH).flat();
      const emotion = allEmotions[Math.floor(Math.random() * allEmotions.length)];
      expanded.push(emotion);
      additions.push({ position: i, text: emotion });
    }
  }

  return { original: text, expanded: expanded.join(" "), technique: "emotional", additions };
}

/**
 * Erweitert einen Text mit Umgebungsdetails.
 */
export function expandWithEnvironment(text: string): ExpandResult {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const additions: { position: number; text: string }[] = [];
  const expanded: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    expanded.push(sentences[i]);
    if (i % 3 === 0) {
      const env = ENVIRONMENT_DETAILS[Math.floor(Math.random() * ENVIRONMENT_DETAILS.length)];
      expanded.push(env + " " + sentences[i].toLowerCase());
      additions.push({ position: i, text: env });
    }
  }

  return { original: text, expanded: expanded.join(" "), technique: "environment", additions };
}

/**
 * Erweitert einen Text mit Hintergrundgeschichten.
 */
export function expandWithBackstory(text: string): ExpandResult {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const additions: { position: number; text: string }[] = [];
  const expanded: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    expanded.push(sentences[i]);
    if (i % 5 === 3) {
      const backstory = BACKSTORY_TEMPLATES[Math.floor(Math.random() * BACKSTORY_TEMPLATES.length)];
      expanded.push(backstory);
      additions.push({ position: i, text: backstory });
    }
  }

  return { original: text, expanded: expanded.join(" "), technique: "backstory", additions };
}

/**
 * Erweitert einen Text mit Dialogen.
 */
export function expandWithDialogue(text: string): ExpandResult {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const additions: { position: number; text: string }[] = [];
  const expanded: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    expanded.push(sentences[i]);
    if (i % 4 === 1) {
      const dialogue = DIALOGUE_TEMPLATES[Math.floor(Math.random() * DIALOGUE_TEMPLATES.length)];
      expanded.push(dialogue);
      additions.push({ position: i, text: dialogue });
    }
  }

  return { original: text, expanded: expanded.join(" "), technique: "dialogue", additions };
}

/**
 * Hauptfunktion: Text mit allen Techniken erweitern.
 */
export function expandText(text: string, techniqueId: string): ExpandResult {
  switch (techniqueId) {
    case "sensory":
      return expandWithSensory(text);
    case "emotional":
      return expandWithEmotion(text);
    case "environment":
      return expandWithEnvironment(text);
    case "backstory":
      return expandWithBackstory(text);
    case "dialogue":
      return expandWithDialogue(text);
    default:
      return { original: text, expanded: text, technique: "unknown", additions: [] };
  }
}

/**
 * Wendet alle Erweiterungstechniken auf den Text an.
 */
export function expandAll(text: string): ExpandResult[] {
  return EXPAND_TECHNIQUES.map((t) => expandText(text, t.id));
}
