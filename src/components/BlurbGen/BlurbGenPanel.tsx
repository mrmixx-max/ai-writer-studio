// Blurb-Generator: Panel für verkaufsoptimierte Klappentexte.
import { useState, useCallback } from "react";
import {
  generateBlurb,
  generateBlurbVariants,
  sharpenBlurb,
  makeBlurbMainstream,
  makeBlurbPremium,
  makeBlurbEmotional,
  makeBlurbMoreGenre,
  makeBlurbShorter,
  type BlurbGenInput,
  type BlurbType,
  type BlurbFormat,
  type BlurbTone,
} from "@/services/marketing/blurbgen";

export function BlurbGenPanel() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [type, setType] = useState<BlurbType>("fiction");
  const [genre, setGenre] = useState("");
  const [audience, setAudience] = useState("");
  const [format, setFormat] = useState<BlurbFormat>("amazon-description");
  const [tone, setTone] = useState<BlurbTone>("commercial");
  const [protagonist, setProtagonist] = useState("");
  const [situation, setSituation] = useState("");
  const [conflict, setConflict] = useState("");
  const [stakes, setStakes] = useState("");
  const [setting, setSetting] = useState("");
  const [usp, setUsp] = useState("");
  const [includeCta, setIncludeCta] = useState(false);
  const [maxWords, setMaxWords] = useState(150);
  const [result, setResult] = useState<ReturnType<typeof generateBlurb> | null>(null);
  const [variants, setVariants] = useState<ReturnType<typeof generateBlurbVariants> | null>(null);

  const input: BlurbGenInput = {
    title,
    subtitle: subtitle || undefined,
    authorName: authorName || undefined,
    type,
    genre,
    audience,
    format,
    tone,
    protagonist: protagonist || undefined,
    situation: situation || undefined,
    conflict: conflict || undefined,
    stakes: stakes || undefined,
    setting: setting || undefined,
    uniqueSellingPoint: usp || undefined,
    includeCta,
    maxWords,
  };

  const handleGenerate = useCallback(() => {
    setResult(generateBlurb(input));
    setVariants(null);
  }, [input]);

  const handleVariants = useCallback(() => {
    setVariants(generateBlurbVariants(input));
  }, [input]);

  return (
    <div className="blurbgen">
      <h2 className="blurbgen-title">Blurb-Generator</h2>

      <div className="blurbgen-grid">
        <div className="blurbgen-field">
          <label>Titel *</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. NEON PROTOCOL" />
        </div>

        <div className="blurbgen-field">
          <label>Untertitel</label>
          <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="z.B. Die letzte Entscheidung" />
        </div>

        <div className="blurbgen-field">
          <label>Autor</label>
          <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="z.B. Max Mustermann" />
        </div>

        <div className="blurbgen-field">
          <label>Typ *</label>
          <select value={type} onChange={(e) => setType(e.target.value as BlurbType)}>
            <option value="fiction">Fiction</option>
            <option value="nonfiction">Nonfiction</option>
          </select>
        </div>

        <div className="blurbgen-field">
          <label>Genre *</label>
          <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="z.B. thriller, fantasy, science fiction" />
        </div>

        <div className="blurbgen-field">
          <label>Zielgruppe *</label>
          <input type="text" value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="z.B. Leser von Techno-Thrillern" />
        </div>

        <div className="blurbgen-field">
          <label>Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as BlurbFormat)}>
            <option value="amazon-description">Amazon KDP</option>
            <option value="back-cover">Rückseite</option>
            <option value="short-hook">Kurzer Hook</option>
            <option value="ad-copy">Werbetext</option>
            <option value="series-page">Serien-Seite</option>
          </select>
        </div>

        <div className="blurbgen-field">
          <label>Ton</label>
          <select value={tone} onChange={(e) => setTone(e.target.value as BlurbTone)}>
            <option value="commercial">Kommerziell</option>
            <option value="premium">Premium</option>
            <option value="emotional">Emotional</option>
            <option value="dark">Dunkel</option>
            <option value="fast-paced">Schnell</option>
            <option value="elegant">Elegant</option>
            <option value="authoritative">Autoritär</option>
          </select>
        </div>

        <div className="blurbgen-field">
          <label>Hauptfigur / Problem</label>
          <input type="text" value={protagonist} onChange={(e) => setProtagonist(e.target.value)} placeholder="z.B. eine desillusionierte Ermittlerin" />
        </div>

        <div className="blurbgen-field">
          <label>Ausgangssituation</label>
          <input type="text" value={situation} onChange={(e) => setSituation(e.target.value)} placeholder="z.B. Nach einem ruhigen Leben..." />
        </div>

        <div className="blurbgen-field">
          <label>Konflikt / Auslöser</label>
          <input type="text" value={conflict} onChange={(e) => setConflict(e.target.value)} placeholder="z.B. eine Mordserie mit politischer Sprengkraft" />
        </div>

        <div className="blurbgen-field">
          <label>Stakes / Wunsch</label>
          <input type="text" value={stakes} onChange={(e) => setStakes(e.target.value)} placeholder="z.B. geht es um Leben und Tod" />
        </div>

        <div className="blurbgen-field">
          <label>Setting</label>
          <input type="text" value={setting} onChange={(e) => setSetting(e.target.value)} placeholder="z.B. Berlin, 2049" />
        </div>

        <div className="blurbgen-field">
          <label>USP</label>
          <input type="text" value={usp} onChange={(e) => setUsp(e.target.value)} placeholder="z.B. Erster Roman mit..." />
        </div>

        <div className="blurbgen-field">
          <label>Max. Wortzahl</label>
          <input type="number" value={maxWords} onChange={(e) => setMaxWords(Number(e.target.value))} min={50} max={500} />
        </div>

        <div className="blurbgen-field checkbox">
          <label>
            <input type="checkbox" checked={includeCta} onChange={(e) => setIncludeCta(e.target.checked)} />
            Call-to-Action
          </label>
        </div>
      </div>

      <div className="blurbgen-actions">
        <button className="blurbgen-button" onClick={handleGenerate} disabled={!title.trim() || !genre.trim() || !audience.trim()}>
          Blurb generieren
        </button>
        <button className="blurbgen-button secondary" onClick={handleVariants} disabled={!title.trim() || !genre.trim()}>
          3 Varianten erzeugen
        </button>
      </div>

      {result && (
        <div className="blurbgen-result">
          <h3>Short Hook</h3>
          <p className="blurbgen-hook">{result.shortHook}</p>

          <h4>Taglines</h4>
          <ul className="blurbgen-taglines">
            {result.taglineOptions.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>

          <h4>Standard Blurb</h4>
          <p className="blurbgen-blurb">{result.standardBlurb}</p>

          <h4>Amazon KDP</h4>
          <div className="blurbgen-kdp" dangerouslySetInnerHTML={{ __html: result.amazonDescription }} />

          <h4>Back Cover</h4>
          <p className="blurbgen-blurb">{result.backCoverBlurb}</p>

          <h4>Ad Copies</h4>
          <ul className="blurbgen-ads">
            {result.adCopies.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>

          {result.warnings.length > 0 && (
            <div className="blurbgen-warnings">
              <h4>Warnungen</h4>
              <ul>
                {result.warnings.map((w, i) => (
                  <li key={i}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="blurbgen-actions">
            <button className="blurbgen-button small" onClick={() => setResult({ ...result, standardBlurb: sharpenBlurb(result.standardBlurb) })}>
              Schärfer
            </button>
            <button className="blurbgen-button small" onClick={() => setResult({ ...result, standardBlurb: makeBlurbMainstream(result.standardBlurb) })}>
              Mainstream
            </button>
            <button className="blurbgen-button small" onClick={() => setResult({ ...result, standardBlurb: makeBlurbPremium(result.standardBlurb) })}>
              Premium
            </button>
            <button className="blurbgen-button small" onClick={() => setResult({ ...result, standardBlurb: makeBlurbEmotional(result.standardBlurb) })}>
              Emotional
            </button>
            <button className="blurbgen-button small" onClick={() => setResult({ ...result, standardBlurb: makeBlurbMoreGenre(result.standardBlurb, genre) })}>
              Mehr Genre
            </button>
            <button className="blurbgen-button small" onClick={() => setResult({ ...result, standardBlurb: makeBlurbShorter(result.standardBlurb) })}>
              Kürzer
            </button>
          </div>
        </div>
      )}

      {variants && (
        <div className="blurbgen-variants">
          <h3>Varianten</h3>
          {variants.map((v) => (
            <div key={v.variant} className="blurbgen-variant">
              <h4>{v.label}</h4>
              <p>{v.blurb}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
