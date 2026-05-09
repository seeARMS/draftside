import type { JSONContent } from "@tiptap/core";

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

export type {
  AiAction,
  AiStatus,
  AiTab,
  Capabilities,
  ChatImageAttachment,
  ChatMessage,
  Classification,
  CompletionContext,
  DraftUpdate,
  EditorUiPrefs,
  EncryptedPayload,
  EncryptedSessionRecord,
  ExpressionOption,
  ExpressionPosition,
  ExpressionTarget,
  GhostCompletionState,
  LockedSessionSummary,
  ModelRuntimeInfo,
  MultimodalInputType,
  OfflineRuntimeInfo,
  RecordingTarget,
  SaveState,
  SelectionSnapshot,
  StoredSessionRecord,
  ThemeMode,
  VaultMeta,
  VaultModalView,
  VaultStatus,
  WriteSession,
};
