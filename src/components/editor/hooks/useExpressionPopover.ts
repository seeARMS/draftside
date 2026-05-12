import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { ExpressionOption, ExpressionTarget } from "../../../lib/types";
import { expressionTargetFromSelection } from "../../../tiptap/expressionTarget";
import { buildExpressionPrompt } from "../../../ai/prompts";
import { parseExpressionOptions } from "../../../ai/parse";

interface UseExpressionPopoverOptions {
  editor: Editor | null;
  vaultLocked: boolean;
  createLanguageModelTask: (signal?: AbortSignal) => Promise<LanguageModel>;
  scheduleSave: (editor: Editor) => void;
}

export function useExpressionPopover({ editor, vaultLocked, createLanguageModelTask, scheduleSave }: UseExpressionPopoverOptions) {
  const [target, setTarget] = useState<ExpressionTarget | null>(null);
  const [options, setOptions] = useState<ExpressionOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);

  const close = useCallback(() => {
    requestRef.current += 1;
    setTarget(null);
    setOptions([]);
    setLoading(false);
    setError("");
  }, []);

  const requestOptions = useCallback(
    async (next: ExpressionTarget) => {
      if (!editor) return;

      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setTarget(next);
      setOptions([]);
      setError("");
      setLoading(true);

      try {
        const docSize = editor.state.doc.content.size;
        const contextFrom = Math.max(0, next.from - 240);
        const contextTo = Math.min(docSize, next.to + 240);
        const context = editor.state.doc.textBetween(contextFrom, contextTo, " ").replace(/\s+/g, " ").trim();
        const model = await createLanguageModelTask();
        let result = "";
        try {
          result = await model.prompt([
            { role: "user", content: buildExpressionPrompt(next.text, context) },
          ]);
        } finally {
          model.destroy();
        }
        const parsed = parseExpressionOptions(result, next.text);

        if (requestRef.current !== requestId) return;
        if (!parsed.length) {
          setError("No useful alternates.");
          return;
        }

        setOptions(parsed);
      } catch (err) {
        if (requestRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : "Could not get alternates.");
      } finally {
        if (requestRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [editor, createLanguageModelTask],
  );

  const handleEditorPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!editor || vaultLocked || event.button !== 0) return;
      const eventTarget = event.target as HTMLElement;
      if (!editor.view.dom.contains(eventTarget)) return;

      window.setTimeout(() => {
        const next = expressionTargetFromSelection(editor);
        if (!next) {
          close();
          return;
        }
        void requestOptions(next);
      }, 0);
    },
    [close, editor, requestOptions, vaultLocked],
  );

  const applyOption = useCallback(
    (text: string) => {
      if (!editor || !target || !text.trim()) return;
      try {
        editor.chain().focus().setTextSelection({ from: target.from, to: target.to }).insertContent(text).run();
        scheduleSave(editor);
        close();
      } catch {
        setError("That text moved. Click it again.");
      }
    },
    [close, editor, scheduleSave, target],
  );

  useEffect(() => {
    if (!target) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      if (editor?.view.dom.contains(event.target as Node)) return;
      setTarget(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTarget(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, target]);

  return {
    target,
    options,
    loading,
    error,
    popoverRef,
    setTarget,
    close,
    handleEditorPointerUp,
    applyOption,
  };
}
