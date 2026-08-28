// Analytics-Tracker: abonniert den EditorStore und speist Wörter/Aktivität in den AnalyticsStore.
// Als Komponente gemountet (z. B. neben dem Editor), rendert nichts.
import { useEffect, useRef } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useAnalyticsStore } from "@/store/analyticsStore";

export function AnalyticsTracker() {
  const prevWords = useRef<number | null>(null);

  useEffect(() => {
    // periodischer Pause-Tick
    const iv = window.setInterval(() => useAnalyticsStore.getState().tick(), 60_000);
    return () => {
      window.clearInterval(iv);
      useAnalyticsStore.getState().endSession();
    };
  }, []);

  useEffect(() => {
    const unsub = useEditorStore.subscribe((s) => {
      const store = useAnalyticsStore.getState();
      const prev = prevWords.current;
      prevWords.current = s.wordCount;
      if (prev === null) return; // erste Messung: keine Delta
      const delta = s.wordCount - prev;
      if (delta !== 0) store.recordWords(delta);
      store.touchActivity();
      store.refresh();
    });
    return unsub;
  }, []);

  return null;
}
