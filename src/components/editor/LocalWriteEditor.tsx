import { useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AiAction, AiStatus, ChatMessage, ModelRuntimeInfo, SelectionSnapshot, WriteSession } from "../../lib/types";
import { EMPTY_DOC, countWords } from "../../lib/session";
import { documentToMarkdown, downloadTextFile, escapeHtml, fileSafeTitle, writeClipboardText } from "../../lib/markdown";
import { storeActiveSessionId } from "../../storage/prefs";
import { readVaultMeta } from "../../vault/crypto";
import { createEditorExtensions } from "../../tiptap/extensions";
import { clearEditorGhostCompletion, ghostCompletionKey } from "../../tiptap/ghostCompletion";
import { useTheme } from "./hooks/useTheme";
import { useUiPrefs } from "./hooks/useUiPrefs";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { usePwaInstall } from "./hooks/usePwaInstall";
import { useStoragePersistence } from "./hooks/useStoragePersistence";
import { useCapabilities } from "./hooks/useCapabilities";
import { useOfflineInfo } from "./hooks/useOfflineInfo";
import { useAiSession } from "./hooks/useAiSession";
import { useSessions } from "./hooks/useSessions";
import { useVault } from "./hooks/useVault";
import { useGhostCompletion } from "./hooks/useGhostCompletion";
import { useExpressionPopover } from "./hooks/useExpressionPopover";
import { useAmbientClassifier } from "./hooks/useAmbientClassifier";
import { useChat } from "./hooks/useChat";
import { useRecording } from "./hooks/useRecording";
import { useAiTools } from "./hooks/useAiTools";
import { useTooltip } from "./hooks/useTooltip";
import { useEditorDocumentTitle } from "./hooks/useEditorDocumentTitle";
import { usePointerDownOutside, useEscapeDismiss } from "./hooks/useEscapeDismiss";
import { SessionRail } from "./layout/SessionRail";
import { EditorToolbar } from "./layout/EditorToolbar";
import { EditorSurface } from "./layout/EditorSurface";
import { EditorFooter } from "./layout/EditorFooter";
import { AiRail } from "./ai-rail/AiRail";
import { AiChat } from "./ai-rail/AiChat";
import { AiTools } from "./ai-rail/AiTools";
import { TooltipLayer } from "./popovers/TooltipLayer";
import { VaultDialog } from "./dialogs/VaultDialog";
import { ConfirmDeleteDialog } from "./dialogs/ConfirmDeleteDialog";

const TIGHTEN_TOOLTIP = "Rewrites the selected text to be shorter while preserving meaning and voice.";
const LIVE_ANALYSIS_TOOLTIP =
  "Reads the draft on a debounce and surfaces form, intent, stance, friction, and an observation. Toggle off for battery or quiet typing.";

