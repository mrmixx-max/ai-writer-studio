// BookWriterPanel: vollautomatische Buchgenerierung mit Kapitelplanung.
// REFACTORED: God Object (~974 lines) split into modular components:
// - BookWriter/types.ts: Type definitions
// - BookWriter/hooks.ts: State management hooks
// - BookWriter/generation.ts: Generation loop logic
// - BookWriter/export.ts: Export functionality
// - BookWriter/ConfigForm.tsx: Configuration UI
// - BookWriter/LiveText.tsx: Live text, editor, controls, export UI
// - BookWriter/BookWriterPanel.tsx: Main component

export { BookWriterPanel } from "./BookWriter/BookWriterPanel";
export * from "./BookWriter/types";
export * from "./BookWriter/hooks";
export * from "./BookWriter/generation";
export * from "./BookWriter/export";
export * from "./BookWriter/ConfigForm";
export * from "./BookWriter/LiveText";
