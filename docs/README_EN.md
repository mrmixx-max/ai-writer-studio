# AI Writer Studio

**A local manuscript studio for novels, non-fiction, essays, and KDP projects.**

Write, build project knowledge, check consistency, and export — with optional AI support through Ollama, LM Studio, or OpenAI.

**Local-first.** Your manuscripts live as a SQLite file on your computer. No account, no subscription, no transmission unless you set up a cloud provider.

---

## Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Setting Up AI Providers](#setting-up-ai-providers)
- [Windows Build](#windows-build)
- [Tests](#tests)
- [Project Structure](#project-structure)
- [License](#license)

---

## Quick Start

### For Users

1. Download and run `AI-Writer-Studio-Setup-<version>-x64.exe`.
2. Installation runs **without administrator rights** to `%LOCALAPPDATA%\Programs\AI Writer Studio\`.
3. On first launch, a wizard guides you through setup. It's skippable — the app works fully without AI.

### For Developers

```bash
git clone https://github.com/mrmixx-max/ai-writer-studio
cd ai-writer-studio
npm install

# Desktop app in development mode (requires Rust)
npm run dev

# Frontend only in browser (without persistence)
npm run dev:vite
```

**Prerequisites**

| Tool | Version | For |
|---|---|---|
| Node.js | 18 or newer | Frontend build |
| Rust | stable, MSVC toolchain | Tauri backend |
| Visual Studio Build Tools | 2019 or newer, with "Desktop development with C++" | Linker |
| Python | 3.9 or newer | Icon generation, WASM copy |
| Inno Setup | 6 or 7 | Installer (optional) |

---

## Features

### Writing

- **Rich-text editor** on TipTap 2 with headings, lists, blockquotes
- **Focus mode** (F11) hides everything except the text
- **Automatic saving** without user action
- **Word counter** with character and save status
- **Version history** per chapter
- **Custom extensions**: Character tags, scene markers, chapter outline

### Project Structure

- Projects with unlimited chapters
- **Character profiles**: Name, alias, age, occupation, appearance, traits, relationships
- **Location profiles** and free **notes** with tags
- **Fragments** for text passages without fixed placement
- **Timeline visualization** with Canvas/SVG
- **Character relationship graph** with force-line simulation

### Worldbuilding

- **World Bible**: Central world info page with locations, rules, history
- **Location Manager**: Locations with coordinates, description, map export
- **Lore/Glossary Editor**: Artifacts, terms, myths, organizations
- **Consistency Checker**: Verifies characters/locations are used consistently

### Project Knowledge (RAG)

Builds a search index across the entire project — chapters, fragments, characters, locations, notes.

- **Structure-oriented chunking**: Cuts at headings and sentence boundaries, never mid-sentence
- **Three search modes**: Semantic (embeddings), exact (verbatim), hybrid (rank fusion)
- **Ask the project**: "What does the project know about character X?"
- **Context preview** before sending to AI
- **Source citations** with every answer

### AI Features

- **Core functions**: Continue writing, rewrite, summarize, correct, brainstorm, free chat
- **AI Writing Assistant**: Auto-complete, style transfer (Jünger, Hemingway, Kerouac…), dialog generator, writing prompts
- **Multi-model support**: Different providers simultaneously
- **Prompt templates**: 12 curated genre templates
- **AI chat history**: Session persistence with history
- **AI analyses**: Sentiment, style, readability

### VoiceLab

- **Audio player** with waveform visualization (Web Audio API)
- **Batch TTS**: Read entire book aloud
- **Whisper transcript editor**: Correctable transcription
- **Audio notes**: Voice memos for chapters

### Collaboration

- **Inline comments** on text passages
- **Track changes**
- **Suggestions** accept/reject
- **Sharing**: Share project, export with comments

### Research

- **Research Manager**: Web notes, screenshots, links
- **Citations & Sources**: APA/MLA/Chicago citation styles
- **Literature management**: Books, articles, websites
- **Export of sources**

### Export

- **Formats**: DOCX, EPUB, PDF, Markdown, plain text
- **Import**: Scrivener (.scrivx), DOCX, Markdown
- **Multi-platform publishing**: Smashwords, Draft2Digital, Kobo
- **Export preflight** before DOCX/PDF/EPUB

### KDP Integration

- **KDP Checklist Panel**: Progress bar, status list, cover preview
- **KDP Metadata Validation**: Title, description, keywords, categories
- **KDP Export Packaging**: Everything in one folder
- **KDP Preflight**: Structure, frontmatter, formats, characters

### Print & Layout

- **Print preview**: Page layout, breaks
- **PDF layout editor**: Page margins, headers/footers
- **Typography**: Fonts, line spacing, paragraph alignment
- **Book layout**: Hardcover/softcover preview

### Writing Analytics

- **Progress tracking**: Words per day/session, 7-day bar chart
- **Goals**: Daily word goal + deadline goal
- **Session statistics**: Writing time, breaks, words/h
- **Streaks**: Current and longest writing streak

### Plugin System

- **Plugin API**: Hooks, events, lifecycle
- **Plugin Manager**: Install, update, deactivate
- **Plugin Store**: Local registry
- **Example plugin**: Word-count badge

### Build & Distribution

- **Auto-update**: Tauri plugin updater with progress events
- **Portable version**: `scripts/create-portable.ps1`
- **Code signing**: `scripts/sign-binary.ps1`
- **Delta updates**: `scripts/generate-delta.ps1`

---

## Setting Up AI Providers

All providers are **optional**. Without any provider, the editor, project management, consistency check, export, and lexical project search remain fully usable.

### Ollama (local, recommended)

```bash
ollama serve
ollama pull llama3.2            # Text model
ollama pull nomic-embed-text    # For semantic project search
```

Expected at `http://localhost:11434`.

### LM Studio (local)

Install LM Studio, load a model, enable the local server.
Expected at `http://localhost:1234`.

### OpenAI (cloud)

Enter API key in settings. The key is stored locally only.

### OpenRouter (cloud)

Enter API key in settings. Supports hundreds of models.

### GPT2API (local)

Local ChatGPT Web API gateway. Expected at `http://localhost:8080`.

---

## Windows Build

```powershell
.\scripts\build-windows.ps1 -CreateInstaller
```

Seven steps, aborts on any error:

| # | Step | What is verified |
|---|---|---|
| 1 | Tools | Node ≥ 18, Rust/Cargo, optional Inno Setup |
| 2 | Version | Sync across all four files |
| 3 | Quality | `tsc`, ESLint, tests |
| 4 | Icons | 30 files from `assets/icons/icon.svg` |
| 5 | Frontend | Vite build, source maps removed |
| 6 | Tauri | Release binary, version info verified |
| 7 | Installer | Inno Setup (only with `-CreateInstaller`) |

---

## Tests

```bash
npm run test              # All tests
npm run test:watch
npx vitest run src/services/knowledge     # One area
```

**Status: 574 tests in 43 files.**

---

## Project Structure

```
ai-writer-studio/
├── assets/icons/              Branding — SVG source and all derivatives
├── docs/                      Documentation (DE/EN)
├── installer/                 Inno Setup
├── scripts/                   Build, installer, sync, icons
├── src/                       Frontend (React + TypeScript)
│   ├── components/            UI components
│   ├── services/              Business logic
│   ├── store/                 Zustand stores
│   ├── plugins/               Plugin system
│   └── types/                 TypeScript types
├── src-tauri/                 Rust backend (Tauri 2)
│   └── src/
│       ├── main.rs            Entry point
│       └── updater.rs         Auto-update logic
├── package.json
├── tauri.conf.json
├── Cargo.toml
└── README.md
```

---

## License

Apache-2.0 License. See [LICENSE.txt](../LICENSE.txt) for details.

---

## Contact

- **Author**: Erik Gieske
- **GitHub**: [mrmixx-max/ai-writer-studio](https://github.com/mrmixx-max/ai-writer-studio)
- **Email**: erikgieske@gmail.com
