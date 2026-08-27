// Quellenliste mit Status und Indexierung.
//
// Der Nutzer muss jederzeit sehen: Was ist indexiert, was veraltet, was
// fehlgeschlagen. Und: ob die Indexierung vollwertig (mit Einbettungen) oder
// eingeschränkt (nur lexikalisch) gelaufen ist.

import { useState } from "react";
import type { KnowledgeSource } from "@/types/knowledge";
import { SOURCE_TYPE_LABELS } from "@/types/knowledge";
import type { SourceStats } from "@/services/knowledge/sources";

interface Props {
  sources: KnowledgeSource[];
  stats: SourceStats;
  busy: boolean;
  progress: { done: number; total: number; label: string } | null;
  notice: { text: string; kind: "ok" | "warn" | "err" } | null;
  onSync: () => void;
  onIndexAll: (force: boolean) => void;
  onIndexOne: (sourceId: string) => void;
}

/** Zeitangabe in Klartext, ohne Bibliothek. */
function relTime(ts: number | null): string {
  if (!ts) return "nie";
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "gestern" : `vor ${d} Tagen`;
}

const STATUS_LABEL: Record<string, string> = {
  indexed: "indexiert",
  stale: "veraltet",
  failed: "fehlgeschlagen",
  pending: "ausstehend",
};

export function SourcePanel({
  sources,
  stats,
  busy,
  progress,
  notice,
  onSync,
  onIndexAll,
  onIndexOne,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sources : sources.slice(0, 12);

  return (
    <div className="kw-section">
      <div className="kw-h">
        <span>Wissensquellen</span>
        {sources.length > 0 && <span>{sources.length}</span>}
      </div>

      <div className="kw-stats">
        <div className="kw-stat">
          <div className={`kw-stat-num${stats.indexed > 0 ? " ok" : ""}`}>{stats.indexed}</div>
          <div className="kw-stat-lbl">indexiert</div>
        </div>
        <div className="kw-stat">
          <div className={`kw-stat-num${stats.stale > 0 ? " warn" : ""}`}>{stats.stale}</div>
          <div className="kw-stat-lbl">veraltet</div>
        </div>
        <div className="kw-stat">
          <div className={`kw-stat-num${stats.failed > 0 ? " err" : ""}`}>{stats.failed}</div>
          <div className="kw-stat-lbl">Fehler</div>
        </div>
        <div className="kw-stat">
          <div className="kw-stat-num">{stats.chunkCount}</div>
          <div className="kw-stat-lbl">Abschnitte</div>
        </div>
      </div>

      <div className="kw-btnrow">
        <button className="kw-btn" onClick={onSync} disabled={busy}>
          Quellen einlesen
        </button>
        <button className="kw-btn primary" onClick={() => onIndexAll(false)} disabled={busy}>
          Projektwissen aktualisieren
        </button>
        <button
          className="kw-btn"
          onClick={() => onIndexAll(true)}
          disabled={busy}
          title="Alle Quellen neu indexieren, auch die bereits fertigen"
        >
          Vollständig neu
        </button>
      </div>

      {progress && (
        <div className="kw-progress">
          <div className="kw-progress-label">
            <span>{progress.label}</span>
            <span className="kw-progress-count">
              {progress.done} / {progress.total}
            </span>
          </div>
          <div className="kw-progress-track">
            <div
              className="kw-progress-fill"
              style={{
                width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : "0%",
              }}
            />
          </div>
        </div>
      )}

      {notice && <div className={`kw-notice ${notice.kind}`}>{notice.text}</div>}

      {sources.length === 0 ? (
        <div className="kw-notice">
          Noch keine Quellen eingelesen. „Quellen einlesen“ erfasst alle Kapitel,
          Fragmente, Figuren, Orte und Notizen dieses Projekts. Danach baut
          „Projektwissen aktualisieren“ den Suchindex auf.
        </div>
      ) : (
        <>
          <div className="kw-sources">
            {visible.map((s) => (
              <div className="kw-source" key={s.id}>
                <span
                  className={`kw-dot ${s.status}`}
                  title={STATUS_LABEL[s.status] ?? s.status}
                />
                <div className="kw-source-main">
                  <div className="kw-source-title" title={s.title}>
                    {s.title}
                  </div>
                  <div className="kw-source-meta">
                    <span className="kw-type">{SOURCE_TYPE_LABELS[s.sourceType]}</span>
                    <span>{STATUS_LABEL[s.status] ?? s.status}</span>
                    <span>·</span>
                    <span>{relTime(s.indexedAt)}</span>
                  </div>
                </div>
                <div className="kw-source-act">
                  <button
                    className="kw-btn tiny"
                    onClick={() => onIndexOne(s.id)}
                    disabled={busy}
                    title="Nur diese Quelle indexieren"
                  >
                    indexieren
                  </button>
                </div>
              </div>
            ))}
          </div>

          {sources.length > 12 && (
            <button
              className="kw-btn tiny"
              style={{ marginTop: 8 }}
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "weniger anzeigen" : `alle ${sources.length} anzeigen`}
            </button>
          )}
        </>
      )}

      {stats.failed > 0 && (
        <div className="kw-notice err" style={{ marginTop: 10 }}>
          {stats.failed} {stats.failed === 1 ? "Quelle" : "Quellen"} konnten nicht
          indexiert werden. Die Ursache steht in der Protokolldatei. Betroffene
          Quellen sind von der Suche ausgeschlossen — Antworten können dadurch
          unvollständig sein.
        </div>
      )}
    </div>
  );
}
