import { Plus, Trash2 } from "lucide-react";
import type { LockedSessionSummary, ModelRuntimeInfo, OfflineRuntimeInfo, SaveState, WriteSession, AiAction, AiStatus, Capabilities } from "../../../lib/types";
import { formatUpdatedAt } from "../../../lib/formatters";
import { cn } from "../../../lib/utils";
import { InstallBanner } from "./InstallBanner";
import { OfflineStatusPopover } from "../popovers/OfflineStatusPopover";
import { ModelStatusPopover } from "../popovers/ModelStatusPopover";
import { SaveStatusPopover } from "../popovers/SaveStatusPopover";
import { iconButton } from "../tailwind";
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
    <aside
      className={cn(
        "relative z-20 flex min-h-0 min-w-0 flex-col overflow-visible rounded-2xl bg-card text-card-foreground opacity-100 outline outline-1 -outline-offset-1 outline-border/60 transition-[opacity,transform,outline-color,visibility] duration-200 ease-out",
        focusMode && "pointer-events-none invisible -translate-x-4 overflow-hidden opacity-0 outline-transparent duration-150",
        "max-[820px]:order-2 max-[820px]:max-h-none max-[820px]:rounded-none max-[820px]:border-t max-[820px]:border-border/70 max-[820px]:outline-0",
        focusMode && "max-[820px]:max-h-0 max-[820px]:min-h-0 max-[820px]:border-t-0",
      )}
      aria-label="Writing sessions"
      aria-hidden={focusMode}
    >
      <div className="flex min-h-[3.75rem] items-start justify-between gap-3 p-3">
        <div className="grid w-full min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h1 className="m-0 text-xl font-medium leading-7 tracking-normal text-foreground">Drafts</h1>
            <button
              type="button"
              className={iconButton(false, "size-9 rounded-md")}
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

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto py-1 max-[820px]:grid max-[820px]:auto-cols-[minmax(12rem,72vw)] max-[820px]:grid-flow-col max-[820px]:overflow-x-auto">
        {vaultLocked
          ? lockedSessions.map((session) => (
              <div key={session.id} className="relative mx-2 w-[calc(100%-1rem)] rounded-lg max-[820px]:mx-1 max-[820px]:w-[calc(100%-0.5rem)]">
                <button type="button" className="grid min-h-[3.625rem] w-full gap-1 rounded-lg border-0 bg-transparent py-2.5 pl-3 pr-11 text-left text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground" onClick={onUnlock}>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium leading-5 text-inherit">Locked draft</span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-muted-foreground">{formatUpdatedAt(session.updatedAt)}</span>
                </button>
              </div>
            ))
          : sessions.map((session) => (
              <div key={session.id} className="group relative mx-2 w-[calc(100%-1rem)] rounded-lg max-[820px]:mx-1 max-[820px]:w-[calc(100%-0.5rem)]">
                <button
                  type="button"
                  className={cn(
                    "grid min-h-[3.625rem] w-full gap-1 rounded-lg border-0 bg-transparent py-2.5 pl-3 pr-11 text-left text-foreground transition-colors hover:bg-muted/70 hover:text-foreground/85 disabled:cursor-default disabled:opacity-60",
                    activeSession?.id === session.id && "bg-muted font-medium text-foreground",
                  )}
                  onClick={() => onSelectSession(session)}
                  disabled={chatPending}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium leading-5 text-inherit">{session.title}</span>
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs leading-4 text-muted-foreground">
                    {session.wordCount} words · {formatUpdatedAt(session.updatedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  className="pointer-events-none absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 scale-95 items-center justify-center rounded-md border-0 bg-card text-muted-foreground opacity-0 shadow-[inset_0_0_0_1px_hsl(var(--border)/0.8)] transition duration-150 hover:bg-destructive/10 hover:text-destructive disabled:cursor-default disabled:opacity-45 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:scale-100 group-focus-within:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:scale-100 [@media(hover:none)]:opacity-100"
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

      <div className="mt-auto flex flex-wrap gap-2 p-3 max-[820px]:mt-0">
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
