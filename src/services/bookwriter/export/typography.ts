// Deutsche Typografie-Normalisierung (C2).
//
// KDP-/Lektorats-Regeln:
// - Gerade Anführungszeichen ("…") → deutsche typografische „…“.
//   Apostrophe bleiben erhalten (').
// - Gedankenstriche: " - " (Bindestrich mit Leerzeichen) → " – " (Halbgeviertstrich).
//   already-typografische " – " und " — " bleiben unangetastet.
// - Keine doppelten Leerzeichen (auch 3+), keine Leerzeichen vor Satzzeichen.
//   Schützendes Leerzeichen am Zeilen-/Blockanfang/-ende bleibt nicht erhalten
//   (trim erfolgt blockweise durch den Aufrufer, hier pro Zeile).

export function normalizeTypography(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    // Anführungszeichen: "…" → „…“ (nicht-greedy über Satzgrenzen hinweg,
    // keine Verschachtelung — Buchtext nutzt einfache Paare).
    .replace(/"([^"\n]+?)"/g, "„$1“")
    // Gedankenstrich: " - " → " – " (nicht "—", falls schon vorhanden).
    .replace(/ - /g, " – ")
    // Keine doppelten (oder mehr) Leerzeichen — Tabs bleiben.
    .replace(/[ \t]{2,}/g, " ")
    // Leerzeichen vor Satzzeichen entfernen.
    .replace(/ +([,.:;!?])/g, "$1")
    // Leerzeichen nach öffnender / vor schließender Klammer.
    .replace(/\( +/g, "(")
    .replace(/ +\)/g, ")");
}