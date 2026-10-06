// EldritchSensoryWeaver (WP 73.1)
//
// Generiert multisensorische Prosa für Lovecraft-horror und Alien-Szenarien:
// unheimliche Geräusche, unbeschreibliche Gerüche, widerliche Texturen.
//
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

/** Sensorische Kategorie. */
export type SenseCategory = "sound" | "smell" | "touch" | "sight" | "taste";

/** Ein sensorischer Eintrag. */
export interface SensoryEntry {
  category: SenseCategory;
  description: string;
  intensity: number; // 0-100
}

/** Eine generierte sensorische Szene. */
export interface SensoryScene {
  title: string;
  entries: SensoryEntry[];
  overallDread: number; // 0-100
}

/** Vorlagen für unheimliche Geräusche. */
const SOUND_TEMPLATES: string[] = [
  "ein leises, rhythmisches Kratzen, als würde etwas aus dem Inneren der Wände kratzen",
  "ein gellender Schrei, der in der Ferne verhallt und nie ganz verstummt",
  "ein feises Flüstern, das Worte zu formen scheint, die kein Mensch kennen sollte",
  "das Tropfen einer unbekannten Flüssigkeit, die in unregelmäßigen Abständen ertönt",
  "ein tiefes, vibrierendes Brummen, das in den Knochen nachzuklingen scheint",
  "das Knarren von Holz, das sich unter einer unsichtbaren Last biegt",
  "ein hoher, durchdringender Ton, der an die Sirene eines Schiffes erinnert, doch fremdartiger ist",
  "das Rascheln von etwas, das sich durch enge Gänge bewegt, gefolgt von Stille",
];

/** Vorlagen für unheimliche Gerüche. */
const SMELL_TEMPLATES: string[] = [
  "ein beißender, chemischer Geruch, der an verrottendes Gemüse und Ozon erinnert",
  "der süßliche Duft von verwesendem Fleisch, mit einem Hauch von etwas Blutigem",
  "ein erdiger, modriger Geruch, der tief aus der Erde zu kommen scheint",
  "der scharfe Gestank von Schwefel, gemischt mit etwas Süßlichem, das den Magen umdreht",
  "ein kalter, metallischer Geruch, der an altes Blut und rostendes Eisen erinnert",
  "der Duft von verbranntem Haar, vermischt mit einem Hauch von etwas Unbekanntem",
  "ein schwerer, stickiger Geruch, der an vergessene Kellergewölbe erinnert",
  "der beißende Geruch von Chlor, der in den Lungen brennt und die Kehle reizt",
];

/** Vorlagen für unheimliche Texturen. */
const TOUCH_TEMPLATES: string[] = [
  "eine schleimige, glitschige Oberfläche, die sich anfühlt wie nasse Haut",
  "eine raue, körnige Textur, die unter den Fingern zerfällt wie trockener Sand",
  "eine kalte, glatte Oberfläche, die an poliertes Glas erinnert, doch lebendig ist",
  "eine weiche, nachgiebige Masse, die sich unter Druck verformt und nicht zurückkehrt",
  "eine stachelige, raue Struktur, die an Dornen erinnert, doch weicher ist",
  "eine feuchte, klebrige Schicht, die an den Fingern haftet und nicht mehr verschwindet",
  "eine harte, knochige Oberfläche, die unter den Nägeln knirscht",
  "eine seidige, kühle Textur, die angenehm ist, doch etwas Falsches hat",
];

/** Vorlagen für unheimliche Sicht. */
const SIGHT_TEMPLATES: string[] = [
  "ein flackerndes, bläuliches Licht, das Schatten wirft, die sich falsch bewegen",
  "eine Form, die sich nicht erfassen lässt, als würde sie sich aus dem Blickwind ziehen",
  "ein Muster aus Linien und Winkeln, das den Verstand zu überfordern scheint",
  "eine Bewegung am Rand des Blickfelds, die verschwindet, wenn man hinsieht",
  "eine Farbe, die es nicht geben sollte, die in der Luft schwebt und pulsiert",
  "ein Schatten, der größer ist als sein Urheber, und sich langsam ausdehnt",
  "ein Glitzern in der Dunkelheit, das an Edelsteine erinnert, doch organisch ist",
  "eine Verzerrung der Luft, als würde die Realität selbst atmen",
];

