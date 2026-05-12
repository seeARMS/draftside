import { useCallback, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { ChatMessage, LockedSessionSummary, SaveState, WriteSession } from "../../../lib/types";
import {
  getLockedSessionSummaries,
  getSessions,
  putSession,
  removeSession,
  replaceAllSessions,
} from "../../../storage/sessions";
import { countWords, createBlankSession, deriveTitle } from "../../../lib/session";
import { readStoredActiveSessionId, storeActiveSessionId } from "../../../storage/prefs";

interface UseSessionsResult {
  sessions: WriteSession[];
  lockedSessions: LockedSessionSummary[];
  activeSession: WriteSession | null;
  activeSessionRef: React.MutableRefObject<WriteSession | null>;
  saveState: SaveState;
  lastSavedAt: number | null;
  setSaveState: React.Dispatch<React.SetStateAction<SaveState>>;
  setLastSavedAt: React.Dispatch<React.SetStateAction<number | null>>;
  saveTimerRef: React.MutableRefObject<number | null>;
  saveSession: (session: WriteSession) => Promise<void>;
  scheduleSave: (editor: Editor) => void;
  persistEditor: (editor: Editor) => Promise<void>;
  persistChatMessages: (messages: ChatMessage[]) => void;
  hydrateFromStorage: () => Promise<void>;
  hydrateLocked: () => Promise<void>;
  loadUnlockedSessions: (vaultKey: CryptoKey) => Promise<void>;
  setSessions: React.Dispatch<React.SetStateAction<WriteSession[]>>;
  setLockedSessions: React.Dispatch<React.SetStateAction<LockedSessionSummary[]>>;
  setActiveSession: React.Dispatch<React.SetStateAction<WriteSession | null>>;
  selectSession: (session: WriteSession) => void;
  createSession: () => Promise<WriteSession>;
  deleteSession: (id: string) => Promise<WriteSession[]>;
  getCurrentSnapshot: (editor: Editor | null) => WriteSession[];
  replaceAll: (sessions: WriteSession[], vaultKey: CryptoKey | null) => Promise<void>;
}

export function useSessions(vaultKeyRef: React.MutableRefObject<CryptoKey | null>): UseSessionsResult {
  const [sessions, setSessions] = useState<WriteSession[]>([]);
  const [lockedSessions, setLockedSessions] = useState<LockedSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<WriteSession | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const activeSessionRef = useRef<WriteSession | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const saveSession = useCallback((session: WriteSession) => putSession(session, vaultKeyRef.current), [vaultKeyRef]);

  const persistEditor = useCallback(async (editor: Editor) => {
    const current = activeSessionRef.current;
    if (!current) return;

    const plainText = editor.getText();
    const now = Date.now();
    const next: WriteSession = {
      ...current,
      title: deriveTitle(plainText),
      content: editor.getJSON(),
      plainText,
      updatedAt: now,
      wordCount: countWords(plainText),
    };

    activeSessionRef.current = next;
    setActiveSession(next);
    setSessions((previous) => [next, ...previous.filter((session) => session.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt));
    setSaveState("saving");

    try {
      await saveSession(next);
      setSaveState("saved");
      setLastSavedAt(Date.now());
    } catch {
      setSaveState("error");
    }
  }, [saveSession]);

  const scheduleSave = useCallback(
    (editor: Editor) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      setSaveState("saving");
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void persistEditor(editor);
      }, 420);
    },
    [persistEditor],
  );

  const persistChatMessages = useCallback((messages: ChatMessage[]) => {
    const current = activeSessionRef.current;
    if (!current) return;

    const next: WriteSession = {
      ...current,
      chatMessages: messages,
      updatedAt: Date.now(),
    };

    activeSessionRef.current = next;
    setActiveSession(next);
    setSessions((previous) => [next, ...previous.filter((session) => session.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt));
    setSaveState("saving");
    void saveSession(next)
      .then(() => {
        setSaveState("saved");
        setLastSavedAt(Date.now());
      })
      .catch(() => setSaveState("error"));
  }, [saveSession]);

  const hydrateLocked = useCallback(async () => {
    const summaries = await getLockedSessionSummaries();
    setLockedSessions(summaries);
    setSessions([]);
    setActiveSession(null);
    activeSessionRef.current = null;
    setLastSavedAt(summaries[0]?.updatedAt ?? null);
  }, []);

  const loadUnlockedSessions = useCallback(async (vaultKey: CryptoKey) => {
    let next = await getSessions(vaultKey);
    if (!next.length) {
      const blank = createBlankSession();
      await putSession(blank, vaultKey);
      next = [blank];
    }

    const activeId = readStoredActiveSessionId();
    const selected = next.find((session) => session.id === activeId) ?? next[0];

    setSessions(next);
    setLockedSessions([]);
    setActiveSession(selected);
    activeSessionRef.current = selected;
    setLastSavedAt(selected.updatedAt);
    setSaveState("idle");
    storeActiveSessionId(selected.id);
  }, []);

  const hydrateFromStorage = useCallback(async () => {
    try {
      const stored = await getSessions();
      let next = stored;

      if (!next.length) {
        const blank = createBlankSession();
        await putSession(blank);
        next = [blank];
      }

      const activeId = readStoredActiveSessionId();
      const selected = next.find((session) => session.id === activeId) ?? next[0];

      setSessions(next);
      setLockedSessions([]);
      setActiveSession(selected);
      activeSessionRef.current = selected;
      setLastSavedAt(selected.updatedAt);
      storeActiveSessionId(selected.id);
    } catch {
      const blank = createBlankSession();
      setSessions([blank]);
      setLockedSessions([]);
      setActiveSession(blank);
      activeSessionRef.current = blank;
      setLastSavedAt(null);
      setSaveState("error");
    }
  }, []);

  const selectSession = useCallback((session: WriteSession) => {
    setActiveSession(session);
    activeSessionRef.current = session;
    storeActiveSessionId(session.id);
    setLastSavedAt(session.updatedAt);
    setSaveState("idle");
  }, []);

  const createSession = useCallback(async () => {
    const blank = createBlankSession();
    await saveSession(blank);
    setSessions((previous) => [blank, ...previous]);
    setActiveSession(blank);
    activeSessionRef.current = blank;
    storeActiveSessionId(blank.id);
    setLastSavedAt(blank.updatedAt);
    setSaveState("saved");
    return blank;
  }, [saveSession]);

  const deleteSession = useCallback(async (id: string): Promise<WriteSession[]> => {
    await removeSession(id);
    const remaining = sessions.filter((session) => session.id !== id);

    if (remaining.length) {
      setSessions(remaining);
      const wasActive = activeSessionRef.current?.id === id;
      if (wasActive) {
        setActiveSession(remaining[0]);
        activeSessionRef.current = remaining[0];
        storeActiveSessionId(remaining[0].id);
        setLastSavedAt(remaining[0].updatedAt);
        setSaveState("idle");
      }
      return remaining;
    }

    const blank = createBlankSession();
    await saveSession(blank);
    setSessions([blank]);
    setActiveSession(blank);
    activeSessionRef.current = blank;
    storeActiveSessionId(blank.id);
    setLastSavedAt(blank.updatedAt);
    setSaveState("saved");
    return [blank];
  }, [saveSession, sessions]);

  const getCurrentSnapshot = useCallback(
    (editor: Editor | null) => {
      const current = activeSessionRef.current;
      if (!editor || !current) return sessions;

      const plainText = editor.getText();
      const next: WriteSession = {
        ...current,
        title: deriveTitle(plainText),
        content: editor.getJSON(),
        plainText,
        updatedAt: Date.now(),
        wordCount: countWords(plainText),
      };

      return [next, ...sessions.filter((session) => session.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt);
    },
    [sessions],
  );

  const replaceAll = useCallback(async (next: WriteSession[], vaultKey: CryptoKey | null) => {
    await replaceAllSessions(next, vaultKey);
    setSessions(next);
    setLockedSessions([]);
  }, []);

  return {
    sessions,
    lockedSessions,
    activeSession,
    activeSessionRef,
    saveState,
    lastSavedAt,
    setSaveState,
    setLastSavedAt,
    saveTimerRef,
    saveSession,
    scheduleSave,
    persistEditor,
    persistChatMessages,
    hydrateFromStorage,
    hydrateLocked,
    loadUnlockedSessions,
    setSessions,
    setLockedSessions,
    setActiveSession,
    selectSession,
    createSession,
    deleteSession,
    getCurrentSnapshot,
    replaceAll,
  };
}
