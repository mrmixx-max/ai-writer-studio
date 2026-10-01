// Text-Patches: Anwenden und Prüfen von Änderungen an Manuskripttext.
//
// Warum zeilenweise und nicht Unified-Diff:
// Ein Modell, das einen Unified Diff mit korrekten @@-Zeilennummern und
// Kontextzeilen erzeugt, ist die Ausnahme. Was zuverlässig funktioniert, ist
// ein Paar aus "diesen Abschnitt" → "durch jenen ersetzen". Der Suchtext
// findet seine Stelle selbst; Zeilennummern können nicht verrutschen.
//
// Der Vertrag ist bewusst streng: Ein Patch, dessen Suchtext nicht GENAU
// EINMAL vorkommt, wird abgelehnt. Bei mehreren Treffern wäre nicht
// entscheidbar, welche Stelle gemeint ist — ein falsch platziertes
// "verbessere" kann einen Absatz zerstören.

import { getLogger } from "@/services/logger";

const log = getLogger("llm/textPatch");

/** Ein einzelner Änderungsvorschlag. */
export interface TextPatch {
  /** Der zu ersetzende Textausschnitt. Muss genau einmal vorkommen. */
  search: string;
  /** Der neue Text. Leer bedeutet: Ausschnitt löschen. */
  replace: string;
  /** Kurze Begründung (für die Anzeige im Redaktions-Panel). */
  reason?: string;
}

export interface PatchResult {
  /** Text nach Anwendung aller Patches. */
  text: string;
  /** Anzahl erfolgreich angewandter Patches. */
  applied: number;
  /** Abgelehnte Patches mit Grund. */
  rejected: Array<{ patch: TextPatch; reason: string }>;
}

/** Normalisiert Zeilenenden, damit der Vergleich nicht an \r scheitert. */
function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

/**
 * Prüft, ob ein Patch anwendbar ist — ohne ihn anzuwenden.
 * Nützlich, um dem Nutzer vorab zu zeigen, was möglich wäre.
 */
export function canApply(text: string, patch: TextPatch): { ok: boolean; reason?: string } {
  const hay = normalize(text);
  const needle = normalize(patch.search).trim();
  if (!needle) return { ok: false, reason: "Leerer Suchtext." };
  const count = countOccurrences(hay, needle);
  if (count === 0) return { ok: false, reason: "Suchtext nicht gefunden." };
  if (count > 1) return { ok: false, reason: `Suchtext kommt ${count}× vor — nicht eindeutig.` };
  return { ok: true };
}

/** Zählt, wie oft `needle` in `hay` vorkommt (nicht überlappend). */
function countOccurrences(hay: string, needle: string): number {
  let count = 0;
  let idx = hay.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = hay.indexOf(needle, idx + needle.length);
  }
  return count;
}

/**
 * Wendet Patches der Reihe nach an. Nicht anwendbare Patches werden übersprungen
 * und protokolliert, nicht stillschweigend verworfen.
 *
 * Wichtig: Jeder Patch wird gegen den AKTUELLEN Stand geprüft. Zwei Patches,
 * die nacheinander dieselbe Stelle betreffen, verhalten sich damit wie erwartet.
 */
export function applyPatches(text: string, patches: TextPatch[]): PatchResult {
  let current = normalize(text);
  const rejected: PatchResult["rejected"] = [];
  let applied = 0;

  for (const patch of patches) {
    const check = canApply(current, patch);
    if (!check.ok) {
      log.warn(`Patch abgelehnt: ${check.reason} (search: ${patch.search.slice(0, 60)}…)`);
      rejected.push({ patch, reason: check.reason ?? "Unbekannter Grund." });
      continue;
    }
    const needle = normalize(patch.search).trim();
    const replacement = normalize(patch.replace).trim();
    current = current.replace(needle, replacement);
    applied++;
  }

  return { text: current, applied, rejected };
}

/**
 * Baut einen Unified-Diff-Text zur ANZEIGE (nicht zum Anwenden).
 *
 * Für die Anwendung sind die Patch-Paare maßgeblich; der Diff ist die
 * menschenlesbare Darstellung im Redaktions-Panel. Bewusst zeilenweise und
 * ohne LCS — Manuskripte sind groß, und ein vollständiger Diff-Algorithmus
 * wäre für die Anzeige unverhältnismäßig.
 */
export function renderDiff(before: string, after: string, contextLines = 1): string {
  const a = normalize(before).split("\n");
  const b = normalize(after).split("\n");

  // Gemeinsamen Anfang/Ende abschneiden: nur der geänderte Bereich wird gezeigt.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a[endA] === b[endB]) {
    endA--;
    endB--;
  }

  // Kein Unterschied: endA rutscht unter start, der Bereich ist leer.
  // Ohne diese Prüfung würde die Kontext-Schleife darunter eine unveränderte
  // Zeile als Diff ausgeben.
  if (endA < start && endB < start) return "";

  const from = Math.max(0, start - contextLines);
  const out: string[] = [];
  for (let i = from; i < start; i++) out.push(` ${a[i]}`);
  for (let i = start; i <= endA; i++) out.push(`-${a[i]}`);
  for (let i = start; i <= endB; i++) out.push(`+${b[i]}`);
  const tailTo = Math.min(a.length - 1, endA + contextLines);
  for (let i = endA + 1; i <= tailTo; i++) out.push(` ${a[i]}`);

  return out.join("\n");
}

/**
 * Prüft, ob eine vorgeschlagene Änderung inhaltlich plausibel ist.
 *
 * Schützt vor dem häufigsten Modellfehler beim Lektorat: Es liefert eine
 * "Verbesserung", die den Abschnitt faktisch leert oder vervielfacht.
 * Gibt null zurück, wenn die Änderung in Ordnung ist, sonst den Grund.
 */
export function sanityCheck(before: string, after: string): string | null {
  const b = before.trim();
  const a = after.trim();
  if (!a) return "Ersetzung würde den Abschnitt leeren.";
  // Eine Verdopplung des Textes ist beim Lektorat praktisch nie gewollt.
  if (b.length > 80 && a.length > b.length * 2.5) {
    return `Ersetzung ist unverhältnismäßig lang (${b.length} → ${a.length} Zeichen).`;
  }
  // Ein Lektorat, das den Text halbiert, ist verdächtig — außer bei "straffen".
  return null;
}
