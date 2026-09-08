// Sprint 24, Agent 4: Prompt-Bibliothek — Engine (NEUE Datei).
//
// Strukturierte Prompt-Sammlung als duenne In-Memory-Registry mit
// best-effort localStorage-Persistenz (Guarded: faellt in Nicht-Browser-
// Umgebungen still auf reines In-Memory zurueck).
// - KEINE LLM-Calls: alles hier sind pure async Functions ueber der Registry.
// - Vordefinierte Prompts (23) decken alle sechs Kategorien ab.
// - Test-Helper `resetLibraryForTests` stellt den Ausgangszustand wieder her.

export type PromptCategory =
  | "writing"
  | "editing"
  | "research"
  | "marketing"
  | "business"
  | "creative";

export interface PromptVariable {
  name: string;
  label: string;
  defaultValue: string;
}

export interface LibraryPrompt {
  id: string;
  name: string;
  category: PromptCategory;
  description: string;
  prompt: string;
  variables: PromptVariable[];
  tags: string[];
  favorite: boolean;
  usageCount: number;
  createdAt: number;
}

export type NewLibraryPrompt = Omit<LibraryPrompt, "id" | "createdAt" | "usageCount">;

export const PROMPT_CATEGORIES: PromptCategory[] = [
  "writing",
  "editing",
  "research",
  "marketing",
  "business",
  "creative",
];

const STORAGE_KEY = "ai-writer-studio:prompt-library:v1";
const BASE_TS = 1700000000000;

function v(name: string, label: string, defaultValue = ""): PromptVariable {
  return { name, label, defaultValue };
}

function builtin(
  id: string,
  name: string,
  category: PromptCategory,
  description: string,
  prompt: string,
  variables: PromptVariable[],
  tags: string[],
  index: number,
): LibraryPrompt {
  return {
    id,
    name,
    category,
    description,
    prompt,
    variables,
    tags,
    favorite: false,
    usageCount: 0,
    createdAt: BASE_TS + index * 1000,
  };
}

