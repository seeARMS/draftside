import type { JSONContent } from "@tiptap/core";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{}\[\]()#+\-.!|>])/g, "\\$1");
}

function plainTextFromNode(node: JSONContent): string {
  if (typeof node.text === "string") return node.text;
  return (node.content ?? []).map(plainTextFromNode).join("");
}

function renderMarkedText(text: string, marks: JSONContent["marks"] = []) {
  const codeMark = marks.find((mark) => mark.type === "code");
  let output = codeMark ? `\`${text.replace(/`/g, "\\`")}\`` : escapeMarkdown(text);

  for (const mark of marks) {
    if (mark.type === "code") continue;
    if (mark.type === "bold") output = `**${output}**`;
    if (mark.type === "italic") output = `*${output}*`;
    if (mark.type === "strike") output = `~~${output}~~`;
    if (mark.type === "link" && typeof mark.attrs?.href === "string") {
      output = `[${output}](${mark.attrs.href})`;
    }
  }

  return output;
}

function renderInlineMarkdown(nodes: JSONContent["content"] = []): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return renderMarkedText(node.text ?? "", node.marks);
      if (node.type === "hardBreak") return "  \n";
      return renderMarkdownNode(node);
    })
    .join("");
}

function renderMarkdownListItem(node: JSONContent, marker: string, depth: number) {
  const indent = "  ".repeat(depth);
  const children = node.content ?? [];
  const rendered = children
    .map((child) => {
      if (child.type === "paragraph") return renderInlineMarkdown(child.content).trim();
      return renderMarkdownNode(child, depth + (child.type?.endsWith("List") ? 1 : 0));
    })
    .filter(Boolean);
  const [first = "", ...rest] = rendered;
  const lines = [`${indent}${marker} ${first}`];

  for (const block of rest) {
    if (block.startsWith(`${indent}  -`) || /^\s+\d+\./.test(block)) {
      lines.push(block);
    } else {
      lines.push(
        block
          .split("\n")
          .map((line) => `${indent}  ${line}`)
          .join("\n"),
      );
    }
  }

  return lines.join("\n");
}

function renderMarkdownNode(node: JSONContent, depth = 0): string {
  const content = node.content ?? [];

  switch (node.type) {
    case "doc":
      return content.map((child) => renderMarkdownNode(child, depth)).filter(Boolean).join("\n\n");
    case "paragraph":
      return renderInlineMarkdown(content).trim();
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level ?? 1), 1), 6);
      return `${"#".repeat(level)} ${renderInlineMarkdown(content).trim()}`.trim();
    }
    case "blockquote": {
      const quote = content.map((child) => renderMarkdownNode(child, depth)).filter(Boolean).join("\n\n");
      return quote
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }
    case "bulletList":
      return content.map((child) => renderMarkdownListItem(child, "-", depth)).join("\n");
    case "orderedList": {
      const start = Number(node.attrs?.start ?? 1);
      return content.map((child, index) => renderMarkdownListItem(child, `${start + index}.`, depth)).join("\n");
    }
    case "listItem":
      return renderMarkdownListItem(node, "-", depth);
    case "taskList":
      return content.map((child) => renderMarkdownNode(child, depth)).join("\n");
    case "taskItem": {
      const checked = node.attrs?.checked ? "x" : " ";
      return renderMarkdownListItem(node, `- [${checked}]`, depth).replace(/^- \[[ x]\] /, `- [${checked}] `);
    }
    case "codeBlock": {
      const language = typeof node.attrs?.language === "string" ? node.attrs.language : "";
      return `\`\`\`${language}\n${plainTextFromNode(node)}\n\`\`\``;
    }
    case "horizontalRule":
      return "---";
    case "hardBreak":
      return "  \n";
    case "text":
      return renderMarkedText(node.text ?? "", node.marks);
    default:
      return renderInlineMarkdown(content).trim();
  }
}

export function documentToMarkdown(doc: JSONContent) {
  return `${renderMarkdownNode(doc).trim()}\n`;
}

export function fileSafeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "draftside";
}

export function downloadTextFile(filename: string, type: string, text: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function writeClipboardText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}
