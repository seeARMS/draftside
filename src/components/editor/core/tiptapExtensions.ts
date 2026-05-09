import { Extension, type Editor } from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import type { CompletionContext, ExpressionPosition, ExpressionTarget, GhostCompletionState } from "./types";
import { countWords } from "./session";
import { stripJsonFences } from "./json";
import { truncateForModel } from "./ai";

const ghostCompletionKey = new PluginKey<GhostCompletionState>("localwriteGhostCompletion");
const markdownPasteKey = new PluginKey("draftsideMarkdownPaste");

function getMarkdownClipboardText(data: DataTransfer) {
  const markdownTypes = ["text/markdown", "text/x-markdown", "text/plain+markdown"];
  for (const type of markdownTypes) {
    if (Array.from(data.types).includes(type)) {
      const value = data.getData(type);
      if (value.trim()) return value;
    }
  }

  return "";
}

function looksLikeMarkdown(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const blockPatterns = [
    /^#{1,6}\s+\S/m,
    /^\s{0,3}(?:[-*+]|\d+[.)])\s+\S/m,
    /^\s{0,3}[-*+]\s+\[[ xX]\]\s+\S/m,
    /^\s{0,3}>\s+\S/m,
    /^\s{0,3}(?:```|~~~)/m,
    /^\s{0,3}(?:---|\*\*\*|___)\s*$/m,
    /^\|.+\|\s*\n\|(?:\s*:?-{3,}:?\s*\|)+/m,
  ];
  const inlinePatterns = [
    /!?\[[^\]\n]+\]\([^) \n]+(?:\s+"[^"\n]+")?\)/,
    /(^|[^*])\*\*[^*\n][\s\S]*?[^*\n]\*\*([^*]|$)/,
    /(^|[^_])__[^_\n][\s\S]*?[^_\n]__([^_]|$)/,
    /`[^`\n]+`/,
    /~~[^~\n]+~~/,
  ];

  return blockPatterns.some((pattern) => pattern.test(trimmed)) || inlinePatterns.some((pattern) => pattern.test(trimmed));
}

function shouldParseClipboardAsMarkdown(text: string, hasMarkdownMime: boolean, html: string) {
  if (hasMarkdownMime) return true;
  if (!text.trim()) return false;
  if (!html.trim()) return true;
  return looksLikeMarkdown(text);
}

const MarkdownPaste = Extension.create({
  name: "markdownPaste",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: markdownPasteKey,
        props: {
          handlePaste: (_view, event) => {
            if (!event.clipboardData || this.editor.isActive("codeBlock")) return false;

            const explicitMarkdown = getMarkdownClipboardText(event.clipboardData);
            const plainText = event.clipboardData.getData("text/plain");
            const html = event.clipboardData.getData("text/html");
            const text = explicitMarkdown || plainText;

            if (!shouldParseClipboardAsMarkdown(text, Boolean(explicitMarkdown), html)) return false;

            event.preventDefault();
            return this.editor.commands.insertContent(text, { contentType: "markdown" });
          },
        },
      }),
    ];
  },
});

const GhostCompletion = Extension.create({
  name: "ghostCompletion",

  addProseMirrorPlugins() {
    return [
      new Plugin<GhostCompletionState>({
        key: ghostCompletionKey,
        state: {
          init: () => ({ pos: null, text: "" }),
          apply(transaction, previous) {
            const meta = transaction.getMeta(ghostCompletionKey) as Partial<GhostCompletionState> & { clear?: boolean } | undefined;

            if (meta?.clear) return { pos: null, text: "" };
            if (typeof meta?.text === "string" && typeof meta.pos === "number") {
              return { pos: meta.pos, text: meta.text };
            }

            if (!previous.text || previous.pos === null) return previous;
            if (!transaction.docChanged && !transaction.selectionSet) return previous;

            const mappedPos = transaction.mapping.map(previous.pos, -1);
            if (!transaction.selection.empty || transaction.selection.from !== mappedPos) {
              return { pos: null, text: "" };
            }

            return { pos: mappedPos, text: previous.text };
          },
        },
        props: {
          decorations(state) {
            const completion = ghostCompletionKey.getState(state);
            if (!completion?.text || completion.pos === null) return DecorationSet.empty;

            return DecorationSet.create(state.doc, [
              Decoration.widget(
                completion.pos,
                () => {
                  const ghost = document.createElement("span");
                  ghost.className = "ghost-completion";
                  ghost.textContent = completion.text;
                  ghost.setAttribute("aria-hidden", "true");
                  return ghost;
                },
                {
                  key: `${completion.pos}:${completion.text}`,
                  side: 1,
                },
              ),
            ]);
          },
        },
      }),
    ];
  },
});

function getEditorGhostCompletion(editor: Editor) {
  return ghostCompletionKey.getState(editor.state) ?? { pos: null, text: "" };
}

function setEditorGhostCompletion(editor: Editor, text: string, pos: number) {
  editor.view.dispatch(editor.state.tr.setMeta(ghostCompletionKey, { text, pos }));
}