/** Vordefinierte Prompts (23 — Vorgabe: 20+). */
const BUILTIN_PROMPTS: LibraryPrompt[] = [
  builtin(
    "kapitel-umschreiben", "Kapitel umschreiben", "writing",
    "Formuliert ein Kapitel neu — klarer, straffer, im gleichen Ton.",
    "Schreibe das folgende Kapitel um. Behalte Handlung, Figuren und Ton bei, aber formuliere klarer und straffer. Entferne Fuellwoerter und staerke den Einstieg:\n\n{{text}}",
    [v("text", "Kapiteltext")],
    ["rewrite", "kapitel", "stil"], 0,
  ),
  builtin(
    "dialog-verbessern", "Dialog verbessern", "writing",
    "Macht Dialoge natuerlicher — Subtext, Stimme, Rhythmus.",
    "Verbessere den folgenden Dialog. Jede Figur soll eine eigene Stimme behalten, Subtext statt Erklaerungen nutzen und der Schlagabtausch soll Rhythmus haben:\n\n{{dialog}}",
    [v("dialog", "Dialog")],
    ["dialog", "figuren"], 1,
  ),
  builtin(
    "spannung-aufbauen", "Spannung aufbauen", "writing",
    "Erhoeht die Spannung einer Szene ueber Pacing und Andeutungen.",
    "Baue in der folgenden Szene mehr Spannung auf: kuerzere Saetze an den entscheidenden Stellen, offene Fragen, Andeutungen statt Aufloesung. Nenne danach in 3 Stichpunkten, was du geaendert hast:\n\n{{szene}}",
    [v("szene", "Szene")],
    ["spannung", "pacing"], 2,
  ),
  builtin(
    "korrekturlesen", "Korrekturlesen", "editing",
    "Findet Rechtschreib-, Grammatik- und Zeichenfehler.",
    "Lies den folgenden Text Korrektur. Liste alle Rechtschreib-, Grammatik- und Zeichensetzungsfehler mit Korrekturvorschlag auf und gib danach den fehlerfreien Text zurueck:\n\n{{text}}",
    [v("text", "Text")],
    ["korrektur", "lektorat"], 3,
  ),
  builtin(
    "stil-verbessern", "Stil verbessern", "editing",
    "Glaettet Satzbau und Wortwahl, ohne die Stimme zu verlieren.",
    "Verbessere den Stil des folgenden Textes: abwechslungsreicher Satzbau, praezise Wortwahl, keine Fuellwoerter. Behalte die Erzaehlstimme bei:\n\n{{text}}",
    [v("text", "Text")],
    ["stil", "lektorat"], 4,
  ),
  builtin(
    "wortschatz-erweitern", "Wortschatz erweitern", "editing",
    "Ersetzt Wiederholungen durch treffende Synonyme.",
    "Der folgende Text wiederholt einige Woerter zu oft. Schlage fuer jede auffällige Wiederholung 3 Alternativen vor und gib eine ueberarbeitete Fassung zurueck:\n\n{{text}}",
    [v("text", "Text")],
    ["wortschatz", "synonyme"], 5,
  ),
  builtin(
    "recherche-notizen", "Recherche Notizen", "research",
    "Verdichtet Recherchematerial zu strukturierten Notizen.",
    "Fasse das folgende Recherchematerial in strukturierten Notizen zusammen: Kernaussagen als Stichpunkte, offene Fragen separat, Quellen am Ende:\n\n{{material}}",
    [v("material", "Recherchematerial")],
    ["recherche", "notizen"], 6,
  ),
  builtin(
    "marketing-text", "Marketing Text", "marketing",
    "Schreibt verkaufsstarken Buch-Marketingtext mit CTA.",
    "Schreibe einen Marketingtext (max. 150 Woerter) auf Basis der folgenden Infos. Tonalitaet: {{ton}}. Ende mit einer klaren Handlungsaufforderung:\n\n{{infos}}",
    [v("infos", "Buchinfos"), v("ton", "Tonalitaet", "begeistert-sachlich")],
    ["marketing", "werbung"], 7,
  ),
  builtin(
    "seo-optimierung", "SEO Optimierung", "marketing",
    "Optimiert Texte fuer Suchmaschinen — Keywords und Meta.",
    "Optimiere den folgenden Text fuer das Keyword {{keyword}}: natuerliche Keyword-Platzierung in Titel, Einleitung und Zwischenueberschriften, dazu Meta-Title (max. 60 Zeichen) und Meta-Description (max. 155 Zeichen):\n\n{{text}}",
    [v("keyword", "Keyword"), v("text", "Text")],
    ["seo", "sichtbarkeit"], 8,
  ),
  builtin(
    "kurzgeschichteidee", "Kurzgeschichteidee", "creative",
    "Generiert drei insignienreife Kurzgeschichten-Praemissen.",
    "Erfinde 3 Kurzgeschichten-Ideen zum Thema {{thema}}. Jede Idee: Titel, 2-Saetze-Praemisse, Ueberraschungsmoment. Genre: {{genre}}.",
    [v("thema", "Thema"), v("genre", "Genre", "Drama")],
    ["ideen", "kurzgeschichte"], 9,
  ),
  builtin(
    "charakter-entwickeln", "Charakter entwickeln", "creative",
    "Baut eine Figur mit Ziel, Wuende und Widerspruch.",
    "Entwickle eine Figur auf Basis der folgenden Stichworte. Gib zurueck: Name, aeusseres Ziel, inneres Beduerfnis, wunde Stelle, groesster Widerspruch, Sprechweise in einem Beispielsatz:\n\n{{stichworte}}",
    [v("stichworte", "Stichworte zur Figur")],
    ["figuren", "charakter"], 10,
  ),
  builtin(
    "welt-aufbauen", "Welt aufbauen", "creative",
    "Entwirft Setting-Regeln, Orte und Kultur im Ueberblick.",
    "Entwirf eine Welt-Skizze zu folgendem Konzept: 5 Orte, 3 gesellschaftliche Regeln, 1 Tabu, 1 Konflikt, der aus der Welt selbst entsteht:\n\n{{konzept}}",
    [v("konzept", "Weltkonzept")],
    ["worldbuilding", "setting"], 11,
  ),
  builtin(
    "plot-twist-finden", "Plot Twist finden", "writing",
    "Entwickelt drei faire, ueberraschende Wendungen.",
    "Schlage 3 Plot Twists fuer die folgende Ausgangslage vor. Jeder Twist muss rueckblickend fair angelegt sein (Hinweis, wo die Andeutung steht) und die Geschichte neu justieren:\n\n{{lage}}",
    [v("lage", "Ausgangslage")],
    ["plot", "twist"], 12,
  ),
  builtin(
    "konflikt-erhoehen", "Konflikt erhöhen", "writing",
    "Verschaerft den zentralen Konflikt einer Szene.",
    "Erhoehe den Konflikt in der folgenden Szene: Was steht konkret auf dem Spiel? Gib jeder Seite ein starkes Argument und verschiebe die Macht mindestens einmal:\n\n{{szene}}",
    [v("szene", "Szene")],
    ["konflikt", "drama"], 13,
  ),
  builtin(
    "aufloesung-schreiben", "Auflösung schreiben", "writing",
    "Schreibt eine befriedigende Aufloesung offener Faeden.",
    "Schreibe eine Aufloesung fuer die folgende Konstellation. Alle offenen Faeden aus {{faeden}} muessen beantwortet, das Thema in einem Schlusssatz verdichtet werden:\n\n{{konstellation}}",
    [v("konstellation", "Konstellation"), v("faeden", "Offene Faeden")],
    ["finale", "aufloesung"], 14,
  ),
  builtin(
    "beschreibung-beleben", "Beschreibung beleben", "writing",
    "Macht Beschreibungen sinnlich und konkret.",
    "Belebe die folgende Beschreibung: ersetze abstrakte Adjektive durch konkrete Sinnesdetails (sehen, hoeren, riechen, fuehlen), ein Vergleich pro Absatz:\n\n{{beschreibung}}",
    [v("beschreibung", "Beschreibung")],
    ["beschreibung", "sinnlichkeit"], 15,
  ),
  builtin(
    "tempo-erhoehen", "Tempo erhöhen", "writing",
    "Zieht langatmige Passagen straff ohne Infoverlust.",
    "Erhoehe das Tempo der folgenden Passage um ca. ein Drittel: kuerzen, straffen, Aktiv statt Passiv — keine Information darf verloren gehen:\n\n{{passage}}",
    [v("passage", "Passage")],
    ["tempo", "straffung"], 16,
  ),
  builtin(
    "perspektive-wechseln", "Perspektive wechseln", "writing",
    "Schreibt eine Szene aus anderer Erzaehlperspektive neu.",
    "Schreibe die folgende Szene aus der Perspektive von {{figur}} neu (Ich- oder Er-Perspektive nach Wahl). Was sieht, weiss und missversteht diese Figur?\n\n{{szene}}",
    [v("szene", "Szene"), v("figur", "Figur")],
    ["perspektive", "stimme"], 17,
  ),
  builtin(
    "show-dont-tell", "Show don't tell", "editing",
    "Verwandelt behauptete Gefuehle in gezeigte Szenen.",
    "Verwandle Tell in Show: Finde im folgenden Text alle Stellen, die Gefuehle oder Eigenschaften nur behaupten, und schreibe sie als konkrete Handlung, Geste oder Sinnesdetail um:\n\n{{text}}",
    [v("text", "Text")],
    ["show-dont-tell", "szenik"], 18,
  ),
  builtin(
    "redundanzen-entfernen", "Redundanzen entfernen", "editing",
    "Streicht Dopplungen und inhaltsleere Fuellungen.",
    "Entferne alle Redundanzen aus dem folgenden Text: doppelte Aussagen, Pleonasmen, inhaltsleere Fuellwoerter. Liste die 5 groessten Streichungen auf und gib den bereinigten Text zurueck:\n\n{{text}}",
    [v("text", "Text")],
    ["redundanz", "kuerzen"], 19,
  ),
  builtin(
    "uebergaenge-glaetten", "Übergänge glätten", "editing",
    "Verbindet Absaetze und Szenen mit sauberen Uebergaengen.",
    "Glaette die Uebergaenge im folgenden Text: Jeder Absatz- und Szenenwechsel bekommt eine Bruecke (Wiederaufnahme, Kontrast oder Zeitsignal), ohne den Inhalt zu veraendern:\n\n{{text}}",
    [v("text", "Text")],
    ["uebergaenge", "fluss"], 20,
  ),
  builtin(
    "klappentext-entwerfen", "Klappentext entwerfen", "business",
    "Entwirft einen Klappentext mit Hook und Kaufimpuls.",
    "Entwirf einen Klappentext (max. 180 Woerter) fuer das folgende Buch: Hook in Satz 1, Protagonist + Konflikt + Einsatz, kein Spoiler des Endes:\n\n{{buch}}",
    [v("buch", "Buchzusammenfassung")],
    ["klappentext", "vertrieb"], 21,
  ),
  builtin(
    "angebot-formulieren", "Angebot formulieren", "business",
    "Formuliert ein professionelles Dienstleistungs-Angebot.",
    "Formuliere ein Angebot auf Basis der folgenden Eckdaten: Leistungsumfang, Preis, Zeitrahmen, naechster Schritt. Ton: {{ton}}:\n\n{{eckdaten}}",
    [v("eckdaten", "Eckdaten"), v("ton", "Ton", "professionell-freundlich")],
    ["angebot", "business"], 22,
  ),
];

