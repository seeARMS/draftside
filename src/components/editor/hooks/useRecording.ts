import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { MultimodalInputType, RecordingTarget } from "../../../lib/types";
import { asModelContentValue } from "../../../ai/multimodal";
import { TRANSCRIBE_PROMPT } from "../../../ai/prompts";
import { stripJsonFences } from "../../../lib/json";
import { clearEditorGhostCompletion } from "../../../tiptap/ghostCompletion";

interface UseRecordingOptions {
  editor: Editor | null;
  scheduleSave: (editor: Editor) => void;
  createMultimodalLanguageModelTask: (inputTypes: MultimodalInputType[], signal?: AbortSignal) => Promise<LanguageModel>;
  setAiAction: (action: "transcribe" | null) => void;
  setAiError: (message: string) => void;
  setChatError: (message: string) => void;
  appendToChatInput: (transcript: string) => void;
  openChatTab: () => void;
  setGhostCompletionText: (next: string) => void;
  completionRequestRef: React.MutableRefObject<number>;
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useRecording(options: UseRecordingOptions) {
  const {
    editor,
    scheduleSave,
    createMultimodalLanguageModelTask,
    setAiAction,
    setAiError,
    setChatError,
    appendToChatInput,
    openChatTab,
    setGhostCompletionText,
    completionRequestRef,
    chatInputRef,
  } = options;

  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  const transcribeAudio = useCallback(
    async (audio: Blob) => {
      const model = await createMultimodalLanguageModelTask(["audio"]);
      let result = "";
      try {
        result = await model.prompt([
          {
            role: "user",
            content: [
              { type: "text", value: TRANSCRIBE_PROMPT },
              { type: "audio", value: asModelContentValue(audio) },
            ],
          },
        ]);
      } finally {
        model.destroy();
      }

      return stripJsonFences(result).trim();
    },
    [createMultimodalLanguageModelTask],
  );

  const handleRecordedAudio = useCallback(
    async (target: RecordingTarget, audio: Blob) => {
      if (!audio.size) {
        const message = "No speech was captured.";
        if (target === "chat") setChatError(message);
        else setAiError(message);
        return;
      }

      setAiAction("transcribe");
      setChatError("");
      setAiError("");

      try {
        const transcript = await transcribeAudio(audio);
        if (!transcript) throw new Error("Chrome returned an empty transcript.");

        if (target === "chat") {
          openChatTab();
          appendToChatInput(transcript);
          window.setTimeout(() => chatInputRef.current?.focus(), 0);
        } else {
          if (!editor) throw new Error("The editor is not ready.");
          clearEditorGhostCompletion(editor);
          setGhostCompletionText("");
          completionRequestRef.current += 1;
          editor.chain().focus().insertContent(transcript).run();
          scheduleSave(editor);
        }
      } catch (error) {
        const details = error instanceof Error ? error.message : "Speech transcription failed.";
        const message = `${details} Chrome local audio input requires desktop Chrome with Gemini Nano multimodal support.`;
        if (target === "chat") setChatError(message);
        else setAiError(message);
      } finally {
        setAiAction(null);
      }
    },
    [
      appendToChatInput,
      chatInputRef,
      completionRequestRef,
      editor,
      openChatTab,
      scheduleSave,
      setAiAction,
      setAiError,
      setChatError,
      setGhostCompletionText,
      transcribeAudio,
    ],
  );

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const startRecording = useCallback(
    async (target: RecordingTarget) => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        const message = "Microphone recording is not available in this browser.";
        if (target === "chat") setChatError(message);
        else setAiError(message);
        return;
      }

      if (recordingTarget) {
        if (recordingTarget === target) stopRecording();
        return;
      }

      setChatError("");
      setAiError("");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);

        mediaStreamRef.current = stream;
        mediaRecorderRef.current = recorder;
        mediaChunksRef.current = [];

        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size) mediaChunksRef.current.push(event.data);
        });

        recorder.addEventListener("stop", () => {
          const chunks = mediaChunksRef.current;
          const type = recorder.mimeType || "audio/webm";
          const audio = new Blob(chunks, { type });

          mediaChunksRef.current = [];
          mediaRecorderRef.current = null;
          mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
          setRecordingTarget(null);

          void handleRecordedAudio(target, audio);
        });

        recorder.start();
        setRecordingTarget(target);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not access the microphone.";
        if (target === "chat") setChatError(message);
        else setAiError(message);
      }
    },
    [handleRecordedAudio, recordingTarget, setAiError, setChatError, stopRecording],
  );

  const toggleRecording = useCallback(
    async (target: RecordingTarget) => {
      if (recordingTarget === target) {
        stopRecording();
        return;
      }
      await startRecording(target);
    },
    [recordingTarget, startRecording, stopRecording],
  );

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return {
    recordingTarget,
    toggleRecording,
    stopRecording,
  };
}
