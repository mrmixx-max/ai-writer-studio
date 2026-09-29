// Serialisierte Schreiboperationen ("Connection Pooling" für sql.js)
//
// sql.js hat genau EINE Verbindung (die In-Memory-DB). Ein klassischer Pool
// ist nicht möglich; das Ziel — keine überlappenden Schreibvorgänge, keine
// Race-Conditions zwischen persistNow()-Exporten — wird stattdessen durch
// eine serielle Aufgabenwarteschlange erreicht: Alle Schreiboperationen laufen
// nacheinander, niemals parallel.

let writeChain: Promise<void> = Promise.resolve();

/**
 * Führt eine Schreiboperation serialisiert aus. Mehrere gleichzeitig
 * aufgerufene Tasks laufen strikt nacheinander; ein Fehler bricht die
 * Kette nicht (der nächste Task läuft weiter).
 */
export function enqueueWrite<T>(task: () => Promise<T> | T): Promise<T> {
  const result = writeChain.then(task);
  writeChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Gibt die aktuelle Kette zurück (für Tests/Inspektion). */
export function getWriteChain(): Promise<void> {
  return writeChain;
}

/** Setzt die Kette zurück (für Tests). */
export function resetWriteChain(): void {
  writeChain = Promise.resolve();
}