// ---------------------------------------------------------------------------
// Store (In-Memory + best-effort localStorage)
// ---------------------------------------------------------------------------

function cloneBuiltin(p: LibraryPrompt): LibraryPrompt {
  return { ...p, variables: p.variables.map((x) => ({ ...x })), tags: [...p.tags] };
}

const store = new Map<string, LibraryPrompt>();

function persist(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...store.values()]));
  } catch {
    // best-effort: Quota/Privatsphaere-Fehler ignorieren
  }
}

function restore(): void {
  store.clear();
  for (const p of BUILTIN_PROMPTS) store.set(p.id, cloneBuiltin(p));
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const items = JSON.parse(raw) as LibraryPrompt[];
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item && typeof item.id === "string" && typeof item.name === "string") {
        store.set(item.id, {
          ...item,
          variables: Array.isArray(item.variables) ? item.variables : [],
          tags: Array.isArray(item.tags) ? item.tags : [],
          favorite: item.favorite === true,
          usageCount: typeof item.usageCount === "number" ? item.usageCount : 0,
          createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
        });
      }
    }
  } catch {
    // korrupte Daten: bei Builtins bleiben
  }
}

restore();

function snapshot(p: LibraryPrompt): LibraryPrompt {
  return { ...p, variables: p.variables.map((x) => ({ ...x })), tags: [...p.tags] };
}

