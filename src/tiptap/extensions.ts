import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { MarkdownPaste } from "./clipboardMarkdown";
import { GhostCompletion } from "./ghostCompletion";

export function createEditorExtensions() {
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
