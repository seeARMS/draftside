import { Plus, Trash2 } from "lucide-react";
import type { LockedSessionSummary, ModelRuntimeInfo, OfflineRuntimeInfo, SaveState, WriteSession, AiAction, AiStatus, Capabilities } from "../../../lib/types";
import { formatUpdatedAt } from "../../../lib/formatters";
import { InstallBanner } from "./InstallBanner";
import { OfflineStatusPopover } from "../popovers/OfflineStatusPopover";
import { ModelStatusPopover } from "../popovers/ModelStatusPopover";
import { SaveStatusPopover } from "../popovers/SaveStatusPopover";
import type { TooltipPlacement } from "../hooks/useTooltip";

interface SessionRailProps {
  focusMode: boolean;
  vaultLocked: boolean;
  sessions: WriteSession[];
  lockedSessions: LockedSessionSummary[];
  activeSession: WriteSession | null;
  chatPending: boolean;
  pwaInstalled: boolean;
  installPromptAvailable: boolean;
  installStatusLabel: string;
  offlineReady: boolean;
  offlineBadgeLabel: string;
  online: boolean;
  offlineInfo: OfflineRuntimeInfo;
  offlineStorageRatio: number | null;
  storagePersisted: boolean | null;
  aiStatus: AiStatus;
  aiAction: AiAction;
  aiProgress: number | null;
  modelInfo: ModelRuntimeInfo;
  modelContextRatio: number | null;
  modelUnsupported: boolean;
  modelUnavailable: boolean;
  capabilities: Capabilities;
  hasActiveModelSession: boolean;
  hasCreatingModelSession: boolean;
  saveState: SaveState;
  lastSavedAt: number | null;
  wordCount: number;
  charCount: number;
  refreshOfflineInfo: () => void;
  refreshModelInfo: () => void;
  onCreateSession: () => void;
  onSelectSession: (session: WriteSession) => void;
  onRequestDelete: (session: WriteSession) => void;
  onUnlock: () => void;
  onInstall: () => void;
  tooltipProps: (label: string, placement?: TooltipPlacement, size?: "wide") => Record<string, string | undefined>;
}

export function SessionRail(props: SessionRailProps) {
  const {
    focusMode,
    vaultLocked,
    sessions,
    lockedSessions,
    activeSession,
    chatPending,
    pwaInstalled,
    installPromptAvailable,
    installStatusLabel,
    offlineReady,
    offlineBadgeLabel,
    online,
    offlineInfo,
    offlineStorageRatio,
    storagePersisted,
    aiStatus,
    aiAction,
    aiProgress,
    modelInfo,
    modelContextRatio,
    modelUnsupported,
    modelUnavailable,
    capabilities,
    hasActiveModelSession,
    hasCreatingModelSession,
    saveState,
    lastSavedAt,
    wordCount,
    charCount,
    refreshOfflineInfo,
    refreshModelInfo,
    onCreateSession,
    onSelectSession,
    onRequestDelete,
    onUnlock,
    onInstall,
    tooltipProps,
  } = props;

  return (
    <aside className="session-rail" aria-label="Writing sessions" aria-hidden={focusMode}>
      <div className="rail-header">
        <div className="rail-title-block">
          <div className="rail-title-row">
            <h1>Drafts</h1>
            <button
              type="button"
              className="icon-button rail-add-button"
              onClick={onCreateSession}
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
                <button type="button" className="session-button is-locked" onClick={onUnlock}>
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
                  onClick={() => onSelectSession(session)}
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
                  onClick={() => onRequestDelete(session)}
                  disabled={chatPending}
                  aria-label={`Delete ${session.title || "Untitled"}`}
                  {...tooltipProps("Delete draft", "left")}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
      </div>

      <InstallBanner
        pwaInstalled={pwaInstalled}
        installPromptAvailable={installPromptAvailable}
        installStatusLabel={installStatusLabel}
        offlineReady={offlineReady}
        onInstall={onInstall}
      />

      <div className="rail-footer">
        <OfflineStatusPopover
          online={online}
          offlineReady={offlineReady}
          offlineBadgeLabel={offlineBadgeLabel}
          offlineInfo={offlineInfo}
          offlineStorageRatio={offlineStorageRatio}
          storagePersisted={storagePersisted}
          installStatusLabel={installStatusLabel}
          onRefresh={refreshOfflineInfo}
        />
        <ModelStatusPopover
          aiStatus={aiStatus}
          aiAction={aiAction}
          aiProgress={aiProgress}
          modelInfo={modelInfo}
          modelContextRatio={modelContextRatio}
          modelUnsupported={modelUnsupported}
          modelUnavailable={modelUnavailable}
          capabilities={capabilities}
          hasActiveSession={hasActiveModelSession}
          hasCreatingSession={hasCreatingModelSession}
          onRefresh={refreshModelInfo}
        />
        <SaveStatusPopover
          saveState={saveState}
          lastSavedAt={lastSavedAt}
          activeSession={activeSession}
          wordCount={wordCount}
          charCount={charCount}
          storagePersisted={storagePersisted}
        />
      </div>
    </aside>
  );
}
