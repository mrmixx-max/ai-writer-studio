// Beta-Reader-Service (WP 14.1, Feedback-Hub).
//
// Aufgaben:
//  1. generateReaderHtml()        — eigenständiges HTML-Dokument für Testleser
//                                   (Inline-Styles + Vanilla-JS-Sammler, keine
//                                   externen Ressourcen, kein Netzwerk).
//  2. parseFeedbackFile()         — parst eine zurückgespielte .aiwsfeedback-Datei.
//  3. applyFeedbackToChapter()    — wendet Leserfeedback deterministisch auf ein
//                                   Kapitel an (Kommentar-/Emote-Marker inline,
//                                   Tempo-Bewertung als Fußzeile).
//
// Rein lokal und deterministisch: kein LLM, keine DB, keine Zufallswerte,
// keine Seiteneffekte. Alle Funktionen sind defensiv — fehlende oder
// ungültige Daten führen zu leeren Fallbacks statt zu Exceptions.

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

/** Kapitel, wie es der Beta-Reader-Service erwartet (Text-Content). */
export interface ChapterInput {
  id: string;
  title: string;
  content: string;
}

/** Optionen für das generierte Testleser-Dokument. */
export interface ReaderOptions {
  darkMode?: boolean;
  showEmotes?: boolean;
}

/** Ein Leserkommentar an einer Textposition (Zeichen-Offset). */
export interface FeedbackComment {
  id: string;
  text: string;
  position: number;
  author: string;
}

/** Emote-Typen des Feedback-Hubs. */
export type FeedbackEmoteType = "thrill" | "slow" | "plot-hole" | "favorite";

/** Eine emotionale Reaktion an einer Textposition. */
export interface FeedbackEmote {
  id: string;
  type: FeedbackEmoteType;
  position: number;
}

/** Tempo-Bewertung eines Kapitels (1 = schleppend … 5 = mitreißend). */
export interface FeedbackRating {
  chapterId: string;
  pacing: number;
}

/** Gesamtes, aus einer .aiwsfeedback-Datei importiertes Feedback. */
export interface FeedbackImport {
  comments: FeedbackComment[];
  emotes: FeedbackEmote[];
  ratings: FeedbackRating[];
}

/** On-Disk-Format der .aiwsfeedback-Datei. */
export interface FeedbackFile {
  format: "ai-writer-studio/feedback";
  version: 1;
  chapterId: string;
  exportedAt: number;
  comments: FeedbackComment[];
  emotes: FeedbackEmote[];
  ratings: FeedbackRating[];
}

// ---------------------------------------------------------------------------
// Konstanten & kleine Helfer
// ---------------------------------------------------------------------------

const EMOTE_ORDER: FeedbackEmoteType[] = ["thrill", "slow", "plot-hole", "favorite"];

const EMOTE_LABELS: Record<FeedbackEmoteType, string> = {
  thrill: "⚡ Spannung",
  slow: "🐌 Langsam",
  "plot-hole": "🕳️ Logikloch",
  favorite: "❤️ Favorit",
};

const PACING_MIN = 1;
const PACING_MAX = 5;

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function isEmoteType(v: unknown): v is FeedbackEmoteType {
  return typeof v === "string" && (EMOTE_ORDER as string[]).includes(v);
}

/** Rundet, begrenzt auf [min, max]; nicht-numerische Eingaben → fallback. */
function asInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** HTML-Escape für Text- und Attributkontexte. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Zerlegt Content in Absätze (getrennt durch Leerzeilen) samt Zeichen-Offset. */
function splitBlocks(content: string): { text: string; offset: number }[] {
  const blocks: { text: string; offset: number }[] = [];
  const n = content.length;
  let i = 0;
  while (i < n) {
    while (i < n && content[i] === "\n") i++;
    if (i >= n) break;
    const start = i;
    const nl = content.indexOf("\n\n", i);
    const end = nl === -1 ? n : nl;
    const text = content.slice(start, end).replace(/\s+$/, "");
    if (text.length > 0) blocks.push({ text, offset: start });
    i = nl === -1 ? n : nl + 2;
  }
  return blocks;
}

/** Fügt ein Marker-Stück an Position ein und sorgt für saubere Trennung. */
function insertAt(content: string, pos: number, marker: string): string {
  const p = Math.max(0, Math.min(pos, content.length));
  const before = content.slice(0, p);
  const after = content.slice(p);
  const left = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const right = after.length > 0 && !/^\s/.test(after) ? " " : "";
  return before + left + marker + right + after;
}

// ---------------------------------------------------------------------------
// 1. Testleser-Dokument
// ---------------------------------------------------------------------------

