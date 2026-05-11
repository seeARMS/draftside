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
  storagePersisted: boolean | null;
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
  storagePersisted,
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
                <strong>Availability</strong>
                <em>{modelInfo.availability ?? aiStatus}</em>
              </span>
              <span>
                <strong>Session</strong>
                <em>{hasActiveSession ? "active" : hasCreatingSession ? "starting" : "not started"}</em>
              </span>
              <span>
                <strong>Context used</strong>
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
              <span className={capabilityClass(capabilities.writer)}>write</span>
              <span className={capabilityClass(capabilities.detector)}>language</span>
              <span className={capabilityClass(capabilities.translator)}>translate</span>
            </span>

            <span className="model-popover-note">
              Inference stays on-device. Draftside requests English text in and out; storage is {storagePersisted ? "persistent" : "browser-managed"}.
            </span>
          </>
        )}
        <span className="model-popover-foot">checked {formatModelInfoTime(modelInfo.checkedAt)}</span>
      </span>
    </span>
  );
}
