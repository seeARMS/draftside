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
  Focus,
  Heading1,
  Heading2,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Languages,
  List,
  ListChecks,
  ListOrdered,
  LoaderCircle,
  Lock,
  LockOpen,
  MessageSquare,
  Mic,
  MicOff,
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
const UI_PREFS_KEY = "draftside.uiPrefs";
const VAULT_META_KEY = "draftside.vault";
const MAX_MODEL_CHARS = 6500;

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const LANGUAGE_MODEL_OPTIONS: LanguageModelCreateCoreOptions = {
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
};

const MULTIMODAL_SYSTEM_PROMPT =
  "You are Draftside, a private on-device writing partner inside a minimal editor. Be concise, concrete, and useful. Never claim network access. Prefer the writer's voice over generic advice.";

const TRANSLATION_LANGUAGES = [
  { code: "ar", label: "Arabic" },
  { code: "bg", label: "Bulgarian" },
  { code: "bn", label: "Bengali" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "hi", label: "Hindi" },
  { code: "hr", label: "Croatian" },
  { code: "hu", label: "Hungarian" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "nl", label: "Dutch" },
  { code: "no", label: "Norwegian" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sv", label: "Swedish" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "vi", label: "Vietnamese" },
  { code: "zh", label: "Chinese" },
  { code: "zh-Hant", label: "Chinese Traditional" },
];

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
type AiAction = "prepare" | "classify" | "think" | "continue" | "rewrite" | "chat" | "transcribe" | "translate" | null;
type AiTab = "chat" | "tools";
type ThemeMode = "light" | "dark";
type ChatRole = "user" | "assistant";
type RecordingTarget = "chat" | "editor";
type MultimodalInputType = "audio" | "image";
type VaultStatus = "disabled" | "locked" | "unlocked";
type VaultModalView = "intro" | "unlock" | "manage" | "disable";

interface EditorUiPrefs {
  activeSessionId?: string;
  aiSidebarOpen?: boolean;
  aiTab?: AiTab;
  chatInput?: string;
  focusMode?: boolean;
  translationTarget?: string;
}

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

interface ChatImageAttachment {
  id: string;
  name: string;
  file: File;
  previewUrl: string;
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

interface EncryptedPayload {
  alg: "AES-GCM";
  data: string;
  iv: string;
}

interface EncryptedSessionRecord {
  id: string;
  encrypted: true;
  version: 1;
  createdAt: number;
  updatedAt: number;
  ciphertext: EncryptedPayload;
}

type StoredSessionRecord = WriteSession | EncryptedSessionRecord;

interface LockedSessionSummary {
  id: string;
  createdAt: number;
  updatedAt: number;
}

interface VaultMeta {
  id: string;
  version: 1;
  credentialId: string;
  salt: string;
  wrappedKey: EncryptedPayload;
  recoveryWrappedKey?: EncryptedPayload;
  createdAt: number;
  updatedAt: number;
}

interface Capabilities {
  prompt: boolean;
  rewriter: boolean;
  writer: boolean;
  detector: boolean;
  translator: boolean;
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

function transactionToPromise(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(value: string) {
  const compact = value.replace(/[\s-]/g, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(compact)) {
    throw new Error("Recovery key should be 64 hexadecimal characters.");
  }

  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function formatRecoveryKey(bytes: Uint8Array) {
  return bytesToHex(bytes).match(/.{1,4}/g)?.join("-") ?? bytesToHex(bytes);
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

async function importAesKey(raw: BufferSource) {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function deriveWrappingKey(secret: BufferSource, purpose: string) {
  const material = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: textBytes("draftside-private-vault-v1"),
      info: textBytes(purpose),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptBytes(key: CryptoKey, bytes: Uint8Array): Promise<EncryptedPayload> {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return {
    alg: "AES-GCM",
    data: bytesToBase64Url(new Uint8Array(encrypted)),
    iv: bytesToBase64Url(iv),
  };
}

async function decryptBytes(key: CryptoKey, payload: EncryptedPayload) {
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64UrlToBytes(payload.iv) }, key, base64UrlToBytes(payload.data));
  return new Uint8Array(decrypted);
}

function isEncryptedSessionRecord(record: unknown): record is EncryptedSessionRecord {
  if (!record || typeof record !== "object") return false;
  const data = record as Partial<EncryptedSessionRecord>;
  return data.encrypted === true && data.version === 1 && typeof data.id === "string" && typeof data.ciphertext?.data === "string";
}

async function encryptSessionRecord(session: WriteSession, vaultKey: CryptoKey): Promise<EncryptedSessionRecord> {
  const ciphertext = await encryptBytes(vaultKey, textBytes(JSON.stringify(session)));
  return {
    id: session.id,
    encrypted: true,
    version: 1,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    ciphertext,
  };
}

async function decryptSessionRecord(record: EncryptedSessionRecord, vaultKey: CryptoKey): Promise<WriteSession> {
  const bytes = await decryptBytes(vaultKey, record.ciphertext);
  const session = JSON.parse(new TextDecoder().decode(bytes)) as WriteSession;
  return {
    ...session,
    id: session.id || record.id,
    createdAt: session.createdAt || record.createdAt,
    updatedAt: session.updatedAt || record.updatedAt,
  };
}

function readVaultMeta(): VaultMeta | null {
  try {
    const stored = localStorage.getItem(VAULT_META_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<VaultMeta>;
    if (
      parsed.version !== 1 ||
      typeof parsed.id !== "string" ||
      typeof parsed.credentialId !== "string" ||
      typeof parsed.salt !== "string" ||
      !parsed.wrappedKey ||
      typeof parsed.wrappedKey.data !== "string" ||
      typeof parsed.wrappedKey.iv !== "string"
    ) {
      return null;
    }

    return parsed as VaultMeta;
  } catch {
    return null;
  }
}

function writeVaultMeta(meta: VaultMeta) {
  localStorage.setItem(VAULT_META_KEY, JSON.stringify(meta));
}

function clearVaultMeta() {
  localStorage.removeItem(VAULT_META_KEY);
}

function ensureVaultRuntime() {
  if (!window.isSecureContext) {
    throw new Error("Private Vault requires a secure browser context. Use HTTPS or localhost.");
  }
  if (!("PublicKeyCredential" in window) || !navigator.credentials?.create || !navigator.credentials?.get) {
    throw new Error("This browser does not support passkeys.");
  }
  if (!crypto.subtle) {
    throw new Error("This browser does not support Web Crypto.");
  }
}

function getPrfResult(credential: PublicKeyCredential) {
  const extensions = credential.getClientExtensionResults() as { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };
  const first = extensions.prf?.results?.first;
  return first ? new Uint8Array(first) : null;
}

async function createVaultCredential(salt: Uint8Array) {
  ensureVaultRuntime();

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Draftside" },
      user: {
        id: randomBytes(32),
        name: "draftside-local-vault",
        displayName: "Draftside Local Vault",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      attestation: "none",
      timeout: 120000,
      extensions: {
        prf: {
          eval: {
            first: salt,
          },
        },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error("Passkey creation was cancelled.");

  const credentialId = bytesToBase64Url(new Uint8Array(credential.rawId));
  return {
    credentialId,
    prf: getPrfResult(credential),
  };
}

async function evaluateCredentialPrf(credentialId: string, salt: Uint8Array) {
  ensureVaultRuntime();

  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [
        {
          type: "public-key",
          id: base64UrlToBytes(credentialId),
        },
      ],
      userVerification: "required",
      timeout: 120000,
      extensions: {
        prf: {
          eval: {
            first: salt,
          },
        },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error("Passkey unlock was cancelled.");
  const prf = getPrfResult(assertion);
  if (!prf) {
    throw new Error("This passkey did not expose the PRF output Draftside needs for local encryption.");
  }
  return prf;
}

async function unwrapVaultKey(meta: VaultMeta, wrappingKey: CryptoKey) {
  const raw = await decryptBytes(wrappingKey, meta.wrappedKey);
  return importAesKey(raw);
}

async function getStoredSessionRecords() {
  const db = await openDb();
  const tx = db.transaction(SESSION_STORE, "readonly");
  return requestToPromise<StoredSessionRecord[]>(tx.objectStore(SESSION_STORE).getAll());
}

async function getLockedSessionSummaries(): Promise<LockedSessionSummary[]> {
  const records = await getStoredSessionRecords();
  return records
    .map((record) => ({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

async function getSessions(vaultKey?: CryptoKey | null) {
  const records = await getStoredSessionRecords();
  const sessions = await Promise.all(
    records.map((record) => {
      if (isEncryptedSessionRecord(record)) {
        if (!vaultKey) throw new Error("Private Vault is locked.");
        return decryptSessionRecord(record, vaultKey);
      }

      return Promise.resolve(record);
    }),
  );
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function putSession(session: WriteSession, vaultKey?: CryptoKey | null) {
  const record = vaultKey ? await encryptSessionRecord(session, vaultKey) : session;
  const db = await openDb();
  const tx = db.transaction(SESSION_STORE, "readwrite");
  await requestToPromise(tx.objectStore(SESSION_STORE).put(record));
}

async function replaceAllSessions(sessions: WriteSession[], vaultKey?: CryptoKey | null) {
  const records = await Promise.all(sessions.map((session) => (vaultKey ? encryptSessionRecord(session, vaultKey) : Promise.resolve(session))));
  const db = await openDb();
  const tx = db.transaction(SESSION_STORE, "readwrite");
  const store = tx.objectStore(SESSION_STORE);
  store.clear();
  records.forEach((record) => store.put(record));
  await transactionToPromise(tx);
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

async function promptChatModel(model: LanguageModel, prompt: string, images: ChatImageAttachment[] = []) {
  const content: LanguageModelMessageContent[] | string = images.length
    ? [
        { type: "text", value: prompt },
        ...images.map((image) => ({
          type: "image" as const,
          value: asModelContentValue(image.file),
        })),
      ]
    : prompt;
  const messages: LanguageModelPrompt = [{ role: "user", content }];

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

function formatSaveTime(value: number | null | undefined) {
  if (!value) return "not saved yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
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

function translationLabel(code: string) {
  return TRANSLATION_LANGUAGES.find((language) => language.code === code)?.label ?? code;
}

function readStoredUiPrefs(): EditorUiPrefs {
  try {
    const stored = localStorage.getItem(UI_PREFS_KEY);
    if (!stored) return {};

    const parsed = JSON.parse(stored) as Partial<EditorUiPrefs>;
    return {
      activeSessionId: typeof parsed.activeSessionId === "string" ? parsed.activeSessionId : undefined,
      aiSidebarOpen: typeof parsed.aiSidebarOpen === "boolean" ? parsed.aiSidebarOpen : undefined,
      aiTab: parsed.aiTab === "chat" || parsed.aiTab === "tools" ? parsed.aiTab : undefined,
      chatInput: typeof parsed.chatInput === "string" ? parsed.chatInput : undefined,
      focusMode: typeof parsed.focusMode === "boolean" ? parsed.focusMode : undefined,
      translationTarget:
        typeof parsed.translationTarget === "string" && TRANSLATION_LANGUAGES.some((language) => language.code === parsed.translationTarget)
          ? parsed.translationTarget
          : undefined,
    };
  } catch {
    return {};
  }
}

function writeStoredUiPrefs(next: EditorUiPrefs) {
  try {
    const current = readStoredUiPrefs();
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({ ...current, ...next }));
  } catch {
    // UI preferences are progressive; the editor still works without them.
  }
}

function storeActiveSessionId(id: string) {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } catch {
    // The consolidated prefs write below may still succeed in normal browsers.
  }
  writeStoredUiPrefs({ activeSessionId: id });
}

function readStoredActiveSessionId() {
  try {
    return localStorage.getItem(ACTIVE_SESSION_KEY) ?? readStoredUiPrefs().activeSessionId;
  } catch {
    return readStoredUiPrefs().activeSessionId;
  }
}

function multimodalKey(inputTypes: MultimodalInputType[]) {
  return [...new Set(inputTypes)].sort().join("+");
}

function buildMultimodalOptions(inputTypes: MultimodalInputType[]): LanguageModelCreateCoreOptions {
  return {
    expectedInputs: [
      { type: "text", languages: ["en"] },
      ...[...new Set(inputTypes)].sort().map((type) => ({ type }) as LanguageModelExpected),
    ],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
  };
}

function asModelContentValue(value: Blob): LanguageModelMessageValue {
  return value as unknown as LanguageModelMessageValue;
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
  const initialVaultMeta = useMemo(() => readVaultMeta(), []);
  const [sessions, setSessions] = useState<WriteSession[]>([]);
  const [lockedSessions, setLockedSessions] = useState<LockedSessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<WriteSession | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
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
    translator: false,
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
  const [translationTarget, setTranslationTarget] = useState(() => readStoredUiPrefs().translationTarget ?? "es");
  const [translationSource, setTranslationSource] = useState("");
  const [lastTranslation, setLastTranslation] = useState("");
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [copiedPostMarkdown, setCopiedPostMarkdown] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WriteSession | null>(null);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(() => readStoredUiPrefs().aiSidebarOpen ?? true);
  const [aiTab, setAiTab] = useState<AiTab>(() => readStoredUiPrefs().aiTab ?? "chat");
  const [focusMode, setFocusMode] = useState(() => readStoredUiPrefs().focusMode ?? false);
  const [vaultMeta, setVaultMeta] = useState<VaultMeta | null>(initialVaultMeta);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>(initialVaultMeta ? "locked" : "disabled");
  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [vaultModalView, setVaultModalView] = useState<VaultModalView>(initialVaultMeta ? "unlock" : "intro");
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState("");
  const [vaultRecoveryKey, setVaultRecoveryKey] = useState("");
  const [vaultRecoveryInput, setVaultRecoveryInput] = useState("");
  const [expressionTarget, setExpressionTarget] = useState<ExpressionTarget | null>(null);
  const [expressionOptions, setExpressionOptions] = useState<ExpressionOption[]>([]);
  const [expressionLoading, setExpressionLoading] = useState(false);
  const [expressionError, setExpressionError] = useState("");
  const [completionTick, setCompletionTick] = useState(0);
  const [ghostCompletionText, setGhostCompletionText] = useState("");
  const [chatInput, setChatInput] = useState(() => readStoredUiPrefs().chatInput ?? "");
  const [chatImages, setChatImages] = useState<ChatImageAttachment[]>([]);
  const [recordingTarget, setRecordingTarget] = useState<RecordingTarget | null>(null);
  const [chatError, setChatError] = useState("");

  const saveTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const completionRequestRef = useRef(0);
  const activeSessionRef = useRef<WriteSession | null>(null);
  const languageModelRef = useRef<LanguageModel | null>(null);
  const vaultKeyRef = useRef<CryptoKey | null>(null);
  const creatingModelRef = useRef<Promise<LanguageModel> | null>(null);
  const multimodalLanguageModelRef = useRef(new Map<string, LanguageModel>());
  const creatingMultimodalModelRef = useRef(new Map<string, Promise<LanguageModel>>());
  const autoPrepareStartedRef = useRef(false);
  const skipUpdateRef = useRef(false);
  const postMenuRef = useRef<HTMLDivElement | null>(null);
  const expressionPopoverRef = useRef<HTMLDivElement | null>(null);
  const expressionRequestRef = useRef(0);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatImageInputRef = useRef<HTMLInputElement | null>(null);
  const chatImagesRef = useRef<ChatImageAttachment[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);

  const saveSession = useCallback((session: WriteSession) => putSession(session, vaultKeyRef.current), []);

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
      await saveSession(next);
      setSaveState("saved");
      setLastSavedAt(Date.now());
    } catch {
      setSaveState("error");
    }
  }, [saveSession]);

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
    setSaveState("saving");
    void saveSession(next)
      .then(() => {
        setSaveState("saved");
        setLastSavedAt(Date.now());
      })
      .catch(() => setSaveState("error"));
  }, [saveSession]);

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
    writeStoredUiPrefs({ aiSidebarOpen });
  }, [aiSidebarOpen]);

  useEffect(() => {
    writeStoredUiPrefs({ aiTab });
  }, [aiTab]);

  useEffect(() => {
    writeStoredUiPrefs({ focusMode });
  }, [focusMode]);

  useEffect(() => {
    writeStoredUiPrefs({ chatInput });
  }, [chatInput]);

  useEffect(() => {
    writeStoredUiPrefs({ translationTarget });
  }, [translationTarget]);

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
        const storedVaultMeta = readVaultMeta();

        if (storedVaultMeta) {
          const summaries = await getLockedSessionSummaries();
          if (!mounted) return;
          setVaultMeta(storedVaultMeta);
          setVaultStatus("locked");
          setLockedSessions(summaries);
          setSessions([]);
          setActiveSession(null);
          activeSessionRef.current = null;
          setLastSavedAt(summaries[0]?.updatedAt ?? null);
          return;
        }

        const stored = await getSessions();
        let nextSessions = stored;

        if (!nextSessions.length) {
          const blank = createBlankSession();
          await putSession(blank);
          nextSessions = [blank];
        }

        const activeId = readStoredActiveSessionId();
        const selected = nextSessions.find((session) => session.id === activeId) ?? nextSessions[0];

        if (!mounted) return;
        setSessions(nextSessions);
        setLockedSessions([]);
        setActiveSession(selected);
        activeSessionRef.current = selected;
        setLastSavedAt(selected.updatedAt);
        storeActiveSessionId(selected.id);
      } catch {
        const blank = createBlankSession();
        if (!mounted) return;
        setSessions([blank]);
        setLockedSessions([]);
        setActiveSession(blank);
        activeSessionRef.current = blank;
        setLastSavedAt(null);
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

    storeActiveSessionId(activeSession.id);
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
    editor?.setEditable(vaultStatus !== "locked");
  }, [editor, vaultStatus]);

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
    chatImagesRef.current = chatImages;
  }, [chatImages]);

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
        translator: "Translator" in globalThis,
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
      multimodalLanguageModelRef.current.forEach((session) => session.destroy());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      chatImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
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
    if (!deleteTarget) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteTarget(null);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteTarget]);

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
  const vaultLocked = vaultStatus === "locked";
  const vaultEnabled = vaultStatus === "locked" || vaultStatus === "unlocked";
  const canSendChat = Boolean((chatInput.trim() || chatImages.length) && capabilities.prompt && activeSession && aiAction === null && !recordingTarget && !vaultLocked);
  const modelContextRatio =
    typeof modelInfo.contextUsage === "number" && typeof modelInfo.contextWindow === "number" && modelInfo.contextWindow > 0
      ? modelInfo.contextUsage / modelInfo.contextWindow
      : null;
  const offlineStorageRatio =
    typeof offlineInfo.storageUsage === "number" && typeof offlineInfo.storageQuota === "number" && offlineInfo.storageQuota > 0
      ? offlineInfo.storageUsage / offlineInfo.storageQuota
      : null;
  const modelUnsupported = aiStatus === "unsupported" || modelInfo.availability === "unsupported";
  const modelUnavailable = aiStatus === "unavailable" || modelInfo.availability === "unavailable";

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
              content: MULTIMODAL_SYSTEM_PROMPT,
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

  const ensureMultimodalLanguageModel = useCallback(async (inputTypes: MultimodalInputType[]) => {
    const key = multimodalKey(inputTypes);
    const existing = multimodalLanguageModelRef.current.get(key);
    if (existing) return existing;

    const pending = creatingMultimodalModelRef.current.get(key);
    if (pending) return pending;

    if (!("LanguageModel" in globalThis)) {
      throw new Error("Chrome built-in AI is not available in this browser.");
    }

    const options = buildMultimodalOptions(inputTypes);
    const promise = (async () => {
      setAiProgress(null);

      const availability = await LanguageModel.availability(options);
      if (availability === "unavailable") {
        throw new Error("Gemini Nano multimodal input is unavailable on this device or Chrome profile.");
      }

      const session = await LanguageModel.create({
        ...options,
        initialPrompts: [
          {
            role: "system",
            content: MULTIMODAL_SYSTEM_PROMPT,
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
            setAiProgress(Math.max(0, Math.min(1, progress)));
          });
        },
      });

      multimodalLanguageModelRef.current.set(key, session);
      setAiProgress(null);
      return session;
    })();

    creatingMultimodalModelRef.current.set(key, promise);

    try {
      return await promise;
    } finally {
      creatingMultimodalModelRef.current.delete(key);
      setAiProgress(null);
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
      if (!editor || vaultLocked || !text.trim()) return;
      editor.chain().focus().insertContent(text).run();
      scheduleSave(editor);
    },
    [editor, scheduleSave, vaultLocked],
  );

  const applyDraftUpdate = useCallback(
    (update: DraftUpdate) => {
      if (!editor || vaultLocked || !update.text.trim()) return false;

      clearEditorGhostCompletion(editor);
      setGhostCompletionText("");
      completionRequestRef.current += 1;
      editor.commands.setContent(update.text, { contentType: "markdown" });
      editor.commands.focus("end");
      scheduleSave(editor);
      return true;
    },
    [editor, scheduleSave, vaultLocked],
  );

  const transcribeAudio = useCallback(
    async (audio: Blob) => {
      const model = await ensureMultimodalLanguageModel(["audio"]);
      const result = await model.prompt([
        {
          role: "user",
          content: [
            {
              type: "text",
              value:
                "Transcribe the attached speech to plain text. Return only the spoken words. Do not summarize, explain, add punctuation beyond natural sentence punctuation, or wrap the result in quotes.",
            },
            { type: "audio", value: asModelContentValue(audio) },
          ],
        },
      ]);

      return stripJsonFences(result).trim();
    },
    [ensureMultimodalLanguageModel],
  );

  const handleRecordedAudio = useCallback(
    async (target: RecordingTarget, audio: Blob) => {
      if (!audio.size) {
        const message = "No speech was captured.";
        if (target === "chat") setChatError(message);
        else setAiError(message);
        return;
      }

      setAiAction("transcribe");
      setChatError("");
      setAiError("");

      try {
        const transcript = await transcribeAudio(audio);
        if (!transcript) throw new Error("Chrome returned an empty transcript.");

        if (target === "chat") {
          setAiSidebarOpen(true);
          setAiTab("chat");
          setChatInput((current) => (current.trim() ? `${current.trim()} ${transcript}` : transcript));
          window.setTimeout(() => chatInputRef.current?.focus(), 0);
        } else {
          if (!editor) throw new Error("The editor is not ready.");
          clearEditorGhostCompletion(editor);
          setGhostCompletionText("");
          completionRequestRef.current += 1;
          editor.chain().focus().insertContent(transcript).run();
          scheduleSave(editor);
        }
      } catch (error) {
        const details = error instanceof Error ? error.message : "Speech transcription failed.";
        const message = `${details} Chrome local audio input requires desktop Chrome with Gemini Nano multimodal support.`;
        if (target === "chat") setChatError(message);
        else setAiError(message);
      } finally {
        setAiAction(null);
      }
    },
    [editor, scheduleSave, transcribeAudio],
  );

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const startRecording = useCallback(
    async (target: RecordingTarget) => {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        const message = "Microphone recording is not available in this browser.";
        if (target === "chat") setChatError(message);
        else setAiError(message);
        return;
      }

      if (recordingTarget) {
        if (recordingTarget === target) stopRecording();
        return;
      }

      setChatError("");
      setAiError("");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);

        mediaStreamRef.current = stream;
        mediaRecorderRef.current = recorder;
        mediaChunksRef.current = [];

        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size) mediaChunksRef.current.push(event.data);
        });

        recorder.addEventListener("stop", () => {
          const chunks = mediaChunksRef.current;
          const type = recorder.mimeType || "audio/webm";
          const audio = new Blob(chunks, { type });

          mediaChunksRef.current = [];
          mediaRecorderRef.current = null;
          mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
          setRecordingTarget(null);

          void handleRecordedAudio(target, audio);
        });

        recorder.start();
        setRecordingTarget(target);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not access the microphone.";
        if (target === "chat") setChatError(message);
        else setAiError(message);
      }
    },
    [handleRecordedAudio, recordingTarget, stopRecording],
  );

  const toggleRecording = useCallback(
    async (target: RecordingTarget) => {
      if (recordingTarget === target) {
        stopRecording();
        return;
      }

      await startRecording(target);
    },
    [recordingTarget, startRecording, stopRecording],
  );

  const handleChatImageSelection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;

    setChatImages((current) => {
      const remainingSlots = Math.max(0, 4 - current.length);
      const next = files.slice(0, remainingSlots).map((file) => ({
        id: crypto.randomUUID(),
        name: file.name || "image",
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...current, ...next];
    });

    event.target.value = "";
  }, []);

  const removeChatImage = useCallback((id: string) => {
    setChatImages((current) => {
      const image = current.find((item) => item.id === id);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }, []);

  const sendChatMessage = useCallback(async () => {
    const prompt = chatInput.trim();
    const session = activeSessionRef.current;
    const images = chatImages;
    if ((!prompt && !images.length) || !session || aiAction !== null || recordingTarget || !capabilities.prompt) return;

    const history = (session.chatMessages ?? []).filter((message) => !message.pending);
    const attachmentText = images.map((image) => `[image: ${image.name}]`).join("\n");
    const visiblePrompt = [prompt, attachmentText].filter(Boolean).join("\n");
    const effectivePrompt = prompt || "Use the attached image or images as context and help me reason about them.";
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: visiblePrompt,
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
    const modelPrompt = buildChatPrompt(effectivePrompt, draftText, history);

    setAiSidebarOpen(true);
    setAiTab("chat");
    setChatInput("");
    setChatImages([]);
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setChatError("");
    persistChatMessages(optimisticMessages);
    setAiAction("chat");

    try {
      const model = images.length ? await ensureMultimodalLanguageModel(["image"]) : await ensureLanguageModel();
      const raw = await promptChatModel(model, modelPrompt, images);
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
  }, [
    aiAction,
    applyDraftUpdate,
    capabilities.prompt,
    chatImages,
    chatInput,
    editor,
    ensureLanguageModel,
    ensureMultimodalLanguageModel,
    persistChatMessages,
    recordingTarget,
  ]);

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

    if (!capabilities.prompt || aiAction || expressionTarget || postMenuOpen || vaultLocked || !selection.empty || !editor.isFocused) {
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
  }, [aiAction, capabilities.prompt, completionTick, editor, ensureLanguageModel, expressionTarget, postMenuOpen, selection.empty, vaultLocked]);

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

  const detectSourceLanguage = useCallback(
    async (text: string) => {
      if (!capabilities.detector || !text.trim()) return "en";

      try {
        const availability = await LanguageDetector.availability();
        if (availability === "unavailable") return "en";

        const detector = await LanguageDetector.create({
          monitor(monitor) {
            monitor.addEventListener("downloadprogress", (event) => {
              if (event.loaded <= 1) setAiProgress(event.loaded);
            });
          },
        });
        const [first] = await detector.detect(text.slice(0, 1600));
        detector.destroy();

        const detected = first?.detectedLanguage || "en";
        const confidence = typeof first?.confidence === "number" ? ` ${Math.round(first.confidence * 100)}%` : "";
        setDetectedLanguage(`${detected}${confidence}`);
        return detected;
      } catch {
        return "en";
      }
    },
    [capabilities.detector],
  );

  const translateDraft = useCallback(async () => {
    const text = getModelText();
    if (!text) {
      setAiError("Write or select some text first.");
      return;
    }

    if (!capabilities.translator) {
      setAiError("Chrome Translator API is unavailable in this browser.");
      return;
    }

    setAiAction("translate");
    setAiError("");
    setAiOutput("");
    setLastTranslation("");

    try {
      const detectedSource = await detectSourceLanguage(text);
      const sourceLanguage = detectedSource;
      setTranslationSource(sourceLanguage);

      if (sourceLanguage === translationTarget) {
        setAiOutput(text);
        setLastTranslation(text);
        return;
      }

      const options: TranslatorCreateOptions = {
        sourceLanguage,
        targetLanguage: translationTarget,
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            const progress =
              event.lengthComputable && event.total > 0
                ? event.loaded / event.total
                : event.loaded <= 1
                  ? event.loaded
                  : 0;
            setAiProgress(Math.max(0, Math.min(1, progress)));
          });
        },
      };

      const availability = await Translator.availability(options);
      if (availability === "unavailable") {
        throw new Error(`Local translation from ${translationLabel(sourceLanguage)} to ${translationLabel(translationTarget)} is unavailable.`);
      }

      const translator = await Translator.create(options);
      const translated = await translator.translate(text);
      translator.destroy();

      setAiProgress(null);
      setLastTranslation(translated);
      setAiOutput(translated);
    } catch (error) {
      setAiProgress(null);
      setAiError(error instanceof Error ? error.message : "Translation failed.");
    } finally {
      setAiAction(null);
    }
  }, [capabilities.translator, detectSourceLanguage, getModelText, translationTarget]);

  const applyTranslation = useCallback(() => {
    if (!lastTranslation.trim() || selection.empty) return;
    replaceSelectionOrInsert(lastTranslation);
  }, [lastTranslation, replaceSelectionOrInsert, selection.empty]);

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
        await saveSession(next);
        setSaveState("saved");
        setLastSavedAt(Date.now());
      }

      setAiOutput(classification.nextMove);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Classification failed.");
    } finally {
      setAiAction(null);
    }
  }, [detectLanguage, ensureLanguageModel, getModelText, saveSession]);

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
        }
      }
    },
    [editor, ensureLanguageModel],
  );

  const handleEditorPointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!editor || vaultLocked || event.button !== 0) return;
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
    [closeExpressionPopover, editor, requestExpressionOptions, vaultLocked],
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

  const getCurrentSessionsSnapshot = useCallback(() => {
    const current = activeSessionRef.current;
    if (!editor || !current) return sessions;

    const plainText = editor.getText();
    const next: WriteSession = {
      ...current,
      title: deriveTitle(plainText),
      content: editor.getJSON(),
      plainText,
      updatedAt: Date.now(),
      wordCount: countWords(plainText),
    };

    return [next, ...sessions.filter((session) => session.id !== next.id)].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [editor, sessions]);

  const openVaultModal = useCallback(
    (view?: VaultModalView) => {
      setVaultError("");
      setVaultRecoveryInput("");
      setVaultModalView(view ?? (vaultStatus === "unlocked" ? "manage" : vaultStatus === "locked" ? "unlock" : "intro"));
      setVaultModalOpen(true);
    },
    [vaultStatus],
  );

  const loadUnlockedSessions = useCallback(
    async (vaultKey: CryptoKey) => {
      let nextSessions = await getSessions(vaultKey);

      if (!nextSessions.length) {
        const blank = createBlankSession();
        await putSession(blank, vaultKey);
        nextSessions = [blank];
      }

      const activeId = readStoredActiveSessionId();
      const selected = nextSessions.find((session) => session.id === activeId) ?? nextSessions[0];

      setSessions(nextSessions);
      setLockedSessions([]);
      setActiveSession(selected);
      activeSessionRef.current = selected;
      setLastSavedAt(selected.updatedAt);
      setSaveState("idle");
      storeActiveSessionId(selected.id);
    },
    [],
  );

  const unlockVaultWithKey = useCallback(
    async (vaultKey: CryptoKey) => {
      vaultKeyRef.current = vaultKey;
      await loadUnlockedSessions(vaultKey);
      setVaultStatus("unlocked");
      setVaultModalView("manage");
      setVaultModalOpen(false);
      setVaultError("");
    },
    [loadUnlockedSessions],
  );

  const unlockVaultWithPasskey = useCallback(async () => {
    const meta = vaultMeta ?? readVaultMeta();
    if (!meta) return;

    setVaultBusy(true);
    setVaultError("");

    try {
      const prf = await evaluateCredentialPrf(meta.credentialId, base64UrlToBytes(meta.salt));
      const wrappingKey = await deriveWrappingKey(prf, `passkey:${meta.id}`);
      const vaultKey = await unwrapVaultKey(meta, wrappingKey);
      await unlockVaultWithKey(vaultKey);
      setVaultMeta(meta);
    } catch (error) {
      setVaultError(error instanceof Error ? error.message : "Could not unlock Private Vault.");
    } finally {
      setVaultBusy(false);
    }
  }, [unlockVaultWithKey, vaultMeta]);

  const unlockVaultWithRecoveryKey = useCallback(async () => {
    const meta = vaultMeta ?? readVaultMeta();
    if (!meta?.recoveryWrappedKey) {
      setVaultError("This vault does not have a recovery key.");
      return;
    }

    setVaultBusy(true);
    setVaultError("");

    try {
      const recoveryBytes = hexToBytes(vaultRecoveryInput);
      const wrappingKey = await deriveWrappingKey(recoveryBytes, `recovery:${meta.id}`);
      const rawVaultKey = await decryptBytes(wrappingKey, meta.recoveryWrappedKey);
      const vaultKey = await importAesKey(rawVaultKey);
      await unlockVaultWithKey(vaultKey);
      setVaultMeta(meta);
    } catch (error) {
      setVaultError(error instanceof Error ? error.message : "Recovery key could not unlock this vault.");
    } finally {
      setVaultBusy(false);
    }
  }, [unlockVaultWithKey, vaultMeta, vaultRecoveryInput]);

  const enableVault = useCallback(async () => {
    setVaultBusy(true);
    setVaultError("");

    try {
      ensureVaultRuntime();

      const sessionsToEncrypt = getCurrentSessionsSnapshot();
      const vaultKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
      const rawVaultKey = new Uint8Array(await crypto.subtle.exportKey("raw", vaultKey));
      const salt = randomBytes(32);
      const vaultId = crypto.randomUUID();
      const credential = await createVaultCredential(salt);
      const prf = credential.prf ?? (await evaluateCredentialPrf(credential.credentialId, salt));
      const passkeyWrappingKey = await deriveWrappingKey(prf, `passkey:${vaultId}`);
      const wrappedKey = await encryptBytes(passkeyWrappingKey, rawVaultKey);
      const recoveryBytes = randomBytes(32);
      const recoveryWrappingKey = await deriveWrappingKey(recoveryBytes, `recovery:${vaultId}`);
      const recoveryWrappedKey = await encryptBytes(recoveryWrappingKey, rawVaultKey);
      const now = Date.now();
      const nextMeta: VaultMeta = {
        id: vaultId,
        version: 1,
        credentialId: credential.credentialId,
        salt: bytesToBase64Url(salt),
        wrappedKey,
        recoveryWrappedKey,
        createdAt: now,
        updatedAt: now,
      };

      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      writeVaultMeta(nextMeta);
      vaultKeyRef.current = vaultKey;
      try {
        await replaceAllSessions(sessionsToEncrypt, vaultKey);
      } catch (error) {
        clearVaultMeta();
        vaultKeyRef.current = null;
        throw error;
      }
      setVaultMeta(nextMeta);
      setVaultStatus("unlocked");
      setVaultRecoveryKey(formatRecoveryKey(recoveryBytes));
      setVaultModalView("manage");
      setSessions(sessionsToEncrypt);
      setLockedSessions([]);
      setActiveSession((current) => sessionsToEncrypt.find((session) => session.id === current?.id) ?? sessionsToEncrypt[0] ?? null);
      activeSessionRef.current = sessionsToEncrypt.find((session) => session.id === activeSessionRef.current?.id) ?? sessionsToEncrypt[0] ?? null;
      setSaveState("saved");
      setLastSavedAt(Date.now());
    } catch (error) {
      if (!vaultMeta) vaultKeyRef.current = null;
      setVaultError(error instanceof Error ? error.message : "Could not enable Private Vault.");
      setVaultStatus(vaultMeta ? "locked" : "disabled");
    } finally {
      setVaultBusy(false);
    }
  }, [getCurrentSessionsSnapshot, vaultMeta]);

  const lockVault = useCallback(async () => {
    const summaries = await getLockedSessionSummaries().catch(() => []);
    vaultKeyRef.current = null;
    activeSessionRef.current = null;
    setSessions([]);
    setLockedSessions(summaries);
    setActiveSession(null);
    setLastSavedAt(summaries[0]?.updatedAt ?? null);
    setSaveState("idle");
    setAiOutput("");
    setAiError("");
    setChatError("");
    setExpressionTarget(null);
    setGhostCompletionText("");
    if (editor) {
      clearEditorGhostCompletion(editor);
      editor.commands.clearContent();
    }
    languageModelRef.current?.destroy();
    languageModelRef.current = null;
    multimodalLanguageModelRef.current.forEach((session) => session.destroy());
    multimodalLanguageModelRef.current.clear();
    setVaultStatus("locked");
    setVaultModalView("unlock");
    setVaultModalOpen(false);
  }, [editor]);

  const disableVault = useCallback(async () => {
    if (!vaultKeyRef.current || vaultStatus !== "unlocked") {
      setVaultError("Unlock Private Vault before removing encryption.");
      setVaultModalView("unlock");
      return;
    }

    setVaultBusy(true);
    setVaultError("");

    try {
      const sessionsToWrite = getCurrentSessionsSnapshot();
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      await replaceAllSessions(sessionsToWrite, null);
      clearVaultMeta();
      vaultKeyRef.current = null;
      setVaultMeta(null);
      setVaultStatus("disabled");
      setVaultRecoveryKey("");
      setVaultRecoveryInput("");
      setVaultModalView("intro");
      setVaultModalOpen(false);
      setSessions(sessionsToWrite);
      setLockedSessions([]);
      setSaveState("saved");
      setLastSavedAt(Date.now());
    } catch (error) {
      setVaultError(error instanceof Error ? error.message : "Could not remove encryption.");
    } finally {
      setVaultBusy(false);
    }
  }, [getCurrentSessionsSnapshot, vaultStatus]);

  const createSession = useCallback(async () => {
    if (vaultLocked) {
      openVaultModal("unlock");
      return;
    }

    const blank = createBlankSession();
    await saveSession(blank);
    setSessions((previous) => [blank, ...previous]);
    setActiveSession(blank);
    activeSessionRef.current = blank;
    storeActiveSessionId(blank.id);
    setLastSavedAt(blank.updatedAt);
    setSaveState("saved");
    setAiOutput("");
    setAiError("");
    setChatError("");
  }, [openVaultModal, saveSession, vaultLocked]);

  const selectSession = useCallback((session: WriteSession) => {
    setActiveSession(session);
    activeSessionRef.current = session;
    storeActiveSessionId(session.id);
    setLastSavedAt(session.updatedAt);
    setSaveState("idle");
    setAiOutput("");
    setAiError("");
    setChatError("");
  }, []);

  const requestDeleteSession = useCallback((session: WriteSession) => {
    setPostMenuOpen(false);
    setDeleteTarget(session);
  }, []);

  const confirmDeleteSession = useCallback(async () => {
    if (!deleteTarget) return;

    const deletingActiveSession = activeSession?.id === deleteTarget.id;
    setPostMenuOpen(false);
    await removeSession(deleteTarget.id);
    const remaining = sessions.filter((session) => session.id !== deleteTarget.id);
    setDeleteTarget(null);

    if (remaining.length) {
      setSessions(remaining);

      if (deletingActiveSession) {
        setActiveSession(remaining[0]);
        activeSessionRef.current = remaining[0];
        storeActiveSessionId(remaining[0].id);
        setLastSavedAt(remaining[0].updatedAt);
        setSaveState("idle");
        setChatError("");
      }

      return;
    }

    const blank = createBlankSession();
    await saveSession(blank);
    setSessions([blank]);
    setActiveSession(blank);
    activeSessionRef.current = blank;
    storeActiveSessionId(blank.id);
    setLastSavedAt(blank.updatedAt);
    setSaveState("saved");
    setChatError("");
  }, [activeSession?.id, deleteTarget, saveSession, sessions]);

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
      disabled={disabled || vaultLocked}
      onClick={onClick}
    >
      {children}
    </button>
  );

  const appClassName = ["editor-app", aiSidebarOpen ? "is-ai-open" : "", focusMode ? "is-focus-mode" : ""].filter(Boolean).join(" ");

  return (
    <div className={appClassName}>
      <aside className="session-rail" aria-label="Writing sessions" aria-hidden={focusMode}>
        <div className="rail-header">
          <div className="rail-title-block">
            <div className="rail-title-row">
              <h1>Drafts</h1>
              <button
                type="button"
                className="icon-button rail-add-button"
                onClick={createSession}
                disabled={chatPending || vaultLocked}
                aria-label="New draft"
                title={vaultLocked ? "Unlock drafts first" : "New draft"}
              >
                <Plus size={17} />
              </button>
            </div>
          </div>
        </div>

        <div className="session-list">
          {vaultLocked
            ? lockedSessions.map((session) => (
                <div key={session.id} className="session-item is-locked">
                  <button type="button" className="session-button is-locked" onClick={() => openVaultModal("unlock")}>
                    <span className="session-title">Locked draft</span>
                    <span className="session-meta">{formatUpdatedAt(session.updatedAt)}</span>
                  </button>
                </div>
              ))
            : sessions.map((session) => (
                <div key={session.id} className={activeSession?.id === session.id ? "session-item is-active" : "session-item"}>
                  <button
                    type="button"
                    className={activeSession?.id === session.id ? "session-button is-active" : "session-button"}
                    onClick={() => selectSession(session)}
                    disabled={chatPending}
                  >
                    <span className="session-title">{session.title}</span>
                    <span className="session-meta">
                      {session.wordCount} words · {formatUpdatedAt(session.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="session-delete-button"
                    onClick={() => requestDeleteSession(session)}
                    disabled={chatPending}
                    aria-label={`Delete ${session.title || "Untitled"}`}
                    title="Delete draft"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
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

              {modelUnsupported ? (
                <>
                  <span className="model-help-copy">
                    Local AI in Draftside uses Chrome's built-in Gemini Nano through the browser LanguageModel API. Safari does not expose that API, so the editor and offline drafts work here, but AI tools are disabled.
                  </span>
                  <span className="model-help-steps">
                    <span>
                      <strong>1</strong>
                      <em>Open this page in desktop Chrome.</em>
                    </span>
                    <span>
                      <strong>2</strong>
                      <em>Use a Chrome profile where built-in AI / Gemini Nano is available.</em>
                    </span>
                    <span>
                      <strong>3</strong>
                      <em>Leave the tab open while the badge changes from downloading to ready.</em>
                    </span>
                  </span>
                  <span className="model-popover-note">
                    Once Chrome downloads the model, Draftside can run completions, chat, rewrites, classification, and alternate phrasing locally.
                  </span>
                </>
              ) : modelUnavailable ? (
                <>
                  <span className="model-help-copy">
                    Chrome exposes the local AI API, but Gemini Nano is not available on this device or Chrome profile yet.
                  </span>
                  <span className="model-help-steps">
                    <span>
                      <strong>1</strong>
                      <em>Update Chrome and restart the browser.</em>
                    </span>
                    <span>
                      <strong>2</strong>
                      <em>Try a Chrome build/profile with built-in AI enabled.</em>
                    </span>
                    <span>
                      <strong>3</strong>
                      <em>Keep Draftside open while Chrome prepares the local model.</em>
                    </span>
                  </span>
                  <span className="model-popover-note">Your editor, drafts, and offline cache still work without the model.</span>
                </>
              ) : (
                <>
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
                  <span className={capabilityClass(capabilities.translator)}>translate</span>
                </span>

                  <span className="model-popover-note">
                    Inference stays on-device. Draftside requests English text in and out; storage is {storagePersisted ? "persistent" : "browser-managed"}.
                    {modelInfo.paramsError ? ` ${modelInfo.paramsError}` : ""}
                  </span>
                </>
              )}
              <span className="model-popover-foot">checked {formatModelInfoTime(modelInfo.checkedAt)}</span>
            </span>
          </span>
          <span className="save-status-wrap">
            <span className={`connectivity save-status ${saveState}`} tabIndex={0} aria-describedby="save-status-popover">
              <Save size={14} />
              {saveState}
            </span>
            <span id="save-status-popover" className="save-popover" role="tooltip">
              <span className="model-popover-title">
                <span>Local draft save</span>
                <span>{saveState}</span>
              </span>

              <span className="model-popover-grid">
                <span>
                  <strong>Last saved</strong>
                  <em>{formatSaveTime(lastSavedAt)}</em>
                </span>
                <span>
                  <strong>Last change</strong>
                  <em>{formatSaveTime(activeSession?.updatedAt)}</em>
                </span>
                <span>
                  <strong>Created</strong>
                  <em>{formatSaveTime(activeSession?.createdAt)}</em>
                </span>
                <span>
                  <strong>Current draft</strong>
                  <em>
                    {wordCount} words, {charCount} chars
                  </em>
                </span>
                <span>
                  <strong>Storage</strong>
                  <em>{storagePersisted === null ? "checking" : storagePersisted ? "persistent IndexedDB" : "browser-managed IndexedDB"}</em>
                </span>
                <span>
                  <strong>Session</strong>
                  <em>{activeSession?.title || "Untitled"}</em>
                </span>
              </span>

              <span className="model-popover-note">
                Draftside autosaves the active document to local IndexedDB about 420ms after edits. Chat history and AI classifications are stored with the same draft.
              </span>
            </span>
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
            className={recordingTarget === "editor" ? "icon-button is-active is-recording" : "icon-button"}
            onClick={() => void toggleRecording("editor")}
            disabled={vaultLocked || !capabilities.prompt || aiAction !== null || (recordingTarget !== null && recordingTarget !== "editor")}
            aria-label={recordingTarget === "editor" ? "Stop dictation" : "Dictate into editor"}
            title={recordingTarget === "editor" ? "Stop dictation" : "Dictate into editor"}
          >
            {recordingTarget === "editor" ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
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
            className={vaultEnabled ? "icon-button vault-button is-active" : "icon-button vault-button"}
            onClick={() => openVaultModal()}
            aria-label={vaultStatus === "locked" ? "Unlock Private Vault" : vaultStatus === "unlocked" ? "Manage Private Vault" : "Enable Private Vault"}
            aria-pressed={vaultEnabled}
            title={vaultStatus === "locked" ? "Unlock Private Vault" : vaultStatus === "unlocked" ? "Private Vault enabled" : "Private Vault"}
          >
            {vaultStatus === "unlocked" ? <LockOpen size={17} /> : <Lock size={17} />}
          </button>
          <button
            type="button"
            className={focusMode ? "icon-button is-active" : "icon-button"}
            onClick={() => setFocusMode((enabled) => !enabled)}
            aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
            aria-pressed={focusMode}
            title={focusMode ? "Exit focus mode" : "Focus mode"}
          >
            <Focus size={17} />
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
                <button
                  type="button"
                  role="menuitem"
                  className="post-menu-item is-danger"
                  onClick={() => activeSession && requestDeleteSession(activeSession)}
                  disabled={chatPending || !activeSession}
                >
                  <Trash2 size={16} />
                  Delete draft
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="editor-scroll">
          {vaultLocked ? (
            <section className="vault-locked-panel" aria-label="Private Vault locked">
              <div className="vault-locked-icon">
                <Lock size={22} />
              </div>
              <h2>Private Vault is locked</h2>
              <p>Your drafts are encrypted on this device. Unlock with your passkey to read, edit, export, or use local AI.</p>
              <button type="button" onClick={() => openVaultModal("unlock")}>
                Unlock drafts
              </button>
            </section>
          ) : (
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
          )}
        </div>

        <footer className="editor-footer" aria-label="Editor status">
          <div className="editor-footer-metrics" aria-live="polite">
            <span>{wordCount} words</span>
            <span>{charCount} chars</span>
            <a
              href="https://github.com/seeARMS/draftside"
              target="_blank"
              rel="noopener noreferrer"
              className="editor-footer-github"
              aria-label="View source on GitHub"
              title="View source on GitHub"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            </a>
          </div>
        </footer>
      </main>

      <aside id="draftside-ai-rail" className="ai-rail" aria-label="Local AI" aria-hidden={focusMode || !aiSidebarOpen}>
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
              {chatImages.length ? (
                <div className="chat-attachments" aria-label="Attached images">
                  {chatImages.map((image) => (
                    <span key={image.id} className="chat-attachment">
                      <img src={image.previewUrl} alt="" />
                      <span>{image.name}</span>
                      <button type="button" onClick={() => removeChatImage(image.id)} aria-label={`Remove ${image.name}`} title="Remove image">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="chat-input-row">
                <input
                  ref={chatImageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="visually-hidden"
                  onChange={handleChatImageSelection}
                  aria-label="Attach images"
                />
                <button
                  type="button"
                  className="chat-tool-button"
                  onClick={() => chatImageInputRef.current?.click()}
                  disabled={!capabilities.prompt || aiAction !== null || !activeSession || chatImages.length >= 4}
                  aria-label="Attach image"
                  title="Attach image"
                >
                  <ImageIcon size={15} />
                </button>
                <button
                  type="button"
                  className={recordingTarget === "chat" ? "chat-tool-button is-recording" : "chat-tool-button"}
                  onClick={() => void toggleRecording("chat")}
                  disabled={!capabilities.prompt || aiAction !== null || !activeSession || (recordingTarget !== null && recordingTarget !== "chat")}
                  aria-label={recordingTarget === "chat" ? "Stop voice input" : "Voice input"}
                  title={recordingTarget === "chat" ? "Stop voice input" : "Voice input"}
                >
                  {recordingTarget === "chat" ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={handleChatComposerKeyDown}
                  disabled={!capabilities.prompt || aiAction !== null || !activeSession}
                  rows={1}
                  placeholder={
                    recordingTarget === "chat"
                      ? "Listening..."
                      : aiAction === "transcribe"
                        ? "Transcribing locally..."
                        : capabilities.prompt
                          ? "Ask anything..."
                          : "Chrome built-in AI is unavailable"
                  }
                  aria-label="Chat with Draftside"
                />
                <button type="submit" className="chat-send-button" aria-label="Send message" disabled={!canSendChat}>
                  {chatPending ? <LoaderCircle className="spin" size={15} /> : <ArrowUp size={15} />}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div id="ai-panel-tools" className="ai-tab-panel tools-panel" role="tabpanel" aria-labelledby="ai-tab-tools">
            <div className="capabilities">
              <span className={capabilityClass(capabilities.prompt)}>prompt</span>
              <span className={capabilityClass(capabilities.rewriter)}>rewrite</span>
              <span className={capabilityClass(capabilities.writer)}>write</span>
              <span className={capabilityClass(capabilities.detector)}>language</span>
              <span className={capabilityClass(capabilities.translator)}>translate</span>
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

            <div className="ai-section translate-section">
              <div className="section-title">
                <span>Translate</span>
                {translationSource ? (
                  <span className="language-pill">
                    <Languages size={13} />
                    {translationLabel(translationSource)} → {translationLabel(translationTarget)}
                  </span>
                ) : null}
              </div>

              <div className="translate-control">
                <label htmlFor="translation-target">To</label>
                <select id="translation-target" value={translationTarget} onChange={(event) => setTranslationTarget(event.target.value)} disabled={aiAction !== null}>
                  {TRANSLATION_LANGUAGES.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="translate-actions">
                <button type="button" onClick={translateDraft} disabled={aiAction !== null || !capabilities.translator || !activeText}>
                  {aiAction === "translate" ? <LoaderCircle className="spin" size={15} /> : <Languages size={15} />}
                  Translate {selection.empty ? "draft" : "selection"}
                </button>
                <button type="button" onClick={applyTranslation} disabled={selection.empty || !lastTranslation.trim() || aiAction !== null}>
                  <Check size={15} />
                  Replace selection
                </button>
              </div>
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
      {vaultModalOpen ? (
        <div
          className="vault-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !vaultBusy && !vaultRecoveryKey) setVaultModalOpen(false);
          }}
        >
          <div className="vault-dialog" role="dialog" aria-modal="true" aria-labelledby="vault-title">
            <div className="vault-dialog-header">
              <div className="vault-dialog-icon" aria-hidden="true">
                {vaultStatus === "unlocked" ? <LockOpen size={19} /> : <Lock size={19} />}
              </div>
              <div>
                <h2 id="vault-title">
                  {vaultModalView === "unlock"
                    ? "Unlock Private Vault"
                    : vaultModalView === "disable"
                      ? "Remove encryption?"
                      : "Private Vault"}
                </h2>
                <p>
                  {vaultModalView === "unlock"
                    ? "Use your passkey to decrypt drafts stored on this device."
                    : vaultModalView === "disable"
                      ? "Draftside will rewrite encrypted drafts as regular local drafts."
                      : "Encrypt every local draft before it is saved to this browser."}
                </p>
              </div>
            </div>

            {vaultError ? <p className="vault-error">{vaultError}</p> : null}

            {vaultModalView === "intro" ? (
              <div className="vault-stack">
                <div className="vault-feature-grid">
                  <span>
                    <strong>Passkey unlock</strong>
                    <em>Touch ID, device PIN, or another passkey method.</em>
                  </span>
                  <span>
                    <strong>Local encryption</strong>
                    <em>Drafts are encrypted in IndexedDB with AES-GCM.</em>
                  </span>
                  <span>
                    <strong>Offline first</strong>
                    <em>No account or server is required to unlock drafts.</em>
                  </span>
                  <span>
                    <strong>Recovery key</strong>
                    <em>Generated once in case the passkey is unavailable.</em>
                  </span>
                </div>
                <p className="vault-note">
                  Private Vault requires passkey PRF support. If this browser or authenticator cannot provide PRF output, Draftside will leave drafts unencrypted.
                </p>
                <div className="vault-actions">
                  <button type="button" className="vault-secondary" onClick={() => setVaultModalOpen(false)} disabled={vaultBusy}>
                    Cancel
                  </button>
                  <button type="button" className="vault-primary" onClick={() => void enableVault()} disabled={vaultBusy}>
                    {vaultBusy ? <LoaderCircle className="spin" size={15} /> : <Lock size={15} />}
                    Enable Private Vault
                  </button>
                </div>
              </div>
            ) : null}

            {vaultModalView === "unlock" ? (
              <div className="vault-stack">
                <button type="button" className="vault-primary vault-full-button" onClick={() => void unlockVaultWithPasskey()} disabled={vaultBusy}>
                  {vaultBusy ? <LoaderCircle className="spin" size={15} /> : <LockOpen size={15} />}
                  Unlock with passkey
                </button>

                {vaultMeta?.recoveryWrappedKey ? (
                  <div className="vault-recovery-unlock">
                    <label htmlFor="vault-recovery-input">Recovery key</label>
                    <textarea
                      id="vault-recovery-input"
                      value={vaultRecoveryInput}
                      onChange={(event) => setVaultRecoveryInput(event.target.value)}
                      placeholder="xxxx-xxxx-xxxx..."
                      rows={3}
                      disabled={vaultBusy}
                    />
                    <button type="button" className="vault-secondary" onClick={() => void unlockVaultWithRecoveryKey()} disabled={vaultBusy || !vaultRecoveryInput.trim()}>
                      Unlock with recovery key
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {vaultModalView === "manage" ? (
              <div className="vault-stack">
                {vaultRecoveryKey ? (
                  <div className="vault-recovery-card">
                    <strong>Save this recovery key now</strong>
                    <code>{vaultRecoveryKey}</code>
                    <p>Draftside will not show this key again. Store it somewhere private before closing this dialog.</p>
                    <div className="vault-actions">
                      <button type="button" className="vault-secondary" onClick={() => void writeClipboardText(vaultRecoveryKey)} disabled={vaultBusy}>
                        Copy key
                      </button>
                      <button type="button" className="vault-primary" onClick={() => setVaultRecoveryKey("")} disabled={vaultBusy}>
                        I saved it
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="vault-feature-grid">
                      <span>
                        <strong>Status</strong>
                        <em>{vaultStatus === "unlocked" ? "unlocked on this tab" : vaultStatus}</em>
                      </span>
                      <span>
                        <strong>Protected drafts</strong>
                        <em>{sessions.length}</em>
                      </span>
                      <span>
                        <strong>Saved as</strong>
                        <em>encrypted records</em>
                      </span>
                      <span>
                        <strong>Recovery</strong>
                        <em>{vaultMeta?.recoveryWrappedKey ? "enabled" : "not set"}</em>
                      </span>
                    </div>
                    <div className="vault-actions">
                      <button type="button" className="vault-secondary" onClick={() => void lockVault()} disabled={vaultBusy}>
                        Lock now
                      </button>
                      <button type="button" className="vault-danger" onClick={() => setVaultModalView("disable")} disabled={vaultBusy}>
                        Remove encryption
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {vaultModalView === "disable" ? (
              <div className="vault-stack">
                <p className="vault-note">
                  This keeps your drafts on this device, but rewrites them as plaintext local records. You can enable Private Vault again later.
                </p>
                <div className="vault-actions">
                  <button type="button" className="vault-secondary" onClick={() => setVaultModalView("manage")} disabled={vaultBusy}>
                    Back
                  </button>
                  <button type="button" className="vault-danger" onClick={() => void disableVault()} disabled={vaultBusy}>
                    {vaultBusy ? <LoaderCircle className="spin" size={15} /> : <LockOpen size={15} />}
                    Remove encryption
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {deleteTarget ? (
        <div
          className="confirm-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-draft-title" aria-describedby="delete-draft-description">
            <div className="confirm-icon" aria-hidden="true">
              <Trash2 size={18} />
            </div>
            <div className="confirm-copy">
              <h2 id="delete-draft-title">Delete draft?</h2>
              <p id="delete-draft-description">
                Delete "{deleteTarget.title || "Untitled"}" from this browser. This cannot be undone.
              </p>
            </div>
            <div className="confirm-actions">
              <button type="button" className="confirm-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="confirm-danger" onClick={() => void confirmDeleteSession()} disabled={chatPending}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
