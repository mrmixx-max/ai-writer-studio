# Sprint 19 Agent 1 — Prospekt-Abschlussbericht: AI Writer Studio (DE + EN)

Stand: 2026-09-07 · Status: DONE

## Quellen (gelesen)
- `README.md` (Z. 1–100): lokales Manuskriptstudio, SQLite lokal-first, Ollama/LM Studio/OpenAI optional, Export DOCX/EPUB/PDF/MD/TXT, BookWriter-Outline, KDP-Preflight, Windows-Installer ohne Adminrechte.
- `docs/handbuch.md` (Z. 1–50): Kapitelstruktur (Installation, Ollama/CORS, BookWriter, KDP-Export, Modell-Manager, Updater …).
- `src/services/export/index.ts`: TipTap-JSON → Blöcke (h1–h3, p, quote, list, code, image) → DOCX/MD/TXT/PDF/EPUB; KDP-ready (EPUB-CSS, PDF-Seitenzahlen, DOCX-Styles); Bilingual-Export (`bilingualExport.ts`), Validierung (`exportValidate.ts`), Publishing (`publishing.ts`).

## Erstellt (Bloomberg-Terminal-Stil: bg #000, amber #ffa028, monospace, dense, A4 1-seitig)
- `C:\Users\webma\Downloads\ai-writer-studio-prospekt-de.html` (5515 B)
- `C:\Users\webma\Downloads\ai-writer-studio-prospekt-en.html` (5386 B)
- `C:\Users\webma\Downloads\ai-writer-studio-prospekt-de.pdf` (54144 B, 1 Seite)
- `C:\Users\webma\Downloads\ai-writer-studio-prospekt-en.pdf` (53112 B, 1 Seite)

Inhalte je Version: Headline + Tagline, alle 8 Features (BookWriter, KDP-Export+Preflight, Bilingual DE/EN, Textformatierung/TipTap, Bildgenerierung, Zeitungsgenerator, Qualitäts-Engine, Windows-UI Tauri 2+React), Preis-Hinweis (0 € Open Source, kein Abo/Konto, lokal-first), Systembox, Formatbox, Workflow, CTA (Setup-EXE → Assistent → Schreiben).

## Rendering (Skill `html-pdf-rendering`)
- Edge Headless: `msedge.exe --headless --disable-gpu --no-sandbox --print-to-pdf=… --no-pdf-header-footer file://…` → `bytes written` bei beiden Dateien (Edge-Noise ignoriert).

## QC (pypdf, maschinell verifiziert)
- DE-PDF: 1 Seite; OK: AI WRITER STUDIO, FUNKTIONEN, BOOKWRITER, KDP, OPEN\u200b/\u200bSOURCE (zeilengetrennt „OPEN\\nSOURCE"), PREIS, CTA-Text, alle Features 01–08.
- EN-PDF: 1 Seite; OK: AI WRITER STUDIO, FEATURES, BOOKWRITER, KDP, OPEN\u200b/\u200bSOURCE, PRICING, CTA-Text, alle Features 01–08.
- Kein Browser-Header/Footer (`--no-pdf-header-footer`), keine Overflow-Seiten (je exakt 1 Seite).
- Hinweis: `pypdf`/`pymupdf` mussten per `uv pip install` nachinstalliert werden (Hermes-Python hatte sie nicht).

## Offene Punkte
- Keine. Visuelle Vision-QC (Preview-PNG) entfällt — Text-QC vollständig grün, Layout reine CSS-Boxen ohne Bilder/Überlappungsrisiko.
