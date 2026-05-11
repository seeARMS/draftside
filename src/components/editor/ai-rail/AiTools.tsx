import { Check, Copy, Languages, LoaderCircle, Pause, Play } from "lucide-react";
import type { AiAction, AmbientStatus, Capabilities, Classification, SelectionSnapshot } from "../../../lib/types";
import { TRANSLATION_LANGUAGES } from "../../../ai/constants";
import { capabilityClass, translationLabel } from "../../../lib/formatters";
import type { TooltipPlacement } from "../hooks/useTooltip";

interface AiToolsProps {
  capabilities: Capabilities;
  aiAction: AiAction;
  ambientStatus: AmbientStatus;
  ambientStatusLabel: string;
  liveAnalysisEnabled: boolean;
  liveAnalysisTooltip: string;
  toggleLiveAnalysis: () => void;
  currentClassification: Classification | undefined;
  detectedLanguage: string;
  translationSource: string;
  translationTarget: string;
  setTranslationTarget: (next: string) => void;
  translateDraft: () => void;
  applyTranslation: () => void;
  lastTranslation: string;
  selection: SelectionSnapshot;
  activeText: string;
  aiOutput: string;
  aiError: string;
  copiedOutput: boolean;
  copyAiOutput: () => void;
  storagePersisted: boolean | null;
  tooltipProps: (label: string, placement?: TooltipPlacement, size?: "wide") => Record<string, string | undefined>;
}

export function AiTools(props: AiToolsProps) {
  const {
    capabilities,
    aiAction,
    ambientStatus,
    ambientStatusLabel,
    liveAnalysisEnabled,
    liveAnalysisTooltip,
    toggleLiveAnalysis,
    currentClassification,
    detectedLanguage,
    translationSource,
    translationTarget,
    setTranslationTarget,
    translateDraft,
    applyTranslation,
    lastTranslation,
    selection,
    activeText,
    aiOutput,
    aiError,
    copiedOutput,
    copyAiOutput,
    storagePersisted,
    tooltipProps,
  } = props;

  return (
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
            {...tooltipProps(liveAnalysisTooltip, "left", "wide")}
          >
            {liveAnalysisEnabled ? <Pause size={13} /> : <Play size={13} />}
            {liveAnalysisEnabled ? "Pause" : "Resume"}
          </button>
        </div>

        {currentClassification ? (
          <>
            {currentClassification.observation ? <p className="ambient-observation">{currentClassification.observation}</p> : null}
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
          <select
            id="translation-target"
            value={translationTarget}
            onChange={(event) => setTranslationTarget(event.target.value)}
            disabled={aiAction !== null}
          >
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
  );
}
