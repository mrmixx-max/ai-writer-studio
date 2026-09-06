// UpdateCheck: Auto-Update-Oberfläche (Prüfen → Herunterladen → Neustart).
//
// Nutzt die Backend-Commands aus src-tauri/src/updater.rs via invoke()
// (konsistent mit z. B. GitPanel/executor.ts):
//   check_for_updates          -> UpdateInfo { available, current_version, version, notes, date }
//   download_and_install_update -> installiert; Fortschritt als Events
//   relaunch_app                -> Neustart in die neue Version
// Fortschritts-Events vom Backend: "update://progress" { downloaded, total },
// "update://installed" { version }.
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Zustände der Update-State-Machine. */
export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "up-to-date"
  | "error";

/** Entspricht UpdateInfo aus src-tauri/src/updater.rs (snake_case vom Backend). */
export interface UpdateInfo {
  available: boolean;
  current_version: string;
  version: string | null;
  notes: string | null;
  date: string | null;
}

interface ProgressPayload {
  downloaded: number;
  total: number | null;
}

interface InstalledPayload {
  version: string;
}

const STATUS_TEXT: Record<UpdateStatus, string> = {
  idle: "Noch nicht geprüft.",
  checking: "Suche nach Updates …",
  available: "Update verfügbar.",
  downloading: "Update wird heruntergeladen …",
  ready: "Update bereit.",
  "up-to-date": "Die App ist aktuell.",
  error: "Fehler bei der Update-Prüfung.",
};

export function UpdateCheck() {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [restarting, setRestarting] = useState(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  // Fortschritts-Events einmalig beim Mount abonnieren.
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenInstalled: (() => void) | undefined;
    let cancelled = false;

    listen<ProgressPayload>("update://progress", (e) => {
      if (statusRef.current !== "downloading") return;
      setDownloaded(e.payload.downloaded);
      setTotal(e.payload.total);
    }).then((u) => {
      if (cancelled) u();
      else unlistenProgress = u;
    });

    listen<InstalledPayload>("update://installed", (e) => {
      if (statusRef.current !== "downloading") return;
      setDownloaded((d) => d);
      setInfo((prev) =>
        prev
          ? { ...prev, version: e.payload.version ?? prev.version }
          : prev,
      );
      setStatus("ready");
    }).then((u) => {
      if (cancelled) u();
      else unlistenInstalled = u;
    });

    return () => {
      cancelled = true;
      unlistenProgress?.();
      unlistenInstalled?.();
    };
  }, []);

  async function check() {
    setStatus("checking");
    setError(null);
    try {
      const res = await invoke<UpdateInfo>("check_for_updates");
      setInfo(res);
      setStatus(res.available ? "available" : "up-to-date");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function download() {
    setStatus("downloading");
    setError(null);
    setDownloaded(0);
    setTotal(null);
    try {
      await invoke("download_and_install_update");
      // Das Backend sendet "update://installed" und startet neu.
      // Falls das Event ausbleibt (z. B. älteres Backend), nicht hängen bleiben:
      // nach erfolgreichem invoke gilt das Update als bereit.
      if (statusRef.current === "downloading") setStatus("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  async function restart() {
    setRestarting(true);
    try {
      await invoke("relaunch_app");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
      setRestarting(false);
    }
  }

  const percent =
    total != null && total > 0
      ? Math.min(100, Math.round((downloaded / total) * 100))
      : null;

  return (
    <div className="update-check" data-status={status}>
      <h4>App-Updates</h4>
      <p className="update-check-status" role="status">
        {status === "error" && error ? error : STATUS_TEXT[status]}
      </p>

      {info?.current_version && (
        <p className="update-check-version">
          Installiert: {info.current_version}
          {info.version && info.available && <> → {info.version}</>}
        </p>
      )}

      {status === "available" && info?.notes && (
        <details className="update-check-notes">
          <summary>Release-Notes ({info.version})</summary>
          <pre>{info.notes}</pre>
        </details>
      )}

      {(status === "idle" ||
        status === "up-to-date" ||
        status === "error" ||
        status === "available") && (
        <div className="update-check-actions">
          {status !== "available" ? (
            <button
              onClick={check}
              title="Update-Feed auf eine neuere Version prüfen"
            >
              Nach Updates suchen
            </button>
          ) : (
            <>
              <button onClick={download} title="Update herunterladen und installieren">
                Update installieren
              </button>
              <button onClick={check} title="Erneut prüfen">
                Erneut prüfen
              </button>
            </>
          )}
        </div>
      )}

      {status === "downloading" && (
        <div className="update-check-progress">
          <progress
            value={percent ?? undefined}
            max={100}
            aria-label="Download-Fortschritt"
          />
          <span>
            {percent != null
              ? `${percent} %`
              : `${Math.round(downloaded / 1024)} KB geladen`}
          </span>
        </div>
      )}

      {status === "ready" && (
        <div className="update-check-ready">
          <p>
            Update{info?.version ? ` auf ${info.version}` : ""} ist installiert.
            Bitte die App neu starten, um es zu verwenden.
          </p>
          <button onClick={restart} disabled={restarting}>
            {restarting ? "Starte neu …" : "Jetzt neu starten"}
          </button>
        </div>
      )}
    </div>
  );
}

export default UpdateCheck;
