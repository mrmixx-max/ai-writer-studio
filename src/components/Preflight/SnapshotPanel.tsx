// Snapshots: Liste, Vergleich, Wiederherstellung.
//
// Die Wiederherstellung ist die einzige Aktion, die Text vernichten kann.
// Deshalb zweistufig: Erst zeigt eine Vorschau, was geschehen würde, dann
// muss der Nutzer ausdrücklich bestätigen.

import { useState, useEffect, useCallback } from "react";
import {
  createSnapshot,
  listSnapshots,
  deleteSnapshot,
  diffSnapshots,
  restoreSnapshot,
  previewRestore,
} from "@/services/snapshot";
import { useProjectStore } from "@/store/projectStore";
import type { Snapshot, SnapshotDiff } from "@/types/snapshot";
import "./preflight.css";

interface Props {
  projectId: string | null;
}

const ORIGIN_LABELS: Record<string, string> = {
  manual: "manuell",
  "before-export": "vor Export",
  bookwriter: "Bookwriter",
};

const KIND_LABELS: Record<string, string> = {
  added: "neu",
  removed: "weg",
  changed: "geändert",
  renamed: "umbenannt",
  moved: "verschoben",
  unchanged: "gleich",
};

type Notice = { text: string; kind: "ok" | "warn" | "err" } | null;