function clearEditorGhostCompletion(editor: Editor) {
  const completion = getEditorGhostCompletion(editor);
  if (!completion.text) return;
  editor.view.dispatch(editor.state.tr.setMeta(ghostCompletionKey, { clear: true }));
}

function completionFingerprint(editor: Editor, pos: number) {
  return editor.state.doc.textBetween(Math.max(0, pos - 180), pos, "\n", "\n");
}

function getCompletionContext(editor: Editor): CompletionContext | null {
  const { selection } = editor.state;
  if (!selection.empty) return null;
  if (editor.isActive("codeBlock")) return null;

  const pos = selection.from;
  const before = editor.state.doc.textBetween(Math.max(0, pos - 1200), pos, "\n", "\n");
  const compactBefore = before.replace(/\s+/g, " ");
  const trimmed = compactBefore.trimEnd();

  if (trimmed.length < 12 || countWords(trimmed) < 3) return null;
  if (/[.!?]$/.test(trimmed)) return null;

  const fragment = trimmed.split(/(?<=[.!?])\s+/u).pop()?.trim() ?? trimmed;
  if (fragment.length < 8 || countWords(fragment) < 2) return null;
  if (/^[\W_]+$/u.test(fragment)) return null;

  return {
    before: truncateForModel(compactBefore, 1800),
    fingerprint: completionFingerprint(editor, pos),
    fragment,
    pos,
  };
}

function cleanGhostCompletion(input: string, context: CompletionContext) {
  let completion = stripJsonFences(input)
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!completion) return "";

  const fragment = context.fragment.trim();
  if (completion.toLocaleLowerCase().startsWith(fragment.toLocaleLowerCase())) {
    completion = completion.slice(fragment.length).trimStart();
  }

  completion = completion.replace(/^[….\s]+/, "").trim();
  const sentenceEnd = completion.search(/[.!?](?:\s|$)/);
  if (sentenceEnd > 0) completion = completion.slice(0, sentenceEnd + 1).trim();

  const words = completion.split(/\s+/).filter(Boolean);
  if (words.length > 12) completion = words.slice(0, 12).join(" ");
  if (!completion || completion === fragment) return "";

  const previousCharacter = context.fingerprint.trimEnd().slice(-1);
  if (completion && !/^[,.;:!?)]/.test(completion) && previousCharacter && !/[\s([{/"'“‘-]/.test(previousCharacter)) {
    completion = ` ${completion}`;
  }

  return completion.length > 96 ? completion.slice(0, 96).replace(/\s+\S*$/, "") : completion;
}

function expressionPopoverPosition(rect: Pick<DOMRect, "bottom" | "height" | "left" | "top" | "width">): ExpressionPosition {
  const width = Math.min(320, Math.max(240, window.innerWidth - 24));
  const halfWidth = width / 2;
  const left = Math.round(Math.min(Math.max(rect.left + rect.width / 2, halfWidth + 12), window.innerWidth - halfWidth - 12));
  const below = rect.bottom + 10;
  const top = below + 236 > window.innerHeight ? Math.max(12, rect.top - 246) : below;

  return { left, top: Math.round(top) };
}

function expressionTargetFromSelection(editor: Editor): ExpressionTarget | null {
  const { from, to, empty } = editor.state.selection;
  if (empty) return null;

  const targetText = editor.state.doc.textBetween(from, to, " ").replace(/\s+/g, " ").trim();
  if (!targetText || targetText.length > 160 || countWords(targetText) > 12) return null;

  const selection = window.getSelection();
  let rect: Pick<DOMRect, "bottom" | "height" | "left" | "top" | "width"> | null = null;

  if (selection?.rangeCount) {
    const selectedRect = selection.getRangeAt(0).getBoundingClientRect();
    if (selectedRect.width || selectedRect.height) rect = selectedRect;
  }

  if (!rect) {
    const start = editor.view.coordsAtPos(from);
    const end = editor.view.coordsAtPos(to);
    const left = Math.min(start.left, end.left);
    const right = Math.max(start.right, end.right);
    const top = Math.min(start.top, end.top);
    const bottom = Math.max(start.bottom, end.bottom);
    rect = { bottom, height: bottom - top, left, top, width: right - left };
  }

  return {
    from,
    to,
    text: targetText,
    position: expressionPopoverPosition(rect),
  };
}

function createEditorExtensions() {
  return [
    StarterKit.configure({
      codeBlock: {
        HTMLAttributes: {
          spellcheck: "false",
        },
      },
    }),
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === "heading" ? "Untitled" : "Start where the thought is sharp..."),
    }),
    CharacterCount.configure({ limit: 50000 }),
    Typography,
    Underline,
    Highlight.configure({ multicolor: false }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown.configure({
      indentation: { style: "space", size: 2 },
    }),
    MarkdownPaste,
    GhostCompletion,
  ];
}

export {
  cleanGhostCompletion,
  clearEditorGhostCompletion,
  createEditorExtensions,
  expressionTargetFromSelection,
  getCompletionContext,
  getEditorGhostCompletion,
  ghostCompletionKey,
  setEditorGhostCompletion,
};
