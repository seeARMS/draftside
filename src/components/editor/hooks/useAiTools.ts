import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { AiAction, AiStatus, Capabilities, SelectionSnapshot } from "../../../lib/types";
import { buildTightenPrompt } from "../../../ai/prompts";
import { readTextStream, truncateForModel } from "../../../ai/text";
import { translationLabel } from "../../../lib/formatters";

interface UseAiToolsOptions {
  editor: Editor | null;
  vaultLocked: boolean;
  capabilities: Capabilities;
  selection: SelectionSnapshot;
  setAiAction: (action: AiAction) => void;
  setAiStatus: (status: AiStatus | ((current: AiStatus) => AiStatus)) => void;
  setAiError: (message: string) => void;
  setAiOutput: (next: string | ((current: string) => string)) => void;
  setAiProgress: (next: number | null) => void;
  ensureLanguageModel: () => Promise<LanguageModel>;
  scheduleSave: (editor: Editor) => void;
  translationTarget: string;
}

export function useAiTools(options: UseAiToolsOptions) {
  const {
    editor,
    vaultLocked,
    capabilities,
    selection,
    setAiAction,
    setAiStatus,
    setAiError,
    setAiOutput,
    setAiProgress,
    ensureLanguageModel,
    scheduleSave,
    translationTarget,
  } = options;

  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [translationSource, setTranslationSource] = useState("");
  const [lastTranslation, setLastTranslation] = useState("");

  const getModelText = useCallback(() => {
    const selected = selection.text.trim();
    const whole = editor?.getText().trim() ?? "";
    return truncateForModel(selected || whole);
  }, [editor, selection.text]);

  const replaceSelectionOrInsert = useCallback(
    (text: string) => {
      if (!editor || vaultLocked || !text.trim()) return;
      editor.chain().focus().insertContent(text).run();
      scheduleSave(editor);
    },
    [editor, scheduleSave, vaultLocked],
  );

  const detectLanguage = useCallback(
    async (text: string) => {
      if (!capabilities.detector || !text.trim()) return;

      try {
        const availability = await LanguageDetector.availability();
        if (availability === "unavailable") return;
        const detector = await LanguageDetector.create({
          monitor(monitor) {
            monitor.addEventListener("downloadprogress", (event) => {
              if (event.loaded <= 1) setAiProgress(event.loaded);
            });
          },
        });
        const [first] = await detector.detect(text.slice(0, 1200));
        detector.destroy();
        if (first?.detectedLanguage) {
          const confidence = typeof first.confidence === "number" ? ` ${Math.round(first.confidence * 100)}%` : "";
          setDetectedLanguage(`${first.detectedLanguage}${confidence}`);
        }
      } catch {
        setDetectedLanguage("");
      }
    },
    [capabilities.detector, setAiProgress],
  );

  const detectSourceLanguage = useCallback(
    async (text: string) => {
      if (!capabilities.detector || !text.trim()) return "en";

      try {
        const availability = await LanguageDetector.availability();
        if (availability === "unavailable") return "en";

        const detector = await LanguageDetector.create({
          monitor(monitor) {
            monitor.addEventListener("downloadprogress", (event) => {
              if (event.loaded <= 1) setAiProgress(event.loaded);
            });
          },
        });
        const [first] = await detector.detect(text.slice(0, 1600));
        detector.destroy();

        const detected = first?.detectedLanguage || "en";
        const confidence = typeof first?.confidence === "number" ? ` ${Math.round(first.confidence * 100)}%` : "";
        setDetectedLanguage(`${detected}${confidence}`);
        return detected;
      } catch {
        return "en";
      }
    },
    [capabilities.detector, setAiProgress],
  );

  const translateDraft = useCallback(async () => {
    const text = getModelText();
    if (!text) {
      setAiError("Write or select some text first.");
      return;
    }

    if (!capabilities.translator) {
      setAiError("Chrome Translator API is unavailable in this browser.");
      return;
    }

    setAiAction("translate");
    setAiError("");
    setAiOutput("");
    setLastTranslation("");

    try {
      const sourceLanguage = await detectSourceLanguage(text);
      setTranslationSource(sourceLanguage);

      if (sourceLanguage === translationTarget) {
        setAiOutput(text);
        setLastTranslation(text);
        return;
      }

      const opts: TranslatorCreateOptions = {
        sourceLanguage,
        targetLanguage: translationTarget,
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            const progress =
              event.lengthComputable && event.total > 0
                ? event.loaded / event.total
                : event.loaded <= 1
                  ? event.loaded
                  : 0;
            setAiProgress(Math.max(0, Math.min(1, progress)));
          });
        },
      };

      const availability = await Translator.availability(opts);
      if (availability === "unavailable") {
        throw new Error(`Local translation from ${translationLabel(sourceLanguage)} to ${translationLabel(translationTarget)} is unavailable.`);
      }

      const translator = await Translator.create(opts);
      const translated = await translator.translate(text);
      translator.destroy();

      setAiProgress(null);
      setLastTranslation(translated);
      setAiOutput(translated);
    } catch (error) {
      setAiProgress(null);
      setAiError(error instanceof Error ? error.message : "Translation failed.");
    } finally {
      setAiAction(null);
    }
  }, [
    capabilities.translator,
    detectSourceLanguage,
    getModelText,
    setAiAction,
    setAiError,
    setAiOutput,
    setAiProgress,
    translationTarget,
  ]);

  const applyTranslation = useCallback(() => {
    if (!lastTranslation.trim() || selection.empty) return;
    replaceSelectionOrInsert(lastTranslation);
  }, [lastTranslation, replaceSelectionOrInsert, selection.empty]);

  const rewriteSelection = useCallback(async () => {
    const text = selection.text.trim();
    if (!text) {
      setAiError("Select text to rewrite.");
      return;
    }

    setAiAction("rewrite");
    setAiError("");
    setAiOutput("");

    try {
      let result = "";

      if (capabilities.rewriter) {
        const availability = await Rewriter.availability({
          tone: "as-is",
          format: "plain-text",
          length: "shorter",
          expectedInputLanguages: ["en"],
          expectedContextLanguages: ["en"],
          outputLanguage: "en",
        });

        if (availability !== "unavailable") {
          const rewriter = await Rewriter.create({
            tone: "as-is",
            format: "plain-text",
            length: "shorter",
            sharedContext: "Private offline writing editor. Preserve meaning and voice while removing slack.",
            monitor(monitor) {
              monitor.addEventListener("downloadprogress", (event) => {
                setAiStatus("downloading");
                if (event.loaded <= 1) setAiProgress(event.loaded);
              });
            },
          });
          const stream = rewriter.rewriteStreaming(text, {
            context: "Tighten this passage without changing the writer's point.",
          });
          result = await readTextStream(stream, setAiOutput);
          rewriter.destroy();
        }
      }

      if (!result) {
        const model = await ensureLanguageModel();
        const stream = model.promptStreaming([
          { role: "user", content: buildTightenPrompt(truncateForModel(text, 4200)) },
        ]);
        result = await readTextStream(stream, setAiOutput);
      }

      replaceSelectionOrInsert(result.trim());
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Rewrite failed.");
    } finally {
      setAiAction(null);
      setAiProgress(null);
    }
  }, [
    capabilities.rewriter,
    ensureLanguageModel,
    replaceSelectionOrInsert,
    selection.text,
    setAiAction,
    setAiError,
    setAiOutput,
    setAiProgress,
    setAiStatus,
  ]);

  return {
    detectedLanguage,
    translationSource,
    lastTranslation,
    detectLanguage,
    translateDraft,
    applyTranslation,
    rewriteSelection,
  };
}
