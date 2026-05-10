import { ACTIVE_SESSION_KEY, UI_PREFS_KEY, TRANSLATION_LANGUAGES } from "./constants";
import type { EditorUiPrefs } from "./types";

function readStoredUiPrefs(): EditorUiPrefs {
  try {
    const stored = localStorage.getItem(UI_PREFS_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored) as Partial<EditorUiPrefs>;
    return {
      activeSessionId: typeof parsed.activeSessionId === "string" ? parsed.activeSessionId : undefined,
      aiSidebarOpen: typeof parsed.aiSidebarOpen === "boolean" ? parsed.aiSidebarOpen : undefined,
      aiTab: parsed.aiTab === "chat" || parsed.aiTab === "tools" ? parsed.aiTab : undefined,
      chatInput: typeof parsed.chatInput === "string" ? parsed.chatInput : undefined,
      focusMode: typeof parsed.focusMode === "boolean" ? parsed.focusMode : undefined,
      liveAnalysis: typeof parsed.liveAnalysis === "boolean" ? parsed.liveAnalysis : undefined,
      translationTarget:
        typeof parsed.translationTarget === "string" && TRANSLATION_LANGUAGES.some((language) => language.code === parsed.translationTarget)
          ? parsed.translationTarget
          : undefined,
    };
  } catch {
    return {};
  }
}

function writeStoredUiPrefs(next: EditorUiPrefs) {
  try {
    const current = readStoredUiPrefs();
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ ...current, ...next }));
  } catch {
    // UI preferences are progressive; the editor still works without them.
  }
}

function storeActiveSessionId(id: string) {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } catch {
    // The consolidated prefs write below may still succeed in normal browsers.
  }
  writeStoredUiPrefs({ activeSessionId: id });
}

function readStoredActiveSessionId() {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY) ?? readStoredUiPrefs().activeSessionId;
  } catch {
    return readStoredUiPrefs().activeSessionId;
  }
}

export { readStoredActiveSessionId, readStoredUiPrefs, storeActiveSessionId, writeStoredUiPrefs };
