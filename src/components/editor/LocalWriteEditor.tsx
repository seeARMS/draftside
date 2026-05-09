import { Extension, type Editor, type JSONContent } from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { EditorContent, useEditor } from "@tiptap/react";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import {
  ArrowUp,
  Bold,
  Brain,
  Check,
  Code2,
  Copy,
  Download,
  Ellipsis,
  FileText,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  Languages,
  List,
  ListChecks,
  ListOrdered,
  LoaderCircle,
  MessageSquare,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Quote,
  Redo2,
  Save,
  Sparkles,
  Sun,
  Tags,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Wand2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DB_NAME = "localwrite";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";
const ACTIVE_SESSION_KEY = "localwrite.activeSessionId";
const THEME_KEY = "draftside.theme";
const MAX_MODEL_CHARS = 6500;

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const LANGUAGE_MODEL_OPTIONS: LanguageModelCreateCoreOptions = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

const CHAT_RESPONSE_CONSTRAINT: Record<string, unknown> = {
  type: "object",
  properties: {
    reply: { type: "string" },
    draftUpdate: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            summary: { type: "string" },
            text: { type: "string" },
          },
          required: ["summary", "text"],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ["reply", "draftUpdate"],
  additionalProperties: false,
};

type SaveState = "idle" | "saving" | "saved" | "error";
type AiStatus = Availability | "idle" | "checking" | "creating" | "unsupported" | "error";
type AiAction = "prepare" | "classify" | "think" | "continue" | "rewrite" | "express" | "chat" | null;
type AiTab = "chat" | "tools";
type ThemeMode = "light" | "dark";
type ChatRole = "user" | "assistant";

interface DraftUpdate {
  text: string;
  summary: string;
}

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  pending?: boolean;
  draftUpdate?: DraftUpdate;
}

interface Classification {
  form: string;
  intent: string;
  stance: string;
  friction: string;
  nextMove: string;
  confidence: number;
  tags: string[];
}

interface WriteSession {
  id: string;
  title: string;
  content: JSONContent;
  plainText: string;
  createdAt: number;
  updatedAt: number;
  wordCount: number;
  classification?: Classification;
  chatMessages?: ChatMessage[];
}

interface Capabilities {
  prompt: boolean;
  rewriter: boolean;
  writer: boolean;
  detector: boolean;
}

interface ModelRuntimeInfo {
  loading: boolean;
  availability?: Availability | "unsupported" | "error";
  params?: Partial<LanguageModelParams>;
  paramsError?: string;
  contextUsage?: number;
  contextWindow?: number;
  temperature?: number;
  topK?: number;
  checkedAt?: number;
}

interface OfflineRuntimeInfo {
  loading: boolean;
  serviceWorkerSupported: boolean;
  controlled: boolean;
  registrationState: string;
  cacheCount?: number;
  cachedRequests?: number;
  cachedBytes?: number;
  storageUsage?: number;
  storageQuota?: number;
  checkedAt?: number;
}

interface SelectionSnapshot {
  empty: boolean;
  text: string;
}

interface ExpressionPosition {
  left: number;
  top: number;
}

interface ExpressionTarget {
  from: number;
  to: number;
  text: string;
  position: ExpressionPosition;
}

interface ExpressionOption {
  text: string;
  note: string;
}

interface GhostCompletionState {
  pos: number | null;
  text: string;
}

interface CompletionContext {
  before: string;
  fingerprint: string;
  fragment: string;
  pos: number;
}

const ghostCompletionKey = new PluginKey<GhostCompletionState>("localwriteGhostCompletion");
const markdownPasteKey = new PluginKey("draftsideMarkdownPaste");

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const store = db.createObjectStore(SESSION_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open Draftside storage."));
  });

  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

async function getSessions() {
  const db = await openDb();
  const tx = db.transaction(SESSION_STORE, "readonly");
  const sessions = await requestToPromise<WriteSession[]>(tx.objectStore(SESSION_STORE).getAll());
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function putSession(session: WriteSession) {
  const db = await openDb();
  const tx = db.transaction(SESSION_STORE, "readwrite");
  await requestToPromise(tx.objectStore(SESSION_STORE).put(session));
}

async function removeSession(id: string) {
  const db = await openDb();
  const tx = db.transaction(SESSION_STORE, "readwrite");
  await requestToPromise(tx.objectStore(SESSION_STORE).delete(id));
}

function createBlankSession(): WriteSession {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "Untitled",
    content: EMPTY_DOC,
    plainText: "",
    createdAt: now,
    updatedAt: now,
    wordCount: 0,
  };
}

function deriveTitle(text: string) {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return "Untitled";
  return firstLine.replace(/^#+\s*/, "").slice(0, 72);
}

function countWords(text: string) {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

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

function escapeHtml(value: string) {
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

function documentToMarkdown(doc: JSONContent) {
  return `${renderMarkdownNode(doc).trim()}\n`;
}

function fileSafeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "draftside";
}

function downloadTextFile(filename: string, type: string, text: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function writeClipboardText(text: string) {
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

function stripJsonFences(input: string) {
  return input
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractFirstJsonValue(input: string, open: "{" | "[", close: "}" | "]") {
  const text = stripJsonFences(input);
  const start = text.indexOf(open);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === open) depth += 1;
    if (character === close) depth -= 1;

    if (depth === 0) return text.slice(start, index + 1);
  }

  return null;
}

function extractJsonArray(input: string) {
  return extractFirstJsonValue(input, "[", "]");
}

function cleanExpressionText(value: string) {
  return value
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeExpressionOptions(raw: unknown, original: string): ExpressionOption[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const originalKey = original.trim().toLocaleLowerCase();
  const options: ExpressionOption[] = [];

  for (const item of raw) {
    const text =
      typeof item === "string"
        ? cleanExpressionText(item)
        : item && typeof item === "object" && "text" in item && typeof item.text === "string"
          ? cleanExpressionText(item.text)
          : "";
    const note =
      item && typeof item === "object" && "note" in item && typeof item.note === "string"
        ? cleanExpressionText(item.note).slice(0, 44)
        : "";
    const key = text.toLocaleLowerCase();

    if (!text || key === originalKey || seen.has(key) || text.length > 96) continue;
    seen.add(key);
    options.push({ text, note });
    if (options.length === 6) break;
  }

  return options;
}

function parseExpressionOptions(input: string, original: string) {
  const json = extractJsonArray(input);
  if (json) {
    try {
      return normalizeExpressionOptions(JSON.parse(json), original);
    } catch {
      // Fall through to line parsing.
    }
  }

  const objectLineOptions = input
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.startsWith("{") && line.endsWith("}"))
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });

  if (objectLineOptions.length) {
    return normalizeExpressionOptions(objectLineOptions, original);
  }

  return normalizeExpressionOptions(
    input
      .replace(/```(?:json)?/gi, "\n")
      .replace(/```/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => !/^[\[\]{},\s]+$/.test(line))
      .filter((line) => !/"text"\s*:/.test(line))
      .filter(Boolean),
    original,
  );
}

function formatUpdatedAt(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function truncateForModel(text: string, limit = MAX_MODEL_CHARS) {
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.floor(limit * 0.55))}\n\n[...]\n\n${text.slice(-Math.floor(limit * 0.4))}`;
}

function extractJsonObject(input: string) {
  return extractFirstJsonValue(input, "{", "}");
}

function normalizeDraftUpdate(raw: unknown): DraftUpdate | null {
  const data = raw && typeof raw === "object" ? (raw as { text?: unknown; markdown?: unknown; summary?: unknown }) : null;
  if (!data) return null;

  const text = typeof data.text === "string" ? data.text.trim() : typeof data.markdown === "string" ? data.markdown.trim() : "";
  if (!text) return null;

  const summary = typeof data.summary === "string" && data.summary.trim() ? data.summary.trim().slice(0, 120) : "Updated the draft";
  return { text, summary };
}

function parseChatResponse(input: string): { reply: string; draftUpdate: DraftUpdate | null } {
  const json = extractJsonObject(input);

  if (json) {
    try {
      const data = JSON.parse(json) as { reply?: unknown; draftUpdate?: unknown; update?: unknown };
      const reply = typeof data.reply === "string" ? data.reply.trim() : "";
      return {
        reply: reply || "Done.",
        draftUpdate: normalizeDraftUpdate(data.draftUpdate ?? data.update ?? null),
      };
    } catch {
      // Fall through to plain text so the chat never exposes JSON parser errors.
    }
  }

  return {
    reply: stripJsonFences(input).trim() || "I could not produce a local response.",
    draftUpdate: null,
  };
}

function formatChatHistory(history: ChatMessage[]) {
  return history
    .filter((message) => !message.pending && message.content.trim())
    .slice(-8)
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content.trim()}`)
    .join("\n\n");
}