function sorted(): LibraryPrompt[] {
  return [...store.values()]
    .map(snapshot)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Stellt den Ausgangszustand wieder her (Tests/Storybook). */
export function resetLibraryForTests(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorieren
  }
  store.clear();
  for (const p of BUILTIN_PROMPTS) store.set(p.id, cloneBuiltin(p));
}

/** Alle Prompts (alphabetisch nach Name). */
export async function getPrompts(): Promise<LibraryPrompt[]> {
  return sorted();
}

/** Prompts einer Kategorie. `"all"` liefert alle, `"favorites"` die Favoriten. */
export async function getPromptsByCategory(category: string): Promise<LibraryPrompt[]> {
  if (category === "all") return sorted();
  if (category === "favorites") return getFavorites();
  return sorted().filter((p) => p.category === category);
}

/** Volltextsuche ueber Name, Beschreibung, Prompttext und Tags. */
export async function searchPrompts(query: string): Promise<LibraryPrompt[]> {
  const q = query.trim().toLowerCase();
  if (!q) return sorted();
  return sorted().filter((p) =>
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.prompt.toLowerCase().includes(q) ||
    p.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

/** Fuegt einen eigenen Prompt hinzu (id/createdAt/usageCount werden vergeben). */
export async function addPrompt(prompt: NewLibraryPrompt): Promise<LibraryPrompt> {
  const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: LibraryPrompt = {
    ...prompt,
    variables: prompt.variables.map((x) => ({ ...x })),
    tags: [...prompt.tags],
    id,
    createdAt: Date.now(),
    usageCount: 0,
  };
  store.set(id, entry);
  persist();
  return snapshot(entry);
}

/** Loescht einen Prompt. Wirft bei unbekannter id. */
export async function deletePrompt(id: string): Promise<void> {
  if (!store.has(id)) throw new Error(`Unbekannter Prompt: ${id}`);
  store.delete(id);
  persist();
}

/** Schaltet den Favorit-Status um. Wirft bei unbekannter id. */
export async function toggleFavorite(id: string): Promise<void> {
  const entry = store.get(id);
  if (!entry) throw new Error(`Unbekannter Prompt: ${id}`);
  entry.favorite = !entry.favorite;
  persist();
}

/** Zaehlt eine Verwendung. Wirft bei unbekannter id. */
export async function incrementUsage(id: string): Promise<void> {
  const entry = store.get(id);
  if (!entry) throw new Error(`Unbekannter Prompt: ${id}`);
  entry.usageCount += 1;
  persist();
}

/** Alle als Favorit markierten Prompts (alphabetisch). */
export async function getFavorites(): Promise<LibraryPrompt[]> {
  return sorted().filter((p) => p.favorite);
}
