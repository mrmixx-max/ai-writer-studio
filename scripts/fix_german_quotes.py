"""
Korrigiert unpaarige deutsche Anfuehrungszeichen in TypeScript-Quellen.

Ersetzt das gerade Quote, das ein oeffnendes deutsches Anfuehrungszeichen
falsch schliesst, durch das korrekte schliessende deutsche Zeichen.

In Template-Literals kompiliert das gerade Quote zwar, aber der Nutzer sieht
dann ,Marta" statt ,Marta' -- typografisch falsch in einer Schreibsoftware.

Aufruf:  python scripts/fix_german_quotes.py
"""

from __future__ import annotations

import glob
import os
import pathlib
import re
import sys

OPEN = "\u201e"
CLOSE = "\u201c"

# Oeffnendes deutsches Zeichen, dann Inhalt (auch mit ${...}-Interpolation),
# dann ein gerades Quote, das eigentlich das schliessende sein sollte.
PATTERN = re.compile(OPEN + r'((?:[^"' + CLOSE + r"\n]|\$\{[^}]*\}){1,120})\"")


def main() -> int:
    root = pathlib.Path(__file__).resolve().parent.parent
    changed: list[str] = []

    files = glob.glob(str(root / "src/**/*.ts"), recursive=True)
    files += glob.glob(str(root / "src/**/*.tsx"), recursive=True)

    for f in sorted(files):
        p = pathlib.Path(f)
        s = p.read_text(encoding="utf-8")
        new = PATTERN.sub(lambda m: OPEN + m.group(1) + CLOSE, s)
        if new != s:
            p.write_text(new, encoding="utf-8")
            rel = os.path.relpath(f, root).replace(os.sep, "/")
            changed.append(rel)

    if not changed:
        print("Nichts zu korrigieren.")
        return 0

    print(f"{len(changed)} Datei(en) korrigiert:")
    for c in changed:
        print(f"  {c}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
