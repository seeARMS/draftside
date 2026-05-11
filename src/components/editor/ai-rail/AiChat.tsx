import { ArrowUp, Check, Image as ImageIcon, LoaderCircle, MessageSquare, Mic, MicOff, X } from "lucide-react";
import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import type { AiAction, Capabilities, ChatImageAttachment, ChatMessage, RecordingTarget, WriteSession } from "../../../lib/types";
import type { TooltipPlacement } from "../hooks/useTooltip";

interface AiChatProps {
  chatMessages: ChatMessage[];
  chatMessagesRef: RefObject<HTMLDivElement>;
  chatInput: string;
  chatImages: ChatImageAttachment[];
  chatError: string;
  chatPending: boolean;
  chatInputRef: RefObject<HTMLTextAreaElement>;
  chatImageInputRef: RefObject<HTMLInputElement>;
  capabilities: Capabilities;
  aiAction: AiAction;
  recordingTarget: RecordingTarget | null;
  activeSession: WriteSession | null;
  canSendChat: boolean;
  onChatInputChange: (next: string) => void;
  onChatComposerKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSendChat: () => void;
  onSelectImages: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (id: string) => void;
  onToggleRecording: (target: RecordingTarget) => void;
  tooltipProps: (label: string, placement?: TooltipPlacement, size?: "wide") => Record<string, string | undefined>;
}

export function AiChat({
  chatMessages,
  chatMessagesRef,
  chatInput,
  chatImages,
  chatError,
  chatPending,
  chatInputRef,
  chatImageInputRef,
  capabilities,
  aiAction,
  recordingTarget,
  activeSession,
  canSendChat,
  onChatInputChange,
  onChatComposerKeyDown,
  onSendChat,
  onSelectImages,
  onRemoveImage,
  onToggleRecording,
  tooltipProps,
}: AiChatProps) {
  const placeholder =
    recordingTarget === "chat"
      ? "Listening..."
      : aiAction === "transcribe"
        ? "Transcribing locally..."
        : capabilities.prompt
          ? "Ask anything..."
          : "Chrome built-in AI is unavailable";

  return (
    <div id="ai-panel-chat" className="ai-tab-panel chat-panel" role="tabpanel" aria-labelledby="ai-tab-chat">
      <div className="chat-messages" ref={chatMessagesRef} aria-live="polite">
        {chatMessages.length ? (
          chatMessages.map((message) => (
            <div key={message.id} className={`chat-message ${message.role}`}>
              <div className="chat-bubble">
                {message.pending ? (
                  <span className="chat-thinking">
                    <LoaderCircle className="spin" size={14} />
                    Thinking locally
                  </span>
                ) : (
                  <p>{message.content}</p>
                )}
                {message.draftUpdate ? (
                  <span className="chat-update">
                    <Check size={13} />
                    {message.draftUpdate.summary}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="chat-empty">
            <MessageSquare size={18} />
            <p>Ask about anything, or ask Draftside to change the draft.</p>
          </div>
        )}

        {chatError ? <p className="chat-error">{chatError}</p> : null}
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSendChat();
        }}
      >
        {chatImages.length ? (
          <div className="chat-attachments" aria-label="Attached images">
            {chatImages.map((image) => (
              <span key={image.id} className="chat-attachment">
                <img src={image.previewUrl} alt="" />
                <span>{image.name}</span>
                <button type="button" onClick={() => onRemoveImage(image.id)} aria-label={`Remove ${image.name}`} {...tooltipProps("Remove image", "top")}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <textarea
          ref={chatInputRef}
          value={chatInput}
          onChange={(event) => onChatInputChange(event.target.value)}
          onKeyDown={onChatComposerKeyDown}
          disabled={!capabilities.prompt || aiAction !== null || !activeSession}
          rows={1}
          placeholder={placeholder}
          aria-label="Chat with Draftside"
        />
        <div className="chat-input-row">
          <input
            ref={chatImageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="visually-hidden"
            onChange={onSelectImages}
            aria-label="Attach images"
          />
          <button
            type="button"
            className="chat-tool-button"
            onClick={() => chatImageInputRef.current?.click()}
            disabled={!capabilities.prompt || aiAction !== null || !activeSession || chatImages.length >= 4}
            aria-label="Attach image"
            {...tooltipProps("Attach image", "top")}
          >
            <ImageIcon size={15} />
          </button>
          <button
            type="button"
            className={recordingTarget === "chat" ? "chat-tool-button is-recording" : "chat-tool-button"}
            onClick={() => onToggleRecording("chat")}
            disabled={!capabilities.prompt || aiAction !== null || !activeSession || (recordingTarget !== null && recordingTarget !== "chat")}
            aria-label={recordingTarget === "chat" ? "Stop voice input" : "Voice input"}
            {...tooltipProps(recordingTarget === "chat" ? "Stop voice input" : "Voice input", "top")}
          >
            {recordingTarget === "chat" ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
          <button type="submit" className="chat-send-button" aria-label="Send message" disabled={!canSendChat} {...tooltipProps("Send message", "left")}>
            {chatPending ? <LoaderCircle className="spin" size={15} /> : <ArrowUp size={15} />}
          </button>
        </div>
      </form>
    </div>
  );
}
