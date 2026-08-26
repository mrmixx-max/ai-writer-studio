// Splash-Bildschirm. Sichtbar, bis das Frontend bereit ist.
//
// Zweck: Das Tauri-Fenster startet mit "visible": false und wird erst gezeigt,
// wenn React gerendert hat. Der Splash überbrückt die Zeit, in der sql.js sein
// WASM lädt und die Migrationen laufen — sonst sähe der Nutzer eine leere
// Fläche und hielte die App für hängend.

import { APP_NAME } from "@/version";

interface Props {
  /** Was gerade passiert, in Klartext. */
  note?: string;
}

export function Splash({ note = "Manuskriptverwaltung wird geladen…" }: Props) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash-mark">{APP_NAME}</div>
      <div className="splash-bar" />
      <div className="splash-note">{note}</div>
    </div>
  );
}
