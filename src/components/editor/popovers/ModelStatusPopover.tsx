import { LoaderCircle, Sparkles } from "lucide-react";
import type { AiAction, AiStatus, Capabilities, ModelRuntimeInfo } from "../../../lib/types";
import { formatModelInfoTime, formatNumber, formatPercent, statusLabel } from "../../../lib/formatters";
import { popoverShell, statusPill } from "../tailwind";
import {
  KeyValueGrid,
  KeyValueRow,
  NumberedList,
  popoverCopyClass,
  popoverHeadlineClass,
  popoverMetaClass,
} from "../dialogPrimitives";

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
      <span
        className={statusPill(isDanger ? "danger" : aiStatus === "available" ? "ok" : "default")}
        tabIndex={0}
        aria-describedby="model-status-popover"
      >
        {aiAction ? <LoaderCircle className="animate-spin" size={14} /> : <Sparkles size={14} />}
        {statusLabel(aiStatus)}
      </span>
      <span id="model-status-popover" className={popoverShell} role="tooltip">
        <PopoverHeader
          title="On-device AI"
          status={modelInfo.loading ? "checking" : statusLabel(modelInfo.availability ?? aiStatus)}
        />

        {modelUnsupported ? (
          <>
            <p className={popoverCopyClass}>
              Draftside's AI runs locally through Chrome's built-in model. This browser doesn't support it yet, so the editor and offline drafts still work — AI tools are off.
            </p>
            <NumberedList
              items={[
                "Open this page in desktop Chrome.",
                "Use a Chrome profile where the local AI model is available.",
                "Leave the tab open while the badge changes from downloading to ready.",
              ]}
            />
            <p className={popoverMetaClass}>
              Once Chrome downloads the model, Draftside can write, chat, rewrite, and suggest phrasing — all locally.
            </p>
          </>
        ) : modelUnavailable ? (
          <>
            <p className={popoverCopyClass}>
              Chrome supports local AI, but the model isn't available on this device or Chrome profile yet.
            </p>
            <NumberedList
              items={[
                "Update Chrome and restart the browser.",
                "Try a Chrome build or profile with the local AI model enabled.",
                "Keep Draftside open while Chrome prepares the model.",
              ]}
            />
            <p className={popoverMetaClass}>Your editor, drafts, and offline cache still work without it.</p>
          </>
        ) : (
          <>
            <KeyValueGrid>
              <KeyValueRow label="Model" value="Gemini Nano · Chrome" />
              <KeyValueRow label="Availability" value={statusLabel(modelInfo.availability ?? aiStatus)} />
              <KeyValueRow
                label="Session"
                value={hasActiveSession ? "active" : hasCreatingSession ? "starting" : "not started"}
              />
              <KeyValueRow
                label="Conversation memory"
                value={`${formatNumber(modelInfo.contextUsage)} / ${formatNumber(modelInfo.contextWindow)} (${formatPercent(modelContextRatio)})`}
              />
              {aiProgress !== null ? <KeyValueRow label="Download" value={formatPercent(aiProgress)} /> : null}
            </KeyValueGrid>

            <span className="flex flex-wrap gap-1.5 pt-0.5">
              <span className={statusPill(capabilities.prompt ? "ok" : "default")}>prompt</span>
              <span className={statusPill(capabilities.rewriter ? "ok" : "default")}>rewrite</span>
              <span className={statusPill(capabilities.detector ? "ok" : "default")}>language</span>
              <span className={statusPill(capabilities.translator ? "ok" : "default")}>translate</span>
            </span>

            <p className={popoverMetaClass}>
              Nothing leaves your device — every suggestion is generated locally. English only, for now.
            </p>
          </>
        )}
        <p className="m-0 font-mono text-xs leading-5 text-muted-foreground">
          checked {formatModelInfoTime(modelInfo.checkedAt)}
        </p>
      </span>
    </span>
  );
}

function PopoverHeader({ title, status }: { title: string; status: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className={popoverHeadlineClass}>{title}</h3>
      <span className="inline-flex items-center rounded-md bg-muted/70 px-2 py-0.5 text-[0.6875rem] font-medium leading-4 text-muted-foreground">
        {status}
      </span>
    </div>
  );
}