function buildChatPrompt(userPrompt: string, draftText: string, history: ChatMessage[]) {
  const conversation = formatChatHistory(history);

  return `You are Draftside's private local chat model inside an offline writing editor.
You control two surfaces:
1. The chat reply.
2. The main editor draft through draftUpdate.

Use the recent conversation as state, not as disposable context. If the user previously asked for draft work and you asked for missing details, the user's next answer should normally complete that request and update the main editor draft. Do not merely acknowledge a usable brief.

Set draftUpdate to a non-null object when the latest message, interpreted in conversation context, asks you to create or modify the editor text. If the message gives enough information, write the draft instead of asking for another confirmation.
Set draftUpdate to null when the user is only chatting, asking a general question, or exploring ideas without asking the editor text to change.
If a requested editor change is genuinely underspecified, ask exactly one concise clarifying question and keep draftUpdate null.
Interpret typos and casual shorthand normally. A short answer can be enough if it supplies the missing detail you just asked for.

When draftUpdate is non-null:
- draftUpdate.text is the complete replacement draft, formatted as Markdown when useful.
- draftUpdate.summary is a short phrase describing the editor change.
- reply is a brief confirmation or orientation, not a copy of the full draft.

Before returning, privately check the result. If draftUpdate is null, the reply must either answer a non-editor question or ask for one truly missing detail; it must not be a simple acknowledgement of an actionable writing brief.

Return exactly one valid compact JSON object and nothing else. Do not use markdown fences.
Use one of these shapes:
{"reply":"short conversational response","draftUpdate":null}
{"reply":"short conversational response","draftUpdate":{"summary":"what changed","text":"full replacement draft text"}}

Current draft:
"""${draftText || "(empty)"}"""

Recent conversation:
${conversation || "(none)"}

Latest user message:
"""${userPrompt}"""`;
}

async function promptChatModel(model: LanguageModel, prompt: string) {
  const messages: LanguageModelPrompt = [{ role: "user", content: prompt }];

  try {
    return await model.prompt(messages, {
      responseConstraint: CHAT_RESPONSE_CONSTRAINT,
      omitResponseConstraintInput: false,
    });
  } catch (errorWithConstraint) {
    try {
      return await model.prompt(messages);
    } catch {
      throw errorWithConstraint;
    }
  }
}

function looseClassificationField(input: string, field: keyof Classification) {
  const match = input.match(new RegExp(`["']?${field}["']?\\s*[:=]\\s*["']?([^"',}\\]\\n]+)`, "i"));
  return match?.[1]?.trim();
}

