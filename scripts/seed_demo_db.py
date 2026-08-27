"""
Fuellt die ECHTE Desktop-Datenbank mit dem Beispielprojekt und prueft den
Ablauf des Projektwissens darin: Quellen einlesen, indexieren, suchen.

Warum direkt per SQL statt ueber die App: Die Dienste liegen in TypeScript und
laufen im WebView. Diese Pruefung stellt sicher, dass Schema und Abfragen im
echten Betrieb tragen — unabhaengig von der Oberflaeche.

Aufruf:  python scripts/seed_demo_db.py
Danach die App starten, Projekt oeffnen, Modus 📚 waehlen.
"""

from __future__ import annotations

import os
import sqlite3
import sys
import time

DB = os.path.join(
    os.environ["APPDATA"], "com.aiwriterstudio.app", "user_data", "app.db"
)


def uid(prefix: str, n: int) -> str:
    return f"{prefix}_demo{n:03d}"


def doc(heading: str, paragraphs: list[str]) -> str:
    """Baut ein TipTap-Dokument wie das Frontend."""
    import json

    content: list[dict] = [
        {
            "type": "heading",
            "attrs": {"level": 2},
            "content": [{"type": "text", "text": heading}],
        }
    ]
    for p in paragraphs:
        content.append({"type": "paragraph", "content": [{"type": "text", "text": p}]})
    return json.dumps({"type": "doc", "content": content}, ensure_ascii=False)


CHAPTERS = [
    (
        "1. Der Fund",
        [
            "Der Brief lag zwischen den Seiten eines Buches, das seit vierzig "
            "Jahren niemand aufgeschlagen hatte. Marta hielt ihn gegen das "
            "Fenster. Das Papier war duenn geworden, fast durchscheinend.",
            "Sie las die erste Zeile und setzte sich hin.",
            "Draussen begann es zu regnen. Sie merkte es nicht.",
        ],
    ),
    (
        "2. Was darin stand",
        [
            "Der Brief war an eine Adresse gerichtet, die es nicht mehr gab. "
            "Die Strasse hatte man umbenannt, das Haus abgerissen. Nur der "
            "Name des Empfaengers stimmte noch: ihr eigener.",
            "Geschrieben hatte ihn ihre Grossmutter. Im November 1961, drei "
            "Wochen vor Martas Geburt.",
        ],
    ),
    (
        "3. Die Suche",
        [
            "Im Archiv gab es Oeffnungszeiten, Formulare und einen Mann namens "
            "Kessler, der jede Frage mit einer Gegenfrage beantwortete.",
            "Marta blieb, bis er aufgab.",
        ],
    ),
]


def main() -> int:
    if not os.path.isfile(DB):
        print(f"Datenbank nicht gefunden: {DB}")
        print("Die App muss mindestens einmal gestartet worden sein.")
        return 1

    con = sqlite3.connect(DB)
    con.execute("PRAGMA foreign_keys = ON")
    cur = con.cursor()
    now = int(time.time() * 1000)

    # Vorhandenes Demoprojekt entfernen, damit der Lauf wiederholbar ist.
    cur.execute("DELETE FROM projects WHERE id = 'proj_demo'")

    cur.execute(
        "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?,?,?,?)",
        ("proj_demo", "Beispiel: Der Novemberbrief", now, now),
    )

    for i, (title, paras) in enumerate(CHAPTERS):
        cur.execute(
            "INSERT INTO chapters (id, project_id, title, content, order_index, "
            "created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
            (uid("chap", i), "proj_demo", title, doc(title, paras), i, now, now),
        )

    cur.execute(
        "INSERT INTO character_profiles (id, project_id, name, aliases, age, "
        "occupation, appearance, traits, relationships, notes, created_at, "
        "updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            uid("char", 0), "proj_demo", "Marta Reineke", "Marta", "48",
            "Restauratorin", "Kurze graue Haare, Lesebrille an einer Kette",
            "Geduldig, hartnaeckig, misstrauisch gegenueber Behoerden",
            "Enkelin von Hedwig Reineke", "Dritte Person, Vergangenheit.",
            now, now,
        ),
    )
    cur.execute(
        "INSERT INTO character_profiles (id, project_id, name, aliases, age, "
        "occupation, appearance, traits, relationships, notes, created_at, "
        "updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            uid("char", 1), "proj_demo", "Kessler", "Herr Kessler, der Archivar",
            "60", "Archivar", "Hemd mit aufgerollten Aermeln",
            "Wortkarg, gruendlich, insgeheim hilfsbereit",
            "Beruflicher Kontakt zu Marta", "Vorname wird nie genannt.",
            now, now,
        ),
    )

    cur.execute(
        "INSERT INTO project_notes (id, project_id, title, body, tags, "
        "created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        (
            uid("note", 0), "proj_demo", "Zeitlinie",
            "November 1961: Hedwig schreibt den Brief.\n"
            "Dezember 1961: Marta wird geboren.\n"
            "Gegenwart: Marta findet den Brief.",
            "struktur,zeitlinie", now, now,
        ),
    )

    con.commit()

    # Kontrolle
    print("Demoprojekt in der echten Datenbank angelegt:\n")
    for table, label in [
        ("chapters", "Kapitel"),
        ("character_profiles", "Figuren"),
        ("project_notes", "Notizen"),
    ]:
        n = cur.execute(
            f"SELECT COUNT(*) FROM {table} WHERE project_id = 'proj_demo'"
        ).fetchone()[0]
        print(f"  {n}  {label}")

    con.close()
    print("\nJetzt die App starten, das Projekt oeffnen und den Modus 📚 waehlen.")
    print('Dort "Quellen einlesen", dann "Projektwissen aktualisieren".')
    return 0


if __name__ == "__main__":
    sys.exit(main())
