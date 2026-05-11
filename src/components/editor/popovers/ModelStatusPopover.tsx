import { LoaderCircle, Sparkles } from "lucide-react";
import type { AiAction, AiStatus, Capabilities, ModelRuntimeInfo } from "../../../lib/types";
import { formatModelInfoTime, formatNumber, formatPercent, statusLabel } from "../../../lib/formatters";
import { popoverGrid, popoverShell, popoverTitle, statusPill } from "../tailwind";

interface ModelStatusPopoverProps {
  aiStatus: AiStatus;
  aiAction: AiAction;
  aiProgress: number | null;
  modelInfo: ModelRuntimeInfo;
  modelContextRatio: number | null;
  modelUnsupported: boolean;
  modelUnavailable: boolean;
  capabilities: Capabilities;
  hasActiveSession: boolean;
  hasCreatingSession: boolean;
  onRefresh: () => void;
}

export function ModelStatusPopover({
  aiStatus,
  aiAction,
  aiProgress,
  modelInfo,
  modelContextRatio,
  modelUnsupported,
  modelUnavailable,
  capabilities,
  hasActiveSession,
  hasCreatingSession,
  onRefresh,
}: ModelStatusPopoverProps) {
  const isDanger = aiStatus === "error" || aiStatus === "unavailable" || aiStatus === "unsupported";

  return (
    <span className="group relative inline-flex" onMouseEnter={onRefresh} onFocus={onRefresh}>
      <span className={statusPill(isDanger ? "danger" : aiStatus === "available" ? "ok" : "default")} tabIndex={0} aria-describedby="model-status-popover">
        {aiAction ? <LoaderCircle className="animate-spin" size={14} /> : <Sparkles size={14} />}
        {statusLabel(aiStatus)}
      </span>
      <span id="model-status-popover" className={popoverShell} role="tooltip">
        <span className={popoverTitle}>
          <span>On-device AI</span>
          <span>{modelInfo.loading ? "checking" : statusLabel(modelInfo.availability ?? aiStatus)}</span>
        </span>

        {modelUnsupported ? (
          <>
            <span className="text-sm leading-snug text-foreground">
              Draftside's AI runs locally through Chrome's built-in model. Safari doesn't support this yet, so the editor and offline drafts work here, but AI tools are turned off.
            </span>
            <span className="grid gap-2">
              <span className="grid grid-cols-[1.35rem_minmax(0,1fr)] items-start gap-2">
                <strong className="inline-flex size-[1.35rem] items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold leading-none text-foreground">1</strong>
                <em className="text-[0.8125rem] not-italic leading-snug text-foreground">Open this page in desktop Chrome.</em>
              </span>
              <span className="grid grid-cols-[1.35rem_minmax(0,1fr)] items-start gap-2">
                <strong className="inline-flex size-[1.35rem] items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold leading-none text-foreground">2</strong>
                <em className="text-[0.8125rem] not-italic leading-snug text-foreground">Use a Chrome profile where the local AI model is available.</em>
              </span>
              <span className="grid grid-cols-[1.35rem_minmax(0,1fr)] items-start gap-2">
                <strong className="inline-flex size-[1.35rem] items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold leading-none text-foreground">3</strong>
                <em className="text-[0.8125rem] not-italic leading-snug text-foreground">Leave the tab open while the badge changes from downloading to ready.</em>
              </span>
            </span>
            <span className="text-xs leading-snug text-muted-foreground">
              Once Chrome downloads the model, Draftside can write, chat, rewrite, and suggest phrasing — all locally.
            </span>
          </>
        ) : modelUnavailable ? (
          <>
            <span className="text-sm leading-snug text-foreground">
              Chrome supports local AI, but the model isn't available on this device or Chrome profile yet.
            </span>
            <span className="grid gap-2">
              <span className="grid grid-cols-[1.35rem_minmax(0,1fr)] items-start gap-2">
                <strong className="inline-flex size-[1.35rem] items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold leading-none text-foreground">1</strong>
                <em className="text-[0.8125rem] not-italic leading-snug text-foreground">Update Chrome and restart the browser.</em>
              </span>
              <span className="grid grid-cols-[1.35rem_minmax(0,1fr)] items-start gap-2">
                <strong className="inline-flex size-[1.35rem] items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold leading-none text-foreground">2</strong>
                <em className="text-[0.8125rem] not-italic leading-snug text-foreground">Try a Chrome build or profile with the local AI model enabled.</em>
              </span>
              <span className="grid grid-cols-[1.35rem_minmax(0,1fr)] items-start gap-2">
                <strong className="inline-flex size-[1.35rem] items-center justify-center rounded-full bg-muted text-[0.6875rem] font-semibold leading-none text-foreground">3</strong>
                <em className="text-[0.8125rem] not-italic leading-snug text-foreground">Keep Draftside open while Chrome prepares the model.</em>
              </span>
            </span>
            <span className="text-xs leading-snug text-muted-foreground">Your editor, drafts, and offline cache still work without it.</span>
          </>
        ) : (
          <>
            <span className={popoverGrid}>
              <span>
                <strong>Model</strong>
                <em>Gemini Nano · Chrome</em>
              </span>
              <span>
                <strong>Availability</strong>
                <em>{statusLabel(modelInfo.availability ?? aiStatus)}</em>
              </span>
              <span>
                <strong>Session</strong>
                <em>{hasActiveSession ? "active" : hasCreatingSession ? "starting" : "not started"}</em>
              </span>
              <span>
                <strong>Conversation memory</strong>
                <em>
                  {formatNumber(modelInfo.contextUsage)} / {formatNumber(modelInfo.contextWindow)} ({formatPercent(modelContextRatio)})
                </em>
              </span>
              {aiProgress !== null ? (
                <span>
                  <strong>Download</strong>
                  <em>{formatPercent(aiProgress)}</em>
                </span>
              ) : null}
            </span>

            <span className="flex flex-wrap gap-1.5 pt-0.5">
              <span className={statusPill(capabilities.prompt ? "ok" : "default")}>prompt</span>
              <span className={statusPill(capabilities.rewriter ? "ok" : "default")}>rewrite</span>
              <span className={statusPill(capabilities.detector ? "ok" : "default")}>language</span>
              <span className={statusPill(capabilities.translator ? "ok" : "default")}>translate</span>
            </span>

            <span className="text-xs leading-snug text-muted-foreground">
              Nothing leaves your device — every suggestion is generated locally. English only, for now.
            </span>
          </>
        )}
        <span className="font-mono text-xs leading-snug text-muted-foreground">checked {formatModelInfoTime(modelInfo.checkedAt)}</span>
      </span>
    </span>
  );
}