function looseClassificationTags(input: string) {
  const tags = input.match(/["']?tags["']?\s*[:=]\s*\[([^\]]*)\]/i)?.[1];
  if (!tags) return [];

  return tags
    .split(",")
    .map((tag) => tag.replace(/^["'\s]+|["'\s]+$/g, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function looseClassification(input: string): Classification {
  const confidence = Number(looseClassificationField(input, "confidence"));

  return normalizeClassification({
    form: looseClassificationField(input, "form"),
    intent: looseClassificationField(input, "intent"),
    stance: looseClassificationField(input, "stance"),
    friction: looseClassificationField(input, "friction"),
    nextMove: looseClassificationField(input, "nextMove"),
    confidence: Number.isFinite(confidence) ? confidence : undefined,
    tags: looseClassificationTags(input),
  });
}

function parseClassification(input: string) {
  const json = extractJsonObject(input);
  if (json) {
    try {
      return normalizeClassification(JSON.parse(json));
    } catch {
      // Fall through to a loose parse so local model formatting errors do not surface to the UI.
    }
  }

  return looseClassification(input);
}

function normalizeClassification(raw: unknown): Classification {
  const data = raw && typeof raw === "object" ? (raw as Partial<Classification>) : {};

  return {
    form: typeof data.form === "string" ? data.form : "draft",
    intent: typeof data.intent === "string" ? data.intent : "unclear",
    stance: typeof data.stance === "string" ? data.stance : "developing",
    friction: typeof data.friction === "string" ? data.friction : "needs more context",
    nextMove: typeof data.nextMove === "string" ? data.nextMove : "write the next concrete sentence",
    confidence: typeof data.confidence === "number" ? Math.max(0, Math.min(1, data.confidence)) : 0.5,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 5) : [],
  };
}

function statusLabel(status: AiStatus) {
  switch (status) {
    case "available":
      return "ready";
    case "downloadable":
      return "download";
    case "downloading":
      return "downloading";
    case "unavailable":
      return "unavailable";
    case "unsupported":
      return "unsupported";
    case "checking":
      return "checking";
    case "creating":
      return "starting";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

function formatNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat().format(value) : "unknown";
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "unknown";
}

function formatBytes(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "unknown";
  if (value < 1024) return `${value} B`;

  const units = ["KB", "MB", "GB"];
  let amount = value / 1024;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  return `${amount >= 10 ? Math.round(amount) : amount.toFixed(1)} ${units[unitIndex]}`;
}

function formatModelInfoTime(value: number | undefined) {
  if (!value) return "not checked";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function mergeStreamChunk(previous: string, chunk: string) {
  if (!chunk) return previous;
  if (chunk.startsWith(previous)) return chunk;
  return `${previous}${chunk}`;
}

async function readTextStream(stream: ReadableStream<string>, onText: (text: string) => void) {
  const reader = stream.getReader();
  let result = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    result = mergeStreamChunk(result, value ?? "");
    onText(result);
  }

  return result;
}

function capabilityClass(enabled: boolean) {
  return enabled ? "capability-pill is-on" : "capability-pill";
}

async function getDraftsideCacheStats() {
  if (!("caches" in window)) return {};

  const cacheNames = (await caches.keys()).filter((key) => key.startsWith("draftside-"));
  let cachedRequests = 0;
  let cachedBytes = 0;

  await Promise.all(
    cacheNames.map(async (cacheName) => {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      cachedRequests += requests.length;

      await Promise.all(
        requests.map(async (request) => {
          const response = await cache.match(request);
          if (!response) return;

          try {
            cachedBytes += (await response.clone().blob()).size;
          } catch {
            // Some opaque or partial responses may not expose a body size.
          }
        }),
      );
    }),
  );

  return {
    cacheCount: cacheNames.length,
    cachedRequests,
    cachedBytes,
  };
}

export default function LocalWriteEditor() {
  const [sessions, setSessions] = useState<WriteSession[]>([]);
  const [activeSession, setActiveSession] = useState<WriteSession | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      // Ignore storage restrictions; theme can still follow the system setting.
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [online, setOnline] = useState(true);
  const [selection, setSelection] = useState<SelectionSnapshot>({ empty: true, text: "" });
  const [capabilities, setCapabilities] = useState<Capabilities>({
    prompt: false,
    rewriter: false,
    writer: false,
    detector: false,
  });
  const [modelInfo, setModelInfo] = useState<ModelRuntimeInfo>({ loading: false });
  const [offlineInfo, setOfflineInfo] = useState<OfflineRuntimeInfo>({
    loading: false,
    serviceWorkerSupported: false,
    controlled: false,
    registrationState: "not checked",
  });
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiProgress, setAiProgress] = useState<number | null>(null);
  const [aiAction, setAiAction] = useState<AiAction>(null);
  const [aiOutput, setAiOutput] = useState("");
  const [aiError, setAiError] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [copiedPostMarkdown, setCopiedPostMarkdown] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [aiTab, setAiTab] = useState<AiTab>("chat");
  const [expressionTarget, setExpressionTarget] = useState<ExpressionTarget | null>(null);
  const [expressionOptions, setExpressionOptions] = useState<ExpressionOption[]>([]);
  const [expressionLoading, setExpressionLoading] = useState(false);
  const [expressionError, setExpressionError] = useState("");
  const [completionTick, setCompletionTick] = useState(0);
  const [ghostCompletionText, setGhostCompletionText] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState("");

  const saveTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const completionRequestRef = useRef(0);
  const activeSessionRef = useRef<WriteSession | null>(null);
  const languageModelRef = useRef<LanguageModel | null>(null);
  const creatingModelRef = useRef<Promise<LanguageModel> | null>(null);
  const autoPrepareStartedRef = useRef(false);
  const skipUpdateRef = useRef(false);
  const postMenuRef = useRef<HTMLDivElement | null>(null);
  const expressionPopoverRef = useRef<HTMLDivElement | null>(null);
  const expressionRequestRef = useRef(0);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  const extensions = useMemo(
    () => [
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
    ],
    [],
  );

  const persistEditor = useCallback(async (editorInstance: NonNullable<ReturnType<typeof useEditor>>) => {
    const current = activeSessionRef.current;
    if (!current) return;

    const plainText = editorInstance.getText();
    const now = Date.now();
    const next: WriteSession = {
      ...current,
      title: deriveTitle(plainText),
      content: editorInstance.getJSON(),
      plainText,
      updatedAt: now,
      wordCount: countWords(plainText),
    };

    activeSessionRef.current = next;
    setActiveSession(next);
    setSessions((previous) => [next, ...previous.filter((session) => session.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt));
    setSaveState("saving");

    try {
      await putSession(next);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, []);

  const scheduleSave = useCallback(
    (editorInstance: NonNullable<ReturnType<typeof useEditor>>) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      setSaveState("saving");
      saveTimerRef.current = window.setTimeout(() => {
        void persistEditor(editorInstance);
      }, 420);
    },
    [persistEditor],
  );

  const persistChatMessages = useCallback((messages: ChatMessage[]) => {
    const current = activeSessionRef.current;
    if (!current) return;

    const next: WriteSession = {
      ...current,
      chatMessages: messages,
      updatedAt: Date.now(),
    };

    activeSessionRef.current = next;
    setActiveSession(next);
    setSessions((previous) => [next, ...previous.filter((session) => session.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt));
    void putSession(next).catch(() => setSaveState("error"));
  }, []);

  const editor = useEditor({
    extensions,
    content: EMPTY_DOC,
    autofocus: "end",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "localwrite-prosemirror",
        spellcheck: "true",
        "aria-label": "Draftside editor",
      },
      handleKeyDown: (view, event) => {
        if (event.key === "Tab") {
          const completion = ghostCompletionKey.getState(view.state);
          if (completion?.text && completion.pos !== null) {
            event.preventDefault();
            view.dispatch(view.state.tr.insertText(completion.text, completion.pos, completion.pos).setMeta(ghostCompletionKey, { clear: true }));
            setGhostCompletionText("");
            return true;
          }
        }

        if (event.key === "Escape" && ghostCompletionKey.getState(view.state)?.text) {
          view.dispatch(view.state.tr.setMeta(ghostCompletionKey, { clear: true }));
          setGhostCompletionText("");
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor: editorInstance }) => {
      if (skipUpdateRef.current) return;
      setExpressionTarget(null);
      clearEditorGhostCompletion(editorInstance);
      setGhostCompletionText("");
      completionRequestRef.current += 1;
      setCompletionTick((tick) => tick + 1);
      scheduleSave(editorInstance);
    },
  });

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Non-persistent theme is acceptable when storage is unavailable.
    }
  }, [theme]);

  useEffect(() => {
    setOnline(navigator.onLine);

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function hydrateSessions() {
      try {
        const stored = await getSessions();
        let nextSessions = stored;

        if (!nextSessions.length) {
          const blank = createBlankSession();
          await putSession(blank);
          nextSessions = [blank];
        }

        const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
        const selected = nextSessions.find((session) => session.id === activeId) ?? nextSessions[0];

        if (!mounted) return;
        setSessions(nextSessions);
        setActiveSession(selected);
        activeSessionRef.current = selected;
        localStorage.setItem(ACTIVE_SESSION_KEY, selected.id);
      } catch {
        const blank = createBlankSession();
        if (!mounted) return;
        setSessions([blank]);
        setActiveSession(blank);
        activeSessionRef.current = blank;
        setSaveState("error");
      }
    }

    void hydrateSessions();

    if ("storage" in navigator && "persist" in navigator.storage) {
      navigator.storage.persist().then(setStoragePersisted).catch(() => setStoragePersisted(false));
    }

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!editor || !activeSession) return;

    localStorage.setItem(ACTIVE_SESSION_KEY, activeSession.id);
    skipUpdateRef.current = true;
    editor.commands.setContent(activeSession.content);
    window.queueMicrotask(() => {
      skipUpdateRef.current = false;
      editor.commands.focus("end");
      setSelection({ empty: true, text: "" });
      setExpressionTarget(null);
    });
  }, [activeSession?.id, editor]);

  useEffect(() => {
    const element = chatMessagesRef.current;
    if (!element || aiTab !== "chat") return;

    element.scrollTo({
      top: element.scrollHeight,
      behavior: "smooth",
    });
  }, [activeSession?.id, activeSession?.chatMessages, aiAction, aiTab]);

  useEffect(() => {
    const textarea = chatInputRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [chatInput]);

  useEffect(() => {
    if (!aiSidebarOpen || aiTab !== "chat") return;

    const focusTimer = window.setTimeout(() => {
      chatInputRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(focusTimer);
  }, [aiSidebarOpen, aiTab]);

  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      const { from, to, empty } = editor.state.selection;
      const text = empty ? "" : editor.state.doc.textBetween(from, to, "\n").trim();
      setSelection({ empty, text });
    };

    const clearCompletionForSelection = () => {
      updateSelection();
      clearEditorGhostCompletion(editor);
      setGhostCompletionText("");
      completionRequestRef.current += 1;
    };

    editor.on("selectionUpdate", clearCompletionForSelection);
    editor.on("transaction", updateSelection);
    updateSelection();

    return () => {
      editor.off("selectionUpdate", clearCompletionForSelection);
      editor.off("transaction", updateSelection);
    };
  }, [editor]);

  useEffect(() => {
    let mounted = true;

    async function detectCapabilities() {
      const next = {
        prompt: "LanguageModel" in globalThis,
        rewriter: "Rewriter" in globalThis,
        writer: "Writer" in globalThis,
        detector: "LanguageDetector" in globalThis,
      };

      if (!mounted) return;
      setCapabilities(next);

      if (!next.prompt) {
        setAiStatus("unsupported");
        setModelInfo({
          loading: false,
          availability: "unsupported",
          checkedAt: Date.now(),
        });
        return;
      }

      setAiStatus("checking");
      try {
        const availability = await LanguageModel.availability(LANGUAGE_MODEL_OPTIONS);
        let params: Partial<LanguageModelParams> | undefined;
        let paramsError = "";

        try {
          params = await LanguageModel.params();
        } catch (error) {
          paramsError = error instanceof Error ? error.message : "Chrome did not expose sampling params.";
        }

        if (mounted) {
          setAiStatus(availability);
          setModelInfo({
            loading: false,
            availability,
            params,
            paramsError,
            checkedAt: Date.now(),
          });
        }
      } catch {
        if (mounted) {
          setAiStatus("error");
          setModelInfo({
            loading: false,
            availability: "error",
            checkedAt: Date.now(),
          });
        }
      }
    }

    void detectCapabilities();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current);
      completionRequestRef.current += 1;
      languageModelRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!postMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!postMenuRef.current?.contains(event.target as Node)) {
        setPostMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPostMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [postMenuOpen]);

  useEffect(() => {
    if (!expressionTarget) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (expressionPopoverRef.current?.contains(event.target as Node)) return;
      if (editor?.view.dom.contains(event.target as Node)) return;
      setExpressionTarget(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpressionTarget(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [editor, expressionTarget]);

  const activeText = editor?.getText().trim() ?? activeSession?.plainText.trim() ?? "";
  const wordCount = editor ? countWords(editor.getText()) : activeSession?.wordCount ?? 0;
  const charCount = editor?.storage.characterCount.characters() ?? activeSession?.plainText.length ?? 0;
  const currentClassification = activeSession?.classification;
  const chatMessages = activeSession?.chatMessages ?? [];
  const chatPending = aiAction === "chat";
  const canSendChat = Boolean(chatInput.trim() && capabilities.prompt && activeSession && aiAction === null);
  const modelContextRatio =
    typeof modelInfo.contextUsage === "number" && typeof modelInfo.contextWindow === "number" && modelInfo.contextWindow > 0
      ? modelInfo.contextUsage / modelInfo.contextWindow
      : null;
  const offlineStorageRatio =
    typeof offlineInfo.storageUsage === "number" && typeof offlineInfo.storageQuota === "number" && offlineInfo.storageQuota > 0
      ? offlineInfo.storageUsage / offlineInfo.storageQuota
      : null;

  const refreshModelInfo = useCallback(async () => {
    if (!("LanguageModel" in globalThis)) {
      setModelInfo({
        loading: false,
        availability: "unsupported",
        checkedAt: Date.now(),
      });
      return;
    }

    setModelInfo((current) => ({ ...current, loading: true }));

    let availability: Availability | "error" = "error";
    let params: Partial<LanguageModelParams> | undefined;
    let paramsError = "";

    try {
      availability = await LanguageModel.availability(LANGUAGE_MODEL_OPTIONS);
    } catch {
      availability = "error";
    }

    try {
      params = await LanguageModel.params();
    } catch (error) {
      paramsError = error instanceof Error ? error.message : "Chrome did not expose sampling params.";
    }

    const session = languageModelRef.current;
    setModelInfo({
      loading: false,
      availability,
      params,
      paramsError,
      contextUsage: session?.contextUsage,
      contextWindow: session?.contextWindow,
      temperature: session?.temperature,
      topK: session?.topK,
      checkedAt: Date.now(),
    });
  }, []);

  const refreshOfflineInfo = useCallback(async () => {
    const serviceWorkerSupported = "serviceWorker" in navigator;
    setOfflineInfo((current) => ({ ...current, loading: true, serviceWorkerSupported }));

    let controlled = false;
    let registrationState = serviceWorkerSupported ? "not registered" : "unsupported";

    if (serviceWorkerSupported) {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const worker = registration?.active ?? registration?.installing ?? registration?.waiting;
        controlled = Boolean(navigator.serviceWorker.controller);
        registrationState = worker ? worker.state : registration ? "registered" : "not registered";
      } catch {
        registrationState = "error";
      }
    }

    let storageUsage: number | undefined;
    let storageQuota: number | undefined;
    try {
      if ("storage" in navigator && "estimate" in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        storageUsage = estimate.usage;
        storageQuota = estimate.quota;
      }
    } catch {
      // Storage estimates are informational only.
    }

    let cacheStats: Awaited<ReturnType<typeof getDraftsideCacheStats>> = {};
    try {
      cacheStats = await getDraftsideCacheStats();
    } catch {
      cacheStats = {};
    }

    setOfflineInfo({
      loading: false,
      serviceWorkerSupported,
      controlled,
      registrationState,
      cacheCount: cacheStats.cacheCount,
      cachedRequests: cacheStats.cachedRequests,
      cachedBytes: cacheStats.cachedBytes,
      storageUsage,
      storageQuota,
      checkedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    void refreshOfflineInfo();

    if (!("serviceWorker" in navigator)) return;
    const handleControllerChange = () => void refreshOfflineInfo();
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [online, refreshOfflineInfo, storagePersisted]);

  const ensureLanguageModel = useCallback(async () => {
    if (languageModelRef.current) return languageModelRef.current;
    if (creatingModelRef.current) return creatingModelRef.current;

    if (!("LanguageModel" in globalThis)) {
      setAiStatus("unsupported");
      throw new Error("Chrome built-in AI is not available in this browser.");
    }

    creatingModelRef.current = (async () => {
      setAiError("");
      setAiProgress(null);
      setModelInfo((current) => ({ ...current, loading: true, checkedAt: Date.now() }));

      let availability: Availability | "error" = "error";

      try {
        availability = await LanguageModel.availability(LANGUAGE_MODEL_OPTIONS);
        setAiStatus(availability);
        if (availability === "unavailable") {
          throw new Error("Gemini Nano is unavailable on this device or Chrome profile.");
        }

        setAiStatus("creating");
        const session = await LanguageModel.create({
          ...LANGUAGE_MODEL_OPTIONS,
          initialPrompts: [
            {
              role: "system",
              content:
                "You are Draftside, a private on-device writing partner inside a minimal editor. Be concise, concrete, and useful. Never claim network access. Prefer the writer's voice over generic advice.",
            },
          ],
          monitor(monitor) {
            monitor.addEventListener("downloadprogress", (event) => {
              const progress =
                event.lengthComputable && event.total > 0
                  ? event.loaded / event.total
                  : event.loaded <= 1
                    ? event.loaded
                    : 0;
              setAiStatus("downloading");
              setAiProgress(Math.max(0, Math.min(1, progress)));
            });
          },
        });

        languageModelRef.current = session;
        setAiStatus("available");
        setAiProgress(null);
        setModelInfo((current) => ({
          ...current,
          loading: false,
          availability: "available",
          contextUsage: session.contextUsage,
          contextWindow: session.contextWindow,
          temperature: session.temperature,
          topK: session.topK,
          checkedAt: Date.now(),
        }));
        return session;
      } catch (error) {
        const failedStatus = availability === "unavailable" ? "unavailable" : "error";
        setAiStatus(failedStatus);
        setAiProgress(null);
        setModelInfo((current) => ({
          ...current,
          loading: false,
          availability: failedStatus,
          checkedAt: Date.now(),
        }));
        throw error;
      }
    })();

    try {
      return await creatingModelRef.current;
    } finally {
      creatingModelRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (autoPrepareStartedRef.current || !("LanguageModel" in globalThis)) return;

    autoPrepareStartedRef.current = true;
    void ensureLanguageModel().catch((error) => {
      setAiError(error instanceof Error ? error.message : "Could not start the local model.");
    });
  }, [ensureLanguageModel]);

  const getModelText = useCallback(() => {
    const selected = selection.text.trim();
    const whole = editor?.getText().trim() ?? "";
    return truncateForModel(selected || whole);
  }, [editor, selection.text]);

  const replaceSelectionOrInsert = useCallback(
    (text: string) => {
      if (!editor || !text.trim()) return;
      editor.chain().focus().insertContent(text).run();
      scheduleSave(editor);
    },
    [editor, scheduleSave],
  );

  const applyDraftUpdate = useCallback(
    (update: DraftUpdate) => {
      if (!editor || !update.text.trim()) return false;

      clearEditorGhostCompletion(editor);
      setGhostCompletionText("");
      completionRequestRef.current += 1;
      editor.commands.setContent(update.text, { contentType: "markdown" });
      editor.commands.focus("end");
      scheduleSave(editor);
      return true;
    },
    [editor, scheduleSave],
  );

  const sendChatMessage = useCallback(async () => {
    const prompt = chatInput.trim();
    const session = activeSessionRef.current;
    if (!prompt || !session || aiAction !== null || !capabilities.prompt) return;

    const history = (session.chatMessages ?? []).filter((message) => !message.pending);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
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
    const modelPrompt = buildChatPrompt(prompt, draftText, history);

    setAiSidebarOpen(true);
    setAiTab("chat");
    setChatInput("");
    setChatError("");
    persistChatMessages(optimisticMessages);
    setAiAction("chat");

    try {
      const model = await ensureLanguageModel();
      const raw = await promptChatModel(model, modelPrompt);
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
  }, [aiAction, applyDraftUpdate, capabilities.prompt, chatInput, editor, ensureLanguageModel, persistChatMessages]);

  const handleChatComposerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendChatMessage();
      }
    },
    [sendChatMessage],
  );

  useEffect(() => {
    if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current);
    if (!editor) return;

    const clearCompletion = () => {
      clearEditorGhostCompletion(editor);
      setGhostCompletionText("");
      completionRequestRef.current += 1;
    };

    if (!capabilities.prompt || aiAction || expressionTarget || postMenuOpen || !selection.empty || !editor.isFocused) {
      clearCompletion();
      return;
    }

    const context = getCompletionContext(editor);
    if (!context) {
      clearCompletion();
      return;
    }

    const requestId = completionRequestRef.current + 1;
    completionRequestRef.current = requestId;

    completionTimerRef.current = window.setTimeout(async () => {
      const liveContext = getCompletionContext(editor);
      if (
        completionRequestRef.current !== requestId ||
        !liveContext ||
        !editor.isFocused ||
        liveContext.pos !== context.pos ||
        liveContext.fingerprint !== context.fingerprint
      ) {
        return;
      }

      try {
        const model = await ensureLanguageModel();
        if (completionRequestRef.current !== requestId) return;

        const result = await model.prompt([
          {
            role: "user",
            content: `You are an inline autocomplete engine for a private writing editor. Continue only the unfinished sentence at the cursor. Return only the words that should be inserted after the cursor. Do not repeat already-written text. No quotes, markdown, JSON, labels, or commentary. Keep it subtle: 3 to 10 words, at most one short clause.\n\nText before cursor:\n"""${liveContext.before}"""`,
          },
        ]);

        const currentContext = getCompletionContext(editor);
        if (
          completionRequestRef.current !== requestId ||
          !currentContext ||
          !editor.isFocused ||
          currentContext.pos !== context.pos ||
          currentContext.fingerprint !== context.fingerprint
        ) {
          return;
        }

        const completion = cleanGhostCompletion(result, currentContext);
        if (!completion) return;

        setEditorGhostCompletion(editor, completion, currentContext.pos);
        setGhostCompletionText(completion);
      } catch {
        if (completionRequestRef.current === requestId) {
          clearEditorGhostCompletion(editor);
          setGhostCompletionText("");
        }
      }
    }, 1000);

    return () => {
      if (completionTimerRef.current) window.clearTimeout(completionTimerRef.current);
      completionRequestRef.current += 1;
    };
  }, [aiAction, capabilities.prompt, completionTick, editor, ensureLanguageModel, expressionTarget, postMenuOpen, selection.empty]);

  const prepareModel = useCallback(async () => {
    setAiAction("prepare");
    try {
      await ensureLanguageModel();
      setAiOutput("Local model ready.");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not start the local model.");
    } finally {
      setAiAction(null);
    }
  }, [ensureLanguageModel]);

  const detectLanguage = useCallback(
    async (text: string) => {
      if (!capabilities.detector || !text.trim()) return;

      try {
        const availability = await LanguageDetector.availability();
        if (availability === "unavailable") return;
        const detector = await LanguageDetector.create({
          monitor(monitor) {
            monitor.addEventListener("downloadprogress", (event) => {
              if (event.loaded <= 1) setAiProgress(event.loaded);
            });
          },
        });
        const [first] = await detector.detect(text.slice(0, 1200));
        detector.destroy();
        if (first?.detectedLanguage) {
          const confidence = typeof first.confidence === "number" ? ` ${Math.round(first.confidence * 100)}%` : "";
          setDetectedLanguage(`${first.detectedLanguage}${confidence}`);
        }
      } catch {
        setDetectedLanguage("");
      }
    },
    [capabilities.detector],
  );

  const classifyDraft = useCallback(async () => {
    const text = getModelText();
    if (!text) {
      setAiError("Write a little first.");
      return;
    }

    setAiAction("classify");
    setAiError("");
    setAiOutput("");

    try {
      await detectLanguage(text);
      const model = await ensureLanguageModel();
      const result = await model.prompt([
        {
          role: "user",
          content: `Classify this draft for the writer. Return exactly one valid compact JSON object and nothing else. Do not use markdown. Do not return multiple objects. Use this exact shape: {"form":"","intent":"","stance":"","friction":"","nextMove":"","confidence":0.0,"tags":[""]}. Keep field values short. Draft:\n\n"""${text}"""`,
        },
      ]);

      const classification = parseClassification(result);
      const current = activeSessionRef.current;
      if (current) {
        const next = { ...current, classification, updatedAt: Date.now() };
        activeSessionRef.current = next;
        setActiveSession(next);
        setSessions((previous) => [next, ...previous.filter((session) => session.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt));
        await putSession(next);
      }

      setAiOutput(classification.nextMove);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Classification failed.");
    } finally {
      setAiAction(null);
    }
  }, [detectLanguage, ensureLanguageModel, getModelText]);

  const thinkWithDraft = useCallback(async () => {
    const text = getModelText();
    if (!text) {
      setAiError("Write a little first.");
      return;
    }

    setAiAction("think");
    setAiError("");
    setAiOutput("");

    try {
      const model = await ensureLanguageModel();
      const stream = model.promptStreaming([
        {
          role: "user",
          content: `Read this writing and respond with five terse lines: strongest idea, hidden assumption, missing proof, useful question, next sentence. No preamble.\n\n"""${text}"""`,
        },
      ]);
      await readTextStream(stream, setAiOutput);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Thinking pass failed.");
    } finally {
      setAiAction(null);
    }
  }, [ensureLanguageModel, getModelText]);

  const continueDraft = useCallback(async () => {
    const text = truncateForModel(editor?.getText().trim() ?? "", 5200);
    if (!text) {
      setAiError("Write a little first.");
      return;
    }

    setAiAction("continue");
    setAiError("");
    setAiOutput("");

    try {
      const model = await ensureLanguageModel();
      const stream = model.promptStreaming([
        {
          role: "user",
          content: `Continue this draft in the same voice. Return only the next two to four sentences, no heading.\n\n"""${text}"""`,
        },
      ]);
      const result = await readTextStream(stream, setAiOutput);
      replaceSelectionOrInsert(result.trimStart());
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Continuation failed.");
    } finally {
      setAiAction(null);
    }
  }, [editor, ensureLanguageModel, replaceSelectionOrInsert]);

  const rewriteSelection = useCallback(async () => {
    const text = selection.text.trim();
    if (!text) {
      setAiError("Select text to rewrite.");
      return;
    }

    setAiAction("rewrite");
    setAiError("");
    setAiOutput("");

    try {
      let result = "";

      if (capabilities.rewriter) {
        const availability = await Rewriter.availability({
          tone: "as-is",
          format: "plain-text",
          length: "shorter",
          expectedInputLanguages: ["en"],
          expectedContextLanguages: ["en"],
          outputLanguage: "en",
        });

        if (availability !== "unavailable") {
          const rewriter = await Rewriter.create({
            tone: "as-is",
            format: "plain-text",
            length: "shorter",
            sharedContext: "Private offline writing editor. Preserve meaning and voice while removing slack.",
            monitor(monitor) {
              monitor.addEventListener("downloadprogress", (event) => {
                setAiStatus("downloading");
                if (event.loaded <= 1) setAiProgress(event.loaded);
              });
            },
          });
          const stream = rewriter.rewriteStreaming(text, {
            context: "Tighten this passage without changing the writer's point.",
          });
          result = await readTextStream(stream, setAiOutput);
          rewriter.destroy();
        }
      }

      if (!result) {
        const model = await ensureLanguageModel();
        const stream = model.promptStreaming([
          {
            role: "user",
            content: `Tighten this passage without changing meaning or voice. Return only the rewritten passage.\n\n"""${truncateForModel(text, 4200)}"""`,
          },
        ]);
        result = await readTextStream(stream, setAiOutput);
      }

      replaceSelectionOrInsert(result.trim());
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Rewrite failed.");
    } finally {
      setAiAction(null);
      setAiProgress(null);
    }
  }, [capabilities.rewriter, ensureLanguageModel, replaceSelectionOrInsert, selection.text]);

  const closeExpressionPopover = useCallback(() => {
    expressionRequestRef.current += 1;
    setExpressionTarget(null);
    setExpressionOptions([]);
    setExpressionLoading(false);
    setExpressionError("");
    setAiAction((current) => (current === "express" ? null : current));
  }, []);

  const requestExpressionOptions = useCallback(
    async (target: ExpressionTarget) => {
      if (!editor) return;

      const requestId = expressionRequestRef.current + 1;
      expressionRequestRef.current = requestId;
      setExpressionTarget(target);
      setExpressionOptions([]);
      setExpressionError("");
      setExpressionLoading(true);
      setAiAction("express");

      try {
        const docSize = editor.state.doc.content.size;
        const contextFrom = Math.max(0, target.from - 240);
        const contextTo = Math.min(docSize, target.to + 240);
        const context = editor.state.doc.textBetween(contextFrom, contextTo, " ").replace(/\s+/g, " ").trim();
        const model = await ensureLanguageModel();
        const result = await model.prompt([
          {
            role: "user",
            content: `Suggest alternate wording for the target word or phrase inside its surrounding sentence. Preserve meaning, fit the context, and prefer natural writerly options over thesaurus noise. Return only valid compact JSON with this exact shape: [{"text":"","note":""}]. Include 4 to 6 options. Never include the original target unchanged. If there are no useful replacements, return []. Keep each note under 4 words. Target: ${JSON.stringify(target.text)}. Context: ${JSON.stringify(context)}.`,
          },
        ]);
        const options = parseExpressionOptions(result, target.text);

        if (expressionRequestRef.current !== requestId) return;
        if (!options.length) {
          setExpressionError("No useful alternates.");
          return;
        }

        setExpressionOptions(options);
      } catch (error) {
        if (expressionRequestRef.current !== requestId) return;
        setExpressionError(error instanceof Error ? error.message : "Could not get alternates.");
      } finally {
        if (expressionRequestRef.current === requestId) {
          setExpressionLoading(false);
          setAiAction((current) => (current === "express" ? null : current));
        }
      }
    },
    [editor, ensureLanguageModel],
  );

  const handleEditorPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!editor || event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (!editor.view.dom.contains(target)) return;

      window.setTimeout(() => {
        const nextTarget = expressionTargetFromSelection(editor);
        if (!nextTarget) {
          closeExpressionPopover();
          return;
        }

        void requestExpressionOptions(nextTarget);
      }, 0);
    },
    [closeExpressionPopover, editor, requestExpressionOptions],
  );

  const applyExpressionOption = useCallback(
    (text: string) => {
      if (!editor || !expressionTarget || !text.trim()) return;

      try {
        editor.chain().focus().setTextSelection({ from: expressionTarget.from, to: expressionTarget.to }).insertContent(text).run();
        scheduleSave(editor);
        closeExpressionPopover();
      } catch {
        setExpressionError("That text moved. Click it again.");
      }
    },
    [closeExpressionPopover, editor, expressionTarget, scheduleSave],
  );

  const createSession = useCallback(async () => {
    const blank = createBlankSession();
    await putSession(blank);
    setSessions((previous) => [blank, ...previous]);
    setActiveSession(blank);
    activeSessionRef.current = blank;
    setAiOutput("");
    setAiError("");
    setChatError("");
  }, []);

  const selectSession = useCallback((session: WriteSession) => {
    setActiveSession(session);
    activeSessionRef.current = session;
    setAiOutput("");
    setAiError("");
    setChatError("");
  }, []);

  const deleteActiveSession = useCallback(async () => {
    if (!activeSession) return;

    setPostMenuOpen(false);
    await removeSession(activeSession.id);
    const remaining = sessions.filter((session) => session.id !== activeSession.id);

    if (remaining.length) {
      setSessions(remaining);
      setActiveSession(remaining[0]);
      activeSessionRef.current = remaining[0];
      setChatError("");
      return;
    }

    const blank = createBlankSession();
    await putSession(blank);
    setSessions([blank]);
    setActiveSession(blank);
    activeSessionRef.current = blank;
    setChatError("");
  }, [activeSession, sessions]);

  const getCurrentDoc = useCallback(() => {
    return editor?.getJSON() ?? activeSession?.content ?? EMPTY_DOC;
  }, [activeSession?.content, editor]);

  const downloadHtml = useCallback(() => {
    if (!editor || !activeSession) return;

    const title = activeSession.title || "Untitled";
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <article>
      ${editor.getHTML()}
    </article>
  </body>
</html>
`;
    downloadTextFile(`${fileSafeTitle(title)}.html`, "text/html;charset=utf-8", html);
    setPostMenuOpen(false);
  }, [activeSession, editor]);

  const downloadMarkdown = useCallback(() => {
    if (!activeSession) return;

    downloadTextFile(`${fileSafeTitle(activeSession.title)}.md`, "text/markdown;charset=utf-8", documentToMarkdown(getCurrentDoc()));
    setPostMenuOpen(false);
  }, [activeSession, getCurrentDoc]);

  const copyPostMarkdown = useCallback(async () => {
    await writeClipboardText(documentToMarkdown(getCurrentDoc()));
    setCopiedPostMarkdown(true);
    window.setTimeout(() => setCopiedPostMarkdown(false), 1200);
    setPostMenuOpen(false);
  }, [getCurrentDoc]);

  const copyAiOutput = useCallback(async () => {
    if (!aiOutput) return;
    await writeClipboardText(aiOutput);
    setCopiedOutput(true);
    window.setTimeout(() => setCopiedOutput(false), 1200);
  }, [aiOutput]);

  const ToolbarButton = ({
    label,
    active = false,
    disabled = false,
    onClick,
    children,
  }: {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      className={active ? "tool-button is-active" : "tool-button"}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );

  return (
    <div className={aiSidebarOpen ? "editor-app is-ai-open" : "editor-app"}>
      <aside className="session-rail" aria-label="Writing sessions">
        <div className="rail-header">
          <div className="rail-title-block">
            <p className="eyebrow">Draftside</p>
            <div className="rail-title-row">
              <h1>Drafts</h1>
              <button type="button" className="icon-button rail-add-button" onClick={createSession} disabled={chatPending} aria-label="New draft" title="New draft">
                <Plus size={17} />
              </button>
            </div>
          </div>
        </div>

        <div className="session-list">
          {sessions.map((session) => (
            <button
              type="button"
              key={session.id}
              className={activeSession?.id === session.id ? "session-button is-active" : "session-button"}
              onClick={() => selectSession(session)}
              disabled={chatPending}
            >
              <span className="session-title">{session.title}</span>
              <span className="session-meta">
                {session.wordCount} words · {formatUpdatedAt(session.updatedAt)}
              </span>
            </button>
          ))}
        </div>

        <div className="rail-footer">
          <span className="offline-status-wrap" onMouseEnter={() => void refreshOfflineInfo()} onFocus={() => void refreshOfflineInfo()}>
            <span className={online ? "connectivity is-online" : "connectivity"} tabIndex={0} aria-describedby="offline-status-popover">
              {online ? <Wifi size={14} /> : <WifiOff size={14} />}
              {online ? "online" : "offline"}
            </span>
            <span id="offline-status-popover" className="offline-popover" role="tooltip">
              <span className="model-popover-title">
                <span>Offline app shell</span>
                <span>{offlineInfo.loading ? "checking" : offlineInfo.controlled ? "active" : "standby"}</span>
              </span>

              <span className="model-popover-grid">
                <span>
                  <strong>Network</strong>
                  <em>{online ? "online now" : "offline now"}</em>
                </span>
                <span>
                  <strong>Service worker</strong>
                  <em>{offlineInfo.serviceWorkerSupported ? offlineInfo.registrationState : "unsupported"}</em>
                </span>
                <span>
                  <strong>Page control</strong>
                  <em>{offlineInfo.controlled ? "controlling this tab" : "not controlling this tab"}</em>
                </span>
                <span>
                  <strong>Cache stores</strong>
                  <em>{formatNumber(offlineInfo.cacheCount)}</em>
                </span>
                <span>
                  <strong>Cached responses</strong>
                  <em>{formatNumber(offlineInfo.cachedRequests)}</em>
                </span>
                <span>
                  <strong>Cache size</strong>
                  <em>{formatBytes(offlineInfo.cachedBytes)}</em>
                </span>
                <span>
                  <strong>Storage used</strong>
                  <em>
                    {formatBytes(offlineInfo.storageUsage)} / {formatBytes(offlineInfo.storageQuota)} ({formatPercent(offlineStorageRatio)})
                  </em>
                </span>
                <span>
                  <strong>Draft storage</strong>
                  <em>{storagePersisted === null ? "checking" : storagePersisted ? "persistent IndexedDB" : "browser-managed IndexedDB"}</em>
                </span>
              </span>

              <span className="model-popover-note">
                Production builds register Chrome's service worker at scope /. It precaches / and /editor, the manifest, icons, fonts, and discovered app assets, then runtime-caches same-origin requests. Drafts stay in IndexedDB and Gemini Nano runs locally after Chrome downloads it.
              </span>
              <span className="model-popover-foot">checked {formatModelInfoTime(offlineInfo.checkedAt)}</span>
            </span>
          </span>
          <span className="model-status-wrap" onMouseEnter={() => void refreshModelInfo()} onFocus={() => void refreshModelInfo()}>
            <span className={`ai-status ${aiStatus}`} tabIndex={0} aria-describedby="model-status-popover">
              {aiAction ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}
              {statusLabel(aiStatus)}
            </span>
            <span id="model-status-popover" className="model-popover" role="tooltip">
              <span className="model-popover-title">
                <span>Chrome Gemini local model</span>
                <span>{modelInfo.loading ? "checking" : statusLabel(modelInfo.availability ?? aiStatus)}</span>
              </span>

              <span className="model-popover-grid">
                <span>
                  <strong>Runtime</strong>
                  <em>LanguageModel API</em>
                </span>
                <span>
                  <strong>Exact model</strong>
                  <em>not exposed by Chrome</em>
                </span>
                <span>
                  <strong>Availability</strong>
                  <em>{modelInfo.availability ?? aiStatus}</em>
                </span>
                <span>
                  <strong>Session</strong>
                  <em>{languageModelRef.current ? "active" : creatingModelRef.current ? "starting" : "not started"}</em>
                </span>
                <span>
                  <strong>Context used</strong>
                  <em>
                    {formatNumber(modelInfo.contextUsage)} / {formatNumber(modelInfo.contextWindow)} ({formatPercent(modelContextRatio)})
                  </em>
                </span>
                <span>
                  <strong>Default topK</strong>
                  <em>{formatNumber(modelInfo.params?.defaultTopK)}</em>
                </span>
                <span>
                  <strong>Max topK</strong>
                  <em>{formatNumber(modelInfo.params?.maxTopK)}</em>
                </span>
                <span>
                  <strong>Default temp</strong>
                  <em>{formatNumber(modelInfo.params?.defaultTemperature)}</em>
                </span>
                <span>
                  <strong>Max temp</strong>
                  <em>{formatNumber(modelInfo.params?.maxTemperature)}</em>
                </span>
                <span>
                  <strong>Active topK</strong>
                  <em>{formatNumber(modelInfo.topK)}</em>
                </span>
                <span>
                  <strong>Active temp</strong>
                  <em>{formatNumber(modelInfo.temperature)}</em>
                </span>
                <span>
                  <strong>Download</strong>
                  <em>{aiProgress === null ? "idle" : formatPercent(aiProgress)}</em>
                </span>
              </span>

              <span className="model-popover-capabilities">
                <span className={capabilityClass(capabilities.prompt)}>prompt</span>
                <span className={capabilityClass(capabilities.rewriter)}>rewrite</span>
                <span className={capabilityClass(capabilities.writer)}>write</span>
                <span className={capabilityClass(capabilities.detector)}>language</span>
              </span>

              <span className="model-popover-note">
                Inference stays on-device. Draftside requests English text in and out; storage is {storagePersisted ? "persistent" : "browser-managed"}.
                {modelInfo.paramsError ? ` ${modelInfo.paramsError}` : ""}
              </span>
              <span className="model-popover-foot">checked {formatModelInfoTime(modelInfo.checkedAt)}</span>
            </span>
          </span>
          <span className="connectivity">
            <Save size={14} />
            {saveState}
          </span>
        </div>
      </aside>

      <main className="editor-main">
        <div className="editor-toolbar" aria-label="Editor toolbar">
          <div className="toolbar-group">
            <ToolbarButton label="Undo" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()}>
              <Undo2 size={17} />
            </ToolbarButton>
            <ToolbarButton label="Redo" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()}>
              <Redo2 size={17} />
            </ToolbarButton>
          </div>

          <div className="toolbar-group">
            <ToolbarButton label="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
              <Bold size={17} />
            </ToolbarButton>
            <ToolbarButton label="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
              <Italic size={17} />
            </ToolbarButton>
            <ToolbarButton label="Underline" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}>
              <UnderlineIcon size={17} />
            </ToolbarButton>
            <ToolbarButton label="Highlight" active={editor?.isActive("highlight")} onClick={() => editor?.chain().focus().toggleHighlight().run()}>
              <Highlighter size={17} />
            </ToolbarButton>
          </div>

          <div className="toolbar-group">
            <ToolbarButton label="Heading 1" active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
              <Heading1 size={17} />
            </ToolbarButton>
            <ToolbarButton label="Heading 2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 size={17} />
            </ToolbarButton>
            <ToolbarButton label="Bullet list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
              <List size={17} />
            </ToolbarButton>
            <ToolbarButton label="Ordered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
              <ListOrdered size={17} />
            </ToolbarButton>
            <ToolbarButton label="Tasks" active={editor?.isActive("taskList")} onClick={() => editor?.chain().focus().toggleTaskList().run()}>
              <ListChecks size={17} />
            </ToolbarButton>
            <ToolbarButton label="Quote" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
              <Quote size={17} />
            </ToolbarButton>
            <ToolbarButton label="Code" active={editor?.isActive("codeBlock")} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
              <Code2 size={17} />
            </ToolbarButton>
          </div>

          <div className="toolbar-spacer" />

          <button
            type="button"
            className="icon-button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            type="button"
            className={aiSidebarOpen ? "icon-button is-active" : "icon-button"}
            onClick={() => setAiSidebarOpen((open) => !open)}
            aria-label={aiSidebarOpen ? "Hide AI sidebar" : "Show AI sidebar"}
            aria-controls="draftside-ai-rail"
            aria-expanded={aiSidebarOpen}
            title={aiSidebarOpen ? "Hide AI sidebar" : "Show AI sidebar"}
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
              title="Post actions"
              onClick={() => setPostMenuOpen((open) => !open)}
            >
              <Ellipsis size={18} />
            </button>
            {postMenuOpen ? (
              <div className="post-menu-content" role="menu" aria-label="Post actions">
                <button type="button" role="menuitem" className="post-menu-item" onClick={downloadHtml} disabled={!editor || !activeSession}>
                  <Download size={16} />
                  Download as HTML
                </button>
                <button type="button" role="menuitem" className="post-menu-item" onClick={downloadMarkdown} disabled={!activeSession}>
                  <FileText size={16} />
                  Download as Markdown
                </button>
                <button type="button" role="menuitem" className="post-menu-item" onClick={copyPostMarkdown} disabled={!activeSession}>
                  {copiedPostMarkdown ? <Check size={16} /> : <Copy size={16} />}
                  {copiedPostMarkdown ? "Copied Markdown" : "Copy as Markdown"}
                </button>
                <button type="button" role="menuitem" className="post-menu-item is-danger" onClick={deleteActiveSession} disabled={chatPending || !activeSession}>
                  <Trash2 size={16} />
                  Delete draft
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="editor-scroll">
          <article className="editor-paper" data-ghost-completion={ghostCompletionText ? "ready" : undefined} onPointerUp={handleEditorPointerUp}>
            <EditorContent editor={editor} />
            {expressionTarget ? (
              <div
                ref={expressionPopoverRef}
                className="expression-popover"
                role="dialog"
                aria-label={`Alternates for ${expressionTarget.text}`}
                style={
                  {
                    "--expression-left": `${expressionTarget.position.left}px`,
                    "--expression-top": `${expressionTarget.position.top}px`,
                  } as React.CSSProperties
                }
              >
                <div className="expression-header">
                  <div>
                    <span className="expression-kicker">Alternates</span>
                    <span className="expression-target">{expressionTarget.text}</span>
                  </div>
                  <button type="button" className="expression-close" onClick={closeExpressionPopover} aria-label="Close alternates" title="Close">
                    <X size={14} />
                  </button>
                </div>

                {expressionLoading ? (
                  <div className="expression-state">
                    <LoaderCircle className="spin" size={15} />
                    Thinking locally
                  </div>
                ) : expressionError ? (
                  <p className="expression-error">{expressionError}</p>
                ) : (
                  <div className="expression-options">
                    {expressionOptions.map((option) => (
                      <button
                        type="button"
                        key={option.text}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applyExpressionOption(option.text)}
                      >
                        <span>{option.text}</span>
                        {option.note ? <small>{option.note}</small> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </article>
        </div>

        <footer className="editor-footer" aria-label="Editor status">
          <div className="editor-footer-metrics" aria-live="polite">
            <span>{wordCount} words</span>
            <span>{charCount} chars</span>
          </div>
        </footer>
      </main>

      <aside id="draftside-ai-rail" className="ai-rail" aria-label="Local AI" aria-hidden={!aiSidebarOpen}>
        <div className="ai-top">
          <div className="ai-header">
            <div>
              <p className="eyebrow">Gemini Nano</p>
              <h2>Local ML</h2>
            </div>
          </div>

          {aiProgress !== null && (
            <div className="progress-wrap" aria-label="Model download progress">
              <span style={{ width: `${Math.round(aiProgress * 100)}%` }} />
            </div>
          )}

          <div className="ai-tabs" role="tablist" aria-label="Local AI modes">
            <button
              type="button"
              id="ai-tab-chat"
              className={aiTab === "chat" ? "ai-tab is-active" : "ai-tab"}
              role="tab"
              aria-selected={aiTab === "chat"}
              aria-controls="ai-panel-chat"
              onClick={() => setAiTab("chat")}
            >
              <MessageSquare size={15} />
              Chat
            </button>
            <button
              type="button"
              id="ai-tab-tools"
              className={aiTab === "tools" ? "ai-tab is-active" : "ai-tab"}
              role="tab"
              aria-selected={aiTab === "tools"}
              aria-controls="ai-panel-tools"
              onClick={() => setAiTab("tools")}
            >
              <Sparkles size={15} />
              Tools
            </button>
          </div>
        </div>

        {aiTab === "chat" ? (
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
                void sendChatMessage();
              }}
            >
              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={handleChatComposerKeyDown}
                disabled={!capabilities.prompt || aiAction !== null || !activeSession}
                rows={1}
                placeholder={capabilities.prompt ? "Ask anything..." : "Chrome built-in AI is unavailable"}
                aria-label="Chat with Draftside"
              />
              <button type="submit" aria-label="Send message" disabled={!canSendChat}>
                {chatPending ? <LoaderCircle className="spin" size={15} /> : <ArrowUp size={15} />}
              </button>
            </form>
          </div>
        ) : (
          <div id="ai-panel-tools" className="ai-tab-panel tools-panel" role="tabpanel" aria-labelledby="ai-tab-tools">
            <div className="capabilities">
              <span className={capabilityClass(capabilities.prompt)}>prompt</span>
              <span className={capabilityClass(capabilities.rewriter)}>rewrite</span>
              <span className={capabilityClass(capabilities.writer)}>write</span>
              <span className={capabilityClass(capabilities.detector)}>language</span>
            </div>

            <div className="ai-actions">
              <button type="button" onClick={prepareModel} disabled={aiAction !== null || !capabilities.prompt}>
                <Sparkles size={16} />
                Prepare
              </button>
              <button type="button" onClick={classifyDraft} disabled={aiAction !== null || !capabilities.prompt || !activeText}>
                <Tags size={16} />
                Classify
              </button>
              <button type="button" onClick={thinkWithDraft} disabled={aiAction !== null || !capabilities.prompt || !activeText}>
                <Brain size={16} />
                Think
              </button>
              <button type="button" onClick={continueDraft} disabled={aiAction !== null || !capabilities.prompt || !activeText}>
                <FileText size={16} />
                Continue
              </button>
              <button type="button" onClick={rewriteSelection} disabled={aiAction !== null || selection.empty}>
                <Wand2 size={16} />
                Tighten
              </button>
            </div>

            <div className="ai-section">
              <div className="section-title">
                <span>Signals</span>
                {detectedLanguage && (
                  <span className="language-pill">
                    <Languages size={13} />
                    {detectedLanguage}
                  </span>
                )}
              </div>

              {currentClassification ? (
                <dl className="classification-grid">
                  <div>
                    <dt>form</dt>
                    <dd>{currentClassification.form}</dd>
                  </div>
                  <div>
                    <dt>intent</dt>
                    <dd>{currentClassification.intent}</dd>
                  </div>
                  <div>
                    <dt>stance</dt>
                    <dd>{currentClassification.stance}</dd>
                  </div>
                  <div>
                    <dt>friction</dt>
                    <dd>{currentClassification.friction}</dd>
                  </div>
                </dl>
              ) : (
                <p className="muted-line">No classification yet.</p>
              )}

              {currentClassification?.tags?.length ? (
                <div className="tag-row">
                  {currentClassification.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="ai-section output-section">
              <div className="section-title">
                <span>Output</span>
                <button type="button" className="mini-icon" onClick={copyAiOutput} disabled={!aiOutput} aria-label="Copy output" title="Copy output">
                  {copiedOutput ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>

              {aiError ? <p className="ai-error">{aiError}</p> : null}
              {aiOutput ? <pre className="ai-output">{aiOutput}</pre> : aiError ? null : <p className="muted-line">Waiting for a local pass.</p>}
            </div>

            <div className="storage-line">
              <span>{storagePersisted ? "persistent storage" : "browser storage"}</span>
              <span>{selection.empty ? "whole draft" : "selection"}</span>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
