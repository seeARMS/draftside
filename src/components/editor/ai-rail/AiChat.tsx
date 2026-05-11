import { ArrowUp, Check, Image as ImageIcon, LoaderCircle, MessageSquare, Mic, MicOff, X } from "lucide-react";
import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import type { AiAction, Capabilities, ChatImageAttachment, ChatMessage, RecordingTarget, WriteSession } from "../../../lib/types";
import { cn } from "../../../lib/utils";
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
    <div id="ai-panel-chat" className="flex min-h-0 flex-1 flex-col gap-3 max-[1120px]:min-h-72" role="tabpanel" aria-labelledby="ai-tab-chat">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-0.5 pb-1 pt-0.5 scroll-smooth" ref={chatMessagesRef} aria-live="polite">
        {chatMessages.length ? (
          chatMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex w-full animate-[draftside-fade-up_180ms_ease-out_both]",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[min(18.5rem,86%)] text-sm leading-relaxed text-foreground",
                  message.role === "user" && "rounded-[1rem_1rem_0.25rem_1rem] bg-muted px-3.5 py-2.5",
                  message.role === "assistant" && "max-w-full bg-transparent px-0.5 py-1",
                )}
              >
                {message.pending ? (
                  <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium leading-5 text-muted-foreground">
                    <LoaderCircle className="animate-spin" size={14} />
                    Thinking locally
                  </span>
                ) : (
                  <p className="m-0 whitespace-pre-wrap break-words">{message.content}</p>
                )}
                {message.draftUpdate ? (
                  <span className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-muted/70 px-2 py-1 text-[0.8125rem] font-medium leading-5 text-foreground">
                    <Check size={13} />
                    {message.draftUpdate.summary}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="m-auto grid max-w-60 justify-items-center gap-2.5 text-center text-muted-foreground">
            <MessageSquare size={18} />
            <p className="m-0 text-sm leading-6">Ask about anything, or ask Draftside to change the draft.</p>
          </div>
        )}

        {chatError ? <p className="m-0 text-sm leading-6 text-destructive">{chatError}</p> : null}
      </div>

      <form
        className="grid shrink-0 gap-2 rounded-xl bg-background p-2.5 shadow-[inset_0_0_0_1px_hsl(var(--border)/0.7)] transition-shadow focus-within:shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.35)]"
        onSubmit={(event) => {
          event.preventDefault();
          onSendChat();
        }}
      >
        {chatImages.length ? (
          <div className="flex flex-wrap gap-1.5" aria-label="Attached images">
            {chatImages.map((image) => (
              <span key={image.id} className="inline-grid max-w-full grid-cols-[1.75rem_minmax(0,1fr)_1.35rem] items-center gap-1.5 rounded-md bg-muted/75 p-1 text-xs leading-4 text-foreground">
                <img src={image.previewUrl} alt="" className="size-7 rounded object-cover" />
                <span className="overflow-hidden text-ellipsis whitespace-nowrap">{image.name}</span>
                <button type="button" className="inline-flex size-[1.35rem] items-center justify-center rounded border-0 bg-transparent text-muted-foreground hover:bg-background hover:text-foreground" onClick={() => onRemoveImage(image.id)} aria-label={`Remove ${image.name}`} {...tooltipProps("Remove image", "top")}>
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
          className="max-h-40 min-h-9 w-full resize-none overflow-y-auto border-0 bg-transparent px-2 py-1.5 text-sm leading-6 text-foreground outline-none [scrollbar-width:none] placeholder:text-muted-foreground/80 disabled:cursor-not-allowed disabled:opacity-65 [&::-webkit-scrollbar]:hidden"
        />
        <div className="flex items-center gap-1.5">
          <input
            ref={chatImageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={onSelectImages}
            aria-label="Attach images"
          />
          <button
            type="button"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground"
            onClick={() => chatImageInputRef.current?.click()}
            disabled={!capabilities.prompt || aiAction !== null || !activeSession || chatImages.length >= 4}
            aria-label="Attach image"
            {...tooltipProps("Attach image", "top")}
          >
            <ImageIcon size={15} />
          </button>
          <button
            type="button"
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground",
              recordingTarget === "chat" && "bg-muted text-destructive",
            )}
            onClick={() => onToggleRecording("chat")}
            disabled={!capabilities.prompt || aiAction !== null || !activeSession || (recordingTarget !== null && recordingTarget !== "chat")}
            aria-label={recordingTarget === "chat" ? "Stop voice input" : "Voice input"}
            {...tooltipProps(recordingTarget === "chat" ? "Stop voice input" : "Voice input", "top")}
          >
            {recordingTarget === "chat" ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
          <button type="submit" className="ml-auto inline-flex size-10 shrink-0 items-center justify-center rounded-md border-0 bg-foreground text-background transition-colors disabled:cursor-default disabled:bg-muted disabled:text-muted-foreground" aria-label="Send message" disabled={!canSendChat} {...tooltipProps("Send message", "left")}>
            {chatPending ? <LoaderCircle className="animate-spin" size={15} /> : <ArrowUp size={15} />}
          </button>
        </div>
      </form>
    </div>
  );
}