export default function LocalWriteEditor() {
  const initialVaultMeta = useMemo(() => readVaultMeta(), []);

  const { theme, toggleTheme } = useTheme();
  const [prefs, setPrefs] = useUiPrefs();
  const online = useOnlineStatus();
  const storagePersisted = useStoragePersistence();

  const [capabilitiesState, setCapabilitiesState] = useCapabilities();
  const { capabilities, aiStatus, modelInfo } = capabilitiesState;

  const [aiAction, setAiAction] = useState<AiAction>(null);
  const [aiOutput, setAiOutput] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiProgress, setAiProgress] = useState<number | null>(null);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [copiedPostMarkdown, setCopiedPostMarkdown] = useState(false);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WriteSession | null>(null);
  const [selection, setSelection] = useState<SelectionSnapshot>({ empty: true, text: "" });
  const [completionTick, setCompletionTick] = useState(0);

  const setAiStatus = useCallback(
    (next: AiStatus | ((current: AiStatus) => AiStatus)) => {
      setCapabilitiesState((current) => ({
        ...current,
        aiStatus: typeof next === "function" ? next(current.aiStatus) : next,
      }));
    },
    [setCapabilitiesState],
  );

  const setModelInfo = useCallback(
    (next: ModelRuntimeInfo | ((current: ModelRuntimeInfo) => ModelRuntimeInfo)) => {
      setCapabilitiesState((current) => ({
        ...current,
        modelInfo: typeof next === "function" ? next(current.modelInfo) : next,
      }));
    },
    [setCapabilitiesState],
  );

  const aiSession = useAiSession({
    setAiStatus,
    setModelInfo,
    setAiError,
    setAiProgress,
  });
  const { ensureLanguageModel, ensureMultimodalLanguageModel, refreshModelInfo, languageModelRef, creatingModelRef, destroyAllModels } = aiSession;

  const { offlineInfo, refreshOfflineInfo } = useOfflineInfo({ online, storagePersisted });

  const vaultKeyRefHolder = useRef<CryptoKey | null>(null);
  const sessionsHook = useSessions(vaultKeyRefHolder);
  const {
    sessions,
    lockedSessions,
    activeSession,
    activeSessionRef,
    saveState,
    lastSavedAt,
    setSaveState,
    setLastSavedAt,
    saveTimerRef,
    saveSession,
    scheduleSave,
    persistChatMessages,
    hydrateFromStorage,
    hydrateLocked,
    loadUnlockedSessions,
    setSessions,
    setLockedSessions,
    setActiveSession,
    selectSession,
    createSession,
    deleteSession,
    getCurrentSnapshot,
    replaceAll,
  } = sessionsHook;

  const skipUpdateRef = useRef(false);
  const extensions = useMemo(() => createEditorExtensions(), []);
  const { updateDocumentTitle } = useEditorDocumentTitle(activeSession);

  const onEditorUpdate = useCallback(
    (editor: import("@tiptap/core").Editor) => {
      if (skipUpdateRef.current) return;
      setExpressionTargetSetterRef.current?.();
      ghostRefSet.current?.();
      setCompletionTick((tick) => tick + 1);
      updateDocumentTitle(editor.getText());
      scheduleSave(editor);
    },
    [scheduleSave, updateDocumentTitle],
  );

  // Use refs to bridge between editor onUpdate (which doesn't know about hooks yet)
  // and the ghost completion / expression hooks. These get assigned below.
  const setExpressionTargetSetterRef = useRef<(() => void) | null>(null);
  const ghostRefSet = useRef<(() => void) | null>(null);

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
            ghostRefSet.current?.();
            return true;
          }
        }

        if (event.key === "Escape" && ghostCompletionKey.getState(view.state)?.text) {
          view.dispatch(view.state.tr.setMeta(ghostCompletionKey, { clear: true }));
          ghostRefSet.current?.();
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor: editorInstance }) => onEditorUpdate(editorInstance),
  });

  // Vault hook
  const tooltip = useTooltip();

  const resetUiOnLock = useCallback(() => {
    setAiOutput("");
    setAiError("");
  }, []);

  const vault = useVault({
    saveTimerRef,
    loadUnlockedSessions,
    hydrateLocked,
    getCurrentSnapshot: (e) => getCurrentSnapshot(e),
    replaceAll,
    setSessions,
    setLockedSessions,
    setActiveSession,
    activeSessionRef,
    setLastSavedAt,
    setSaveState,
    destroyAllModels,
    editor,
    resetUiOnLock,
  });
  vaultKeyRefHolder.current = vault.vaultKeyRef.current;

  // Sync vaultKeyRefHolder reactively with vault state
  useEffect(() => {
    vaultKeyRefHolder.current = vault.vaultKeyRef.current;
  }, [vault.state.status, vault.vaultKeyRef]);

  const vaultLocked = vault.state.status === "locked";
  const vaultEnabled = vault.state.status === "locked" || vault.state.status === "unlocked";

  // Initial hydration
  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (initialVaultMeta) {
        try {
          await hydrateLocked();
        } catch {
          // ignore
        }
        if (!mounted) return;
        return;
      }
      await hydrateFromStorage();
    })();
    return () => {
      mounted = false;
    };
  }, [hydrateFromStorage, hydrateLocked, initialVaultMeta]);

  // Sync editor content to active session
  useEffect(() => {
    if (!editor || !activeSession) return;

    storeActiveSessionId(activeSession.id);
    skipUpdateRef.current = true;
    editor.commands.setContent(activeSession.content);
    window.queueMicrotask(() => {
      skipUpdateRef.current = false;
      editor.commands.focus("end");
      setSelection({ empty: true, text: "" });
    });
  }, [activeSession?.id, editor]);

  useEffect(() => {
    editor?.setEditable(!vaultLocked);
  }, [editor, vaultLocked]);

  // Selection tracking
  useEffect(() => {
    if (!editor) return;

    const updateSelection = () => {
      const { from, to, empty } = editor.state.selection;
      const text = empty ? "" : editor.state.doc.textBetween(from, to, "\n").trim();
      setSelection({ empty, text });
    };

    const onSelectionChange = () => {
      updateSelection();
      ghostRefSet.current?.();
    };

    editor.on("selectionUpdate", onSelectionChange);
    editor.on("transaction", updateSelection);
    updateSelection();

    return () => {
      editor.off("selectionUpdate", onSelectionChange);
      editor.off("transaction", updateSelection);
    };
  }, [editor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      destroyAllModels();
    };
  }, [destroyAllModels, saveTimerRef]);

  // AI tools
  const aiTools = useAiTools({
    editor,
    vaultLocked,
    capabilities,
    selection,
    setAiAction,
    setAiStatus,
    setAiError,
    setAiOutput,
    setAiProgress,
    ensureLanguageModel,
    scheduleSave,
    translationTarget: prefs.translationTarget,
  });

  // Expression popover
  const expression = useExpressionPopover({
    editor,
    vaultLocked,
    ensureLanguageModel,
    scheduleSave,
  });

  // Ghost completion
  const ghost = useGhostCompletion({
    editor,
    enabled: capabilities.prompt && aiAction === null,
    selectionEmpty: selection.empty,
    expressionTargetActive: Boolean(expression.target),
    postMenuOpen,
    vaultLocked,
    completionTick,
    ensureLanguageModel,
  });

  // Wire setter refs (used by editor onUpdate handler)
  useEffect(() => {
    setExpressionTargetSetterRef.current = () => expression.setTarget(null);
    ghostRefSet.current = () => {
      if (editor) clearEditorGhostCompletion(editor);
      ghost.setGhostCompletionText("");
      ghost.completionRequestRef.current += 1;
    };
  }, [editor, expression, ghost]);

  // Ambient classifier
  const ambient = useAmbientClassifier({
    editor,
    capabilities,
    vaultLocked,
    liveAnalysisEnabled: prefs.liveAnalysis,
    aiAction,
    activeSession,
    activeSessionRef,
    setActiveSession,
    setSessions,
    saveSession,
    ensureLanguageModel,
    detectLanguage: aiTools.detectLanguage,
    completionTick,
  });

  // Chat
  const chat = useChat({
    editor,
    capabilities,
    vaultLocked,
    aiAction,
    setAiAction,
    recordingTarget: null, // wired below after recording is constructed
    activeSessionRef,
    persistChatMessages,
    ensureLanguageModel,
    ensureMultimodalLanguageModel,
    scheduleSave,
    setGhostCompletionText: ghost.setGhostCompletionText,
    completionRequestRef: ghost.completionRequestRef,
    initialChatInput: prefs.chatInput,
    setStoredChatInput: useCallback(
      (next: string) => {
        setPrefs((current) => ({ ...current, chatInput: next }));
      },
      [setPrefs],
    ),
    openSidebarChat: useCallback(() => {
      setPrefs((current) => ({ ...current, aiSidebarOpen: true, aiTab: "chat" }));
    }, [setPrefs]),
  });

  // Recording (depends on chat refs and openSidebarChat helper)
  const recording = useRecording({
    editor,
    scheduleSave,
    ensureMultimodalLanguageModel,
    setAiAction: setAiAction as (action: "transcribe" | null) => void,
    setAiError,
    setChatError: chat.setChatError,
    appendToChatInput: chat.appendToChatInput,
    openChatTab: useCallback(() => setPrefs((current) => ({ ...current, aiSidebarOpen: true, aiTab: "chat" })), [setPrefs]),
    setGhostCompletionText: ghost.setGhostCompletionText,
    completionRequestRef: ghost.completionRequestRef,
    chatInputRef: chat.chatInputRef,
  });

  // Patch chat to know about recordingTarget without creating circular dep
  const chatPending = aiAction === "chat";
  const canSendChat = Boolean(
    (chat.chatInput.trim() || chat.chatImages.length) &&
      capabilities.prompt &&
      activeSession &&
      aiAction === null &&
      !recording.recordingTarget &&
      !vaultLocked,
  );

  // Keep chat-messages scrolled
  useEffect(() => {
    const element = chat.chatMessagesRef.current;
    if (!element || prefs.aiTab !== "chat") return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [activeSession?.id, activeSession?.chatMessages, aiAction, chat.chatMessagesRef, prefs.aiTab]);

  // Focus chat input when sidebar/chat tab opens
  useEffect(() => {
    if (!prefs.aiSidebarOpen || prefs.aiTab !== "chat") return;
    const focusTimer = window.setTimeout(() => {
      chat.chatInputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(focusTimer);
  }, [prefs.aiSidebarOpen, prefs.aiTab, chat.chatInputRef]);

  // PWA install
  const pwa = usePwaInstall(refreshOfflineInfo);

  // Post menu dismiss
  const postMenuRef = useRef<HTMLDivElement>(null);
  usePointerDownOutside(postMenuOpen, postMenuRef, () => setPostMenuOpen(false));
  useEscapeDismiss(postMenuOpen, () => setPostMenuOpen(false));
  useEscapeDismiss(Boolean(deleteTarget), () => setDeleteTarget(null));

  // Derived UI values
  const activeText = editor?.getText().trim() ?? activeSession?.plainText.trim() ?? "";
  const wordCount = editor ? countWords(editor.getText()) : activeSession?.wordCount ?? 0;
  const charCount = editor?.storage.characterCount.characters() ?? activeSession?.plainText.length ?? 0;
  const currentClassification = activeSession?.classification;
  const ambientStatusLabel = !prefs.liveAnalysis
    ? "Live analysis paused"
    : ambient.status === "thinking"
      ? "Reading the draft…"
      : ambient.status === "stale"
        ? "Catching up…"
        : ambient.status === "tentative"
          ? "Tentative — too early"
          : ambient.status === "ready"
            ? "Caught up"
            : ambient.status === "error"
              ? "Could not read"
              : "Waiting for text";
  const chatMessages = activeSession?.chatMessages ?? [];
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
  const installStatusLabel = pwa.pwaInstalled ? "installed" : pwa.installPrompt ? "ready" : offlineReady ? "browser menu" : "setting up";

  // Toolbar/sessions actions
  const handleCreateSession = useCallback(async () => {
    if (vaultLocked) {
      vault.openVaultModal("unlock");
      return;
    }
    await createSession();
    setAiOutput("");
    setAiError("");
    chat.setChatError("");
  }, [chat, createSession, vault, vaultLocked]);

  const handleSelectSession = useCallback(
    (session: WriteSession) => {
      selectSession(session);
      setAiOutput("");
      setAiError("");
      chat.setChatError("");
    },
    [chat, selectSession],
  );

  const requestDeleteSession = useCallback((session: WriteSession) => {
    setPostMenuOpen(false);
    setDeleteTarget(session);
  }, []);

  const confirmDeleteSession = useCallback(async () => {
    if (!deleteTarget) return;
    setPostMenuOpen(false);
    await deleteSession(deleteTarget.id);
    setDeleteTarget(null);
    chat.setChatError("");
  }, [chat, deleteSession, deleteTarget]);

  const getCurrentDoc = useCallback(() => editor?.getJSON() ?? activeSession?.content ?? EMPTY_DOC, [activeSession?.content, editor]);

  const downloadHtml = useCallback(() => {
    if (!editor || !activeSession) return;

    const title = activeSession.title || "Untitled";
    const html = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1">\n    <title>${escapeHtml(title)}</title>\n  </head>\n  <body>\n    <article>\n      ${editor.getHTML()}\n    </article>\n  </body>\n</html>\n`;
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

  const toggleLiveAnalysis = useCallback(() => {
    setPrefs((current) => ({ ...current, liveAnalysis: !current.liveAnalysis }));
  }, [setPrefs]);

  const toggleFocusMode = useCallback(() => {
    setPrefs((current) => ({ ...current, focusMode: !current.focusMode }));
  }, [setPrefs]);

  const toggleAiSidebar = useCallback(() => {
    setPrefs((current) => ({ ...current, aiSidebarOpen: !current.aiSidebarOpen }));
  }, [setPrefs]);

  const setAiTab = useCallback(
    (tab: typeof prefs.aiTab) => {
      setPrefs((current) => ({ ...current, aiTab: tab }));
    },
    [setPrefs],
  );

  const setTranslationTarget = useCallback(
    (next: string) => {
      setPrefs((current) => ({ ...current, translationTarget: next }));
    },
    [setPrefs],
  );

  const swapTranslation = useCallback(() => {
    const source = aiTools.translationSource;
    if (!source || source === prefs.translationTarget) return;
    aiTools.setTranslationSource(prefs.translationTarget);
    setTranslationTarget(source);
  }, [aiTools, prefs.translationTarget, setTranslationTarget]);

  const togglePostMenu = useCallback(() => setPostMenuOpen((open) => !open), []);

  const onChatInputChange = useCallback(
    (next: string) => chat.setChatInput(next),
    [chat],
  );

  const appClassName = ["editor-app", prefs.aiSidebarOpen ? "is-ai-open" : "", prefs.focusMode ? "is-focus-mode" : ""].filter(Boolean).join(" ");

  return (
    <div
      className={appClassName}
      onPointerOver={tooltip.handlePointerOver}
      onPointerOut={tooltip.handlePointerOut}
      onPointerDown={tooltip.hideTooltip}
      onFocus={tooltip.handleFocus}
      onBlur={tooltip.handleBlur}
    >
      <SessionRail
        focusMode={prefs.focusMode}
        vaultLocked={vaultLocked}
        sessions={sessions}
        lockedSessions={lockedSessions}
        activeSession={activeSession}
        chatPending={chatPending}
        pwaInstalled={pwa.pwaInstalled}
        installPromptAvailable={Boolean(pwa.installPrompt)}
        installStatusLabel={installStatusLabel}
        offlineReady={offlineReady}
        offlineBadgeLabel={offlineBadgeLabel}
        online={online}
        offlineInfo={offlineInfo}
        offlineStorageRatio={offlineStorageRatio}
        storagePersisted={storagePersisted}
        aiStatus={aiStatus}
        aiAction={aiAction}
        aiProgress={aiProgress}
        modelInfo={modelInfo}
        modelContextRatio={modelContextRatio}
        modelUnsupported={modelUnsupported}
        modelUnavailable={modelUnavailable}
        capabilities={capabilities}
        hasActiveModelSession={Boolean(languageModelRef.current)}
        hasCreatingModelSession={Boolean(creatingModelRef.current)}
        saveState={saveState}
        lastSavedAt={lastSavedAt}
        wordCount={wordCount}
        charCount={charCount}
        refreshOfflineInfo={() => void refreshOfflineInfo()}
        refreshModelInfo={() => void refreshModelInfo()}
        onCreateSession={() => void handleCreateSession()}
        onSelectSession={handleSelectSession}
        onRequestDelete={requestDeleteSession}
        onUnlock={() => vault.openVaultModal("unlock")}
        onInstall={() => void pwa.install()}
        tooltipProps={tooltip.tooltipProps}
      />

      <main className="editor-main">
        <EditorToolbar
          editor={editor}
          vaultLocked={vaultLocked}
          vaultStatus={vault.state.status}
          vaultEnabled={vaultEnabled}
          capabilities={capabilities}
          aiAction={aiAction}
          recordingTarget={recording.recordingTarget}
          toggleRecording={recording.toggleRecording}
          theme={theme}
          toggleTheme={toggleTheme}
          openVaultModal={() => vault.openVaultModal()}
          focusMode={prefs.focusMode}
          toggleFocusMode={toggleFocusMode}
          aiSidebarOpen={prefs.aiSidebarOpen}
          toggleAiSidebar={toggleAiSidebar}
          postMenuOpen={postMenuOpen}
          togglePostMenu={togglePostMenu}
          postMenuRef={postMenuRef}
          copiedPostMarkdown={copiedPostMarkdown}
          chatPending={chatPending}
          activeSession={activeSession}
          onDownloadHtml={downloadHtml}
          onDownloadMarkdown={downloadMarkdown}
          onCopyMarkdown={() => void copyPostMarkdown()}
          onRequestDeleteActive={() => activeSession && requestDeleteSession(activeSession)}
          tooltipProps={tooltip.tooltipProps}
        />

        <EditorSurface
          editor={editor}
          vaultLocked={vaultLocked}
          ghostCompletionText={ghost.ghostCompletionText}
          onUnlock={() => vault.openVaultModal("unlock")}
          onPointerUp={expression.handleEditorPointerUp}
          expressionTarget={expression.target}
          expressionOptions={expression.options}
          expressionLoading={expression.loading}
          expressionError={expression.error}
          expressionPopoverRef={expression.popoverRef}
          applyExpressionOption={expression.applyOption}
          closeExpressionPopover={expression.close}
          rewriteSelection={aiTools.rewriteSelection}
          aiAction={aiAction}
          tooltipProps={tooltip.tooltipProps}
          tightenTooltip={TIGHTEN_TOOLTIP}
        />

        <EditorFooter wordCount={wordCount} charCount={charCount} />
      </main>

      <AiRail
        focusMode={prefs.focusMode}
        aiSidebarOpen={prefs.aiSidebarOpen}
        aiProgress={aiProgress}
        aiTab={prefs.aiTab}
        setAiTab={setAiTab}
      >
        {prefs.aiTab === "chat" ? (
          <AiChat
            chatMessages={chatMessages as ChatMessage[]}
            chatMessagesRef={chat.chatMessagesRef}
            chatInput={chat.chatInput}
            chatImages={chat.chatImages}
            chatError={chat.chatError}
            chatPending={chatPending}
            chatInputRef={chat.chatInputRef}
            chatImageInputRef={chat.chatImageInputRef}
            capabilities={capabilities}
            aiAction={aiAction}
            recordingTarget={recording.recordingTarget}
            activeSession={activeSession}
            canSendChat={canSendChat}
            onChatInputChange={onChatInputChange}
            onChatComposerKeyDown={chat.handleChatComposerKeyDown}
            onSendChat={() => void chat.sendChatMessage()}
            onSelectImages={chat.handleChatImageSelection}
            onRemoveImage={chat.removeChatImage}
            onToggleRecording={(target) => void recording.toggleRecording(target)}
            tooltipProps={tooltip.tooltipProps}
          />
        ) : (
          <AiTools
            capabilities={capabilities}
            aiAction={aiAction}
            ambientStatus={ambient.status}
            ambientStatusLabel={ambientStatusLabel}
            liveAnalysisEnabled={prefs.liveAnalysis}
            liveAnalysisTooltip={LIVE_ANALYSIS_TOOLTIP}
            toggleLiveAnalysis={toggleLiveAnalysis}
            currentClassification={currentClassification}
            detectedLanguage={aiTools.detectedLanguage}
            translationSource={aiTools.translationSource}
            translationTarget={prefs.translationTarget}
            setTranslationTarget={setTranslationTarget}
            translateDraft={() => void aiTools.translateDraft()}
            swapTranslation={swapTranslation}
            lastTranslation={aiTools.lastTranslation}
            selection={selection}
            activeText={activeText}
            aiError={aiError}
            copiedOutput={copiedOutput}
            copyAiOutput={() => void copyAiOutput()}
            tooltipProps={tooltip.tooltipProps}
          />
        )}
      </AiRail>

      <TooltipLayer activeTooltip={tooltip.activeTooltip} />

      {vault.state.modalOpen ? (
        <VaultDialog
          busy={vault.state.busy}
          disableVault={vault.disableVault}
          enableVault={vault.enableVault}
          error={vault.state.error}
          lockVault={vault.lockVault}
          modalView={vault.state.modalView}
          protectedDraftCount={sessions.length}
          recoveryInput={vault.state.recoveryInput}
          recoveryKey={vault.state.recoveryKey}
          setModalOpen={(value) => {
            const next = typeof value === "function" ? value(vault.state.modalOpen) : value;
            vault.setModalOpen(next);
          }}
          setModalView={(value) => {
            const next = typeof value === "function" ? value(vault.state.modalView) : value;
            vault.setModalView(next);
          }}
          setRecoveryInput={(value) => {
            const next = typeof value === "function" ? value(vault.state.recoveryInput) : value;
            vault.setRecoveryInput(next);
          }}
          setRecoveryKey={(value) => {
            const next = typeof value === "function" ? value(vault.state.recoveryKey) : value;
            vault.setRecoveryKey(next);
          }}
          status={vault.state.status}
          unlockWithPasskey={vault.unlockWithPasskey}
          unlockWithRecoveryKey={vault.unlockWithRecoveryKey}
          vaultMeta={vault.state.meta}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmDeleteDialog busy={chatPending} confirmDelete={confirmDeleteSession} setDeleteTarget={setDeleteTarget} target={deleteTarget} />
      ) : null}
    </div>
  );
}
