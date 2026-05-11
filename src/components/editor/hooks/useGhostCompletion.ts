import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import {
  cleanGhostCompletion,
  clearEditorGhostCompletion,
  getCompletionContext,
  setEditorGhostCompletion,
} from "../../../tiptap/ghostCompletion";
import { buildCompletionPrompt } from "../../../ai/prompts";

interface UseGhostCompletionOptions {
  editor: Editor | null;
  enabled: boolean;
  selectionEmpty: boolean;
  expressionTargetActive: boolean;
  postMenuOpen: boolean;
  vaultLocked: boolean;
  completionTick: number;
  ensureLanguageModel: () => Promise<LanguageModel>;
}

export function useGhostCompletion({
  editor,
  enabled,
  selectionEmpty,
  expressionTargetActive,
  postMenuOpen,
  vaultLocked,
  completionTick,
  ensureLanguageModel,
}: UseGhostCompletionOptions) {
  const [ghostCompletionText, setGhostCompletionText] = useState("");
  const completionTimerRef = useRef<number | null>(null);
  const completionRequestRef = useRef(0);

  const cancelCompletion = () => {
    if (editor) clearEditorGhostCompletion(editor);
    setGhostCompletionText("");
    completionRequestRef.current += 1;
  };

  useEffect(() => {
    if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current);
    if (!editor) return;

    const clearAll = () => {
      clearEditorGhostCompletion(editor);
      setGhostCompletionText("");
      completionRequestRef.current += 1;
    };

    if (!enabled || expressionTargetActive || postMenuOpen || vaultLocked || !selectionEmpty || !editor.isFocused) {
      clearAll();
      return;
    }

    const context = getCompletionContext(editor);
    if (!context) {
      clearAll();
      return;
    }

    const requestId = completionRequestRef.current + 1;
    completionRequestRef.current = requestId;

    completionTimerRef.current = window.setTimeout(async () => {
      const liveContext = getCompletionContext(editor);
      if (
        completionRequestRef.current !== requestId ||
        !liveContext ||
        !editor.isFocused ||
        liveContext.pos !== context.pos ||
        liveContext.fingerprint !== context.fingerprint
      ) {
        return;
      }

      try {
        const model = await ensureLanguageModel();
        if (completionRequestRef.current !== requestId) return;

        const result = await model.prompt([
          { role: "user", content: buildCompletionPrompt(liveContext.before) },
        ]);

        const currentContext = getCompletionContext(editor);
        if (
          completionRequestRef.current !== requestId ||
          !currentContext ||
          !editor.isFocused ||
          currentContext.pos !== context.pos ||
          currentContext.fingerprint !== context.fingerprint
        ) {
          return;
        }

        const completion = cleanGhostCompletion(result, currentContext);
        if (!completion) return;

        setEditorGhostCompletion(editor, completion, currentContext.pos);
        setGhostCompletionText(completion);
      } catch {
        if (completionRequestRef.current === requestId) {
          clearEditorGhostCompletion(editor);
          setGhostCompletionText("");
        }
      }
    }, 1000);

    return () => {
      if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current);
      completionRequestRef.current += 1;
    };
  }, [editor, enabled, expressionTargetActive, postMenuOpen, vaultLocked, selectionEmpty, completionTick, ensureLanguageModel]);

  return {
    ghostCompletionText,
    setGhostCompletionText,
    completionRequestRef,
    completionTimerRef,
    cancelCompletion,
  };
}
