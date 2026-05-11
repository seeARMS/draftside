import { LoaderCircle, Sparkles } from "lucide-react";
import type { AiAction, AiStatus, Capabilities, ModelRuntimeInfo } from "../../../lib/types";
import { capabilityClass, formatModelInfoTime, formatNumber, formatPercent, statusLabel } from "../../../lib/formatters";

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
  return (
    <span className="model-status-wrap" onMouseEnter={onRefresh} onFocus={onRefresh}>
      <span className={`ai-status ${aiStatus}`} tabIndex={0} aria-describedby="model-status-popover">
        {aiAction ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}
        {statusLabel(aiStatus)}
      </span>
      <span id="model-status-popover" className="model-popover" role="tooltip">
        <span className="model-popover-title">
          <span>On-device AI</span>
          <span>{modelInfo.loading ? "checking" : statusLabel(modelInfo.availability ?? aiStatus)}</span>
        </span>

        {modelUnsupported ? (
          <>
            <span className="model-help-copy">
              Draftside's AI runs locally through Chrome's built-in model. Safari doesn't support this yet, so the editor and offline drafts work here, but AI tools are turned off.
            </span>
            <span className="model-help-steps">
              <span>
                <strong>1</strong>
                <em>Open this page in desktop Chrome.</em>
              </span>
              <span>
                <strong>2</strong>
                <em>Use a Chrome profile where the local AI model is available.</em>
              </span>
              <span>
                <strong>3</strong>
                <em>Leave the tab open while the badge changes from downloading to ready.</em>
              </span>
            </span>
            <span className="model-popover-note">
              Once Chrome downloads the model, Draftside can write, chat, rewrite, and suggest phrasing — all locally.
            </span>
          </>
        ) : modelUnavailable ? (
          <>
            <span className="model-help-copy">
              Chrome supports local AI, but the model isn't available on this device or Chrome profile yet.
            </span>
            <span className="model-help-steps">
              <span>
                <strong>1</strong>
                <em>Update Chrome and restart the browser.</em>
              </span>
              <span>
                <strong>2</strong>
                <em>Try a Chrome build or profile with the local AI model enabled.</em>
              </span>
              <span>
                <strong>3</strong>
                <em>Keep Draftside open while Chrome prepares the model.</em>
              </span>
            </span>
            <span className="model-popover-note">Your editor, drafts, and offline cache still work without it.</span>
          </>
        ) : (
          <>
            <span className="model-popover-grid">
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

            <span className="model-popover-capabilities">
              <span className={capabilityClass(capabilities.prompt)}>prompt</span>
              <span className={capabilityClass(capabilities.rewriter)}>rewrite</span>
              <span className={capabilityClass(capabilities.detector)}>language</span>
              <span className={capabilityClass(capabilities.translator)}>translate</span>
            </span>

            <span className="model-popover-note">
              Nothing leaves your device — every suggestion is generated locally. English only, for now.
            </span>
          </>
        )}
        <span className="model-popover-foot">checked {formatModelInfoTime(modelInfo.checkedAt)}</span>
      </span>
    </span>
  );
}
