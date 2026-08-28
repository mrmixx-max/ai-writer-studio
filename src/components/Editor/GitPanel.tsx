// Git-Panel: Status, Commit, Sync, Branches, Konflikte, Diff-Ansicht.
import { useMemo, useState } from "react";
import { useGit } from "@/services/git/useGit";
import { parseUnifiedDiff, type DiffLine } from "@/services/git/diff";

interface GitPanelProps {
  /** Projektverzeichnis (Repo-Root). */
  dir: string | null;
}

export function GitPanel({ dir }: GitPanelProps) {
  const git = useGit(dir);
  const [message, setMessage] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [diffFor, setDiffFor] = useState<string | null>(null);
  const [diffText, setDiffText] = useState<DiffLine[] | null>(null);

  const changed = useMemo(() => git.status.filter((e) => !e.conflicted), [git.status]);

  async function showDiff(path: string) {
    if (!dir) return;
    const { invoke } = await import("@tauri-apps/api/core");
    const res = await invoke<{ code: number; stdout: string }>("run_git", {
      cwd: dir,
      args: ["diff", "HEAD", "--", path],
    });
    setDiffFor(path);
    setDiffText(parseUnifiedDiff(res.stdout));
  }

  if (!dir || !git.available) return <div className="git-panel">Git nicht verfügbar.</div>;
  if (!git.repoReady) {
    return (
      <div className="git-panel">
        <p>Dieses Projekt ist noch kein Git-Repository.</p>
        <button onClick={() => git.init()} disabled={git.busy}>Git-Repository initialisieren</button>
      </div>
    );
  }

  return (
    <div className="git-panel">
      <header>
        <strong>Git</strong> · {git.branch ?? "detached"}
        {git.busy && <span> …</span>}
      </header>

      {git.lastError && <div className="git-error">{git.lastError}</div>}

      {/* Konflikte */}
      {git.conflicts.length > 0 && (
        <section className="git-conflicts">
          <h4>Merge-Konflikte ({git.conflicts.length})</h4>
          <ul>{git.conflicts.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="git-conflict-actions">
            <button onClick={() => git.resolveAll("ours")} disabled={git.busy}>Meine Fassung</button>
            <button onClick={() => git.resolveAll("theirs")} disabled={git.busy}>Andere Fassung</button>
            <button onClick={() => git.resolveAll("both")} disabled={git.busy}>Beide behalten</button>
            <button onClick={() => git.abort()} disabled={git.busy}>Merge abbrechen</button>
          </div>
        </section>
      )}

      {/* Änderungen + Diff */}
      <section className="git-changes">
        <h4>Änderungen ({changed.length})</h4>
        <ul>
          {changed.map((e) => (
            <li key={e.path} className={e.statusCode.trim() === "" ? "staged" : ""}>
              <button onClick={() => showDiff(e.path)} title="Diff anzeigen">{e.path}</button>{" "}
              <code>{e.statusCode}</code>
            </li>
          ))}
        </ul>
      </section>

      {diffFor && diffText && (
        <section className="git-diff">
          <h4>Diff: {diffFor}</h4>
          <pre className="git-diff-view">
            {diffText.map((l, i) => (
              <div key={i} className={`diff-${l.type}`}>
                {l.type === "add" ? "+ " : l.type === "remove" ? "- " : "  "}
                {l.text}
              </div>
            ))}
          </pre>
          <button onClick={() => setDiffFor(null)}>Diff schließen</button>
        </section>
      )}

      {/* Commit + Sync */}
      <section className="git-commit">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit-Nachricht…"
          onKeyDown={async (e) => {
            if (e.key === "Enter" && message.trim()) {
              if (await git.commit(message.trim())) setMessage("");
            }
          }}
        />
        <button
          onClick={async () => {
            if (message.trim() && (await git.commit(message.trim()))) setMessage("");
          }}
          disabled={git.busy || changed.length === 0}
        >
          Commit
        </button>
        <button onClick={() => git.doPull()} disabled={git.busy}>Pull</button>
        <button onClick={() => git.doPush()} disabled={git.busy}>Push</button>
      </section>

      {/* Branches / Entwurf-Endversion-Workflow */}
      <section className="git-branches">
        <h4>Branches</h4>
        <ul>
          {git.branches.map((b) => (
            <li key={b.name}>
              <button onClick={() => git.checkout(b.name)} disabled={git.busy || b.current}>
                {b.current ? "● " : ""}{b.name}
                {b.ahead || b.behind ? ` (↑${b.ahead} ↓${b.behind})` : ""}
              </button>
            </li>
          ))}
        </ul>
        <input
          value={newBranchName}
          onChange={(e) => setNewBranchName(e.target.value)}
          placeholder="Neuer Branch…"
        />
        <button onClick={() => { if (newBranchName.trim()) { git.newBranch(newBranchName.trim()); setNewBranchName(""); } }}>
          Anlegen
        </button>
        <div className="git-workflow">
          <button onClick={() => git.openDraft()} disabled={git.busy} title="Arbeitsbranch für Rohfassungen">Entwurf</button>
          <button onClick={() => git.promoteFinal()} disabled={git.busy} title="In Endversion mergen">Als Endversion sichern</button>
        </div>
      </section>

      {/* Log */}
      <section className="git-log">
        <h4>Historie</h4>
        <ul>
          {git.log.slice(0, 10).map((c) => (
            <li key={c.hash}>
              <code>{c.shortHash}</code> {c.subject} <em>({c.author})</em>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
