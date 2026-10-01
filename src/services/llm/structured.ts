// Strukturierte LLM-Ausgaben: JSON-Extraktion, Zod-Validierung, Repair-Prompting.
//
// Warum eigenes Modul in der LLM-Schicht:
// - Reine JSON-Extraktion/Reparatur ist keine Bookwriter-Domäne. Läge sie in
//   `bookwriter/workflow.ts` und würde `workflow.ts` hier validieren, entstünde
//   ein Import-Zyklus. Deshalb liegt die Extraktion hier, und `workflow.ts`
//   re-exportiert sie für bestehende Aufrufer.
// - Zod prüft, was der TypeScript-Cast nur behauptet: `parseJson<T>` liefert
//   ein `T`, ohne zur Laufzeit irgendetwas über die Form zu wissen. Ein Modell,
//   das `{"chapters": "..."}` statt eines Arrays liefert, kam bisher durch.

import { z } from "zod";
import { getLogger } from "@/services/logger";

const log = getLogger("llm/structured");

// ---------------------------------------------------------------------------
// 1. Extraktion (LLM-agnostisch, ohne Semantik)
// ---------------------------------------------------------------------------

/** Versucht, einen String als JSON zu parsen (null statt Throw). */
export function tryParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Extrahiert Markdown-Code-Blöcke (```json ... ``` oder ``` ... ```).
 * Gibt alle Block-Inhalte zurück (innere zuerst, dann äußere).
 */
export function extractCodeBlocks(raw: string): string[] {
  const out: string[] = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const inner = m[1].trim();
    if (inner) out.push(inner);
  }
  return out;
}

/**
 * Isoliert die erste [...] oder {...}-Sequenz aus freiem Text.
 * Klammer-Matching ist string-sensitiv (ignoriert Klammern in Strings
 * und escaped Quotes). Gibt null zurück, wenn nichts Balanciertes da ist.
 */
export function isolateJsonSequence(raw: string): string | null {
  const startIdx = (() => {
    const a = raw.indexOf("[");
    const b = raw.indexOf("{");
    if (a === -1) return b;
    if (b === -1) return a;
    return Math.min(a, b);
  })();
  if (startIdx === -1) return null;
  const pairs: Record<string, string> = { "[": "]", "{": "}" };
  const stack: string[] = [];
  let inStr: string | null = null;
  for (let i = startIdx; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (ch === "\\") {
        i++; // escaped Zeichen überspringen
      } else if (ch === inStr) {
        inStr = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
    } else if (ch === "[" || ch === "{") {
      stack.push(ch);
    } else if (ch === "]" || ch === "}") {
      const open = stack.pop();
      if (!open || pairs[open] !== ch) return null; // unbalanciert
      if (stack.length === 0) return raw.slice(startIdx, i + 1);
    }
  }
  return null;
}

/**
 * Repariert häufige LLM-JSON-Fehler:
 * - Single-Quotes → Double-Quotes
 * - unquotete Keys ({title: ...} → {"title": ...})
 * - unquotete String-Werte (: Anfang, → : "Anfang",; Zahlen/bool/null bleiben)
 * - Trailing Commas vor ] oder }
 * - Steuerzeichen entfernen, Whitespace normalisieren
 */
export function repairJson(text: string): string {
  let s = text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();
  // Single-quoted Strings → double-quoted (simple Fälle: '...' ohne Innen-Quotes).
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner: string) => `"${(inner as string).replace(/"/g, '\\"')}"`);
  // Unquotete Keys quoten.
  s = s.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_-]*)\s*:/g, '$1"$2":');
  // Unquotete String-Werte quoten (Zahlen, true/false/null auslassen).
  s = s.replace(/:\s*([A-Za-zÄÖÜäöüß][^,{}[\]"]*?)\s*([,}])/g, (m, val: string, end: string) => {
    const v = (val as string).trim();
    if (/^(true|false|null)$/.test(v) || /^-?\d+(\.\d+)?$/.test(v) || v.startsWith('"')) return m;
    return `: "${v}"${end}`;
  });
  // Trailing Commas entfernen.
  s = s.replace(/,(\s*[}\]])/g, "$1");
  return s;
}

/**
 * Parst JSON aus einer LLM-Antwort (Sprint 19e: LFM2-24B Wort-Salat-robust).
 *
 * Strategie (der Reihe nach, erster Treffer gewinnt):
 *  1. Direkt parsen (bereits valides JSON).
 *  2. Markdown-Code-Blöcke extrahieren und parsen.
 *  3. JSON-Sequenz ([...]/ {...}) aus Fließtext isolieren und parsen.
 *  4. Reparaturversuch (Quotes, Kommas, Keys) auf 1.–3.
 *
 * Gibt null zurück, wenn nichts davon valides JSON liefert
 * (z. B. reiner Wort-Salat ohne JSON-Struktur).
 *
 * ACHTUNG: Das `T` ist ein Cast, keine Prüfung. Für alles, worauf sich
 * Anwendungslogik verlässt, `parseStructuredJson` mit einem Zod-Schema nutzen.
 */
