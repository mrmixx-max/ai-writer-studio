// Unit-Tests: DB-Migration legt writing_prompts an + CRUD grundlegend.
import { describe, it, expect, beforeEach } from "vitest";
import initSqlJs from "sql.js";
import { migrate } from "@/services/db";

describe("DB migration", () => {
  let db: any;
  beforeEach(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    migrate(db);
  });

  it("erstellt writing_prompts-Tabelle", () => {
    const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='writing_prompts'");
    expect(res.length).toBe(1);
  });

  it("insert + select funktioniert", () => {
    db.run(
      "INSERT INTO writing_prompts (id, text, genre, prompt_type, is_favorite, created_at, provider, model) VALUES (?,?,?,?,0,?,?,?)",
      ["p1", "Testprompt", "Fantasy", "Story-Starter", Date.now(), "generator", "x"],
    );
    const res = db.exec("SELECT text FROM writing_prompts WHERE id='p1'");
    expect(res[0].values[0][0]).toBe("Testprompt");
  });

  it("idempotent: zweite Migration wirft nicht", () => {
    expect(() => migrate(db)).not.toThrow();
  });
});