/**
 * Erzeugt ein eigenständiges HTML-Dokument für Testleser. Der Leser kann
 * Absätze anklicken, Kommentare/Emotes an der gewählten Position erfassen,
 * ein Tempo-Rating abgeben und das Feedback als .aiwsfeedback-Datei
 * exportieren (Struktur = FeedbackFile, von parseFeedbackFile lesbar).
 */
export function generateReaderHtml(chapter: ChapterInput, options?: ReaderOptions): string {
  const id = asString(chapter?.id);
  const title = asString(chapter?.title).trim() || "Unbenanntes Kapitel";
  const content = asString(chapter?.content);
  const dark = options?.darkMode ?? false;
  const showEmotes = options?.showEmotes ?? false;

  // ID sicher in das Skript einbetten (JSON + `<` maskiert → kein </script>).
  const safeIdForScript = JSON.stringify(id).replace(/</g, "\\u003c");

  const blocks = splitBlocks(content);
  const article =
    blocks.length > 0
      ? blocks
          .map((b) => `<p data-pos="${b.offset}">${escapeHtml(b.text).replace(/\n/g, "<br>")}</p>`)
          .join("\n        ")
      : `<p class="empty">(Noch kein Inhalt)</p>`;

  const emoteButtons = showEmotes
    ? EMOTE_ORDER.map(
        (t) =>
          `<button type="button" class="emote" data-emote="${t}" data-label="${EMOTE_LABELS[t]}">${EMOTE_LABELS[t]}</button>`,
      ).join("\n          ")
    : "";

  const pacingOptions = [1, 2, 3, 4, 5]
    .map((v) => `<option value="${v}"${v === 3 ? " selected" : ""}>${v}</option>`)
    .join("");

  const emotesBlock = showEmotes
    ? `\n      <label>Emotion</label>\n      <div id="fb-emotes">\n          ${emoteButtons}\n      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} — Testleser</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: Georgia, "Iowan Old Style", "Times New Roman", serif; line-height: 1.7; }
      body.light { background: #fbfaf7; color: #1d1d1f; }
      body.dark { background: #12161c; color: #e6e6e6; }
      main { max-width: 720px; margin: 0 auto; padding: 32px 20px 96px; }
      h1 { font-size: 1.9rem; margin: 0 0 4px; }
      .meta { color: #8b98a9; font-size: 0.85rem; margin-bottom: 24px; }
      article p { cursor: pointer; padding: 4px 6px; border-radius: 4px; margin: 0 0 12px; }
      article p:hover { background: rgba(255, 176, 0, 0.12); }
      article p.active { background: rgba(255, 176, 0, 0.22); outline: 1px solid #ffb000; }
      .empty { color: #8b98a9; font-style: italic; }
      #fb-panel { margin-top: 40px; border-top: 1px solid #2a3340; padding-top: 20px; font-family: ui-sans-serif, system-ui, sans-serif; }
      #fb-panel h2 { font-size: 1.1rem; }
      .hint { color: #8b98a9; font-size: 0.85rem; }
      label { display: block; margin: 12px 0 4px; font-size: 0.85rem; color: #8b98a9; }
      input, textarea, select { width: 100%; box-sizing: border-box; padding: 8px; border-radius: 4px; border: 1px solid #2a3340; background: #ffffff; color: inherit; font: inherit; }
      body.dark input, body.dark textarea, body.dark select { background: #11161f; }
      button { margin-top: 8px; padding: 6px 14px; border: none; border-radius: 4px; background: #ffb000; color: #0a0e14; font-weight: bold; cursor: pointer; }
      button.emote { margin: 4px 6px 0 0; background: transparent; color: inherit; border: 1px solid #2a3340; font-weight: normal; }
      #fb-list { list-style: none; padding: 0; margin-top: 12px; font-size: 0.9rem; }
      #fb-list li { border-bottom: 1px solid #2a3340; padding: 6px 0; }
      .muted { color: #8b98a9; }
    </style>
  </head>
  <body class="${dark ? "dark" : "light"}">
    <main>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Testleser-Ansicht · Kapitel-ID: ${escapeHtml(id || "—")}</div>
      <article id="reader-text">
        ${article}
      </article>

      <section id="fb-panel">
        <h2>Dein Feedback</h2>
        <p class="hint">Klicke auf einen Absatz, um die Position für deinen Kommentar zu wählen.</p>
        <label for="reader-name">Name</label>
        <input id="reader-name" type="text" placeholder="Dein Name" autocomplete="off" />
        <label for="fb-comment">Kommentar</label>
        <textarea id="fb-comment" rows="3" placeholder="Was fällt dir auf?"></textarea>
        <button type="button" id="fb-add">Kommentar hinzufügen</button>${emotesBlock}
        <label for="fb-pacing">Tempo (1 = schleppend, 5 = mitreißend)</label>
        <select id="fb-pacing">${pacingOptions}</select>
        <ul id="fb-list"></ul>
        <button type="button" id="fb-export">⬇ .aiwsfeedback exportieren</button>
      </section>
    </main>

    <script>
      (function () {
        var CHAPTER_ID = ${safeIdForScript};
        var SHOW_EMOTES = ${showEmotes ? "true" : "false"};
        var activePos = 0;
        var comments = [];
        var emotes = [];
        var seq = 0;
        var paras = document.querySelectorAll("p[data-pos]");

        function setActive(p) {
          for (var i = 0; i < paras.length; i++) paras[i].classList.remove("active");
          p.classList.add("active");
          var v = parseInt(p.getAttribute("data-pos") || "0", 10);
          activePos = isFinite(v) ? v : 0;
        }
        for (var i = 0; i < paras.length; i++) {
          (function (p) {
            p.addEventListener("click", function () { setActive(p); });
          })(paras[i]);
        }

        function esc(s) {
          return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }
        function author() {
          var el = document.getElementById("reader-name");
          return (el && el.value.trim()) || "Anonym";
        }
        function render() {
          var html = "";
          for (var i = 0; i < comments.length; i++) {
            html += "<li>📝 @" + comments[i].position + " <b>" + esc(comments[i].author) + "</b>: " + esc(comments[i].text) + "</li>";
          }
          for (var j = 0; j < emotes.length; j++) {
            html += "<li>" + esc(emotes[j].label) + " @" + emotes[j].position + "</li>";
          }
          document.getElementById("fb-list").innerHTML = html || "<li class='muted'>Noch kein Feedback erfasst.</li>";
        }

        document.getElementById("fb-add").addEventListener("click", function () {
          var ta = document.getElementById("fb-comment");
          var text = (ta.value || "").trim();
          if (!text) return;
          comments.push({ id: "c" + (++seq), text: text, position: activePos, author: author() });
          ta.value = "";
          render();
        });

        if (SHOW_EMOTES) {
          var btns = document.querySelectorAll("[data-emote]");
          for (var k = 0; k < btns.length; k++) {
            (function (b) {
              b.addEventListener("click", function () {
                emotes.push({
                  id: "e" + (++seq),
                  type: b.getAttribute("data-emote"),
                  label: b.getAttribute("data-label"),
                  position: activePos
                });
                render();
              });
            })(btns[k]);
          }
        }

        document.getElementById("fb-export").addEventListener("click", function () {
          var pacing = parseInt(document.getElementById("fb-pacing").value, 10);
          var ratings = isFinite(pacing) ? [{ chapterId: CHAPTER_ID, pacing: pacing }] : [];
          var data = {
            format: "ai-writer-studio/feedback",
            version: 1,
            chapterId: CHAPTER_ID,
            exportedAt: Date.now(),
            comments: comments,
            emotes: emotes,
            ratings: ratings
          };
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "feedback-" + (CHAPTER_ID || "kapitel") + ".aiwsfeedback";
          a.click();
          URL.revokeObjectURL(a.href);
        });

        render();
      })();
    </script>
  </body>
</html>
`;
}

