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
    <div className="editor-toolbar" aria-label="Editor toolbar">
      <div className="toolbar-group">
        {button("Undo", () => editor?.chain().focus().undo().run(), { disabled: !editor?.can().undo() }, <Undo2 size={17} />)}
        {button("Redo", () => editor?.chain().focus().redo().run(), { disabled: !editor?.can().redo() }, <Redo2 size={17} />)}
      </div>

      <div className="toolbar-group">
        {button("Bold", () => editor?.chain().focus().toggleBold().run(), { active: editor?.isActive("bold") }, <Bold size={17} />)}
        {button("Italic", () => editor?.chain().focus().toggleItalic().run(), { active: editor?.isActive("italic") }, <Italic size={17} />)}
        {button("Underline", () => editor?.chain().focus().toggleUnderline().run(), { active: editor?.isActive("underline") }, <UnderlineIcon size={17} />)}
        {button("Highlight", () => editor?.chain().focus().toggleHighlight().run(), { active: editor?.isActive("highlight") }, <Highlighter size={17} />)}
      </div>

      <div className="toolbar-group">
        {button("Heading 1", () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), { active: editor?.isActive("heading", { level: 1 }) }, <Heading1 size={17} />)}
        {button("Heading 2", () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), { active: editor?.isActive("heading", { level: 2 }) }, <Heading2 size={17} />)}
        {button("Bullet list", () => editor?.chain().focus().toggleBulletList().run(), { active: editor?.isActive("bulletList") }, <List size={17} />)}
        {button("Ordered list", () => editor?.chain().focus().toggleOrderedList().run(), { active: editor?.isActive("orderedList") }, <ListOrdered size={17} />)}
        {button("Tasks", () => editor?.chain().focus().toggleTaskList().run(), { active: editor?.isActive("taskList") }, <ListChecks size={17} />)}
        {button("Quote", () => editor?.chain().focus().toggleBlockquote().run(), { active: editor?.isActive("blockquote") }, <Quote size={17} />)}
        {button("Code", () => editor?.chain().focus().toggleCodeBlock().run(), { active: editor?.isActive("codeBlock") }, <Code2 size={17} />)}
      </div>

      <div className="toolbar-spacer" />

      <button
        type="button"
        className={recordingTarget === "editor" ? "icon-button is-active is-recording" : "icon-button"}
        onClick={() => void toggleRecording("editor")}
        disabled={vaultLocked || !capabilities.prompt || aiAction !== null || (recordingTarget !== null && recordingTarget !== "editor")}
        aria-label={recordingTarget === "editor" ? "Stop dictation" : "Dictate into editor"}
        {...tooltipProps(recordingTarget === "editor" ? "Stop dictation" : "Dictate into editor", "bottom")}
      >
        {recordingTarget === "editor" ? <MicOff size={17} /> : <Mic size={17} />}
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        {...tooltipProps(`Switch to ${theme === "dark" ? "light" : "dark"} mode`, "bottom")}
      >
        {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <button
        type="button"
        className={vaultEnabled ? "icon-button vault-button is-active" : "icon-button vault-button"}
        onClick={openVaultModal}
        aria-label={vaultStatus === "locked" ? "Unlock Private Vault" : vaultStatus === "unlocked" ? "Manage Private Vault" : "Enable Private Vault"}
        aria-pressed={vaultEnabled}
        {...tooltipProps(vaultStatus === "locked" ? "Unlock Private Vault" : vaultStatus === "unlocked" ? "Private Vault enabled" : "Private Vault", "bottom")}
      >
        {vaultStatus === "unlocked" ? <LockOpen size={17} /> : <Lock size={17} />}
      </button>
      <button
        type="button"
        className={focusMode ? "icon-button is-active" : "icon-button"}
        onClick={toggleFocusMode}
        aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
        aria-pressed={focusMode}
        {...tooltipProps(focusMode ? "Exit focus mode" : "Focus mode", "bottom")}
      >
        <Focus size={17} />
      </button>
      <button
        type="button"
        className={aiSidebarOpen ? "icon-button is-active" : "icon-button"}
        onClick={toggleAiSidebar}
        aria-label={aiSidebarOpen ? "Hide AI sidebar" : "Show AI sidebar"}
        aria-controls="draftside-ai-rail"
        aria-expanded={aiSidebarOpen}
        {...tooltipProps(aiSidebarOpen ? "Hide AI sidebar" : "Show AI sidebar", "bottom")}
      >
        {aiSidebarOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
      </button>
      <div className="post-menu" ref={postMenuRef}>
        <button
          type="button"
          className="post-menu-trigger"
          aria-label="Post actions"
          aria-haspopup="menu"
          aria-expanded={postMenuOpen}
          onClick={togglePostMenu}
        >
          <Ellipsis size={18} />
        </button>
        {postMenuOpen ? (
          <div className="post-menu-content" role="menu" aria-label="Post actions">
            <button type="button" role="menuitem" className="post-menu-item" onClick={onDownloadHtml} disabled={!editor || !activeSession}>
              <Download size={16} />
              Download as HTML
            </button>
            <button type="button" role="menuitem" className="post-menu-item" onClick={onDownloadMarkdown} disabled={!activeSession}>
              <FileText size={16} />
              Download as Markdown
            </button>
            <button type="button" role="menuitem" className="post-menu-item" onClick={onCopyMarkdown} disabled={!activeSession}>
              {copiedPostMarkdown ? <Check size={16} /> : <Copy size={16} />}
              {copiedPostMarkdown ? "Copied Markdown" : "Copy as Markdown"}
            </button>
            <button
              type="button"
              role="menuitem"
              className="post-menu-item is-danger"
              onClick={onRequestDeleteActive}
              disabled={chatPending || !activeSession}
            >
              <Trash2 size={16} />
              Delete draft
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
