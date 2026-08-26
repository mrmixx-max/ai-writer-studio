// Erstbefüllung der Prompt-Sammlung.
//
// Wird vom Erststart-Assistenten optional aufgerufen. Idempotent: bereits
// vorhandene Einträge mit gleichem Text werden nicht erneut angelegt, damit
// ein zweiter Assistentendurchlauf keine Dubletten erzeugt.

import { getDb, persist } from "@/services/db";
import { OFFLINE_PROMPTS } from "./offlinePrompts";

function uid(): string {
  return `prm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Legt die mitgelieferten Vorlagen an.
 * @returns Anzahl der tatsächlich eingefügten Einträge.
 */
export async function seedDefaultPrompts(): Promise<number> {
  const db = getDb();
  const now = Date.now();
  let inserted = 0;

  for (const p of OFFLINE_PROMPTS) {
    // Dublettenschutz über den Text — Prompts haben keine natürliche Id.
    const existing = db.exec("SELECT 1 FROM writing_prompts WHERE text = ? LIMIT 1", [p.text]);
    if (existing.length > 0 && existing[0].values.length > 0) continue;

    db.run(
      `INSERT INTO writing_prompts
         (id, text, genre, prompt_type, tone, target_length, is_favorite, created_at, provider, model, project_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uid(),
        p.text,
        p.genre,
        p.type,
        p.tone,
        p.target_length,
        0,
        now,
        null,
        null,
        null,
      ],
    );
    inserted++;
  }

  if (inserted > 0) await persist();
  return inserted;
}
