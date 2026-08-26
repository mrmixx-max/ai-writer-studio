"""
Erzeugt das vollständige Windows-Icon-Set für AI Writer Studio.

Motiv (identisch zu assets/icons/icon.svg):
  Manuskriptseite mit umgeschlagener Ecke auf dunkler Tintenkarte,
  zwei Schreiblinien, dritte Zeile schwingt als Denkbogen auf.

Ausgabe:
  assets/icons/png/icon-{16,32,48,64,128,256,512}.png
  assets/icons/icon.ico            (Multi-Resolution, 16-256)
  assets/icons/setup-icon.ico      (Installer)
  assets/icons/uninstall-icon.ico  (Uninstaller, Siegelrot invertiert)
  assets/icons/file-project.ico    (.aiwsproj)
  assets/icons/file-chapter.ico    (.aiwschapter)
  src-tauri/icons/*                (von Tauri erwartete Dateien)

Aufruf:  python scripts/generate_icons.py
"""

from __future__ import annotations

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets", "icons")
PNG_DIR = os.path.join(ASSETS, "png")
TAURI_ICONS = os.path.join(ROOT, "src-tauri", "icons")

# Palette
INK = (28, 25, 23, 255)          # Tinte
PARCHMENT = (251, 248, 241, 255)  # Pergament hell
PARCHMENT_D = (239, 233, 219, 255)
FOLD = (200, 190, 170, 255)
SEAL = (154, 59, 50, 255)         # Siegelrot
SEAL_LIGHT = (198, 93, 80, 255)

# Basisauflösung, in der gezeichnet wird; alles andere wird heruntergerechnet.
BASE = 1024


def rounded_rect(d: ImageDraw.ImageDraw, box, radius, fill):
    d.rounded_rectangle(box, radius=radius, fill=fill)


def draw_mark(size: int = BASE, accent=SEAL, plate=INK, page=PARCHMENT) -> Image.Image:
    """Zeichnet die Marke in der angegebenen Kantenlänge."""
    s = size / 512.0  # Skalenfaktor gegenüber dem 512er-SVG-Koordinatensystem
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def p(x, y):
        return (x * s, y * s)

    # Tintenkarte
    rounded_rect(d, [40 * s, 40 * s, 472 * s, 472 * s], radius=96 * s, fill=plate)

    # Manuskriptseite mit abgeschnittener Ecke
    page_poly = [
        p(150, 116), p(300, 116), p(362, 178),
        p(362, 396), p(150, 396),
    ]
    d.polygon(page_poly, fill=page)
    # Leichter Verlauf: unteres Drittel etwas dunkler
    d.polygon([p(150, 330), p(362, 330), p(362, 396), p(150, 396)], fill=PARCHMENT_D)

    # Umgeschlagene Ecke
    d.polygon([p(300, 116), p(362, 178), p(300, 178)], fill=FOLD)

    # Schreiblinien
    lw = max(1, int(13 * s))
    d.line([p(176, 228), p(318, 228)], fill=INK, width=lw)
    d.line([p(176, 274), p(288, 274)], fill=INK, width=lw)

    # Denkbogen als Polyline (Bezier-Approximation)
    def bezier(p0, p1, p2, p3, steps=48):
        pts = []
        for i in range(steps + 1):
            t = i / steps
            u = 1 - t
            x = (u ** 3) * p0[0] + 3 * (u ** 2) * t * p1[0] + 3 * u * (t ** 2) * p2[0] + (t ** 3) * p3[0]
            y = (u ** 3) * p0[1] + 3 * (u ** 2) * t * p1[1] + 3 * u * (t ** 2) * p2[1] + (t ** 3) * p3[1]
            pts.append((x, y))
        return pts

    arc = bezier(p(176, 320), p(258, 320), p(320, 292), p(314, 232))
    aw = max(1, int(15 * s))
    d.line(arc, fill=accent, width=aw, joint="curve")

    # Setzpunkt
    r = 13 * s
    d.ellipse([314 * s - r, 226 * s - r, 314 * s + r, 226 * s + r], fill=accent)

    return img


def save_png_set():
    os.makedirs(PNG_DIR, exist_ok=True)
    master = draw_mark(BASE)
    sizes = [16, 32, 48, 64, 128, 256, 512]
    for n in sizes:
        # Zweistufiges Downsampling für saubere Kanten bei kleinen Größen
        inter = master.resize((n * 4, n * 4), Image.LANCZOS) if n <= 64 else master
        inter.resize((n, n), Image.LANCZOS).save(os.path.join(PNG_DIR, f"icon-{n}.png"))
    return master


