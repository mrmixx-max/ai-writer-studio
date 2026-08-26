// About-Dialog. Zeigt Version, Speicherorte und Persistenzstatus.
//
// Der Persistenzhinweis ist bewusst hier sichtbar: Läuft die App ohne
// Dateipersistenz (In-Memory), muss der Nutzer das erfahren können, bevor
// er stundenlang schreibt.

import { useEffect, useState } from "react";
import { APP_NAME, APP_VERSION, APP_CLAIM, APP_COPYRIGHT, APP_URL } from "@/version";
import { databasePath, isPersistent } from "@/services/db";

interface Props {
  onClose: () => void;
}

interface Paths {
  data: string;
  logs: string;
  exports: string;
  backups: string;
}

export function AboutDialog({ onClose }: Props) {
  const [paths, setPaths] = useState<Paths | null>(null);
  const [tauriVersion, setTauriVersion] = useState<string | null>(null);

  useEffect(() => {
    // Pfade und Backend-Version aus dem Rust-Teil holen. Schlägt das fehl
    // (Browser-Dev-Modus), bleibt die Anzeige einfach leer statt zu brechen.
    void (async () => {
      try {
        const core = await import("@tauri-apps/api/core");
        const info = await core.invoke<{ tauri: string }>("app_info");
        setTauriVersion(info.tauri);
        const p = await core.invoke<Paths>("user_paths");
        setPaths(p);
      } catch {
        /* Kein Tauri-Kontext: Pfadangaben entfallen. */
      }
    })();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const dbPath = databasePath();
  const persistent = isPersistent();

  return (
    <div className="about-backdrop" onClick={onClose} role="presentation">
      <div
        className="about-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Über ${APP_NAME}`}
      >
        <div className="about-brand">
          <span className="about-wordmark">{APP_NAME}</span>
          <span className="welcome-version">{APP_VERSION}</span>
        </div>
        <p className="about-claim">{APP_CLAIM}</p>

        <div className="about-rows selectable">
          <span className="about-key">Speicherung</span>
          <span className="about-val">
            {persistent ? "Dauerhaft auf Datenträger" : "Nur im Arbeitsspeicher"}
          </span>

          {dbPath && (
            <>
              <span className="about-key">Datenbank</span>
              <span className="about-val">{dbPath}</span>
            </>
          )}

          {paths && (
            <>
              <span className="about-key">Protokolle</span>
              <span className="about-val">{paths.logs}</span>
              <span className="about-key">Exporte</span>
              <span className="about-val">{paths.exports}</span>
              <span className="about-key">Sicherungen</span>
              <span className="about-val">{paths.backups}</span>
            </>
          )}

          {tauriVersion && (
            <>
              <span className="about-key">Laufzeit</span>
              <span className="about-val">Tauri {tauriVersion}</span>
            </>
          )}

          <span className="about-key">Projektseite</span>
          <span className="about-val">{APP_URL}</span>
        </div>

        {!persistent && (
          <p className="provider-status error" style={{ marginBottom: 20 }}>
            Achtung: Änderungen werden derzeit nicht dauerhaft gespeichert.
            Beim Schließen der App gehen sie verloren. Prüfe die Protokolldatei,
            um die Ursache zu finden.
          </p>
        )}

        <div className="about-foot">
          <span className="about-copy">{APP_COPYRIGHT} · MIT-Lizenz</span>
          <button className="wbtn" onClick={onClose}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
