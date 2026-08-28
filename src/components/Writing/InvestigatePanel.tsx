// Investigatives Journalismus-Panel
import { useState } from "react";
import {
  generateArticle,
  generateXThread,
  analyzeArticle,
  generateResearchPlan,
  type InvestigateInput,
  type ArticleResult,
  type XThreadResult,
  type InvestigateWarning,
  type ResearchPlan,
} from "@/services/writing/investigate";
import "@/components/KIPanel/ki.css";

const ARTICLE_TYPES = [
  { id: "news-report", label: "News-Report" },
  { id: "feature", label: "Feature" },
  { id: "investigation", label: "Investigation" },
  { id: "fact-check", label: "Fact-Check" },
  { id: "opinion", label: "Meinung" },
] as const;

const ZIELMEDIEN = [
  { id: "blog", label: "Blog" },
  { id: "magazin", label: "Magazin" },
  { id: "newsletter", label: "Newsletter" },
  { id: "x-thread", label: "X-Thread" },
  { id: "x-single-post", label: "X-Single-Post" },
] as const;

const TÖNE = [
  { id: "nüchtern", label: "Nüchtern" },
  { id: "analytisch", label: "Analytisch" },
  { id: "enthüllend", label: "Enthüllend" },
  { id: "kritisch", label: "Kritisch" },
  { id: "erklärend", label: "Erklärend" },
] as const;

