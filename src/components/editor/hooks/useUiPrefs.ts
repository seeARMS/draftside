import { useEffect, useRef, useState } from "react";
import type { AiTab, EditorUiPrefs } from "../../../lib/types";
import { readStoredUiPrefs, writeStoredUiPrefs } from "../../../storage/prefs";

interface UiPrefsState {
  aiSidebarOpen: boolean;
  aiTab: AiTab;
  focusMode: boolean;
  liveAnalysis: boolean;
  translationTarget: string;
  chatInput: string;
}

function initialPrefs(): UiPrefsState {
  const stored = readStoredUiPrefs();
  const isWideViewport = typeof window !== "undefined" && window.innerWidth > 1120;
  return {
    aiSidebarOpen: stored.aiSidebarOpen ?? isWideViewport,
    aiTab: stored.aiTab ?? "tools",
    focusMode: stored.focusMode ?? false,
    liveAnalysis: stored.liveAnalysis ?? true,
    translationTarget: stored.translationTarget ?? "es",
    chatInput: stored.chatInput ?? "",
  };
}

const PERSIST_KEYS: ReadonlyArray<keyof EditorUiPrefs> = [
  "aiSidebarOpen",
  "aiTab",
  "focusMode",
  "liveAnalysis",
  "translationTarget",
  "chatInput",
];

export function useUiPrefs() {
  const [prefs, setPrefs] = useState<UiPrefsState>(initialPrefs);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const next: EditorUiPrefs = {};
    for (const key of PERSIST_KEYS) {
      (next as Record<string, unknown>)[key] = prefs[key as keyof UiPrefsState];
    }
    writeStoredUiPrefs(next);
  }, [prefs]);

  return [prefs, setPrefs] as const;
}
