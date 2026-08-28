// Collaboration-Modul: Kommentare, Track Changes, Vorschläge, Versionsvergleich.

export { CommentMark } from "./commentExtension";
export { TcInsertMark, TcDeleteMark, TrackChangesExtension } from "./trackChangesExtension";
export type { TrackChangesCallbacks, TrackChangesStorage } from "./trackChangesExtension";

export { CollaborationPanel } from "./CollaborationPanel";
export { CommentsPanel } from "./CommentsPanel";
export { TrackChangesPanel } from "./TrackChangesPanel";
export { SuggestionsPanel } from "./SuggestionsPanel";
export { VersionDiff } from "./VersionDiff";
export { SharingPanel } from "./SharingPanel";

export {
  buildCommentAppendix,
  buildProjectBundle,
  shareProject,
  shareProjectAsZip,
  importProjectBundle,
} from "@/services/collaboration/sharing";
export type { ShareBundle, ImportResult } from "@/services/collaboration/sharing";

export { docText, selectionRange, textOffsetToPos, findCommentRange } from "./textPos";
export type { TextRange } from "./textPos";
