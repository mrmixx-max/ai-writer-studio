// KDP-Package-Panel (Sprint 11, Agent 3; i18n Sprint 13, Agent 6).
//
// Vorschau des manuellen Upload-Bundles: Dateien, SHA256-Hashes,
// Validierungsstand + Download-als-ZIP. Reine Sicht auf buildKdpBundle()
// — keine eigene Validierung, kein Upload (KDP hat keine Public API, der
// Upload passiert manuell im KDP-Webformular).
//
// ZIP via JSZip (bereits Dependency, vgl. releasePackage.ts) — keine neuen
// Pakete. Der Download nutzt einen Anchor-Download im Browser-Kontext.

import { useEffect, useState } from "react";
import type { KdpMetadata } from "@/types/bookwriter";
import {
  buildKdpBundle,
  downloadBundleAsZip,
  type KdpBundle,
  type KdpBundleInputFile,
} from "@/services/bookwriter/kdpPackage";
import { useI18n } from "@/i18n";
import "./kdp.css";

export interface KdpPackagePanelProps {
  title: string;
  author?: string;
  language?: string;
  isbn?: string | null;
  metadata: KdpMetadata;
  /** Manuskript aus dem Export-Service (exportBook) — null = noch kein Export. */
  manuscript: KdpBundleInputFile | null;
  cover?: KdpBundleInputFile | null;
}

type Notice = { text: string; kind: "ok" | "warn" | "err" } | null;

function shortHash(hash: string): string {
  return `${hash.slice(0, 12)}…`;
}

export function KdpPackagePanel({
  title,
  author,
  language,
  isbn,
  metadata,
  manuscript,
  cover,
}: KdpPackagePanelProps) {
  const { t } = useI18n();
  const [bundle, setBundle] = useState<KdpBundle | null>(null);
  const [building, setBuilding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let cancelled = false;
    setBundle(null);
    setNotice(null);
    if (!manuscript) return;
    setBuilding(true);
    buildKdpBundle({ title, author, language, isbn: isbn ?? null, metadata, manuscript, cover: cover ?? null })
      .then((b) => {
        if (cancelled) return;
        setBundle(b);
        if (!b.canUpload) {
          const reasons = b.manifest.validation.issues
            .filter((i) => i.severity === "error")
            .map((i) => i.message);
          if (!b.manifest.coverPresent) reasons.push(t("kdp.package.coverMissingNoProof"));
          setNotice({ text: t("kdp.package.bundleBlocked", { reasons: reasons.join("; ") }), kind: "err" });
        }
      })
      .catch((e) => {
        if (!cancelled) setNotice({ text: (e as Error)?.message ?? String(e), kind: "err" });
      })
      .finally(() => {
        if (!cancelled) setBuilding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [title, author, language, isbn, metadata, manuscript, cover, t]);

  async function downloadZip() {
    if (!bundle || !bundle.canUpload) return;
    setBusy(true);
    try {
      const { filename, sizeBytes } = await downloadBundleAsZip(bundle);
      setNotice({
        text: t("kdp.package.downloaded", {
          filename,
          kb: Math.max(1, Math.round(sizeBytes / 1024)),
        }),
        kind: "ok",
      });
    } catch (e) {
      setNotice({ text: (e as Error)?.message ?? String(e), kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  if (!manuscript) {
    return (
      <div className="kdp mode-placeholder" data-testid="kdp-package-empty">
        {t("kdp.package.empty")}
      </div>
    );
  }

  if (building || !bundle) {
    return (
      <div className="kdp mode-placeholder" data-testid="kdp-package-building">
        {t("kdp.package.building")}
      </div>
    );
  }

  const validation = bundle.manifest.validation;

  return (
    <div className="kdp kdp-package" data-testid="kdp-package-panel">
      <h3>{t("kdp.package.title")}</h3>
      <p className="kdp-hint">
        {t("kdp.package.hint")}
      </p>

      <div
        className={`kdp-status ${bundle.canUpload ? "ok" : "blocked"}`}
        data-testid="kdp-package-status"
      >
        {bundle.canUpload
          ? t("kdp.package.ready", { errors: validation.errorCount, warnings: validation.warningCount })
          : t("kdp.package.blocked", { errors: validation.errorCount, warnings: validation.warningCount })}
      </div>

      <table className="kdp-files" data-testid="kdp-package-files">
        <thead>
          <tr>
            <th>{t("kdp.package.col.file")}</th>
            <th>{t("kdp.package.col.role")}</th>
            <th>{t("kdp.package.col.size")}</th>
            <th>{t("kdp.package.col.sha")}</th>
          </tr>
        </thead>
        <tbody>
          {bundle.manifest.files.map((f) => (
            <tr key={f.name}>
              <td>{f.name}</td>
              <td>{f.role}</td>
              <td>{t("kdp.package.sizeKb", { kb: Math.max(1, Math.round(f.sizeBytes / 1024)) })}</td>
              <td title={f.sha256}>{shortHash(f.sha256)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="kdp-checklist" data-testid="kdp-package-checklist">
        {bundle.manifest.checklist.map((c) => (
          <li key={c.label} className={c.ok ? "ok" : "fail"}>
            {c.ok ? "✔" : "✘"} {c.label}
          </li>
        ))}
      </ul>

      {validation.issues.length > 0 && (
        <ul className="kdp-issues" data-testid="kdp-package-issues">
          {validation.issues.map((issue, i) => (
            <li key={i} className={issue.severity}>
              [{issue.field}] {issue.message}
            </li>
          ))}
        </ul>
      )}

      {notice && (
        <div className={`kdp-notice ${notice.kind}`} data-testid="kdp-package-notice">
          {notice.text}
        </div>
      )}

      <button
        type="button"
        onClick={downloadZip}
        disabled={!bundle.canUpload || busy}
        data-testid="kdp-package-download"
        title={bundle.canUpload ? t("kdp.package.download") : t("kdp.package.downloadBlockedTitle")}
      >
        {busy ? t("kdp.package.creatingZip") : t("kdp.package.download")}
      </button>
    </div>
  );
}
