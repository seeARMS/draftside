import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

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

export const MarkdownPaste = Extension.create({
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
