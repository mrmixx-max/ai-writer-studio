// KDP-Pre-Upload-Checkliste (Sprint 9, Agent 3).
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
import "./kdp.css";

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
 */
export function buildPreUploadChecklist(input: PreUploadChecklistInput): PreUploadCheckItem[] {
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
      label: "Dateiformat DOCX/EPUB",
      ok: formatOk,
      required: true,
      hint: formatOk ? (file ? file.name : null) : fileHint,
    },
    {
      id: "size",
      label: "Dateigröße im Limit",
      ok: sizeOk,
      required: true,
      hint: sizeOk ? null : fileHint,
    },
    {
      id: "metadata",
      label: "Metadaten vollständig (Titel, Klappentext, Keywords)",
      ok: metadataOk,
      required: true,
      hint: metadataOk ? null : metaErrors.map((i) => i.message).join("; "),
    },
    {
      id: "price",
      label: "Preis gesetzt (0,99–200 USD)",
      ok: priceOk,
      required: false,
      hint: priceOk ? (metadata.priceUsd != null ? `${metadata.priceUsd.toFixed(2)} USD` : "KDP fragt den Preis beim Setup ab") : issues.find((i) => /preis/i.test(i.message))?.message ?? null,
    },
    {
      id: "cover",
      label: "Cover vorhanden",
      ok: coverOk,
      required: true,
      hint: coverOk ? null : "Kein Cover hinterlegt — KDP lehnt Bücher ohne Cover im Review ab.",
    },
    {
      id: "isbn",
      label: isbn ? "ISBN gültig" : "ISBN (optional — KDP vergibt eigene)",
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
  /** Button-Label. Default: "Zu KDP hochladen". */
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
  uploadLabel = "Zu KDP hochladen",
  busy = false,
}: KdpPreUploadChecklistProps) {
  const items = useMemo(
    () => buildPreUploadChecklist({ file, metadata, isbn }),
    [file, metadata, isbn],
  );
  const blocking = items.filter((i) => i.required && !i.ok);
  const ready = blocking.length === 0;
  const doneCount = items.filter((i) => i.ok).length;

  return (
    <div className="kdp kdp-preupload" data-testid="kdp-preupload-checklist">
      <div className="kdp-head">
        <h3>Pre-Upload-Check</h3>
        <span className="kdp-summary" data-testid="kdp-preupload-summary">
          {doneCount}/{items.length} erfüllt
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
                {!item.required && <span className="kdp-item-optional"> (optional)</span>}
              </span>
              {item.hint && <span className="kdp-item-hint">{item.hint}</span>}
            </span>
          </li>
        ))}
      </ul>

      {!ready && (
        <div className="kdp-notice kdp-notice-err" data-testid="kdp-preupload-blocking">
          {blocking.length} Pflichtpunkt(e) offen — Upload blockiert.
        </div>
      )}

      {onUpload && (
        <button
          className="kdp-export"
          data-testid="kdp-preupload-upload-btn"
          onClick={onUpload}
          disabled={busy || !ready}
          title={ready ? uploadLabel : "Pflichtpunkte zuerst erfüllen"}
        >
          {busy ? "Upload läuft…" : uploadLabel}
        </button>
      )}
    </div>
  );
}
