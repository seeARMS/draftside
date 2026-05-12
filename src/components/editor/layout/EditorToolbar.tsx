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
  Type,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import type { RefObject } from "react";
import type { Editor } from "@tiptap/core";
import type { AiAction, Capabilities, EditorFont, RecordingTarget, ThemeMode, VaultStatus, WriteSession } from "../../../lib/types";
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
  editorFont: EditorFont;
  setEditorFont: (font: EditorFont) => void;
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
    editorFont,
    setEditorFont,
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
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid w-max min-w-[14rem] max-w-[calc(100vw-1rem)] gap-0.5 rounded-xl bg-popover p-2 text-popover-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)),0_18px_46px_hsl(var(--shadow-color)/0.12)]" role="menu" aria-label="More actions">
              <div className="px-2 pb-1 pt-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground" role="presentation">
                Appearance
              </div>
              <FontPicker editorFont={editorFont} setEditorFont={setEditorFont} />
              <div className="my-1 h-px bg-border/70" role="separator" />
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

const FONT_OPTIONS: Array<{ value: EditorFont; label: string; category: string; className: string }> = [
  { value: "geist", label: "Geist", category: "Sans", className: "font-sans" },
  { value: "inter", label: "Inter", category: "Sans", className: "editor-font-inter-preview" },
  { value: "helvetica", label: "Helvetica", category: "Sans", className: "editor-font-helvetica-preview" },
  { value: "open-sans", label: "Open Sans", category: "Sans", className: "editor-font-open-sans-preview" },
  { value: "charter", label: "Charter", category: "Serif", className: "editor-font-charter-preview" },
  { value: "georgia", label: "Georgia", category: "Serif", className: "editor-font-georgia-preview" },
  { value: "dm-mono", label: "DM Mono", category: "Mono", className: "editor-font-dm-mono-preview" },
  { value: "geist-mono", label: "Geist Mono", category: "Mono", className: "editor-font-geist-mono-preview" },
];

function FontPicker({
  editorFont,
  setEditorFont,
}: {
  editorFont: EditorFont;
  setEditorFont: (font: EditorFont) => void;
}) {
  const current = FONT_OPTIONS.find((option) => option.value === editorFont) ?? FONT_OPTIONS[0];

  return (
    <div className="group/font relative">
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md border-0 bg-transparent p-2 text-left text-sm font-medium leading-5 text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
      >
        <span className="inline-flex items-center gap-2.5">
          <Type size={16} />
          Font
        </span>
        <span className={cn("text-[0.8125rem] font-normal text-muted-foreground", current.className)}>{current.label}</span>
      </button>
      <div
        className="pointer-events-none invisible absolute right-full top-0 z-[60] -mt-2 mr-1 grid min-w-[12rem] gap-0.5 rounded-xl bg-popover p-2 text-popover-foreground opacity-0 shadow-[inset_0_0_0_1px_hsl(var(--border)),0_18px_46px_hsl(var(--shadow-color)/0.12)] transition-opacity duration-100 group-hover/font:pointer-events-auto group-hover/font:visible group-hover/font:opacity-100 group-focus-within/font:pointer-events-auto group-focus-within/font:visible group-focus-within/font:opacity-100 max-[640px]:right-auto max-[640px]:left-0 max-[640px]:top-full max-[640px]:mt-1 max-[640px]:mr-0"
        role="menu"
        aria-label="Editor font"
      >
        {FONT_OPTIONS.map((option) => {
          const isActive = option.value === editorFont;
          return (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={isActive}
              onClick={() => setEditorFont(option.value)}
              className={cn(
                "grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-2.5 rounded-md border-0 bg-transparent p-2 text-left text-sm leading-5 text-foreground transition-colors hover:bg-muted",
                isActive && "bg-muted",
              )}
            >
              <span className="inline-flex size-4 items-center justify-center text-foreground" aria-hidden="true">
                {isActive ? <Check size={14} /> : null}
              </span>
              <span className="grid gap-0.5">
                <span className={cn("text-[0.9375rem] font-medium leading-5", option.className)}>{option.label}</span>
                <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">{option.category}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