export function InvestigatePanel() {
  const [input, setInput] = useState<InvestigateInput>({
    titel: "",
    these: "",
    artikelTyp: "investigation",
    zielmedium: "blog",
    sprache: "Deutsch",
    ton: "nüchtern",
    kernfakten: [],
    quellen: [],
    akteure: [],
    ereignisse: [],
    offeneFragen: [],
    rechtlicheSensibilität: false,
    maxLaenge: 3000,
    threadLaenge: 8,
  });

  const [article, setArticle] = useState<ArticleResult | null>(null);
  const [thread, setThread] = useState<XThreadResult | null>(null);
  const [warnings, setWarnings] = useState<InvestigateWarning[]>([]);
  const [researchPlan, setResearchPlan] = useState<ResearchPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"article" | "thread" | "facts" | "research">("article");

  function updateField<K extends keyof InvestigateInput>(field: K, value: InvestigateInput[K]) {
    setInput((prev) => ({ ...prev, [field]: value }));
  }

  function addFakt() {
    updateField("kernfakten", [...input.kernfakten, ""]);
  }

  function updateFakt(index: number, value: string) {
    const neueFakten = [...input.kernfakten];
    neueFakten[index] = value;
    updateField("kernfakten", neueFakten);
  }

  function removeFakt(index: number) {
    updateField(
      "kernfakten",
      input.kernfakten.filter((_, i) => i !== index)
    );
  }

  function addQuelle() {
    updateField("quellen", [...input.quellen, { type: "Dokument", label: "" }]);
  }

  function updateQuelle(index: number, field: string, value: string) {
    const neueQuellen = [...input.quellen];
    neueQuellen[index] = { ...neueQuellen[index], [field]: value };
    updateField("quellen", neueQuellen);
  }

  function removeQuelle(index: number) {
    updateField(
      "quellen",
      input.quellen.filter((_, i) => i !== index)
    );
  }

  function addAkteur() {
    updateField("akteure", [...input.akteure, { name: "", rolle: "" }]);
  }

  function updateAkteur(index: number, field: string, value: string) {
    const neueAkteure = [...input.akteure];
    neueAkteure[index] = { ...neueAkteure[index], [field]: value };
    updateField("akteure", neueAkteure);
  }

  function removeAkteur(index: number) {
    updateField(
      "akteure",
      input.akteure.filter((_, i) => i !== index)
    );
  }

  function addEreignis() {
    updateField("ereignisse", [...input.ereignisse, { datum: "", beschreibung: "" }]);
  }

  function updateEreignis(index: number, field: string, value: string) {
    const neueEreignisse = [...input.ereignisse];
    neueEreignisse[index] = { ...neueEreignisse[index], [field]: value };
    updateField("ereignisse", neueEreignisse);
  }

  function removeEreignis(index: number) {
    updateField(
      "ereignisse",
      input.ereignisse.filter((_, i) => i !== index)
    );
  }

  function addOffeneFrage() {
    updateField("offeneFragen", [...input.offeneFragen, ""]);
  }

  function updateOffeneFrage(index: number, value: string) {
    const neueFragen = [...input.offeneFragen];
    neueFragen[index] = value;
    updateField("offeneFragen", neueFragen);
  }

  function removeOffeneFrage(index: number) {
    updateField(
      "offeneFragen",
      input.offeneFragen.filter((_, i) => i !== index)
    );
  }

  async function handleGenerate() {
    setBusy(true);
    try {
      const result = generateArticle(input);
      setArticle(result);
      setWarnings(analyzeArticle(result));
      
      if (input.zielmedium === "x-thread" || input.zielmedium === "x-single-post") {
        setThread(generateXThread(result, { posts: input.threadLaenge }));
      }
      
      setResearchPlan(generateResearchPlan(input));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="investigate-panel">
      <div className="investigate-header">
        <h2>🔎 Investigativ-Journalismus</h2>
        <p className="investigate-subtitle">Faktenbasierte Artikel und X-Threads</p>
      </div>

      {/* Eingabefelder */}
      <div className="investigate-inputs">
        <div className="input-group">
          <label>Arbeitstitel / These</label>
          <input
            type="text"
            value={input.titel}
            onChange={(e) => updateField("titel", e.target.value)}
            placeholder="z.B. Datenleck bei Kommunal-IT"
          />
        </div>

        <div className="input-group">
          <label>These</label>
          <textarea
            value={input.these}
            onChange={(e) => updateField("these", e.target.value)}
            placeholder="Die zentrale Behauptung oder Fragestellung..."
            rows={3}
          />
        </div>

        <div className="input-row">
          <div className="input-group">
            <label>Artikeltyp</label>
            <select
              value={input.artikelTyp}
              onChange={(e) => updateField("artikelTyp", e.target.value as any)}
            >
              {ARTICLE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Zielmedium</label>
            <select
              value={input.zielmedium}
              onChange={(e) => updateField("zielmedium", e.target.value as any)}
            >
              {ZIELMEDIEN.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="input-row">
          <div className="input-group">
            <label>Sprache</label>
            <input
              type="text"
              value={input.sprache}
              onChange={(e) => updateField("sprache", e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>Ton</label>
            <select
              value={input.ton}
              onChange={(e) => updateField("ton", e.target.value as any)}
            >
              {TÖNE.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Kernfakten */}
        <div className="input-group">
          <label>
            Kernfakten / Recherche-Notizen
            <button className="btn-add" onClick={addFakt}>
              + Hinzufügen
            </button>
          </label>
          {input.kernfakten.map((fakt, i) => (
            <div key={i} className="list-item">
              <input
                type="text"
                value={fakt}
                onChange={(e) => updateFakt(i, e.target.value)}
                placeholder="Fakt oder Notiz..."
              />
              <button className="btn-remove" onClick={() => removeFakt(i)}>
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Quellen */}
        <div className="input-group">
          <label>
            Quellen
            <button className="btn-add" onClick={addQuelle}>
              + Hinzufügen
            </button>
          </label>
          {input.quellen.map((quelle, i) => (
            <div key={i} className="list-item quelle">
              <select
                value={quelle.type}
                onChange={(e) => updateQuelle(i, "type", e.target.value)}
              >
                <option value="Dokument">Dokument</option>
                <option value="Interview">Interview</option>
                <option value="Datenbank">Datenbank</option>
                <option value="öffentlicher Datensatz">Öffentlicher Datensatz</option>
                <option value="Medienbericht">Medienbericht</option>
              </select>
              <input
                type="text"
                value={quelle.label}
                onChange={(e) => updateQuelle(i, "label", e.target.value)}
                placeholder="Bezeichnung..."
              />
              <button className="btn-remove" onClick={() => removeQuelle(i)}>
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Akteure */}
        <div className="input-group">
          <label>
            Protagonisten / Beteiligte
            <button className="btn-add" onClick={addAkteur}>
              + Hinzufügen
            </button>
          </label>
          {input.akteure.map((akteur, i) => (
            <div key={i} className="list-item akteur">
              <input
                type="text"
                value={akteur.name}
                onChange={(e) => updateAkteur(i, "name", e.target.value)}
                placeholder="Name..."
              />
              <input
                type="text"
                value={akteur.rolle}
                onChange={(e) => updateAkteur(i, "rolle", e.target.value)}
                placeholder="Rolle..."
              />
              <button className="btn-remove" onClick={() => removeAkteur(i)}>
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Ereignisse */}
        <div className="input-group">
          <label>
            Ereignisse / Timeline
            <button className="btn-add" onClick={addEreignis}>
              + Hinzufügen
            </button>
          </label>
          {input.ereignisse.map((ereignis, i) => (
            <div key={i} className="list-item ereignis">
              <input
                type="date"
                value={ereignis.datum}
                onChange={(e) => updateEreignis(i, "datum", e.target.value)}
              />
              <input
                type="text"
                value={ereignis.beschreibung}
                onChange={(e) => updateEreignis(i, "beschreibung", e.target.value)}
                placeholder="Beschreibung..."
              />
              <button className="btn-remove" onClick={() => removeEreignis(i)}>
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Offene Fragen */}
        <div className="input-group">
          <label>
            Offene Fragen / Unbestätigte Punkte
            <button className="btn-add" onClick={addOffeneFrage}>
              + Hinzufügen
            </button>
          </label>
          {input.offeneFragen.map((frage, i) => (
            <div key={i} className="list-item">
              <input
                type="text"
                value={frage}
                onChange={(e) => updateOffeneFrage(i, e.target.value)}
                placeholder="Offene Frage..."
              />
              <button className="btn-remove" onClick={() => removeOffeneFrage(i)}>
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="input-row">
          <div className="input-group">
            <label>
              <input
                type="checkbox"
                checked={input.rechtlicheSensibilität}
                onChange={(e) => updateField("rechtlicheSensibilität", e.target.checked)}
              />
              Rechtliche Sensibilität
            </label>
          </div>

          <div className="input-group">
            <label>Max. Artikellänge</label>
            <input
              type="number"
              value={input.maxLaenge}
              onChange={(e) => updateField("maxLaenge", parseInt(e.target.value) || 3000)}
            />
          </div>

          <div className="input-group">
            <label>Thread-Länge</label>
            <input
              type="number"
              value={input.threadLaenge}
              onChange={(e) => updateField("threadLaenge", parseInt(e.target.value) || 8)}
            />
          </div>
        </div>
      </div>

      <button
        className="btn-generate"
        onClick={handleGenerate}
        disabled={busy || !input.titel}
      >
        {busy ? "Generiere..." : "Artikel generieren"}
      </button>

      {/* Tabs */}
      {article && (
        <div className="investigate-tabs">
          <button
            className={tab === "article" ? "active" : ""}
            onClick={() => setTab("article")}
          >
            Artikel
          </button>
          <button
            className={tab === "thread" ? "active" : ""}
            onClick={() => setTab("thread")}
          >
            X-Thread
          </button>
          <button
            className={tab === "facts" ? "active" : ""}
            onClick={() => setTab("facts")}
          >
            Fakten
          </button>
          <button
            className={tab === "research" ? "active" : ""}
            onClick={() => setTab("research")}
          >
            Recherche
          </button>
        </div>
      )}

      {/* Artikel-Tab */}
      {tab === "article" && article && (
        <div className="investigate-output">
          <div className="article-preview">
            <h3>{article.headline}</h3>
            <p className="teaser">{article.teaser}</p>
            <p className="nut-graf">{article.nutGraf}</p>
            <div className="article-body">
              {article.article.split("\n").map((line, i) => (
                <p key={i} className={line.startsWith("#") ? "heading" : ""}>
                  {line.replace(/^#+\s/, "")}
                </p>
              ))}
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="warnings">
              <h4>⚠️ Warnungen</h4>
              {warnings.map((w, i) => (
                <div key={i} className={`warning ${w.severity}`}>
                  <strong>{w.code}:</strong> {w.message}
                  {w.fix && <span className="fix">→ {w.fix}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Thread-Tab */}
      {tab === "thread" && thread && (
        <div className="investigate-output">
          <div className="thread-preview">
            {thread.posts.map((post) => (
              <div key={post.nummer} className="thread-post">
                <span className="post-nummer">{post.nummer}/x</span>
                <p>{post.text}</p>
                <span className="zeichen">{post.zeichen}/280</span>
              </div>
            ))}
          </div>

          <div className="hook-alternatives">
            <h4>Alternative Hooks</h4>
            {thread.hookAlternatives.map((hook, i) => (
              <div key={i} className="hook-alt">
                {hook}
              </div>
            ))}
          </div>

          <div className="hashtags">
            <h4>Hashtags</h4>
            {thread.hashtags.map((tag, i) => (
              <span key={i} className="hashtag">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fakten-Tab */}
      {tab === "facts" && article && (
        <div className="investigate-output">
          <h4>Faktentabelle</h4>
          <table className="fact-table">
            <thead>
              <tr>
                <th>Behauptung</th>
                <th>Quelle</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {article.factTable.map((fact, i) => (
                <tr key={i} className={`status-${fact.status}`}>
                  <td>{fact.behauptung}</td>
                  <td>{fact.quelle}</td>
                  <td>
                    <span className={`badge ${fact.status}`}>
                      {fact.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4>Timeline</h4>
          <div className="timeline">
            {article.timeline.map((event, i) => (
              <div key={i} className="timeline-event">
                <span className="datum">{event.datum}</span>
                <span className="beschreibung">{event.beschreibung}</span>
                {event.quelle && <span className="quelle">({event.quelle})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recherche-Tab */}
      {tab === "research" && researchPlan && (
        <div className="investigate-output">
          <h4>Recherche-Plan</h4>
          <div className="research-section">
            <h5>Offene Fragen</h5>
            <ul>
              {researchPlan.offeneFragen.map((frage, i) => (
                <li key={i}>{frage}</li>
              ))}
            </ul>
          </div>

          <div className="research-section">
            <h5>Benötigte Dokumente</h5>
            <ul>
              {researchPlan.benoetigteDokumente.map((dok, i) => (
                <li key={i}>{dok}</li>
              ))}
            </ul>
          </div>

          <div className="research-section">
            <h5>Mögliche Gesprächspartner</h5>
            <ul>
              {researchPlan.moeglicheGespraechspartner.map((partner, i) => (
                <li key={i}>{partner}</li>
              ))}
            </ul>
          </div>

          {researchPlan.ifgAnfrage && (
            <div className="research-section">
              <h5>IFG-Anfrage</h5>
              <p>{researchPlan.ifgAnfrage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
