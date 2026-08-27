"""
Findet unpaarige deutsche Anfuehrungszeichen in TypeScript-Quellen.

Anlass: Beim Schreiben deutscher UI-Texte ist mir dieser Fehler dreimal
passiert. Wer „Text" schreibt (deutsches Zeichen oeffnend, GERADES Quote
schliessend), beendet damit versehentlich den umgebenden String -- tsc
meldet dann "',' expected" an einer scheinbar harmlosen Stelle.

Richtig ist das Paar \u201e ... \u201c. Genau darauf prueft dieses Skript:
ein oeffnendes deutsches Anfuehrungszeichen, dessen naechstes Anfuehrungs-
zeichen ein gerades " ist.

Aufruf:  python scripts/check_german_quotes.py
Exitcode 1, wenn Treffer gefunden werden.
"""

from __future__ import annotations

import glob
import os
import re
import sys

OPENING = "\u201e"  # deutsches oeffnendes Anfuehrungszeichen
CLOSING = "\u201c"  # deutsches schliessendes Anfuehrungszeichen

# Ein oeffnendes deutsches Zeichen, dann Text ohne Anfuehrungszeichen und
# ohne Zeilenumbruch, dann ein GERADES Quote statt des deutschen.
BAD = re.compile(OPENING + r'[^"' + CLOSING + r"\n]{1,100}\"")


def check_file(path: str) -> list[tuple[int, str]]:
    hits: list[tuple[int, str]] = []
    with open(path, encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, 1):
            stripped = line.lstrip()
            # Reine Kommentarzeilen sind unkritisch.
            if stripped.startswith(("//", "*", "/*")):
                continue
            if BAD.search(line):
                hits.append((lineno, line.rstrip()))
    return hits


def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    total = 0

    for pat in ("src/**/*.ts", "src/**/*.tsx"):
        for path in sorted(glob.glob(os.path.join(root, pat), recursive=True)):
            hits = check_file(path)
            if not hits:
                continue
            rel = os.path.relpath(path, root).replace("\\", "/")
            for lineno, line in hits:
                print(f"{rel}:{lineno}")
                print(f"    {line[:110]}")
                total += 1

    print()
    if total:
        print(f"{total} unpaariges deutsches Anfuehrungszeichen.")
        print(
            f"Erwartet wird das Paar {OPENING} ... {CLOSING}. "
            f'Ein gerades " nach {OPENING} beendet den umgebenden String.'
        )
        return 1

    print("Alle deutschen Anfuehrungszeichen sind korrekt gepaart.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
