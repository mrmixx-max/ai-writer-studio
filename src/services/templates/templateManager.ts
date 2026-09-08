// TemplateManager: CRUD + Rendern von Text-Vorlagen (Sprint 20, Agent 5).
//
// Reiner In-Memory-Store mit Seed-Vorlagen — bewusst KEINE Abhaengigkeit
// zu Projekt-DB, Settings oder LLM (damit testbar und leichtgewichtig).
// Das Generieren (LLM-Call mit gerendertem Prompt) passiert im
// TemplatePanel ueber eine injizierbare `generate`-Funktion.

export type TemplateCategory =
  | "novel"
  | "short-story"
  | "article"
  | "essay"
  | "script"
  | "poetry"
  | "blog"
  | "email";

export interface TemplateVariable {
  name: string;
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
  defaultValue: string;
}

export interface TextTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  prompt: string;
  variables: TemplateVariable[];
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  "novel",
  "short-story",
  "article",
  "essay",
  "script",
  "poetry",
  "blog",
  "email",
];

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  novel: "Roman",
  "short-story": "Kurzgeschichte",
  article: "Artikel",
  essay: "Essay",
  script: "Drehbuch",
  poetry: "Lyrik",
  blog: "Blog",
  email: "E-Mail",
};

export function templateCategoryLabel(category: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[category] ?? category;
}

function seed(
  id: string,
  name: string,
  category: TemplateCategory,
  description: string,
  prompt: string,
  variables: TemplateVariable[],
): TextTemplate {
  return { id, name, category, description, prompt, variables };
}

function defaultTemplates(): TextTemplate[] {
  return [
    seed(
      "tpl-novel-opener",
      "Romanauftakt",
      "novel",
      "Stimmungsvoller Auftakt mit Figur, Ort und Konflikt.",
      "Schreibe den Auftakt eines Romans im Genre {{genre}}. Hauptfigur: {{protagonist}}. Ort: {{setting}}. Ton: {{tone}}.",
      [
        { name: "genre", label: "Genre", type: "text", defaultValue: "Fantasy" },
        { name: "protagonist", label: "Hauptfigur", type: "text", defaultValue: "eine junge Kartografin" },
        { name: "setting", label: "Schauplatz", type: "text", defaultValue: "eine Hafenstadt im Nebel" },
        { name: "tone", label: "Ton", type: "select", options: ["düster", "lyrisch", "spannend", "humorvoll"], defaultValue: "düster" },
      ],
    ),
    seed(
      "tpl-shortstory-flash",
      "Flash Fiction",
      "short-story",
      "Komplette Kurzgeschichte unter 500 Wörtern.",
      "Schreibe eine Flash-Fiction-Geschichte (max. 500 Wörter) zum Thema {{theme}} mit einer überraschenden Wendung am Ende. Perspektive: {{perspective}}.",
      [
        { name: "theme", label: "Thema", type: "text", defaultValue: "Abschied" },
        { name: "perspective", label: "Perspektive", type: "select", options: ["Ich", "Er/Sie", "Du"], defaultValue: "Ich" },
      ],
    ),
    seed(
      "tpl-article-explainer",
      "Erklärartikel",
      "article",
      "Sachlicher Erklärartikel mit Struktur.",
      "Schreibe einen Erklärartikel zum Thema {{topic}} für die Zielgruppe {{audience}}. Gliederung: Aufhänger, Grundlagen, Beispiele, Fazit. Länge: ca. {{words}} Wörter.",
      [
        { name: "topic", label: "Thema", type: "text", defaultValue: "Künstliche Intelligenz" },
        { name: "audience", label: "Zielgruppe", type: "text", defaultValue: "interessierte Laien" },
        { name: "words", label: "Wörter (ca.)", type: "number", defaultValue: "800" },
      ],
    ),
    seed(
      "tpl-blog-post",
      "Blogbeitrag",
      "blog",
      "Lockerer Blogbeitrag mit Hook und CTA.",
      "Schreibe einen Blogbeitrag zum Thema {{topic}}. Beginne mit einem starken Hook, schreibe locker und direkt (Du-Form), und schließe mit einem Call-to-Action: {{cta}}.",
      [
        { name: "topic", label: "Thema", type: "text", defaultValue: "Produktivität" },
        { name: "cta", label: "Call-to-Action", type: "text", defaultValue: "Newsletter abonnieren" },
      ],
    ),
    seed(
      "tpl-email-formal",
      "Formelle E-Mail",
      "email",
      "Höfliche, präzise Geschäftsmail.",
      "Schreibe eine formelle E-Mail an {{recipient}} mit dem Anliegen: {{concern}}. Ton: höflich und präzise. Absender: {{sender}}.",
      [
        { name: "recipient", label: "Empfänger", type: "text", defaultValue: "Frau Müller" },
        { name: "concern", label: "Anliegen", type: "text", defaultValue: "Terminverschiebung" },
        { name: "sender", label: "Absender", type: "text", defaultValue: "Max Mustermann" },
      ],
    ),
  ];
}

let store: TextTemplate[] = defaultTemplates();
let counter = 0;

function nextId(): string {
  counter += 1;
  return `tpl_${Date.now().toString(36)}_${counter}`;
}

function clone(t: TextTemplate): TextTemplate {
  return {
    ...t,
    variables: t.variables.map((v) => ({
      ...v,
      options: v.options ? [...v.options] : undefined,
    })),
  };
}

/** Test-Helfer: setzt den Store auf die Seed-Vorlagen zurück. */
export async function resetTemplates(): Promise<void> {
  store = defaultTemplates();
}

/** Erstellt ein Template (ID wird vergeben). */
export async function createTemplate(
  template: Omit<TextTemplate, "id">,
): Promise<TextTemplate> {
  const created: TextTemplate = { ...template, id: nextId() };
  store.push(created);
  return clone(created);
}

/** Liefert alle Templates (Kopien — der Store ist von außen unveränderbar). */
export async function getTemplates(): Promise<TextTemplate[]> {
  return store.map(clone);
}

/** Liefert nur Templates der angegebenen Kategorie. */
export async function getTemplatesByCategory(
  category: string,
): Promise<TextTemplate[]> {
  return store.filter((t) => t.category === category).map(clone);
}

/** Liefert ein einzelnes Template oder null. */
export async function getTemplateById(id: string): Promise<TextTemplate | null> {
  const found = store.find((t) => t.id === id);
  return found ? clone(found) : null;
}

/** Löscht ein Template. Idempotent — unbekannte IDs sind kein Fehler. */
export async function deleteTemplate(id: string): Promise<void> {
  store = store.filter((t) => t.id !== id);
}

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/**
 * Rendert den Prompt eines Templates: jedes `{{variable}}` wird durch den
 * übergebenen Wert ersetzt, ersatzweise durch den defaultValue der Variable,
 * ersatzweise durch einen Leerstring. Wirft bei unbekannter Template-ID.
 */
export async function renderTemplate(
  id: string,
  variables: Record<string, string>,
): Promise<string> {
  const template = store.find((t) => t.id === id);
  if (!template) {
    throw new Error(`Unbekanntes Template: ${id}`);
  }
  const defaults = new Map(
    template.variables.map((v) => [v.name, v.defaultValue] as const),
  );
  return template.prompt.replace(PLACEHOLDER_RE, (_match, name: string) => {
    const given = variables[name];
    if (given !== undefined && given !== "") return given;
    return defaults.get(name) ?? "";
  });
}
