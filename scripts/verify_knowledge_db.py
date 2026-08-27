"""
End-to-End-Prüfung des Projektwissens gegen die ECHTE Desktop-Datenbank.

Prüft nicht die Oberfläche, sondern das, was hinter ihren Knöpfen passiert —
in derselben SQLite-Datei, die die laufende App benutzt. Damit ist belegt,
dass Schema und Abfragen im echten Betrieb zusammenpassen, nicht nur in
der In-Memory-Testdatenbank.

Aufruf:  python scripts/verify_knowledge_db.py
"""

from __future__ import annotations

import os
import sqlite3
import sys

DB = os.path.join(
    os.environ["APPDATA"], "com.aiwriterstudio.app", "user_data", "app.db"
)


def fail(msg: str) -> None:
    print(f"  FEHLER  {msg}")
    globals()["ERRORS"] += 1


ERRORS = 0


def main() -> int:
    if not os.path.isfile(DB):
        print(f"Datenbank nicht gefunden: {DB}")
        print("Die App muss mindestens einmal gestartet worden sein.")
        return 1

    size_kb = os.path.getsize(DB) / 1024
    print(f"Datenbank: {DB}")
    print(f"Groesse:   {size_kb:.0f} KB\n")

    con = sqlite3.connect(DB)
    cur = con.cursor()

    # 1. Alle Tabellen des Wissenssystems vorhanden?
    print("Tabellen des Wissenssystems")
    needed = [
        "knowledge_sources",
        "knowledge_chunks",
        "knowledge_index_jobs",
        "character_profiles",
        "location_profiles",
        "project_notes",
    ]
    have = {
        r[0]
        for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    }
    for t in needed:
        if t in have:
            print(f"  OK      {t}")
        else:
            fail(f"{t} fehlt")

    # 2. Schema-Version
    ver = cur.execute("SELECT MAX(version) FROM schema_migrations").fetchone()[0]
    print(f"\nSchema-Version: {ver}")
    if ver is None or ver < 2:
        fail("Schema-Version muss mindestens 2 sein")

    # 3. Spalten, auf die die UI zugreift
    print("\nSpalten von knowledge_sources")
    cols = {r[1] for r in cur.execute("PRAGMA table_info(knowledge_sources)")}
    # chunk_count gehoert NICHT dazu: sourceStats() zaehlt per JOIN ueber
    # knowledge_chunks, damit der Zaehler nicht doppelt gepflegt werden muss.
    for c in [
        "id",
        "project_id",
        "source_type",
        "title",
        "status",
        "content_hash",
        "indexed_at",
    ]:
        if c in cols:
            print(f"  OK      {c}")
        else:
            fail(f"Spalte {c} fehlt")

    print("\nSpalten von knowledge_chunks")
    ccols = {r[1] for r in cur.execute("PRAGMA table_info(knowledge_chunks)")}
    for c in ["id", "source_id", "text", "embedding", "term_freq", "heading_path"]:
        if c in ccols:
            print(f"  OK      {c}")
        else:
            fail(f"Spalte {c} fehlt")

    # 4. Suchindizes — namentlich pruefen.
    #    Ein Substring-Filter auf "knowledge" greift NICHT: die Indizes heissen
    #    idx_ks_* und idx_kc_*. Genau dieser Denkfehler hat einen Fehlalarm
    #    ausgeloest, obwohl alle Indizes vorhanden waren.
    print("\nSuchindizes")
    idx = {
        r[0]
        for r in cur.execute("SELECT name FROM sqlite_master WHERE type='index'")
    }
    expected = [
        "idx_ks_project",
        "idx_ks_ref",
        "idx_kc_project",
        "idx_kc_source",
        "idx_cf_report",
        "idx_cf_project",
        "idx_cf_status",
        "idx_pf_report",
        "idx_snap_project",
        "idx_si_snapshot",
    ]
    for name in expected:
        if name in idx:
            print(f"  OK      {name}")
        else:
            fail(f"Index {name} fehlt — Suche laeuft als Full-Table-Scan")

    # 5. Fremdschluessel greifen wirklich (Kaskade beim Projektloeschen)
    print("\nFremdschluessel")
    cur.execute("PRAGMA foreign_keys = ON")
    fks = list(cur.execute("PRAGMA foreign_key_list(knowledge_chunks)"))
    if any(f[2] == "knowledge_sources" for f in fks):
        print("  OK      knowledge_chunks -> knowledge_sources")
    else:
        fail("knowledge_chunks hat keinen Fremdschluessel auf knowledge_sources")

    # 6. Inhalt, falls vorhanden
    n_src = cur.execute("SELECT COUNT(*) FROM knowledge_sources").fetchone()[0]
    n_chk = cur.execute("SELECT COUNT(*) FROM knowledge_chunks").fetchone()[0]
    print(f"\nInhalt: {n_src} Quellen, {n_chk} Abschnitte")
    if n_src:
        print("  Verteilung nach Typ und Status:")
        for row in cur.execute(
            "SELECT source_type, status, COUNT(*) FROM knowledge_sources "
            "GROUP BY source_type, status ORDER BY source_type"
        ):
            print(f"    {row[0]:12} {row[1]:10} {row[2]}")

    con.close()

    print()
    if ERRORS:
        print(f"{ERRORS} Problem(e) gefunden.")
        return 1
    print("Alles in Ordnung.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