// ---------------------------------------------------------------------------
// 2. .aiwsfeedback-Datei parsen
// ---------------------------------------------------------------------------

function normalizeComments(raw: unknown): FeedbackComment[] {
  if (!Array.isArray(raw)) return [];
  const out: FeedbackComment[] = [];
  raw.forEach((item, i) => {
    const r = asRecord(item);
    if (!r) return;
    const text = asString(r.text).trim();
    if (!text) return; // Kommentar ohne Text ist nutzlos
    out.push({
      id: asString(r.id) || `c${i + 1}`,
      text,
      position: asInt(r.position, 0, 0, Number.MAX_SAFE_INTEGER),
      author: asString(r.author).trim() || "Anonym",
    });
  });
  return out;
}

function normalizeEmotes(raw: unknown): FeedbackEmote[] {
  if (!Array.isArray(raw)) return [];
  const out: FeedbackEmote[] = [];
  raw.forEach((item, i) => {
    const r = asRecord(item);
    if (!r) return;
    if (!isEmoteType(r.type)) return; // unbekannter Emote-Typ → verwerfen
    out.push({
      id: asString(r.id) || `e${i + 1}`,
      type: r.type,
      position: asInt(r.position, 0, 0, Number.MAX_SAFE_INTEGER),
    });
  });
  return out;
}

