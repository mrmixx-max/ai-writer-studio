// Bookwriter Dokumente: Tests für Chunking, BM25-Suche, Formatierung.
import { describe, it, expect, beforeEach, vi } from "vitest";
// setup.ts mockt sql.js global durch eine Fake-DB — diese Tests brauchen
// das echte In-Memory-SQLite, daher nehmen wir das Original zurück.
vi.mock("sql.js", async (importOriginal) => await importOriginal());
import { initDb } from "@/services/db";
import { createProject } from "@/services/project";
import {
  addDocument,
  listDocuments,
  deleteDocument,
  searchDocuments,
  formatRagContext,
} from "@/services/bookwriter/documents";

describe("bookwriter documents", () => {
  let projectId: string;

  beforeEach(async () => {
    await initDb();
    const project = await createProject("Test-Projekt");
    projectId = project.id;
  });

  it("speichert ein Dokument und chunkt es", async () => {
    const result = await addDocument({
      projectId,
      title: "Test-Dokument",
      fileType: "txt",
      fileName: "test.txt",
      content: "Dies ist ein Test. ".repeat(100),
    });

    expect(result.error).toBeNull();
    expect(result.doc).not.toBeNull();
    expect(result.chunks).toBeGreaterThan(0);
  });

  it("listet Dokumente eines Projekts", async () => {
    await addDocument({
      projectId,
      title: "Dok 1",
      fileType: "txt",
      fileName: "d1.txt",
      content: "Inhalt eins. ".repeat(50),
    });
    await addDocument({
      projectId,
      title: "Dok 2",
      fileType: "txt",
      fileName: "d2.txt",
      content: "Inhalt zwei. ".repeat(50),
    });

    const docs = listDocuments(projectId);
    expect(docs).toHaveLength(2);
  });

  it("findet relevante Passagen über BM25", async () => {
    await addDocument({
      projectId,
      title: "Geschichte der Stadt Berlin",
      fileType: "txt",
      fileName: "berlin.txt",
      content:
        "Berlin ist die Hauptstadt von Deutschland. " +
        "Die Stadt hat eine lange Geschichte. " +
        "Berlin wurde im 13. Jahrhundert gegründet. " +
        "Heute leben über 3 Millionen Menschen in Berlin. " +
        "Die Stadt ist bekannt für ihre Kultur und Geschichte. " +
        "Das Brandenburger Tor ist ein Wahrzeichen. " +
        "Die Mauer fiel 1989. " +
        "Berlin ist heute eine moderne Metropole. ".repeat(5),
    });

    const hits = searchDocuments(projectId, "Berlin Geschichte", 3);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].docTitle).toBe("Geschichte der Stadt Berlin");
  });

  it("formatiert RAG-Kontext korrekt", () => {
    const hits = [
      {
        docId: "d1",
        docTitle: "Dok 1",
        text: "Relevanter Text.",
        startChar: 0,
        score: 1.5,
      },
      {
        docId: "d2",
        docTitle: "Dok 2",
        text: "Weiterer Text.",
        startChar: 100,
        score: 1.2,
      },
    ];

    const ctx = formatRagContext(hits);
    expect(ctx).toContain("[Quelle 1: Dok 1]");
    expect(ctx).toContain("[Quelle 2: Dok 2]");
    expect(ctx).toContain("Relevanter Text.");
  });

  it("leerer Kontext bei keinen Treffern", () => {
    const ctx = formatRagContext([]);
    expect(ctx).toBe("");
  });

  it("löscht Dokumente", async () => {
    const result = await addDocument({
      projectId,
      title: "Temp",
      fileType: "txt",
      fileName: "temp.txt",
      content: "Temporärer Inhalt. ".repeat(20),
    });

    expect(result.doc).not.toBeNull();
    const id = result.doc!.id;

    let docs = listDocuments(projectId);
    expect(docs).toHaveLength(1);

    await deleteDocument(id);
    docs = listDocuments(projectId);
    expect(docs).toHaveLength(0);
  });
});
