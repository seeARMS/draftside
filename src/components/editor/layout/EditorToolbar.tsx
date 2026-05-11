import {
  Bold,
  Check,
  Code2,
  Copy,
  Download,
  Ellipsis,
  FileText,
  Focus,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Lock,
  LockOpen,
  Menu,
  Mic,
  MicOff,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Quote,
  Redo2,
  Sun,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import type { RefObject } from "react";
import type { Editor } from "@tiptap/core";
import type { AiAction, Capabilities, RecordingTarget, ThemeMode, VaultStatus, WriteSession } from "../../../lib/types";
import { cn } from "../../../lib/utils";
import { iconButton } from "../tailwind";
import { ToolbarButton } from "./ToolbarButton";
import type { TooltipPlacement } from "../hooks/useTooltip";

interface EditorToolbarProps {
  editor: Editor | null;
  vaultLocked: boolean;
  vaultStatus: VaultStatus;
  vaultEnabled: boolean;
  capabilities: Capabilities;
  aiAction: AiAction;
  recordingTarget: RecordingTarget | null;
  toggleRecording: (target: RecordingTarget) => Promise<void>;
  theme: ThemeMode;
  toggleTheme: () => void;
  openVaultModal: () => void;
  focusMode: boolean;
  toggleFocusMode: () => void;
  aiSidebarOpen: boolean;
  toggleAiSidebar: () => void;
  postMenuOpen: boolean;
  togglePostMenu: () => void;
  postMenuRef: RefObject<HTMLDivElement>;
  copiedPostMarkdown: boolean;
  chatPending: boolean;
  activeSession: WriteSession | null;
  onOpenDrafts: () => void;
  onDownloadHtml: () => void;
  onDownloadMarkdown: () => void;
  onCopyMarkdown: () => void;
  onRequestDeleteActive: () => void;
  tooltipProps: (label: string, placement?: TooltipPlacement, size?: "wide") => Record<string, string | undefined>;
}

export function EditorToolbar(props: EditorToolbarProps) {
  const {
    editor,
    vaultLocked,
    vaultStatus,
    vaultEnabled,
    capabilities,
    aiAction,
    recordingTarget,
    toggleRecording,
    theme,
    toggleTheme,
    openVaultModal,
    focusMode,
    toggleFocusMode,
    aiSidebarOpen,
    toggleAiSidebar,
    postMenuOpen,
    togglePostMenu,
    postMenuRef,
    copiedPostMarkdown,
    chatPending,
    activeSession,
    onOpenDrafts,
    onDownloadHtml,
    onDownloadMarkdown,
    onCopyMarkdown,
    onRequestDeleteActive,
    tooltipProps,
  } = props;

  const button = (label: string, onClick: () => void, opts: { active?: boolean; disabled?: boolean } = {}, icon: React.ReactNode) => (
    <ToolbarButton
      label={label}
      active={opts.active}
      disabled={(opts.disabled ?? false) || vaultLocked}
      onClick={onClick}
      tooltipProps={tooltipProps}
    >
      {icon}
    </ToolbarButton>
  );

  return (
    <div
      className="sticky top-0 z-[5] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-border/70 bg-card px-3 py-2.5 max-[960px]:grid-rows-[auto_auto] max-[960px]:gap-y-1 max-[960px]:px-2 max-[960px]:pb-1.5 max-[960px]:pt-2 max-[520px]:px-1.5"
      aria-label="Editor toolbar"
    >
      <button
        type="button"
        className={cn(
          iconButton(),
          "col-start-1 row-start-1 hidden max-[1120px]:inline-flex",
          focusMode && "max-[1120px]:hidden",
        )}
        onClick={onOpenDrafts}
        aria-label="Open drafts"
        {...tooltipProps("Drafts", "bottom")}
      >
        <Menu size={18} />
      </button>

      <div
        className={cn(
          "col-start-1 row-start-1 flex min-w-0 items-center gap-2",
          "max-[1120px]:col-start-1 max-[1120px]:col-end-4 max-[1120px]:row-start-2",
          "max-[1120px]:-mx-2 max-[1120px]:overflow-x-auto max-[1120px]:px-2",
          "max-[520px]:-mx-1.5 max-[520px]:px-1.5",
        )}
      >
        <div className="inline-flex shrink-0 items-center gap-0.5 border-r border-border/70 pr-2 max-[520px]:pr-1">
          {button("Undo", () => editor?.chain().focus().undo().run(), { disabled: !editor?.can().undo() }, <Undo2 size={17} />)}
          {button("Redo", () => editor?.chain().focus().redo().run(), { disabled: !editor?.can().redo() }, <Redo2 size={17} />)}
        </div>

        <div className="inline-flex shrink-0 items-center gap-0.5 border-r border-border/70 pr-2 max-[520px]:pr-1">
          {button("Bold", () => editor?.chain().focus().toggleBold().run(), { active: editor?.isActive("bold") }, <Bold size={17} />)}
          {button("Italic", () => editor?.chain().focus().toggleItalic().run(), { active: editor?.isActive("italic") }, <Italic size={17} />)}
          {button("Underline", () => editor?.chain().focus().toggleUnderline().run(), { active: editor?.isActive("underline") }, <UnderlineIcon size={17} />)}
          {button("Highlight", () => editor?.chain().focus().toggleHighlight().run(), { active: editor?.isActive("highlight") }, <Highlighter size={17} />)}
        </div>

        <div className="inline-flex shrink-0 items-center gap-0.5 border-r border-border/70 pr-2 max-[520px]:pr-1">
          {button("Heading 1", () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), { active: editor?.isActive("heading", { level: 1 }) }, <Heading1 size={17} />)}
          {button("Heading 2", () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), { active: editor?.isActive("heading", { level: 2 }) }, <Heading2 size={17} />)}
          {button("Bullet list", () => editor?.chain().focus().toggleBulletList().run(), { active: editor?.isActive("bulletList") }, <List size={17} />)}
          {button("Ordered list", () => editor?.chain().focus().toggleOrderedList().run(), { active: editor?.isActive("orderedList") }, <ListOrdered size={17} />)}
          {button("Tasks", () => editor?.chain().focus().toggleTaskList().run(), { active: editor?.isActive("taskList") }, <ListChecks size={17} />)}
          {button("Quote", () => editor?.chain().focus().toggleBlockquote().run(), { active: editor?.isActive("blockquote") }, <Quote size={17} />)}
          {button("Code", () => editor?.chain().focus().toggleCodeBlock().run(), { active: editor?.isActive("codeBlock") }, <Code2 size={17} />)}
        </div>

        <button
          type="button"
          className={cn(iconButton(recordingTarget === "editor", recordingTarget === "editor" ? "text-destructive" : undefined), "shrink-0")}
          onClick={() => void toggleRecording("editor")}
          disabled={vaultLocked || !capabilities.prompt || aiAction !== null || (recordingTarget !== null && recordingTarget !== "editor")}
          aria-label={recordingTarget === "editor" ? "Stop dictation" : "Dictate into editor"}
          {...tooltipProps(recordingTarget === "editor" ? "Stop dictation" : "Dictate into editor", "bottom")}
        >
          {recordingTarget === "editor" ? <MicOff size={17} /> : <Mic size={17} />}
        </button>
      </div>

      <div className="col-start-3 row-start-1 flex shrink-0 items-center gap-1">
        <div className="relative z-20 shrink-0" ref={postMenuRef}>
          <button
            type="button"
            className={iconButton(postMenuOpen)}
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={postMenuOpen}
            onClick={togglePostMenu}
          >
            <Ellipsis size={18} />
          </button>
          {postMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid w-max min-w-[13.5rem] max-w-[calc(100vw-1rem)] gap-0.5 rounded-xl bg-popover p-2 text-popover-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)),0_18px_46px_hsl(var(--foreground)/0.12)]" role="menu" aria-label="More actions">
              <button type="button" role="menuitem" className="flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-md border-0 bg-transparent p-2 text-left text-sm font-medium leading-5 text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50" onClick={toggleTheme}>
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                Switch to {theme === "dark" ? "light" : "dark"} mode
              </button>
              <button type="button" role="menuitem" className="flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-md border-0 bg-transparent p-2 text-left text-sm font-medium leading-5 text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50" onClick={openVaultModal}>
                {vaultStatus === "unlocked" ? <LockOpen size={16} /> : <Lock size={16} />}
                {vaultStatus === "locked" ? "Unlock Private Vault" : vaultStatus === "unlocked" ? "Manage Private Vault" : "Enable Private Vault"}
              </button>
              <button type="button" role="menuitem" className="flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-md border-0 bg-transparent p-2 text-left text-sm font-medium leading-5 text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50" onClick={toggleFocusMode} aria-pressed={focusMode}>
                <Focus size={16} />
                {focusMode ? "Exit focus mode" : "Focus mode"}
              </button>
              <div className="my-1 h-px bg-border/70" role="separator" />
              <button type="button" role="menuitem" className="flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-md border-0 bg-transparent p-2 text-left text-sm font-medium leading-5 text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50" onClick={onDownloadHtml} disabled={!editor || !activeSession}>
                <Download size={16} />
                Download as HTML
              </button>
              <button type="button" role="menuitem" className="flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-md border-0 bg-transparent p-2 text-left text-sm font-medium leading-5 text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50" onClick={onDownloadMarkdown} disabled={!activeSession}>
                <FileText size={16} />
                Download as Markdown
              </button>
              <button type="button" role="menuitem" className="flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-md border-0 bg-transparent p-2 text-left text-sm font-medium leading-5 text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50" onClick={onCopyMarkdown} disabled={!activeSession}>
                {copiedPostMarkdown ? <Check size={16} /> : <Copy size={16} />}
                {copiedPostMarkdown ? "Copied Markdown" : "Copy as Markdown"}
              </button>
              <div className="my-1 h-px bg-border/70" role="separator" />
              <button
                type="button"
                role="menuitem"
                className={cn(
                  "flex min-h-9 items-center gap-2.5 whitespace-nowrap rounded-md border-0 bg-transparent p-2 text-left text-sm font-medium leading-5 text-destructive transition-colors hover:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50",
                )}
                onClick={onRequestDeleteActive}
                disabled={chatPending || !activeSession}
              >
                <Trash2 size={16} />
                Delete draft
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className={iconButton(aiSidebarOpen)}
          onClick={toggleAiSidebar}
          aria-label={aiSidebarOpen ? "Hide AI sidebar" : "Show AI sidebar"}
          aria-controls="draftside-ai-rail"
          aria-expanded={aiSidebarOpen}
          {...tooltipProps(aiSidebarOpen ? "Hide AI" : "Local AI", "bottom")}
        >
          {aiSidebarOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
        </button>
      </div>
    </div>
  );
}
