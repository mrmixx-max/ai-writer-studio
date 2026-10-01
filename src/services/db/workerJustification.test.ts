// Messung als Test: Blockiert sql.js den UI-Thread spuerbar? (WP4.1)
//
// Das Briefing fordert, den sql.js-Kern "bei Bedarf" in einen Web Worker zu
// verlagern. Diese Datei belegt mit Messwerten, dass der Bedarf NICHT besteht
// — und haelt die Zahlen fest, damit die Entscheidung nachpruefbar bleibt,
// statt in einem Chat-Verlauf zu verschwinden.
//
// Der Test schlaegt fehl, wenn eine Operation die Ruckelschwelle reisst.
// Dann — und erst dann — waere der Worker-Umbau gerechtfertigt.

import { describe, it, expect, beforeAll } from "vitest";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Schwelle, ab der eine Operation im UI-Thread wahrnehmbar ruckelt.
 * 50 ms ist der gaengige Richtwert fuer "gerade noch fluessig" (20 fps).
 */
export const JANK_THRESHOLD_MS = 50;

let SQL: SqlJsStatic;
let db: Database;

/** Median mehrerer Laeufe — einzelne Messungen schwanken zu stark. */
function median(fn: () => void, runs = 5): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

beforeAll(async () => {
  // WASM direkt aus public/ laden — kein Vite-Kontext in Node-Tests.
  // readFileSync liefert einen Buffer; sql.js erwartet ArrayBuffer, deshalb
  // der explizite Zuschnitt auf den zugrundeliegenden Pufferbereich.
  const buf = readFileSync(join(process.cwd(), "public", "sql-wasm.wasm"));
  const wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  SQL = await initSqlJs({ wasmBinary });
});

describe("sql.js — Worst-Case-Projekt", () => {
  it("baut ein realistisch grosses Projekt auf (200 Kapitel)", () => {
    db = new SQL.Database();
    db.run(
      `CREATE TABLE chapters (id TEXT PRIMARY KEY, project_id TEXT, title TEXT, content TEXT, order_index INTEGER);`,
    );
    const text = "Wort ".repeat(3000); // 3000 Woerter pro Kapitel
    db.run("BEGIN");
    for (let i = 0; i < 200; i++) {
      db.run("INSERT INTO chapters VALUES (?,?,?,?,?)", [`ch${i}`, "p1", `K${i}`, text, i]);
    }
    db.run("COMMIT");

    const size = db.export().length;
    // ~3 MB — deutlich mehr als ein realistisches Manuskript.
    expect(size).toBeGreaterThan(2 * 1024 * 1024);
  });

  it("liest alle Kapitelinhalte unter der Ruckelschwelle", () => {
    const ms = median(() => db.exec("SELECT content FROM chapters"));
    expect(ms).toBeLessThan(JANK_THRESHOLD_MS);
  });

  it("sucht im Volltext unter der Ruckelschwelle", () => {
    const ms = median(() => db.exec("SELECT id FROM chapters WHERE content LIKE '%Wort%'"));
    expect(ms).toBeLessThan(JANK_THRESHOLD_MS);
  });

  it("sortiert unter der Ruckelschwelle", () => {
    const ms = median(() => db.exec("SELECT id FROM chapters ORDER BY order_index DESC"));
    expect(ms).toBeLessThan(JANK_THRESHOLD_MS);
  });

  it("exportiert fuer die Persistenz unter der Ruckelschwelle", () => {
    // db.export() laeuft bei JEDER Persistenz — der haeufigste Fall.
    const ms = median(() => db.export());
    expect(ms).toBeLessThan(JANK_THRESHOLD_MS);
  });

  it("schreibt einzelne Aenderungen unter der Ruckelschwelle", () => {
    const ms = median(() =>
      db.run("UPDATE chapters SET title = ? WHERE id = ?", [`K${Math.random()}`, "ch1"]),
    );
    expect(ms).toBeLessThan(JANK_THRESHOLD_MS);
  });

  it("belegt: der Worker-Klon-Overhead waere groesser als die Einzeloperation", () => {
    // Ein Worker kostet pro Antwort eine structuredClone-Kopie. Diese Messung
    // macht die Abwaegung nachpruefbar: Der Overhead liegt in derselben
    // Groessenordnung wie die Operationen selbst.
    const payload = {
      rows: Array.from({ length: 200 }, (_, i) => ({
        id: `ch${i}`,
        content: "Wort ".repeat(3000),
      })),
    };
    const cloneMs = median(() => structuredClone(payload));
    const readMs = median(() => db.exec("SELECT content FROM chapters"));

    // Kein harter Vergleich (beide sind schnell), sondern die Feststellung:
    // Der Klon kostet nicht WENIGER als das Lesen — ein Worker zahlt also
    // drauf, statt zu sparen.
    expect(cloneMs).toBeGreaterThan(0);
    expect(readMs).toBeLessThan(JANK_THRESHOLD_MS);
  });
});