export function parseJson<T>(raw: string): T | null {
  if (!raw || !raw.trim()) return null;
  const clean = raw.replace(/^\uFEFF/, "").trim();

  const candidates: string[] = [clean, ...extractCodeBlocks(clean)];
  const isolated = isolateJsonSequence(clean);
  if (isolated && !candidates.includes(isolated)) candidates.push(isolated);

  for (const c of candidates) {
    const direct = tryParse<T>(c);
    if (direct !== null) return direct;
  }
  for (const c of candidates) {
    const repaired = tryParse<T>(repairJson(c));
    if (repaired !== null) return repaired;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 2. Zod-Validierung mit Repair-Prompting
// ---------------------------------------------------------------------------

/** Warum eine Validierung fehlschlug — für Log und Repair-Prompt. */
export interface ValidationFailure {
  /** Menschenlesbare Fehlerzeilen ("chapters.0.title: Erwartet string"). */
  messages: string[];
  /** true, wenn gar kein JSON extrahierbar war (Wort-Salat statt Formfehler). */
  noJson: boolean;
}

export type StructuredOutcome<T> =
  | { ok: true; value: T; attempts: number; repaired: boolean }
  | { ok: false; failure: ValidationFailure; raw: string };

/** Formatiert Zod-Issues als knappe, prompt-taugliche Zeilen. */
export function zodIssueLines(err: z.ZodError): string[] {
  return err.issues.slice(0, 20).map((i) => {
    const path = i.path.join(".") || "(root)";
    return `${path}: ${i.message}`;
  });
}

/**
 * Validiert eine LLM-Antwort gegen ein Zod-Schema — inklusive genau EINES
 * Reparaturversuchs.
 *
 * Ablauf:
 *  1. Antwort parsen (Kaskade aus parseJson).
 *  2. Zod-Validierung. Bei Erfolg fertig.
 *  3. Bei Misserfolg: Repair-Prompt aus den konkreten Fehlerpfaden bauen,
 *     genau einen weiteren LLM-Call machen, erneut validieren.
 *  4. Scheitert auch das, `ok: false` mit den Fehlerzeilen — der Aufrufer
 *     entscheidet, ob er abbricht, retryt oder auf einen Fallback geht.
 *
 * Es wird bewusst nur EIN Reparaturversuch gemacht: Häufig scheitert auch der
 * zweite, und jede Runde kostet einen vollen Modell-Call auf einem Manuskript.
 *
 * @param raw          Rohtext der LLM-Antwort.
 * @param schema       Zod-Schema der erwarteten Struktur.
 * @param completeOnce Callback für den Reparaturversuch. Fehlt er, wird bei
 *                     ungültiger Ausgabe sofort `ok: false` geliefert.
 * @param label        Name für Log-Ausgaben (z. B. "outline", "entities").
 */
export async function parseStructuredJson<T>(
  raw: string,
  schema: z.ZodType<T>,
  completeOnce?: (prompt: string) => Promise<string>,
  label = "structured",
): Promise<StructuredOutcome<T>> {
  const first = extractAndValidate(raw, schema);
  if (first.ok) return { ok: true, value: first.value, attempts: 1, repaired: false };

  if (!completeOnce) {
    return { ok: false, failure: first.failure, raw };
  }

  const repairPrompt = buildRepairPrompt(raw, first.failure);
  log.warn(
    `[${label}] Ungültige Struktur (${first.failure.messages.slice(0, 3).join("; ")}) — ein Reparaturversuch.`,
  );

  let secondRaw = "";
  try {
    secondRaw = await completeOnce(repairPrompt);
  } catch (e) {
    // Der Reparatur-Call darf den Aufrufer nicht mit einem Netzwerkfehler
    // überraschen: Der ursprüngliche Validierungsfehler ist die bessere
    // Diagnose und wird deshalb zurückgegeben.
    log.warn(`[${label}] Reparatur-Call fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, failure: first.failure, raw };
  }

  const second = extractAndValidate(secondRaw, schema);
  if (second.ok) return { ok: true, value: second.value, attempts: 2, repaired: true };

  log.warn(`[${label}] Auch der Reparaturversuch blieb ungültig.`);
  return { ok: false, failure: second.failure, raw: secondRaw };
}

/** Extrahiert JSON aus `raw` und validiert gegen das Schema. */
function extractAndValidate<T>(
  raw: string,
  schema: z.ZodType<T>,
): { ok: true; value: T } | { ok: false; failure: ValidationFailure } {
  const parsed = parseJson<unknown>(raw);
  if (parsed === null) {
    return { ok: false, failure: { messages: ["Kein JSON in der Antwort gefunden."], noJson: true } };
  }
  const result = schema.safeParse(parsed);
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, failure: { messages: zodIssueLines(result.error), noJson: false } };
}

/**
 * Baut den Repair-Prompt: ursprüngliche Ausgabe + konkrete Fehler + die
 * verbindliche Form. Bewusst knapp — das Modell soll korrigieren, nicht
 * neu dichten.
 */
export function buildRepairPrompt(raw: string, failure: ValidationFailure): string {
  const problems = failure.messages.length
    ? failure.messages.map((m) => `- ${m}`).join("\n")
    : "- Die Antwort enthielt kein erkennbares JSON.";

  const excerpt = raw.length > 4000 ? `${raw.slice(0, 4000)}\n…(gekürzt)` : raw;

  return (
    `Deine vorige Antwort hatte die falsche Struktur.\n\n` +
    `Fehler:\n${problems}\n\n` +
    `Deine Antwort war:\n${excerpt}\n\n` +
    `Korrigiere sie. Gib NUR valides JSON zurück — kein Markdown, keine ` +
    `Code-Fences, keine Erklärung, keinen Text davor oder danach. ` +
    `Behalte die inhaltlichen Aussagen bei und ändere ausschließlich die Struktur.`
  );
}
