// KDP-Pre-Upload-Checkliste (Sprint 9, Agent 3; i18n Sprint 13, Agent 6).
//
// Präsentations-Komponente für den Upload-Dialog: zeigt vor dem Transport,
// ob Dateiformat, Metadaten-Vollständigkeit und Cover den KDP-Vertrag
// erfüllen, und blockiert den Upload-Button bis alle Pflichtpunkte grün
// sind. Reine Sicht auf validateUploadArtefact() — keine eigene Validierung.

import { useMemo } from "react";
import type { KdpMetadata } from "@/types/bookwriter";
import {
  validateUploadArtefact,
  type UploadFile,
} from "@/services/bookwriter/kdpUploadValidation";
import { useI18n, type Interpolation, type TranslationKey } from "@/i18n";
import { de } from "@/i18n/locales/de";
import "./kdp.css";

/** Übersetzungsfunktion (t aus useI18n) — als optionaler Parameter der reinen Builder-Funktion. */
export type PreUploadTranslator = (key: TranslationKey, vars?: Interpolation) => string;

/** Fallback ohne Provider/Testkontext: deutsche Referenztexte. */
function germanFallback(key: TranslationKey): string {
  return de[key] ?? String(key);
}

/** Ein Checklistenpunkt der Pre-Upload-Prüfung. */
export interface PreUploadCheckItem {
  id: "format" | "size" | "metadata" | "price" | "cover" | "isbn";
  label: string;
  ok: boolean;
  /** Pflichtpunkt (blockiert den Upload) oder optional. */
  required: boolean;
  /** Detailhinweis aus der Validierung. */
  hint: string | null;
}

export interface PreUploadChecklistInput {
  file: UploadFile | null;
  metadata: KdpMetadata;
  isbn?: string | null;
}

/**
 * Baut die Checkliste als reine Funktion (testbar ohne DOM):
 * Dateiformat, Dateigröße, Metadaten-Vollständigkeit, Preis, Cover, ISBN.
 * Ohne `t` fallen Labels/Hinweise auf Deutsch zurück (bestehende Tests).
 */
export function buildPreUploadChecklist(
  input: PreUploadChecklistInput,
  t: PreUploadTranslator = germanFallback,
): PreUploadCheckItem[] {
  const { file, metadata, isbn = null } = input;
  const validation = validateUploadArtefact(file, metadata, { isbn });
  const issues = validation.issues;
  const errorsOn = (field: "file" | "metadata" | "isbn") =>
    issues.filter((i) => i.field === field && i.severity === "error");

  const fileErrors = errorsOn("file");
  const formatOk = !fileErrors.some((i) => /format|endung|kein dateiname|keine manuskript/i.test(i.message));
  const sizeOk = !fileErrors.some((i) => /leer|klein|groß|limit/i.test(i.message));
  const fileHint = fileErrors.map((i) => i.message).join("; ") || null;

  const metaErrors = errorsOn("metadata").filter((i) => !/preis/i.test(i.message));
  const metadataOk = !metaErrors.some((i) => /titel|klappentext|keyword/i.test(i.message));
  const priceOk = !issues.some((i) => /preis/i.test(i.message) && i.severity === "error");

  const coverOk = (metadata.coverImage?.trim() ?? "") !== "";
  const isbnErrors = errorsOn("isbn");
  const isbnOk = isbnErrors.length === 0;

  return [
    {
      id: "format",
      label: t("kdp.preupload.label.format"),
      ok: formatOk,
      required: true,
      hint: formatOk ? (file ? file.name : null) : fileHint,
    },
    {
      id: "size",
      label: t("kdp.preupload.label.size"),
      ok: sizeOk,
      required: true,
      hint: sizeOk ? null : fileHint,
    },
    {
      id: "metadata",
      label: t("kdp.preupload.label.metadata"),
      ok: metadataOk,
      required: true,
      hint: metadataOk ? null : metaErrors.map((i) => i.message).join("; "),
    },
    {
      id: "price",
      label: t("kdp.preupload.label.price"),
      ok: priceOk,
      required: false,
      hint: priceOk ? (metadata.priceUsd != null ? `${metadata.priceUsd.toFixed(2)} USD` : t("kdp.preupload.priceAskedLater")) : issues.find((i) => /preis/i.test(i.message))?.message ?? null,
    },
    {
      id: "cover",
      label: t("kdp.preupload.label.cover"),
      ok: coverOk,
      required: true,
      hint: coverOk ? null : t("kdp.preupload.coverMissingHint"),
    },
    {
      id: "isbn",
      label: isbn ? t("kdp.preupload.label.isbnValid") : t("kdp.preupload.label.isbnOptional"),
      ok: isbnOk,
      required: false,
      hint: isbnOk ? null : isbnErrors.map((i) => i.message).join("; "),
    },
  ];
}

/** Props der Pre-Upload-Checkliste. */
export interface KdpPreUploadChecklistProps extends PreUploadChecklistInput {
  /** Upload-Callback (nur bei erfüllten Pflichtpunkten klickbar). */
  onUpload?: () => void;
  /** Button-Label. Default: t("kdp.preupload.upload"). */
  uploadLabel?: string;
  /** Deaktiviert den Button zusätzlich (z. B. während ein Upload läuft). */
  busy?: boolean;
}

const ITEM_ICON: Record<string, string> = { ok: "✔", fail: "✘" };

export function KdpPreUploadChecklist({
  file,
  metadata,
  isbn = null,
  onUpload,
  uploadLabel,
  busy = false,
}: KdpPreUploadChecklistProps) {
  const { t } = useI18n();
  const label = uploadLabel ?? t("kdp.preupload.upload");
  const items = useMemo(
    () => buildPreUploadChecklist({ file, metadata, isbn }, t),
    [file, metadata, isbn, t],
  );
  const blocking = items.filter((i) => i.required && !i.ok);
  const ready = blocking.length === 0;
  const doneCount = items.filter((i) => i.ok).length;

  return (
    <div className="kdp kdp-preupload" data-testid="kdp-preupload-checklist">
      <div className="kdp-head">
        <h3>{t("kdp.preupload.title")}</h3>
        <span className="kdp-summary" data-testid="kdp-preupload-summary">
          {t("kdp.preupload.summary", { done: doneCount, total: items.length })}
        </span>
      </div>

      <ul className="kdp-list">
        {items.map((item) => (
          <li
            key={item.id}
            className={`kdp-item kdp-item-${item.ok ? "ok" : "err"}`}
            data-testid={`kdp-preupload-item-${item.id}`}
            data-ok={item.ok ? "true" : "false"}
          >
            <span className="kdp-item-icon">{ITEM_ICON[item.ok ? "ok" : "fail"]}</span>
            <span className="kdp-item-body">
              <span className="kdp-item-label">
                {item.label}
                {!item.required && <span className="kdp-item-optional">{t("kdp.preupload.optional")}</span>}
              </span>
              {item.hint && <span className="kdp-item-hint">{item.hint}</span>}
            </span>
          </li>
        ))}
      </ul>

      {!ready && (
        <div className="kdp-notice kdp-notice-err" data-testid="kdp-preupload-blocking">
          {t("kdp.preupload.blocking", { count: blocking.length })}
        </div>
      )}

      {onUpload && (
        <button
          className="kdp-export"
          data-testid="kdp-preupload-upload-btn"
          onClick={onUpload}
          disabled={busy || !ready}
          title={ready ? label : t("kdp.preupload.fulfillFirst")}
        >
          {busy ? t("kdp.preupload.uploading") : label}
        </button>
      )}
    </div>
  );
}
