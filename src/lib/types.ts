import type { JSONContent } from "@tiptap/core";

export type SaveState = "idle" | "saving" | "saved" | "error";
export type AiStatus = Availability | "idle" | "checking" | "creating" | "unsupported" | "error";
export type AiAction = "rewrite" | "chat" | "transcribe" | "translate" | null;
export type AiTab = "chat" | "tools";
export type AmbientStatus = "off" | "idle" | "tentative" | "stale" | "thinking" | "ready" | "error";
export type ThemeMode = "light" | "dark";
export type ChatRole = "user" | "assistant";
export type RecordingTarget = "chat" | "editor";
export type MultimodalInputType = "audio" | "image";
export type VaultStatus = "disabled" | "locked" | "unlocked";
export type VaultModalView = "intro" | "unlock" | "manage" | "disable";
export type EditorFont =
  | "geist"
  | "inter"
  | "helvetica"
  | "open-sans"
  | "charter"
  | "georgia"
  | "dm-mono"
  | "geist-mono";

export interface EditorUiPrefs {
  activeSessionId?: string;
  aiSidebarOpen?: boolean;
  aiTab?: AiTab;
  chatInput?: string;
  editorFont?: EditorFont;
  focusMode?: boolean;
  liveAnalysis?: boolean;
  translationTarget?: string;
}

export interface DraftUpdate {
  text: string;
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  pending?: boolean;
  draftUpdate?: DraftUpdate;
}

export interface ChatImageAttachment {
  id: string;
  name: string;
  file: File;
  previewUrl: string;
}

export interface Classification {
  form: string;
  intent: string;
  stance: string;
  friction: string;
  nextMove: string;
  confidence: number;
  tags: string[];
  observation?: string;
  fingerprint?: string;
  updatedAt?: number;
}

export interface WriteSession {
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

export interface EncryptedPayload {
  alg: "AES-GCM";
  data: string;
  iv: string;
}

export interface EncryptedSessionRecord {
  id: string;
  encrypted: true;
  version: 1;
  createdAt: number;
  updatedAt: number;
  ciphertext: EncryptedPayload;
}

export type StoredSessionRecord = WriteSession | EncryptedSessionRecord;

export interface LockedSessionSummary {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export interface VaultMeta {
  id: string;
  version: 1;
  credentialId: string;
  salt: string;
  wrappedKey: EncryptedPayload;
  recoveryWrappedKey?: EncryptedPayload;
  createdAt: number;
  updatedAt: number;
}

export interface Capabilities {
  prompt: boolean;
  rewriter: boolean;
  detector: boolean;
  translator: boolean;
}

export interface ModelRuntimeInfo {
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

export interface OfflineRuntimeInfo {
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

export interface SelectionSnapshot {
  empty: boolean;
  text: string;
}

export interface ExpressionPosition {
  left: number;
  top: number;
}

export interface ExpressionTarget {
  from: number;
  to: number;
  text: string;
  position: ExpressionPosition;
}

export interface ExpressionOption {
  text: string;
  note: string;
}

export interface GhostCompletionState {
  pos: number | null;
  text: string;
}

export interface CompletionContext {
  before: string;
  fingerprint: string;
  fragment: string;
  pos: number;
}
