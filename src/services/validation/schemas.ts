// Zod-Schemata für alle Nutzer-Eingaben.
// Datei: src/services/validation/schemas.ts
//
// Ein Validierungspunkt für Formulare, Stores und Services. Funktionen, die
// Nutzer-Daten in die DB schreiben (createProject, updateChapter, Settings),
// validieren hierüber. Bei Verletzung: ZodError → verständliche Message.

import { z } from "zod";
import type { AppSettings } from "@/types/config";
import type { ProviderId } from "@/types/llm";

// ---------- Basis-K constraints ----------

/** Nicht-leerer, begrenzter Text (einzeilig). */
export const nonEmptyString = (max = 200, label = "Feld") =>
  z
    .string()
    .trim()
    .min(1, `${label} darf nicht leer sein.`)
    .max(max, `${label} darf maximal ${max} Zeichen haben.`);

/** Mehrzeiliger Inhalt (Kapitel, Fragmente, Prompts). */
export const longText = (max = 2_000_000) =>
  z.string().max(max, `Text ist zu lang (max. ${max.toLocaleString("de-DE")} Zeichen).`);

/** http(s)-URL mit Port. */
export const httpUrl = z
  .string()
  .trim()
  .url("Bitte eine gültige URL angeben (z.B. http://localhost:11434).")
  .refine((v) => v.startsWith("http://") || v.startsWith("https://"), {
    message: "URL muss mit http:// oder https:// beginnen.",
  });

/** UUID-artige IDs (unsere Services nutzen crypto.randomUUID / Fallback). */
export const idSchema = z
  .string()
  .min(8, "ID zu kurz.")
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "ID enthält ungültige Zeichen.");

const providerIdSchema = z.enum(["ollama", "lmstudio", "openai", "openrouter", "gpt2api"]);
const autoLockSchema = z.enum(["off", "5m", "15m", "30m", "1h"]);

// ---------- Projekte / Kapitel ----------

export const createProjectSchema = z.object({
  name: nonEmptyString(120, "Projektname"),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const renameProjectSchema = z.object({
  id: idSchema,
  name: nonEmptyString(120, "Projektname"),
});

export const chapterContentSchema = z.object({
  id: idSchema,
  title: nonEmptyString(200, "Kapiteltitel"),
  content: longText(),
});
export type ChapterContentInput = z.infer<typeof chapterContentSchema>;

// ---------- Fragmente / Charaktere ----------

export const createFragmentSchema = z.object({
  chapterId: idSchema,
  title: nonEmptyString(200, "Fragmenttitel"),
  content: longText(500_000),
  tone: z.string().max(100).nullable().optional(),
  speaker: z.string().max(200).nullable().optional(),
  timeRef: z.string().max(100).nullable().optional(),
});

export const createCharacterSchema = z.object({
  name: nonEmptyString(120, "Charaktername"),
  description: z.string().max(20_000).optional().default(""),
  projectId: idSchema,
});

// ---------- Einstellungen ----------

export const temperatureSchema = z
  .number()
  .min(0, "Temperature muss zwischen 0 und 2 liegen.")
  .max(2, "Temperature muss zwischen 0 und 2 liegen.");

export const maxTokensSchema = z
  .number()
  .int("maxTokens muss eine ganze Zahl sein.")
  .min(1, "maxTokens muss ≥ 1 sein.")
  .max(200_000, "maxTokens ist unrealistisch hoch (max. 200000).");

/** Schema für AppSettings (partial: nur geänderte Felder validieren). */
export const appSettingsSchema = z.object({
  provider: providerIdSchema,
  model: nonEmptyString(120, "Modellname"),
  temperature: temperatureSchema,
  maxTokens: maxTokensSchema,
  systemPrompt: z.string().max(20_000, "System-Prompt zu lang."),
  theme: z.enum(["light", "dark"]),
  language: z.enum(["de", "en", "fr", "es"]).optional(),
  highContrast: z.boolean().optional(),
  ollamaBaseUrl: httpUrl,
  lmstudioBaseUrl: httpUrl,
  gpt2apiBaseUrl: httpUrl,
  imageProvider: z.enum(["openai-dalle", "openrouter-flux", "sd-webui", "none"]),
  sdWebuiUrl: httpUrl,
  coverGenerator: z.enum(["active", "none"]),
  blurbGenerator: z.enum(["active", "none"]),
  scientificWriting: z.enum(["active", "none"]),
  privacyMode: z.boolean(),
  manuscriptEncryption: z.boolean(),
  requirePassphrase: z.boolean(),
  autoLock: autoLockSchema,
});

/**
 * Validiert ein AppSettings-Objekt (vollständig oder teilweise).
 * Rückgabe: normalisierte Partial-Settings oder null (mit ZodError via onFail).
 */
export function validateAppSettings(
  value: Partial<AppSettings>,
  onFail?: (errors: string[]) => void,
): Partial<AppSettings> | null {
  // partial(): nur vorhandene Felder werden geprüft — .z.B. aus dem
  // Settings-Formular kommende Einzeländerungen.
  const result = appSettingsSchema.partial().safeParse(value);
  if (result.success) return result.data as Partial<AppSettings>;
  onFail?.(result.error.issues.map((i) => `${i.path.join(".") || "settings"}: ${i.message}`));
  return null;
}

// ---------- Prompts / LLM-Eingaben ----------

export const chatRequestSchema = z.object({
  prompt: longText(100_000),
  model: nonEmptyString(120, "Modellname").optional(),
  temperature: temperatureSchema.optional(),
  maxTokens: maxTokensSchema.optional(),
});
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

// ---------- Generischer Helper für UI-Formulare ----------

/**
 * Führt ein Schema aus und liefert bei Fehler die erste verständliche
 * Fehlermeldung (für Inline-Anzeige im Formular).
 */
export function validate<T>(
  schema: z.ZodType<T>,
  value: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  return { ok: false, error: first?.message ?? "Eingabe ungültig." };
}

/** Alle Fehlermeldungen eines ZodError als Array (z.B. fürs Loggen). */
export function zodMessages(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`);
}

export function providerId(value: string): ProviderId | null {
  const r = providerIdSchema.safeParse(value);
  return r.success ? r.data : null;
}