/** Vorlagen für unheimliche Geschmäcker. */
const TASTE_TEMPLATES: string[] = [
  "ein metallischer Geschmack, der an frisches Blut erinnert und die Zunge brennen lässt",
  "ein süßlicher, klebriger Geschmack, der im Haften bleibt und nicht mehr verschwindet",
  "ein bitterer, erdiger Geschmack, der an verrottetes Holz erinnert",
  "ein scharfer, beißender Geschmack, der die Geschmacksnerven überreizt",
  "ein kalter, loser Geschmack, der an Eis erinnert, doch lebendig ist",
  "ein salziger, brackiger Geschmack, der an Meerwasser erinnert, doch fremdartiger ist",
  "ein saurer, fruchtiger Geschmack, der angenehm beginnt und schrecklich endet",
  "ein nackter, leerer Geschmack, der den Mund auszusaugen scheint",
];

/** Alle Vorlagen nach Kategorie. */
const TEMPLATES: Record<SenseCategory, string[]> = {
  sound: SOUND_TEMPLATES,
  smell: SMELL_TEMPLATES,
  touch: TOUCH_TEMPLATES,
  sight: SIGHT_TEMPLATES,
  taste: TASTE_TEMPLATES,
};

/** Kategorie-Labels. */
export const CATEGORY_LABELS: Record<SenseCategory, string> = {
  sound: "Gehör",
  smell: "Geruch",
  touch: "Tastsinn",
  sight: "Sehen",
  taste: "Geschmack",
};

/** Wählt einen deterministischen Eintrag aus einer Vorlagen-Liste. */
export function pickTemplate(templates: string[], seed: number, index: number): string {
  const rng = createSeededRandom(seed + index);
  const idx = Math.floor(rng() * templates.length);
  return templates[idx];
}

/** Generiert eine sensorische Szene. */
export function generateSensoryScene(title: string, seed: number = 42): SensoryScene {
  const categories: SenseCategory[] = ["sound", "smell", "touch", "sight", "taste"];
  const entries: SensoryEntry[] = categories.map((cat, i) => {
    const templates = TEMPLATES[cat];
    const description = pickTemplate(templates, seed, i);
    const rng = createSeededRandom(seed + i * 100);
    const intensity = 30 + Math.floor(rng() * 70);
    return { category: cat, description, intensity };
  });

  const overallDread = Math.round(entries.reduce((sum, e) => sum + e.intensity, 0) / entries.length);

  return { title, entries, overallDread };
}

/** Generiert mehrere Szenen. */
export function generateSensoryScenes(titles: string[], seed: number = 42): SensoryScene[] {
  return titles.map((title, i) => generateSensoryScene(title, seed + i * 1000));
}

/** Formatiert eine sensorische Szene als Text. */
export function formatSensoryScene(scene: SensoryScene): string {
  const lines: string[] = [];
  lines.push(`=== ${scene.title} ===`);
  lines.push(`Gesamtschrecken: ${scene.overallDread}%`);
  lines.push("");
  for (const entry of scene.entries) {
    lines.push(`${CATEGORY_LABELS[entry.category]} (${entry.intensity}%): ${entry.description}`);
  }
  return lines.join("\n");
}

/** Formatiert mehrere Szenen. */
export function formatSensoryScenes(scenes: SensoryScene[]): string {
  return scenes.map(formatSensoryScene).join("\n\n");
}

/** Berechnet die durchschnittliche Intensität einer Szene. */
export function computeAverageIntensity(scene: SensoryScene): number {
  if (scene.entries.length === 0) return 0;
  return Math.round(scene.entries.reduce((sum, e) => sum + e.intensity, 0) / scene.entries.length);
}

/** Findet den intensivsten Eintrag einer Szene. */
export function findMostIntenseEntry(scene: SensoryScene): SensoryEntry | null {
  if (scene.entries.length === 0) return null;
  return scene.entries.reduce((max, e) => (e.intensity > max.intensity ? e : max));
}

/** Prüft, ob eine Szene besonders beängstigend ist. */
export function isDreadful(scene: SensoryScene, threshold: number = 70): boolean {
  return scene.overallDread >= threshold;
}
