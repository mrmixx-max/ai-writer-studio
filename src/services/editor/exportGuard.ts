// Export-Guard: Prüft vor dem Export, ob noch offene Track-Changes existieren.
//
// Wenn der Lektorat-Button Patches als Track-Changes angewendet hat, aber der
// Autor sie noch nicht akzeptiert oder abgelehnt hat, soll der Export nicht
// stillschweigend durchlaufen. Stattdessen wird der Autor gefragt, ob er die
// Änderungen vor dem Export annehmen oder ablehnen will.

import type { EditorState } from "@tiptap/pm/state";
import { hasOpenTrackChanges, countOpenTrackChanges } from "@/services/editor/editorialTrackChanges";

export interface ExportGuardResult {
  /** true, wenn exportiert werden darf (keine offenen Track-Changes). */
  allowed: boolean;
  /** Anzahl der offenen Track-Changes. */
  openChanges: number;
  /** Warnmeldung für die UI. */
  message: string | null;
}

/**
 * Prüft, ob noch offene Track-Changes im Editor existieren.
 * Gibt eine Warnung zurück, wenn Lektoratsänderungen noch nicht bearbeitet wurden.
 */
export function checkExportGuard(state: EditorState): ExportGuardResult {
  if (!hasOpenTrackChanges(state)) {
    return { allowed: true, openChanges: 0, message: null };
  }

  const count = countOpenTrackChanges(state);
  return {
    allowed: false,
    openChanges: count,
    message: `Achtung: ${count} Lektoratsänderungen sind noch nicht akzeptiert oder abgelehnt. Vor dem Export bitte alle Änderungen überprüfen.`,
  };
}
