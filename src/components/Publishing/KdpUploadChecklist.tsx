// KDP-Upload-Checklist: Upload-Reihenfolge wie im KDP-Formular,
// inklusive Preis-Punkt (Titel, Beschreibung, Keywords, Kategorien,
// Cover, Preis).

import { useMemo } from "react";
import { buildKdpChecklist, type KdpChecklistItem } from "@/services/kdp/validation";
import type { KdpMetadata } from "@/types/bookwriter";

const STATUS_ICON: Record<KdpChecklistItem["status"], string> = {
  ok: "✔",
  warn: "⚠",
  err: "✘",
};

export function KdpUploadChecklist({ metadata }: { metadata: KdpMetadata }) {
  const checklist = useMemo(() => buildKdpChecklist(metadata), [metadata]);
  const doneCount = checklist.filter((c) => c.status !== "err").length;

  return (
    <section className="pub-section" data-testid="pub-upload-checklist">
      <div className="pub-summary">
        {doneCount}/{checklist.length} Punkte erfüllt
        <div className="pub-bar">
          <div
            className="pub-bar-fill"
            style={{ width: `${Math.round((doneCount / Math.max(checklist.length, 1)) * 100)}%` }}
          />
        </div>
      </div>
      <ul className="pub-checklist">
        {checklist.map((item) => (
          <li key={item.id} className={`pub-item pub-item-${item.status}`}>
            <span className="pub-item-icon">{STATUS_ICON[item.status]}</span>
            <span className="pub-item-body">
              <span className="pub-item-label">{item.label}</span>
              <span className="pub-item-hint">{item.hint}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