function normalizeRatings(raw: unknown): FeedbackRating[] {
  if (!Array.isArray(raw)) return [];
  const out: FeedbackRating[] = [];
  raw.forEach((item) => {
    const r = asRecord(item);
    if (!r) return;
    const n = typeof r.pacing === "number" ? r.pacing : Number(r.pacing);
    if (!Number.isFinite(n)) return; // ohne numerisches Pacing nicht bewertbar
    out.push({
      chapterId: asString(r.chapterId),
      pacing: Math.min(PACING_MAX, Math.max(PACING_MIN, Math.round(n))),
    });
  });
  return out;
}

/**
 * Parst eine .aiwsfeedback-Datei. Toleriert sowohl das vollständige
 * FeedbackFile-Format als auch ein nacktes FeedbackImport-Objekt sowie eine
 * Verschachtelung unter `feedback` oder `data`. Ungültiges JSON, fehlende
 * Felder und kaputte Einzel-Einträge führen zu leeren/gefilterten Fallbacks —
 * die Funktion wirft nie.
 */
export function parseFeedbackFile(json: string): FeedbackImport {
  const empty: FeedbackImport = { comments: [], emotes: [], ratings: [] };
  if (typeof json !== "string" || json.trim() === "") return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return empty;
  }

  const root = asRecord(parsed);
  if (!root) return empty;

  // Format direkt oder in { feedback } / { data } verschachtelt.
  const inner = asRecord(root.feedback) ?? asRecord(root.data) ?? root;

  return {
    comments: normalizeComments(inner.comments),
    emotes: normalizeEmotes(inner.emotes),
    ratings: normalizeRatings(inner.ratings),
  };
}

// ---------------------------------------------------------------------------
// 3. Feedback auf ein Kapitel anwenden
// ---------------------------------------------------------------------------

/**
 * Wendet Leserfeedback deterministisch auf ein Kapitel an und gibt eine neue
 * ChapterInput zurück (Eingabe bleibt unverändert):
 *  - Kommentare → Inline-Marker `[[Kommentar von <Autor>: <Text>]]` an Position.
 *  - Emotes     → Inline-Marker `[[<Label>]]` an Position.
 *  - Ratings    → Tempo-Fußzeile `[Bewertung — Tempo: <Ø>/5]` am Kapitelende.
 * Positionen werden auf [0, content.length] begrenzt; ungültige Einträge
 * werden übersprungen. Mehrere Marker an gleicher Position behalten ihre
 * Reihenfolge (stabiler Sort).
 */
export function applyFeedbackToChapter(chapter: ChapterInput, feedback: FeedbackImport): ChapterInput {
  const src: ChapterInput = {
    id: asString(chapter?.id),
    title: asString(chapter?.title),
    content: asString(chapter?.content),
  };

  const comments = Array.isArray(feedback?.comments) ? feedback.comments : [];
  const emotes = Array.isArray(feedback?.emotes) ? feedback.emotes : [];
  const ratings = Array.isArray(feedback?.ratings) ? feedback.ratings : [];

  if (comments.length === 0 && emotes.length === 0 && ratings.length === 0) {
    return { ...src };
  }

  const max = src.content.length;
  const insertions: { pos: number; marker: string }[] = [];

  for (const c of comments) {
    const text = asString(c?.text).trim();
    if (!text) continue;
    const author = asString(c?.author).trim() || "Anonym";
    insertions.push({
      pos: asInt(c?.position, 0, 0, max),
      marker: `[[Kommentar von ${author}: ${text}]]`,
    });
  }
  for (const e of emotes) {
    if (!isEmoteType(e?.type)) continue;
    insertions.push({
      pos: asInt(e?.position, 0, 0, max),
      marker: `[[${EMOTE_LABELS[e.type]}]]`,
    });
  }

  // Stabil aufsteigend sortieren (ES2019+) und von hinten einfügen, damit
  // sich die Offsets nicht verschieben.
  insertions.sort((a, b) => a.pos - b.pos);
  let content = src.content;
  for (let i = insertions.length - 1; i >= 0; i--) {
    content = insertAt(content, insertions[i].pos, insertions[i].marker);
  }

  const values = ratings.map((r) => asInt(r?.pacing, 0, PACING_MIN, PACING_MAX)).filter((n) => n >= PACING_MIN);
  if (values.length > 0) {
    const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    const votes = values.length > 1 ? ` (${values.length} Stimmen)` : "";
    const footer = `[Bewertung — Tempo: ${avg}/${PACING_MAX}${votes}]`;
    content = content.length > 0 ? content.replace(/\s+$/, "") + "\n\n" + footer : footer;
  }

  return { id: src.id, title: src.title, content };
}
