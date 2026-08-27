// Exportbereitschaft als Ampel.
//
// Bewusst im Service, nicht in der View: Die Ampel ist eine Produktaussage
// ("kann ich das veröffentlichen?"), keine Darstellungsfrage. Sie muss
// testbar sein und überall dasselbe sagen — im Preflight-Bereich wie im
// Exportdialog.

import type { PreflightFinding, PreflightStats } from "@/types/preflight";

export type ReadinessLevel = "green" | "yellow" | "red";

export interface Readiness {
  level: ReadinessLevel;
  /** Kurze Aussage, was der Zustand bedeutet. */
  title: string;
  /** Erklärung mit Zahlen. */
  detail: string;
  /** Empfohlener nächster Schritt. */
  nextStep: string | null;
}

/**
 * Bewertet die Exportbereitschaft.
 *
 * Regel:
 *   rot   mindestens ein Blocker — Export erzeugt ein fehlerhaftes Ergebnis
 *   gelb  Warnungen, aber keine Blocker — Export läuft, mit sichtbaren Mängeln
 *   grün  nur Hinweise oder nichts
 *
 * Ein noch nicht durchgeführter Prüflauf ist NICHT grün. Grün heißt "geprüft
 * und in Ordnung", nicht "nichts bekannt" — sonst wäre die Ampel eine Lüge.
 */
export function assessReadiness(stats: PreflightStats): Readiness {
  if (stats.lastRun === null) {
    return {
      level: "yellow",
      title: "Noch nicht geprüft",
      detail:
        "Für dieses Projekt liegt kein Prüfbericht vor. Ohne Prüfung ist " +
        "unbekannt, ob der Export ein brauchbares Ergebnis liefert.",
      nextStep: "Exportprüfung starten",
    };
  }

  if (stats.blocker > 0) {
    return {
      level: "red",
      title: `${stats.blocker} ${stats.blocker === 1 ? "kritischer Befund" : "kritische Befunde"}`,
      detail:
        `Der Export würde ein fehlerhaftes oder unvollständiges Ergebnis ` +
        `liefern. Zusätzlich ${stats.warning} ${stats.warning === 1 ? "Warnung" : "Warnungen"} ` +
        `und ${stats.hint} ${stats.hint === 1 ? "Hinweis" : "Hinweise"}.`,
      nextStep: "Kritische Befunde beheben oder als bewusst markieren",
    };
  }

  if (stats.warning > 0) {
    return {
      level: "yellow",
      title: `${stats.warning} ${stats.warning === 1 ? "Warnung" : "Warnungen"}`,
      detail:
        "Der Export läuft durch, das Ergebnis hat aber sichtbare Mängel. " +
        `Dazu ${stats.hint} ${stats.hint === 1 ? "Hinweis" : "Hinweise"}. ` +
        "Für eine Veröffentlichung solltest du die Warnungen durchgehen.",
      nextStep: "Warnungen prüfen",
    };
  }

  if (stats.hint > 0) {
    return {
      level: "green",
      title: "Bereit für den Export",
      detail:
        `Keine kritischen Befunde und keine Warnungen. ${stats.hint} ` +
        `${stats.hint === 1 ? "Hinweis" : "Hinweise"} zur Verbesserung, ` +
        "die den Export nicht behindern.",
      nextStep: null,
    };
  }

  return {
    level: "green",
    title: "Bereit für den Export",
    detail: "Die Prüfung hat keine Auffälligkeiten gefunden.",
    nextStep: null,
  };
}

/**
 * Bewertet ein einzelnes Format.
 * Grundlage für die Zähler am Formatwähler.
 */
export function assessFormat(
  findings: PreflightFinding[],
  format: string,
): { blocker: number; warning: number; hint: number; level: ReadinessLevel } {
  const relevant = findings.filter((f) => {
    if (f.status !== "open") return false;
    // Formatunabhängige Befunde gelten für jedes Format.
    if (f.affectedFormats.length === 0) return true;
    return f.affectedFormats.includes(format as PreflightFinding["affectedFormats"][number]);
  });

  const blocker = relevant.filter((f) => f.severity === "blocker").length;
  const warning = relevant.filter((f) => f.severity === "warning").length;
  const hint = relevant.filter((f) => f.severity === "hint").length;

  return {
    blocker,
    warning,
    hint,
    level: blocker > 0 ? "red" : warning > 0 ? "yellow" : "green",
  };
}

/**
 * Hinweis zur KI-Offenlegung bei KDP.
 *
 * Amazon verlangt seit 2023 die Angabe KI-generierter Inhalte beim Upload.
 * Der Hinweis steht bewusst als Konstante hier und nicht verstreut in der
 * Oberfläche: Er ist eine rechtliche Aussage und darf nicht versehentlich
 * an einer Stelle fehlen oder abweichen.
 */
export const KDP_AI_DISCLOSURE =
  "Wenn Teile dieses Manuskripts von einer KI erzeugt wurden, musst du das " +
  "bei der Veröffentlichung über KDP angeben. Amazon unterscheidet zwischen " +
  "KI-generiertem Inhalt (die KI hat den Text geschrieben) und KI-unterstütztem " +
  "Inhalt (du hast geschrieben, die KI hat geholfen). Die Angabe erfolgt beim " +
  "Upload im KDP-Konto — diese App überträgt nichts und kann die Angabe nicht " +
  "für dich machen.";
