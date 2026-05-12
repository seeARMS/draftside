import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import type {
  AiAction,
  Capabilities,
  ChatImageAttachment,
  ChatMessage,
  DraftUpdate,
  MultimodalInputType,
  RecordingTarget,
  WriteSession,
} from "../../../lib/types";
import { buildChatPrompt } from "../../../ai/prompts";
import { parseChatResponse } from "../../../ai/parse";
import { promptChatModel } from "../../../ai/multimodal";
import { truncateForModel } from "../../../ai/text";
import { clearEditorGhostCompletion } from "../../../tiptap/ghostCompletion";

interface UseChatOptions {
  editor: Editor | null;
  capabilities: Capabilities;
  vaultLocked: boolean;
  aiAction: AiAction;
  setAiAction: (action: AiAction) => void;
  recordingTarget: RecordingTarget | null;
  activeSessionRef: React.MutableRefObject<WriteSession | null>;
  persistChatMessages: (messages: ChatMessage[]) => void;
  createLanguageModelTask: (signal?: AbortSignal) => Promise<LanguageModel>;
  createMultimodalLanguageModelTask: (inputTypes: MultimodalInputType[], signal?: AbortSignal) => Promise<LanguageModel>;
  scheduleSave: (editor: Editor) => void;
  setGhostCompletionText: (next: string) => void;
  completionRequestRef: React.MutableRefObject<number>;
  initialChatInput: string;
  setStoredChatInput: (next: string) => void;
  openSidebarChat: () => void;
}

export function useChat(options: UseChatOptions) {
  const {
    editor,
    capabilities,
    vaultLocked,
    aiAction,
    setAiAction,
    recordingTarget,
    activeSessionRef,
    persistChatMessages,
    createLanguageModelTask,
    createMultimodalLanguageModelTask,
    scheduleSave,
    setGhostCompletionText,
    completionRequestRef,
    initialChatInput,
    setStoredChatInput,
    openSidebarChat,
  } = options;

  const [chatInput, setChatInput] = useState(initialChatInput);
  const [chatImages, setChatImages] = useState<ChatImageAttachment[]>([]);
  const [chatError, setChatError] = useState("");

  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatImageInputRef = useRef<HTMLInputElement>(null);
  const chatImagesRef = useRef<ChatImageAttachment[]>([]);

  useEffect(() => {
    chatImagesRef.current = chatImages;
  }, [chatImages]);

  useEffect(() => {
    setStoredChatInput(chatInput);
  }, [chatInput, setStoredChatInput]);

  useEffect(() => {
    const textarea = chatInputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [chatInput]);

  useEffect(() => {
    return () => {
      chatImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  const applyDraftUpdate = useCallback(
    (update: DraftUpdate) => {
      if (!editor || vaultLocked || !update.text.trim()) return false;

      clearEditorGhostCompletion(editor);
      setGhostCompletionText("");
      completionRequestRef.current += 1;

      const docEmpty = editor.state.doc.textContent.trim().length === 0;

      if (update.mode === "append" && !docEmpty) {
        editor
          .chain()
          .focus("end")
          .insertContent(`\n\n${update.text}`, { contentType: "markdown" })
          .run();
      } else if (update.mode === "prepend" && !docEmpty) {
        editor
          .chain()
          .focus("start")
          .insertContent(`${update.text}\n\n`, { contentType: "markdown" })
          .run();
        editor.commands.focus("start");
      } else {
        editor.commands.setContent(update.text, { contentType: "markdown" });
        editor.commands.focus("end");
      }

      scheduleSave(editor);
      return true;
    },
    [completionRequestRef, editor, scheduleSave, setGhostCompletionText, vaultLocked],
  );

  const handleChatImageSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;

    setChatImages((current) => {
      const remainingSlots = Math.max(0, 4 - current.length);
      const next = files.slice(0, remainingSlots).map((file) => ({
        id: crypto.randomUUID(),
        name: file.name || "image",
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...current, ...next];
    });

    event.target.value = "";
  }, []);

  const removeChatImage = useCallback((id: string) => {
    setChatImages((current) => {
      const image = current.find((item) => item.id === id);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const sendChatMessage = useCallback(async () => {
    const prompt = chatInput.trim();
    const session = activeSessionRef.current;
    const images = chatImages;
    if ((!prompt && !images.length) || !session || aiAction !== null || recordingTarget || !capabilities.prompt) return;

    const history = (session.chatMessages ?? []).filter((message) => !message.pending);
    const attachmentText = images.map((image) => `[image: ${image.name}]`).join("\n");
    const visiblePrompt = [prompt, attachmentText].filter(Boolean).join("\n");
    const effectivePrompt = prompt || "Use the attached image or images as context and help me reason about them.";
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: visiblePrompt,
      createdAt: Date.now(),
    };
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: Date.now() + 1,
      pending: true,
    };
    const optimisticMessages = [...history, userMessage, assistantMessage];
    const draftText = truncateForModel(editor?.getText().trim() ?? session.plainText.trim(), 5200);
    const modelPrompt = buildChatPrompt(effectivePrompt, draftText, history);

    openSidebarChat();
    setChatInput("");
    setChatImages([]);
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setChatError("");
    persistChatMessages(optimisticMessages);
    setAiAction("chat");

    try {
      const model = images.length ? await createMultimodalLanguageModelTask(["image"]) : await createLanguageModelTask();
      let raw = "";
      try {
        raw = await promptChatModel(model, modelPrompt, images);
      } finally {
        model.destroy();
      }
      const parsed = parseChatResponse(raw);
      const appliedUpdate = parsed.draftUpdate && activeSessionRef.current?.id === session.id ? parsed.draftUpdate : null;

      if (appliedUpdate) applyDraftUpdate(appliedUpdate);

      const finalMessages = optimisticMessages.map((message) =>
        message.id === assistantMessage.id
          ? {
              ...message,
              content: parsed.reply || (appliedUpdate ? "I updated the draft." : "Done."),
              pending: false,
              draftUpdate: appliedUpdate ?? undefined,
            }
          : message,
      );

      if (activeSessionRef.current?.id === session.id) {
        persistChatMessages(finalMessages);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat failed.";
      setChatError(message);

      const finalMessages = optimisticMessages.map((item) =>
        item.id === assistantMessage.id
          ? {
              ...item,
              content: `I could not complete that locally: ${message}`,
              pending: false,
            }
          : item,
      );

      if (activeSessionRef.current?.id === session.id) {
        persistChatMessages(finalMessages);
      }
    } finally {
      setAiAction(null);
    }
  }, [
    activeSessionRef,
    aiAction,
    applyDraftUpdate,
    capabilities.prompt,
    chatImages,
    chatInput,
    editor,
    createLanguageModelTask,
    createMultimodalLanguageModelTask,
    openSidebarChat,
    persistChatMessages,
    recordingTarget,
    setAiAction,
  ]);

  const handleChatComposerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendChatMessage();
      }
    },
    [sendChatMessage],
  );

  const appendToChatInput = useCallback((transcript: string) => {
    setChatInput((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript));
  }, []);

  return {
    chatInput,
    chatImages,
    chatError,
    chatMessagesRef,
    chatInputRef,
    chatImageInputRef,
    setChatInput,
    setChatError,
    handleChatImageSelection,
    removeChatImage,
    sendChatMessage,
    handleChatComposerKeyDown,
    appendToChatInput,
  };
}
