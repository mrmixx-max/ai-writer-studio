// Robuste JSON-Extraktion aus LLM-Antworten (A1).
//
// Zweistufige Strategie statt reinem Bracket-Counting:
//   (a) Direkter JSON.parse nach Markdown-Fence-Entfernung (```json ... ```)
//   (b) Klammer-Zustandsmaschine: Strings mit Escape-Sequenzen werden korrekt
//       übersprungen (inString / escaped), damit `}` IM String nicht vorzeitig
//       beendet (z.B. Zusammenfassungen wie "Der Wendepunkt } und ...").
//   (c) Reparatur-Pass: trailing commas entfernen, einfache Anführungszeichen
//       normalisieren, abgeschnittenes JSON an letztem vollständigen Kapitel
//       kappen.

/**
 * (a) Entfernt Markdown-Code-Fences (```json ... ``` / ``` ... ```) inklusive
 * umgebenden Backticks, damit der Inhalt direkt geparst werden kann.
 */
export function stripFences(text: string): string {
  return text
    .replace(/```(?:json)?\s*\n?/gi, "")
    .replace(/```/g, "");
}

/**
 * (b) Findet das erste balancierte JSON-Objekt per Zustandsmaschine.
 * Strings (inkl. Escape-Sequenzen) werden korrekt übersprungen — ein `}`
 * innerhalb eines Strings beendet das Objekt NICHT vorzeitig.
 * Bei unbalanciertem (abgeschnittenem) JSON wird null geliefert; der
 * Reparatur-Pass übernimmt.
 */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // unbalanciert → Repair-Pass
}

/**
 * (c) Reparatur-Pass: einfache Anführungszeichen normalisieren (nur als
 * String-Delimiter; Apostrophe in Double-Quotes-Strings bleiben Inhalt),
 * trailing commas entfernen.
 */
export function repairJson(json: string): string {
  let s = normalizeQuotes(json.trim());
  // Trailing commas: `,}` / `,]` → `}` / `]`
  s = s.replace(/,(\s*[}\]])/g, "$1");
  return s;
}

/**
 * Heuristik für einfache Anführungszeichen: Ein `'` außerhalb von
 * Double-Quote-Strings beginnt/beendet einen String und wird zu `"`.
 * Innerhalb von Double-Quote-Strings bleibt `'` unangetastet (Inhalt).
 */
function normalizeQuotes(s: string): string {
  let out = "";
  let inDouble = false;
  let inSingle = false;
  let escaped = false;
  for (const ch of s) {
    if (inSingle) {
      if (escaped) { escaped = false; out += ch; continue; }
      if (ch === "\\") { escaped = true; out += ch; continue; }
      if (ch === "'") { inSingle = false; out += '"'; continue; }
      // Unescaped `"` innerhalb von Single-Quotes-Strings escapen
      if (ch === '"') { out += '\\"'; continue; }
      out += ch;
      continue;
    }
    if (inDouble) {
      if (escaped) { escaped = false; out += ch; continue; }
      if (ch === "\\") { escaped = true; out += ch; continue; }
      if (ch === '"') { inDouble = false; out += ch; continue; }
      out += ch;
      continue;
    }
    if (ch === '"') { inDouble = true; out += ch; continue; }
    if (ch === "'") { inSingle = true; out += '"'; continue; }
    out += ch;
  }
  return out;
}

/**
 * (c) Absgeschnittenes JSON kappen: baut das Objekt mit allen VOLLSTÄNDIGEN
 * Kapitel-Objekten aus der `chapters`-Array wieder zusammen. Unvollständige
 * Kapitel (z.B. mitten im Summary-Text abgebrochen) werden verworfen.
 */
export function capTruncatedJson(text: string): string | null {
  const m = /"chapters"\s*:\s*\[/.exec(text);
  if (!m) return null;
  const arrStart = m.index + m[0].length;

  // Zustandsmaschine: vollständige Objekte in der Array sammeln
  const objects: string[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  for (let i = arrStart; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        objects.push(text.slice(start, i + 1));
        start = -1;
      }
      if (depth < 0) break; // Array zu — nichts mehr zu holen
    }
  }

  // Nur Kapitel behalten, die einzeln parsebar sind
  const valid = objects.filter((o) => {
    try { JSON.parse(o); return true; } catch { return false; }
  });
  if (valid.length === 0) return null;

  // Prefix (title/genre/...) + repariertes chapters-Array wieder zusammenbauen
  const rebuilt =
    text.slice(0, m.index) + '"chapters": [' + valid.join(",") + "]}";
  return repairJson(rebuilt);
}

/**
 * Zweistufiges Gesamtparsing: alle Kandidaten der Reihe nach probieren.
 * Wirft einen sprechenden Fehler mit Antwort-Anfang, wenn nichts parsebar ist.
 */
export function parseJsonLoose<T>(raw: string, label: string): T {
  const stripped = stripFences(raw);
  const extracted = extractJsonObject(stripped);

  const candidates: string[] = [
    stripped.trim(), // (a) direkter Parse
  ];
  if (extracted) candidates.push(extracted); // (b) Zustandsmaschine
  // (c) Reparatur-Pass auf (a) und (b)
  candidates.push(repairJson(stripped.trim()));
  if (extracted) candidates.push(repairJson(extracted));
  // (c) Abschneiden an letztem vollständigen Kapitel
  const capped = [stripped.trim(), extracted]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .map(capTruncatedJson)
    .filter((x): x is string => x !== null);
  candidates.push(...capped);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Nächster Kandidat
    }
  }

  const preview = raw.slice(0, 120).replace(/\s+/g, " ").trim();
  throw new Error(
    `${label}: Kein gültiges JSON in der Antwort erkannt. Anfang: "${preview}${raw.length > 120 ? "…" : ""}"`,
  );
}