export function SnapshotPanel({ projectId }: Props) {
  const proj = useProjectStore();

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<Snapshot | null>(null);
  const [deleteExtra, setDeleteExtra] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const reload = useCallback(() => {
    if (!projectId) {
      setSnapshots([]);
      return;
    }
    try {
      setSnapshots(listSnapshots(projectId));
    } catch {
      /* DB noch nicht bereit */
    }
  }, [projectId]);

  useEffect(() => {
    reload();
    setSelected([]);
    setDiff(null);
    setConfirmRestore(null);
    setNotice(null);
  }, [projectId, reload]);

  const projectName = proj.projects.find((p) => p.id === projectId)?.name ?? "Projekt";

  async function create() {
    if (!projectId) return;
    const name = window.prompt(
      "Name des Snapshots:",
      `Stand ${new Date().toLocaleDateString("de-DE")}`,
    );
    if (!name?.trim()) return;
    const note = window.prompt("Notiz (optional):") || null;

    setBusy(true);
    try {
      const snap = await createSnapshot(projectId, projectName, name.trim(), note);
      reload();
      setNotice({
        text: `Snapshot „${snap.name}“ angelegt: ${snap.chapterCount} Kapitel, ${snap.wordCount.toLocaleString("de-DE")} Wörter.`,
        kind: "ok",
      });
    } catch (e) {
      setNotice({ text: `Snapshot fehlgeschlagen: ${(e as Error)?.message}`, kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  function toggleSelect(id: string) {
    setDiff(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      // Höchstens zwei zum Vergleichen; der älteste fällt heraus.
      return prev.length >= 2 ? [prev[1], id] : [...prev, id];
    });
  }

  function compare() {
    if (selected.length !== 2) return;
    // Älteren zuerst: Die Liste ist neueste-zuerst sortiert.
    const [a, b] = selected;
    const ai = snapshots.findIndex((s) => s.id === a);
    const bi = snapshots.findIndex((s) => s.id === b);
    const from = ai > bi ? a : b;
    const to = ai > bi ? b : a;
    setDiff(diffSnapshots(from, to));
  }

  async function remove(snap: Snapshot) {
    if (!window.confirm(`Snapshot „${snap.name}“ endgültig löschen?`)) return;
    setBusy(true);
    try {
      await deleteSnapshot(snap.id);
      setSelected((prev) => prev.filter((x) => x !== snap.id));
      setDiff(null);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function doRestore() {
    if (!confirmRestore) return;
    setBusy(true);
    try {
      const r = await restoreSnapshot(confirmRestore.id, projectName, { deleteExtra });
      proj.refresh();
      reload();
      setConfirmRestore(null);
      setDeleteExtra(false);
      setNotice({
        text:
          `Wiederhergestellt: ${r.restored} Kapitel zurückgesetzt` +
          (r.recreated ? `, ${r.recreated} neu angelegt` : "") +
          (r.extra ? `, ${r.extra} zusätzliche ${r.extraHandling === "deleted" ? "gelöscht" : "behalten"}` : "") +
          (r.safetySnapshotId ? ". Ein Sicherungs-Snapshot des vorherigen Stands wurde angelegt." : ""),
        kind: "ok",
      });
    } catch (e) {
      setNotice({ text: `Wiederherstellung fehlgeschlagen: ${(e as Error)?.message}`, kind: "err" });
    } finally {
      setBusy(false);
    }
  }

  if (!projectId) {
    return (
      <div className="pf">
        <div className="pf-scroll">
          <div className="dg-notice">Wähle links ein Projekt.</div>
        </div>
      </div>
    );
  }

  const preview = confirmRestore ? previewRestore(confirmRestore.id) : null;

  return (
    <div className="pf">
      <div className="pf-scroll">
        <div className="dg-actions">
          <button className="dg-btn primary" onClick={() => void create()} disabled={busy}>
            Snapshot erstellen
          </button>
          <button
            className="dg-btn"
            onClick={compare}
            disabled={busy || selected.length !== 2}
            title={selected.length === 2 ? "Die beiden gewählten vergleichen" : "Zwei Snapshots wählen"}
          >
            vergleichen
          </button>
        </div>

        {notice && <div className={`dg-notice ${notice.kind}`}>{notice.text}</div>}

        {/* Schutzabfrage vor der Wiederherstellung */}
        {confirmRestore && preview && (
          <div className="snap-confirm">
            <div className="snap-confirm-title">
              Snapshot „{confirmRestore.name}“ wiederherstellen?
            </div>
            <div className="snap-confirm-text">
              {preview.willRestore} Kapitel werden auf den damaligen Inhalt zurückgesetzt
              {preview.willRecreate > 0 && `, ${preview.willRecreate} neu angelegt`}.
              {preview.extra.length > 0 && (
                <>
                  {" "}
                  Nur im aktuellen Stand vorhanden: {preview.extra.join(", ")}.
                </>
              )}
              {preview.warning && (
                <>
                  <br />
                  <br />
                  {preview.warning}
                </>
              )}
            </div>

            {preview.extra.length > 0 && (
              <label className="pf-gate-opt" style={{ marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={deleteExtra}
                  onChange={(e) => setDeleteExtra(e.target.checked)}
                />
                <span>
                  Die {preview.extra.length} zusätzlichen Kapitel ebenfalls löschen.
                  Ohne dieses Häkchen bleiben sie erhalten.
                </span>
              </label>
            )}

            <div className="snap-acts">
              <button className="dg-btn primary" onClick={() => void doRestore()} disabled={busy}>
                Wiederherstellen
              </button>
              <button
                className="dg-btn"
                onClick={() => {
                  setConfirmRestore(null);
                  setDeleteExtra(false);
                }}
                disabled={busy}
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {snapshots.length === 0 ? (
          <div className="dg-notice">
            Noch keine Snapshots. Ein Snapshot hält den gesamten Manuskriptstand
            fest — alle Kapitel mit vollem Inhalt. Sinnvoll vor größeren
            Umbauten und vor dem Export.
          </div>
        ) : (
          <div className="snap-list">
            {snapshots.map((s) => (
              <div
                className={`snap${selected.includes(s.id) ? " selected" : ""}`}
                key={s.id}
                onClick={() => toggleSelect(s.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") toggleSelect(s.id);
                }}
              >
                <div className="snap-head">
                  <span className="snap-name">{s.name}</span>
                  <span className="snap-when">
                    {new Date(s.createdAt).toLocaleString("de-DE")}
                  </span>
                </div>

                <div className="snap-meta">
                  <span className={`snap-origin ${s.meta.origin}`}>
                    {ORIGIN_LABELS[s.meta.origin] ?? s.meta.origin}
                  </span>
                  <span>{s.chapterCount} Kapitel</span>
                  <span>{s.wordCount.toLocaleString("de-DE")} Wörter</span>
                </div>

                {s.note && <div className="snap-note">{s.note}</div>}

                <div className="snap-acts">
                  <button
                    className="dg-btn tiny"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmRestore(s);
                    }}
                    disabled={busy}
                  >
                    wiederherstellen
                  </button>
                  <button
                    className="dg-btn tiny"
                    onClick={(e) => {
                      e.stopPropagation();
                      void remove(s);
                    }}
                    disabled={busy}
                  >
                    löschen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Vergleich */}
        {diff && (
          <div className="snap-diff">
            <div className="snap-diff-sum">{diff.structureSummary}</div>
            <div className="snap-entries">
              {diff.entries.map((e) => (
                <div className="snap-entry" key={e.chapterId}>
                  <span className={`snap-kind ${e.kind}`}>{KIND_LABELS[e.kind]}</span>
                  <span className="snap-entry-title">
                    {e.titleAfter ?? e.titleBefore}
                    {e.kind === "renamed" && e.titleBefore && (
                      <span style={{ color: "var(--fg-faint)" }}> (war: {e.titleBefore})</span>
                    )}
                  </span>
                  <span
                    className={`snap-delta${e.wordDelta > 0 ? " plus" : e.wordDelta < 0 ? " minus" : ""}`}
                  >
                    {e.wordDelta === 0
                      ? "±0"
                      : e.wordDelta > 0
                        ? `+${e.wordDelta}`
                        : String(e.wordDelta)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
