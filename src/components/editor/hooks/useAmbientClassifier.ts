import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { AiAction, AmbientStatus, Capabilities, Classification, WriteSession } from "../../../lib/types";
import { buildAmbientPrompt } from "../../../ai/prompts";
import { parseAmbientResponse } from "../../../ai/parse";
import { fingerprintText, truncateForModel } from "../../../ai/text";

interface UseAmbientClassifierOptions {
  editor: Editor | null;
  capabilities: Capabilities;
  vaultLocked: boolean;
  liveAnalysisEnabled: boolean;
  aiAction: AiAction;
  activeSession: WriteSession | null;
  activeSessionRef: React.MutableRefObject<WriteSession | null>;
  setActiveSession: React.Dispatch<React.SetStateAction<WriteSession | null>>;
  setSessions: React.Dispatch<React.SetStateAction<WriteSession[]>>;
  saveSession: (session: WriteSession) => Promise<void>;
  ensureLanguageModel: () => Promise<LanguageModel>;
  detectLanguage: (text: string) => Promise<void>;
  completionTick: number;
}

export function useAmbientClassifier(options: UseAmbientClassifierOptions) {
  const {
    editor,
    capabilities,
    vaultLocked,
    liveAnalysisEnabled,
    aiAction,
    activeSession,
    activeSessionRef,
    setActiveSession,
    setSessions,
    saveSession,
    ensureLanguageModel,
    detectLanguage,
    completionTick,
  } = options;

  const [status, setStatus] = useState<AmbientStatus>("idle");
  const ambientTimerRef = useRef<number | null>(null);
  const ambientRequestRef = useRef(0);
  const ambientAbortRef = useRef<AbortController | null>(null);
  const ambientFingerprintRef = useRef<string>("");

  useEffect(() => {
    ambientFingerprintRef.current = activeSession?.classification?.fingerprint ?? "";
  }, [activeSession?.id, activeSession?.classification?.fingerprint]);

  const runPass = useCallback(
    async (text: string, fingerprint: string) => {
      const requestId = ambientRequestRef.current + 1;
      ambientRequestRef.current = requestId;

      ambientAbortRef.current?.abort();
      const controller = new AbortController();
      ambientAbortRef.current = controller;

      setStatus("thinking");
      void detectLanguage(text);

      try {
        const model = await ensureLanguageModel();
        if (controller.signal.aborted || ambientRequestRef.current !== requestId) return;

        const result = await model.prompt(
          [{ role: "user", content: buildAmbientPrompt(truncateForModel(text, 4800)) }],
          { signal: controller.signal },
        );

        if (controller.signal.aborted || ambientRequestRef.current !== requestId) return;

        const next: Classification = {
          ...parseAmbientResponse(result),
          fingerprint,
          updatedAt: Date.now(),
        };

        const current = activeSessionRef.current;
        if (!current) {
          setStatus("idle");
          return;
        }

        const updated: WriteSession = { ...current, classification: next, updatedAt: Date.now() };
        activeSessionRef.current = updated;
        setActiveSession(updated);
        setSessions((previous) => [updated, ...previous.filter((session) => session.id !== updated.id)].sort((a, b) => b.updatedAt - a.updatedAt));
        ambientFingerprintRef.current = fingerprint;
        setStatus("ready");

        try {
          await saveSession(updated);
        } catch {
          // Ambient analysis is best-effort; ignore persistence hiccups.
        }
      } catch (error) {
        if (controller.signal.aborted || ambientRequestRef.current !== requestId) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      } finally {
        if (ambientAbortRef.current === controller) {
          ambientAbortRef.current = null;
        }
      }
    },
    [activeSessionRef, detectLanguage, ensureLanguageModel, saveSession, setActiveSession, setSessions],
  );

  useEffect(() => {
    if (!liveAnalysisEnabled) {
      setStatus("off");
      ambientAbortRef.current?.abort();
      ambientAbortRef.current = null;
      ambientRequestRef.current += 1;
      if (ambientTimerRef.current) {
        window.clearTimeout(ambientTimerRef.current);
        ambientTimerRef.current = null;
      }
      return;
    }

    if (!capabilities.prompt || vaultLocked || !editor) {
      setStatus("idle");
      return;
    }

    const text = editor.getText().trim();
    if (!text) {
      setStatus("idle");
      return;
    }
    if (text.length < 30) {
      setStatus("tentative");
      return;
    }

    const fingerprint = fingerprintText(text);
    if (fingerprint === ambientFingerprintRef.current) {
      setStatus("ready");
      return;
    }

    if (aiAction !== null) {
      setStatus("stale");
      return;
    }

    setStatus("stale");
    if (ambientTimerRef.current) window.clearTimeout(ambientTimerRef.current);
    ambientTimerRef.current = window.setTimeout(() => {
      ambientTimerRef.current = null;
      void runPass(text, fingerprint);
    }, 1500);

    return () => {
      if (ambientTimerRef.current) {
        window.clearTimeout(ambientTimerRef.current);
        ambientTimerRef.current = null;
      }
    };
  }, [liveAnalysisEnabled, capabilities.prompt, vaultLocked, editor, completionTick, activeSession?.id, aiAction, runPass]);

  return { status };
}
