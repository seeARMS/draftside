import { EditorContent, useEditor } from "@tiptap/react";
import { ConfirmDeleteDialog } from "./components/ConfirmDeleteDialog";
import { VaultDialog } from "./components/VaultDialog";
import {
  ArrowUp,
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
  Pause,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Plus,
  Quote,
  Redo2,
  Save,
  Sparkles,
  Sun,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Wand2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CHAT_RESPONSE_CONSTRAINT,
  EMPTY_DOC,
  LANGUAGE_MODEL_OPTIONS,
  MULTIMODAL_SYSTEM_PROMPT,
  THEME_KEY,
  TRANSLATION_LANGUAGES,
  asModelContentValue,
  base64UrlToBytes,
  buildAmbientPrompt,
  buildChatPrompt,
  buildMultimodalOptions,
  bytesToBase64Url,
  capabilityClass,
  cleanGhostCompletion,
  clearEditorGhostCompletion,
  countWords,
  createBlankSession,
  createEditorExtensions,
  createVaultCredential,
  decryptBytes,
  deriveTitle,
  deriveWrappingKey,
  documentToMarkdown,
  downloadTextFile,
  encryptBytes,
  evaluateCredentialPrf,
  escapeHtml,
  expressionTargetFromSelection,
  fileSafeTitle,
  fingerprintText,
  formatBytes,
  formatModelInfoTime,
  formatNumber,
  formatPercent,
  formatRecoveryKey,
  formatSaveTime,
  formatUpdatedAt,
  getCompletionContext,
  getDraftsideCacheStats,
  getLockedSessionSummaries,
  getSessions,
  ghostCompletionKey,
  hexToBytes,
  importAesKey,
  multimodalKey,
  parseAmbientResponse,
  parseChatResponse,
  parseExpressionOptions,
  promptChatModel,
  putSession,
  randomBytes,
  readStoredActiveSessionId,
  readStoredUiPrefs,
  readTextStream,
  readVaultMeta,
  removeSession,
  replaceAllSessions,
  setEditorGhostCompletion,
  statusLabel,
  storeActiveSessionId,
  stripJsonFences,
  truncateForModel,
  translationLabel,
  unwrapVaultKey,
  writeClipboardText,
  writeStoredUiPrefs,
  writeVaultMeta,
  clearVaultMeta,
  ensureVaultRuntime,
  type AiAction,
  type AiStatus,
  type AiTab,
  type AmbientStatus,
  type Capabilities,
  type ChatImageAttachment,
  type ChatMessage,
  type Classification,
  type DraftUpdate,
  type ExpressionOption,
  type ExpressionTarget,
  type LockedSessionSummary,
  type ModelRuntimeInfo,
  type MultimodalInputType,
  type OfflineRuntimeInfo,
  type RecordingTarget,
  type SaveState,
  type SelectionSnapshot,
  type ThemeMode,
  type VaultMeta,
  type VaultModalView,
  type VaultStatus,
  type WriteSession,
} from "./editorCore";

type TooltipPlacement = "top" | "right" | "bottom" | "left";

type ActiveTooltip = {
  label: string;
  placement: TooltipPlacement;
  size?: "wide";
  x: number;
  y: number;
};

type PwaInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const isStandalonePwa = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
};

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
  const [liveAnalysisEnabled, setLiveAnalysisEnabled] = useState(() => readStoredUiPrefs().liveAnalysis ?? true);
  const [ambientStatus, setAmbientStatus] = useState<AmbientStatus>("idle");
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
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);
  const [installPrompt, setInstallPrompt] = useState<PwaInstallPromptEvent | null>(null);
  const [pwaInstalled, setPwaInstalled] = useState(() => isStandalonePwa());

  const saveTimerRef = useRef<number | null>(null);
  const completionTimerRef = useRef<number | null>(null);
  const completionRequestRef = useRef(0);
  const ambientTimerRef = useRef<number | null>(null);
  const ambientRequestRef = useRef(0);
  const ambientAbortRef = useRef<AbortController | null>(null);
  const ambientFingerprintRef = useRef<string>("");
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
  const tooltipTargetRef = useRef<HTMLElement | null>(null);

  const saveSession = useCallback((session: WriteSession) => putSession(session, vaultKeyRef.current), []);

  const extensions = useMemo(() => createEditorExtensions(), []);

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
    ambientFingerprintRef.current = activeSession?.classification?.fingerprint ?? "";
  }, [activeSession?.id, activeSession?.classification?.fingerprint]);

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
    setPwaInstalled(isStandalonePwa());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isStandalonePwa()) setInstallPrompt(event as PwaInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setPwaInstalled(true);
    };

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => setPwaInstalled(isStandalonePwa());

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneQuery.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener?.("change", handleDisplayModeChange);
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
  const ambientStatusLabel = !liveAnalysisEnabled
    ? "Live analysis paused"
    : ambientStatus === "thinking"
      ? "Reading the draft…"
      : ambientStatus === "stale"
        ? "Catching up…"
        : ambientStatus === "tentative"
          ? "Tentative — too early"
          : ambientStatus === "ready"
            ? "Caught up"
            : ambientStatus === "error"
              ? "Could not read"
              : "Waiting for text";
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
  const offlineReady = offlineInfo.controlled;
  const offlineBadgeLabel = offlineReady ? "offline ready" : online ? "online" : "offline";
  const installStatusLabel = pwaInstalled ? "installed" : installPrompt ? "ready" : offlineReady ? "browser menu" : "setting up";

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

  const installDraftside = useCallback(async () => {
    if (pwaInstalled) return;

    if (!installPrompt) {
      void refreshOfflineInfo();
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setPwaInstalled(true);
    } finally {
      setInstallPrompt(null);
      void refreshOfflineInfo();
    }
  }, [installPrompt, pwaInstalled, refreshOfflineInfo]);

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

  const toggleLiveAnalysis = useCallback(() => {
    setLiveAnalysisEnabled((previous) => {
      const next = !previous;
      writeStoredUiPrefs({ liveAnalysis: next });
      return next;
    });
  }, []);

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

  const runAmbientPass = useCallback(
    async (text: string, fingerprint: string) => {
      const requestId = ambientRequestRef.current + 1;
      ambientRequestRef.current = requestId;

      ambientAbortRef.current?.abort();
      const controller = new AbortController();
      ambientAbortRef.current = controller;

      setAmbientStatus("thinking");

      void detectLanguage(text);

      try {
        const model = await ensureLanguageModel();
        if (controller.signal.aborted || ambientRequestRef.current !== requestId) return;

        const result = await model.prompt(
          [{ role: "user", content: buildAmbientPrompt(truncateForModel(text, 4800)) }],
          { signal: controller.signal },
        );

        if (controller.signal.aborted || ambientRequestRef.current !== requestId) return;

        const next: Classification = {
          ...parseAmbientResponse(result),
          fingerprint,
          updatedAt: Date.now(),
        };

        const current = activeSessionRef.current;
        if (!current) {
          setAmbientStatus("idle");
          return;
        }

        const updated: WriteSession = { ...current, classification: next, updatedAt: Date.now() };
        activeSessionRef.current = updated;
        setActiveSession(updated);
        setSessions((previous) => [updated, ...previous.filter((session) => session.id !== updated.id)].sort((a, b) => b.updatedAt - a.updatedAt));
        ambientFingerprintRef.current = fingerprint;
        setAmbientStatus("ready");

        try {
          await saveSession(updated);
        } catch {
          // Ambient analysis is best-effort; ignore persistence hiccups.
        }
      } catch (error) {
        if (controller.signal.aborted || ambientRequestRef.current !== requestId) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAmbientStatus("error");
      } finally {
        if (ambientAbortRef.current === controller) {
          ambientAbortRef.current = null;
        }
      }
    },
    [detectLanguage, ensureLanguageModel, saveSession],
  );

  useEffect(() => {
    if (!liveAnalysisEnabled) {
      setAmbientStatus("off");
      ambientAbortRef.current?.abort();
      ambientAbortRef.current = null;
      ambientRequestRef.current += 1;
      if (ambientTimerRef.current) {
        window.clearTimeout(ambientTimerRef.current);
        ambientTimerRef.current = null;
      }
      return;
    }

    if (!capabilities.prompt || vaultLocked || !editor) {
      setAmbientStatus("idle");
      return;
    }

    const text = editor.getText().trim();
    if (!text) {
      setAmbientStatus("idle");
      return;
    }
    if (text.length < 30) {
      setAmbientStatus("tentative");
      return;
    }

    const fingerprint = fingerprintText(text);
    if (fingerprint === ambientFingerprintRef.current) {
      setAmbientStatus("ready");
      return;
    }

    if (aiAction !== null) {
      setAmbientStatus("stale");
      return;
    }

    setAmbientStatus("stale");
    if (ambientTimerRef.current) window.clearTimeout(ambientTimerRef.current);
    ambientTimerRef.current = window.setTimeout(() => {
      ambientTimerRef.current = null;
      void runAmbientPass(text, fingerprint);
    }, 1500);

    return () => {
      if (ambientTimerRef.current) {
        window.clearTimeout(ambientTimerRef.current);
        ambientTimerRef.current = null;
      }
    };
  }, [liveAnalysisEnabled, capabilities.prompt, vaultLocked, editor, completionTick, activeSession?.id, aiAction, runAmbientPass]);

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

  const tooltipProps = (label: string, placement: TooltipPlacement = "top", size?: "wide") => ({
    "data-tooltip": label,
    "data-tooltip-placement": placement,
    ...(size ? { "data-tooltip-size": size } : {}),
  });

  const aiActionTooltips = {
    tighten: "Rewrites the selected text to be shorter while preserving meaning and voice.",
    liveAnalysis: "Reads the draft on a debounce and surfaces form, intent, stance, friction, and an observation. Toggle off for battery or quiet typing.",
  };

  const showTooltipForElement = useCallback((element: HTMLElement) => {
    const label = element.dataset.tooltip;
    if (!label) return;

    const placement = (element.dataset.tooltipPlacement as TooltipPlacement | undefined) ?? "top";
    const size = element.dataset.tooltipSize === "wide" ? "wide" : undefined;
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    setActiveTooltip({
      label,
      placement,
      size,
      x: placement === "left" ? rect.left : placement === "right" ? rect.right : centerX,
      y: placement === "top" ? rect.top : placement === "bottom" ? rect.bottom : centerY,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    tooltipTargetRef.current = null;
    setActiveTooltip(null);
  }, []);

  const handleTooltipPointerOver = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-tooltip]") : null;
      if (!target || !event.currentTarget.contains(target)) return;

      tooltipTargetRef.current = target;
      showTooltipForElement(target);
    },
    [showTooltipForElement],
  );

  const handleTooltipPointerOut = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = tooltipTargetRef.current;
      const next = event.relatedTarget as Node | null;
      if (current && next && current.contains(next)) return;
      hideTooltip();
    },
    [hideTooltip],
  );

  const handleTooltipFocus = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-tooltip]") : null;
      if (!target || !event.currentTarget.contains(target)) return;

      tooltipTargetRef.current = target;
      showTooltipForElement(target);
    },
    [showTooltipForElement],
  );

  const handleTooltipBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>) => {
      const current = tooltipTargetRef.current;
      const next = event.relatedTarget as Node | null;
      if (current && next && current.contains(next)) return;
      hideTooltip();
    },
    [hideTooltip],
  );

  useEffect(() => {
    if (!activeTooltip) return;

    const updateTooltipPosition = () => {
      const target = tooltipTargetRef.current;
      if (!target?.isConnected) {
        hideTooltip();
        return;
      }

      showTooltipForElement(target);
    };

    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);
    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [activeTooltip, hideTooltip, showTooltipForElement]);

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
      disabled={disabled || vaultLocked}
      onClick={onClick}
      {...tooltipProps(label, "bottom")}
    >
      {children}
    </button>
  );

  const appClassName = ["editor-app", aiSidebarOpen ? "is-ai-open" : "", focusMode ? "is-focus-mode" : ""].filter(Boolean).join(" ");

  return (
    <div
      className={appClassName}
      onPointerOver={handleTooltipPointerOver}
      onPointerOut={handleTooltipPointerOut}
      onPointerDown={hideTooltip}
      onFocus={handleTooltipFocus}
      onBlur={handleTooltipBlur}
    >
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
                {...tooltipProps(vaultLocked ? "Unlock drafts first" : "New draft", "right")}
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
                    {...tooltipProps("Delete draft", "left")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
        </div>

        {!pwaInstalled ? (
          <div className={offlineReady ? "install-banner is-offline-ready" : "install-banner"}>
            <div className="install-banner-copy">
              <span className="install-banner-kicker">
                <Download size={13} />
                {installStatusLabel}
              </span>
              <strong>Install Draftside</strong>
              <span>Install once and keep writing offline.</span>
            </div>
            {installPrompt ? (
              <button type="button" onClick={() => void installDraftside()}>
                Install
              </button>
            ) : (
              <span className="install-banner-fallback">Browser menu</span>
            )}
          </div>
        ) : null}

        <div className="rail-footer">
          <span className="offline-status-wrap" onMouseEnter={() => void refreshOfflineInfo()} onFocus={() => void refreshOfflineInfo()}>
            <span className={offlineReady ? "connectivity is-offline-ready" : online ? "connectivity is-online" : "connectivity"} tabIndex={0} aria-describedby="offline-status-popover">
              {offlineReady ? <Check size={14} /> : online ? <Wifi size={14} /> : <WifiOff size={14} />}
              {offlineBadgeLabel}
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
                <span>
                  <strong>Install</strong>
                  <em>{installStatusLabel}</em>
                </span>
              </span>

              <span className="model-popover-note">
                Production builds register Chrome's service worker at scope /. It precaches / and /editor, the manifest, icons, fonts, and discovered app assets, then runtime-caches same-origin requests. Install adds a standalone launcher; drafts stay in IndexedDB and Gemini Nano runs locally after Chrome downloads it.
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
            {...tooltipProps(recordingTarget === "editor" ? "Stop dictation" : "Dictate into editor", "bottom")}
          >
            {recordingTarget === "editor" ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            {...tooltipProps(`Switch to ${theme === "dark" ? "light" : "dark"} mode`, "bottom")}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            type="button"
            className={vaultEnabled ? "icon-button vault-button is-active" : "icon-button vault-button"}
            onClick={() => openVaultModal()}
            aria-label={vaultStatus === "locked" ? "Unlock Private Vault" : vaultStatus === "unlocked" ? "Manage Private Vault" : "Enable Private Vault"}
            aria-pressed={vaultEnabled}
            {...tooltipProps(vaultStatus === "locked" ? "Unlock Private Vault" : vaultStatus === "unlocked" ? "Private Vault enabled" : "Private Vault", "bottom")}
          >
            {vaultStatus === "unlocked" ? <LockOpen size={17} /> : <Lock size={17} />}
          </button>
          <button
            type="button"
            className={focusMode ? "icon-button is-active" : "icon-button"}
            onClick={() => setFocusMode((enabled) => !enabled)}
            aria-label={focusMode ? "Exit focus mode" : "Enter focus mode"}
            aria-pressed={focusMode}
            {...tooltipProps(focusMode ? "Exit focus mode" : "Focus mode", "bottom")}
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

                  <div className="expression-footer">
                    <button
                      type="button"
                      className="expression-action"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        void rewriteSelection().finally(() => closeExpressionPopover());
                      }}
                      disabled={aiAction !== null}
                      {...tooltipProps(aiActionTooltips.tighten, "top", "wide")}
                    >
                      {aiAction === "rewrite" ? <LoaderCircle className="spin" size={13} /> : <Wand2 size={13} />}
                      Tighten selection
                    </button>
                  </div>
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
                      <button type="button" onClick={() => removeChatImage(image.id)} aria-label={`Remove ${image.name}`} {...tooltipProps("Remove image", "top")}>
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
                  {...tooltipProps("Attach image", "top")}
                >
                  <ImageIcon size={15} />
                </button>
                <button
                  type="button"
                  className={recordingTarget === "chat" ? "chat-tool-button is-recording" : "chat-tool-button"}
                  onClick={() => void toggleRecording("chat")}
                  disabled={!capabilities.prompt || aiAction !== null || !activeSession || (recordingTarget !== null && recordingTarget !== "chat")}
                  aria-label={recordingTarget === "chat" ? "Stop voice input" : "Voice input"}
                  {...tooltipProps(recordingTarget === "chat" ? "Stop voice input" : "Voice input", "top")}
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
                <button type="submit" className="chat-send-button" aria-label="Send message" disabled={!canSendChat} {...tooltipProps("Send message", "left")}>
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

            <div className="ai-section live-section">
              <div className="section-title">
                <span className="live-status">
                  <span className={`live-dot is-${ambientStatus}`} aria-hidden="true" />
                  <span>{ambientStatusLabel}</span>
                </span>
                <button
                  type="button"
                  className="live-toggle"
                  onClick={toggleLiveAnalysis}
                  aria-pressed={liveAnalysisEnabled}
                  {...tooltipProps(aiActionTooltips.liveAnalysis, "left", "wide")}
                >
                  {liveAnalysisEnabled ? <Pause size={13} /> : <Play size={13} />}
                  {liveAnalysisEnabled ? "Pause" : "Resume"}
                </button>
              </div>

              {currentClassification ? (
                <>
                  {currentClassification.observation ? (
                    <p className="ambient-observation">{currentClassification.observation}</p>
                  ) : null}
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
                  {currentClassification.nextMove ? (
                    <p className="ambient-next">
                      <span className="ambient-next-label">try next</span>
                      <span>{currentClassification.nextMove}</span>
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="muted-line">{liveAnalysisEnabled ? "Keep writing — Draftside reads along." : "Live analysis is paused."}</p>
              )}

              {currentClassification?.tags?.length ? (
                <div className="tag-row">
                  {currentClassification.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}

              {detectedLanguage ? (
                <div className="language-pill self-start">
                  <Languages size={13} />
                  {detectedLanguage}
                </div>
              ) : null}
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

            <div className="ai-section output-section">
              <div className="section-title">
                <span>Output</span>
                <button type="button" className="mini-icon" onClick={copyAiOutput} disabled={!aiOutput} aria-label="Copy output" {...tooltipProps("Copy output", "left")}>
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
      {activeTooltip ? (
        <div
          className={["editor-tooltip", `is-${activeTooltip.placement}`, activeTooltip.size ? `is-${activeTooltip.size}` : ""].filter(Boolean).join(" ")}
          role="tooltip"
          style={
            {
              "--tooltip-x": `${activeTooltip.x}px`,
              "--tooltip-y": `${activeTooltip.y}px`,
            } as React.CSSProperties
          }
        >
          {activeTooltip.label}
        </div>
      ) : null}
      {vaultModalOpen ? (
        <VaultDialog
          busy={vaultBusy}
          disableVault={disableVault}
          enableVault={enableVault}
          error={vaultError}
          lockVault={lockVault}
          modalView={vaultModalView}
          protectedDraftCount={sessions.length}
          recoveryInput={vaultRecoveryInput}
          recoveryKey={vaultRecoveryKey}
          setModalOpen={setVaultModalOpen}
          setModalView={setVaultModalView}
          setRecoveryInput={setVaultRecoveryInput}
          setRecoveryKey={setVaultRecoveryKey}
          status={vaultStatus}
          unlockWithPasskey={unlockVaultWithPasskey}
          unlockWithRecoveryKey={unlockVaultWithRecoveryKey}
          vaultMeta={vaultMeta}
        />
      ) : null}
      {deleteTarget ? (
        <ConfirmDeleteDialog busy={chatPending} confirmDelete={confirmDeleteSession} setDeleteTarget={setDeleteTarget} target={deleteTarget} />
      ) : null}
    </div>
  );
}
