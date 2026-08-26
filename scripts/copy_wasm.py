"""
Kopiert die sql.js-WASM-Datei nach public/, damit Vite sie ins dist-Verzeichnis
uebernimmt.

Hintergrund:
  sql.js laedt sql-wasm.wasm zur Laufzeit per HTTP nach. Vite erkennt das nicht
  als Abhaengigkeit, weshalb die Datei im Release fehlt. Der Tauri-Server
  antwortet auf den 404 mit index.html, und sql.js scheitert mit:

    CompileError: WebAssembly.instantiate(): expected magic word
    00 61 73 6d, found 3c 21 64 6f

  (3c 21 64 6f = "<!do", also der Anfang von <!doctype html>.)

  Folge waere: kein SQLite, keine Persistenz, stiller Datenverlust.

Aufruf:  python scripts/copy_wasm.py
Wird vom prebuild-Skript in package.json automatisch ausgefuehrt.
"""

from __future__ import annotations

import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "node_modules", "sql.js", "dist", "sql-wasm.wasm")
PUBLIC = os.path.join(ROOT, "public")
DST = os.path.join(PUBLIC, "sql-wasm.wasm")


def main() -> int:
    if not os.path.isfile(SRC):
        print(f"FEHLER: {SRC} nicht gefunden. Zuerst 'npm install' ausfuehren.", file=sys.stderr)
        return 1

    os.makedirs(PUBLIC, exist_ok=True)

    src_size = os.path.getsize(SRC)
    if os.path.isfile(DST) and os.path.getsize(DST) == src_size:
        print(f"sql-wasm.wasm bereits aktuell ({src_size / 1024:.0f} KB)")
        return 0

    shutil.copy2(SRC, DST)
    print(f"sql-wasm.wasm nach public/ kopiert ({src_size / 1024:.0f} KB)")

    # Magic Word pruefen, damit ein kaputter Kopiervorgang sofort auffaellt.
    with open(DST, "rb") as f:
        magic = f.read(4)
    if magic != b"\x00asm":
        print(f"FEHLER: Ungueltiges WASM-Magic-Word: {magic!r}", file=sys.stderr)
        return 1
    print("WASM-Magic-Word korrekt (00 61 73 6d)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
