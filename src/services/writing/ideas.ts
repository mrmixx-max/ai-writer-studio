// Ideen-Generator: Plot-Twists, Konflikte, Settings generieren.
export interface IdeaSeed {
  id: string;
  category: string;
  title: string;
  description: string;
}

const PLOT_TWISTS = [
  "Der Protagonist ist der Bösewicht — er hat es nur vergessen.",
  "Der Mentor hat den ganzen Zeit gelogen.",
  "Die Prophezeiung wurde falsch übersetzt.",
  "Der Feind ist eine Zukunftversion des Helden.",
  "Die Welt ist eine Simulation — aber nicht auf die Art, die jeder denkt.",
  "Der verlorene Schatz war die ganze Zeit in Sichtweite.",
  "Der Verräter ist der beste Freund — aus gutem Grund.",
  "Der Held hat bereits alles einmal durchlebt (Zeitschleife).",
  "Die Magie existiert nicht — aber der Glaube daran macht sie real.",
  "Der wahre Feind ist das System, nicht die Person darin.",
];

const CONFLICTS = [
  "Zwei Freunde lieben dieselbe Person.",
  "Familienpflicht vs. eigener Traum.",
  "Wahrheit ansagen vs. alle verlieren.",
  "Rache vs. Vergebung.",
  "Überleben vs. Moral.",
  "Loyalität zum Staat vs. Loyalität zur Familie.",
  "Fortschritt vs. Tradition.",
  "Liebe vs. Pflicht.",
  "Gerechtigkeit vs. Barmherzigkeit.",
  "Freiheit vs. Sicherheit.",
];

const SETTINGS = [
  "Eine Stadt, in der es nie dunkel wird.",
  "Eine Welt ohne Metall — alle Technik aus Knochen.",
  "Ein Kontinent, der langsam versinkt.",
  "Eine Gesellschaft, in der Träume geteilt werden können.",
  "Eine Insel, auf der die Zeit rückwärts läuft.",
  "Eine Wüste, in der es unter Wasser Städte gibt.",
  "Ein Wald, der sich bewegt und Reisende gefangen hält.",
  "Eine Stadt in den Wolken — nur für die Reichen.",
  "Eine Welt, in der Schatten eigenes Leben haben.",
  "Ein Planet mit zwei Sonnen — und einer dunklen Seite.",
];

const CHARACTER_FLAWS = [
  "Kann nicht nein sagen.",
  "Hat eine unkontrollierbare Angst.",
  "Ist süchtig nach etwas Ungewöhnlichem.",
  "Vertraut niemandem — zu Recht.",
  "Lügt immer, auch wenn die Wahrheit besser wäre.",
  "Ist zu stolz um Hilfe anzunehmen.",
  "Hat ein dunkles Geheimnis aus der Vergangenheit.",
  "Kann nicht still sitzen — muss immer handeln.",
  "Ist zu nachgiebig — wird ausgenutzt.",
  "Hat einen unstillbaren Durst nach Rache.",
];

export function generateIdeas(type: "plot" | "conflict" | "setting" | "flaw", count: number = 5): IdeaSeed[] {
  const pools = {
    plot: PLOT_TWISTS,
    conflict: CONFLICTS,
    setting: SETTINGS,
    flaw: CHARACTER_FLAWS,
  };
  const pool = pools[type];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((text, i) => ({
    id: `${type}-${Date.now()}-${i}`,
    category: type,
    title: text.split("—")[0].trim(),
    description: text,
  }));
}

export function generateRandomPrompt(): string {
  const prompts = [
    "Was passiert, wenn der Held plötzlich alles verliert?",
    "Wer hat ein Motiv, den Protagonisten zu täuschen?",
    "Was ist das größte Geheimnis in deiner Welt?",
    "Welche Regel deiner Welt wird gebrochen — und was passiert dann?",
    "Was will der Antagonist wirklich — und warum?",
    "Welche Beziehung in deiner Geschichte ist eine Lüge?",
    "Was wäre, wenn der Held unrecht hat?",
    "Welcher Charakter hat den größten Charakterbogen?",
    "Was ist der Wendepunkt in Akt 2?",
    "Wie endet deine Geschichte — und ist das das Ende?",
  ];
  return prompts[Math.floor(Math.random() * prompts.length)];
}
