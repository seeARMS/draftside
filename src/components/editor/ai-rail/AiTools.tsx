import { ArrowLeftRight, Check, Copy, Languages, LoaderCircle, Pause, Play } from "lucide-react";
import type { AiAction, AmbientStatus, Capabilities, Classification, SelectionSnapshot } from "../../../lib/types";
import { TRANSLATION_LANGUAGES } from "../../../ai/constants";
import { translationLabel } from "../../../lib/formatters";
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
  swapTranslation: () => void;
  lastTranslation: string;
  selection: SelectionSnapshot;
  activeText: string;
  aiError: string;
  copiedOutput: boolean;
  copyAiOutput: () => void;
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
    swapTranslation,
    lastTranslation,
    selection,
    activeText,
    aiError,
    copiedOutput,
    copyAiOutput,
    tooltipProps,
  } = props;

  const showTranslationPreview = selection.empty && Boolean(lastTranslation.trim());

  return (
    <div id="ai-panel-tools" className="ai-tab-panel tools-panel" role="tabpanel" aria-labelledby="ai-tab-tools">
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
          <button
            type="button"
            className="language-pill is-button"
            onClick={swapTranslation}
            disabled={aiAction !== null || !translationSource || translationSource === translationTarget}
            {...tooltipProps("Swap languages", "left")}
          >
            <ArrowLeftRight size={13} />
            {translationLabel(translationSource)} → {translationLabel(translationTarget)}
          </button>
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
        </div>

        {aiError ? <p className="ai-error">{aiError}</p> : null}

        {showTranslationPreview ? (
          <div className="translate-preview">
            <div className="translate-preview-head">
              <span>Result</span>
              <button
                type="button"
                className="mini-icon"
                onClick={copyAiOutput}
                aria-label="Copy translation"
                {...tooltipProps("Copy translation", "left")}
              >
                {copiedOutput ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <pre>{lastTranslation}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
