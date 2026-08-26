// Zustand des Erststart-Assistenten.
//
// Gespeichert wird in localStorage, nicht in der SQLite-DB: Der Assistent muss
// auch dann entscheiden können, ob er erscheint, wenn die DB noch nicht bereit
// ist oder gerade migriert wird.

const KEY_COMPLETED = "aiws.setup.completed";
const KEY_VERSION = "aiws.setup.version";

/**
 * Version des Assistenten. Erhöhen, wenn neue Schritte hinzukommen, die auch
 * bestehende Nutzer sehen sollen — dann erscheint er erneut.
 */
export const SETUP_VERSION = 1;

/** true, wenn der Assistent für die aktuelle Version schon durchlaufen wurde. */
export function isSetupCompleted(): boolean {
  try {
    if (localStorage.getItem(KEY_COMPLETED) !== "1") return false;
    const v = Number(localStorage.getItem(KEY_VERSION) ?? "0");
    return v >= SETUP_VERSION;
  } catch {
    // Kein localStorage (sehr seltener Fall): Assistent lieber zeigen als
    // den Nutzer ohne Einrichtung stehen lassen.
    return false;
  }
}

/** Markiert den Assistenten als abgeschlossen. */
export function markSetupCompleted(): void {
  try {
    localStorage.setItem(KEY_COMPLETED, "1");
    localStorage.setItem(KEY_VERSION, String(SETUP_VERSION));
  } catch {
    /* Nicht kritisch: der Assistent erscheint dann erneut. */
  }
}

/** Setzt den Assistenten zurück — für "Erste Schritte erneut anzeigen". */
export function resetSetup(): void {
  try {
    localStorage.removeItem(KEY_COMPLETED);
    localStorage.removeItem(KEY_VERSION);
  } catch {
    /* ignorieren */
  }
}
