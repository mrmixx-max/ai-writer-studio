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
import { useI18n } from "@/i18n";

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

export function UpdateCheck() {
  const { t } = useI18n();
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [restarting, setRestarting] = useState(false);
  const statusRef = useRef(status);
  statusRef.current = status;

  const STATUS_TEXT: Record<UpdateStatus, string> = {
    idle: t("updatecheck.status.idle"),
    checking: t("updatecheck.status.checking"),
    available: t("updatecheck.status.available"),
    downloading: t("updatecheck.status.downloading"),
    ready: t("updatecheck.status.ready"),
    "up-to-date": t("updatecheck.status.upToDate"),
    error: t("updatecheck.status.error"),
  };

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
      <h4>{t("updatecheck.title")}</h4>
      <p className="update-check-status" role="status">
        {status === "error" && error ? error : STATUS_TEXT[status]}
      </p>

      {info?.current_version && (
        <p className="update-check-version">
          {t("updatecheck.installed", { current: info.current_version })}
          {info.version && info.available && <> → {info.version}</>}
        </p>
      )}

      {status === "available" && info?.notes && (
        <details className="update-check-notes">
          <summary>{t("updatecheck.releaseNotes", { version: info.version ?? "" })}</summary>
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
              title={t("updatecheck.checkTitle")}
            >
              {t("updatecheck.check")}
            </button>
          ) : (
            <>
              <button onClick={download} title={t("updatecheck.installTitle")}>
                {t("updatecheck.install")}
              </button>
              <button onClick={check} title={t("updatecheck.recheckTitle")}>
                {t("updatecheck.recheck")}
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
            aria-label={t("updatecheck.progressLabel")}
          />
          <span>
            {percent != null
              ? t("updatecheck.percent", { percent })
              : t("updatecheck.downloadedKb", { kb: Math.round(downloaded / 1024) })}
          </span>
        </div>
      )}

      {status === "ready" && (
        <div className="update-check-ready">
          <p>
            {info?.version
              ? t("updatecheck.readyWithVersion", { version: info.version })
              : t("updatecheck.readyWithoutVersion")}
          </p>
          <button onClick={restart} disabled={restarting}>
            {restarting ? t("updatecheck.restarting") : t("updatecheck.restart")}
          </button>
        </div>
      )}
    </div>
  );
}

export default UpdateCheck;