def save_ico(path: str, master: Image.Image, sizes=(16, 24, 32, 48, 64, 128, 256)):
    """
    Schreibt eine echte Multi-Resolution-.ico.

    Wichtig: Pillows ICO-Writer erzeugt die Frames selbst aus EINEM Bild
    anhand von `sizes=`. Übergibt man stattdessen `append_images`, landet
    nur der erste (kleinste) Frame in der Datei — die Datei ist dann rund
    600 Bytes groß und Windows zeigt in großen Ansichten ein verwaschenes
    16x16-Bild. Deshalb: größtes Bild + sizes-Liste.
    """
    largest = max(sizes)
    src = master if master.width >= largest else master.resize((largest, largest), Image.LANCZOS)
    src = src.resize((largest, largest), Image.LANCZOS)
    src.save(path, format="ICO", sizes=[(n, n) for n in sizes])


def save_tauri_icons(master: Image.Image):
    os.makedirs(TAURI_ICONS, exist_ok=True)
    mapping = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
    }
    for name, n in mapping.items():
        inter = master.resize((n * 4, n * 4), Image.LANCZOS) if n <= 64 else master
        inter.resize((n, n), Image.LANCZOS).save(os.path.join(TAURI_ICONS, name))
    save_ico(os.path.join(TAURI_ICONS, "icon.ico"), master)
    # Windows-Store-Logos, die Tauri optional erwartet
    for name, n in {"Square30x30Logo.png": 30, "Square44x44Logo.png": 44,
                    "Square71x71Logo.png": 71, "Square89x89Logo.png": 89,
                    "Square107x107Logo.png": 107, "Square142x142Logo.png": 142,
                    "Square150x150Logo.png": 150, "Square284x284Logo.png": 284,
                    "Square310x310Logo.png": 310, "StoreLogo.png": 50}.items():
        inter = master.resize((n * 4, n * 4), Image.LANCZOS) if n <= 64 else master
        inter.resize((n, n), Image.LANCZOS).save(os.path.join(TAURI_ICONS, name))


def save_document_icons(master: Image.Image):
    """Dokument-Icons: Seite tritt hervor, Karte tritt zurück."""
    # Projektdatei: Siegelrot
    proj = draw_mark(BASE, accent=SEAL, plate=(38, 34, 31, 255))
    save_ico(os.path.join(ASSETS, "file-project.ico"), proj)
    # Kapiteldatei: gedämpfter Akzent
    chap = draw_mark(BASE, accent=(120, 113, 100, 255), plate=(38, 34, 31, 255))
    save_ico(os.path.join(ASSETS, "file-chapter.ico"), chap)


def save_installer_icons(master: Image.Image):
    save_ico(os.path.join(ASSETS, "setup-icon.ico"), master)
    uninst = draw_mark(BASE, accent=(130, 124, 112, 255))
    save_ico(os.path.join(ASSETS, "uninstall-icon.ico"), uninst)


def save_wizard_images():
    """
    Inno-Setup-Wizard-Bitmaps.
    WizardImageFile: 164x314 (klassisch) bzw. beliebig bei WizardStyle=modern.
    WizardSmallImageFile: 55x58.
    """
    # Großes Seitenbild: Tintenfläche mit Marke, Hochformat
    big = Image.new("RGB", (497, 314), (28, 25, 23))
    d = ImageDraw.Draw(big)
    # dezenter Verlauf
    for y in range(314):
        t = y / 313
        c = (int(28 + 14 * t), int(25 + 12 * t), int(23 + 10 * t))
        d.line([(0, y), (497, y)], fill=c)
    mark = draw_mark(240).convert("RGBA")
    big.paste(mark, (28, 37), mark)
    big.save(os.path.join(ASSETS, "wizard-image.bmp"), format="BMP")

    small = Image.new("RGB", (55, 58), (28, 25, 23))
    m2 = draw_mark(52).convert("RGBA")
    small.paste(m2, (1, 3), m2)
    small.save(os.path.join(ASSETS, "wizard-small.bmp"), format="BMP")


def main():
    os.makedirs(ASSETS, exist_ok=True)
    master = save_png_set()
    save_ico(os.path.join(ASSETS, "icon.ico"), master)
    save_installer_icons(master)
    save_document_icons(master)
    save_wizard_images()
    save_tauri_icons(master)

    produced = []
    for base, _, files in os.walk(ASSETS):
        for f in sorted(files):
            produced.append(os.path.relpath(os.path.join(base, f), ROOT))
    for f in sorted(os.listdir(TAURI_ICONS)):
        produced.append(os.path.relpath(os.path.join(TAURI_ICONS, f), ROOT))

    print(f"{len(produced)} Dateien erzeugt:")
    for f in produced:
        print("  " + f.replace("\\", "/"))


if __name__ == "__main__":
    main()
