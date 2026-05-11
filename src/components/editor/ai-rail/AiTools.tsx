import { ArrowLeftRight, Check, Copy, Languages, LoaderCircle, Pause, Play } from "lucide-react";
import type { AiAction, AmbientStatus, Capabilities, Classification, SelectionSnapshot } from "../../../lib/types";
import { TRANSLATION_LANGUAGES } from "../../../ai/constants";
import { translationLabel } from "../../../lib/formatters";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { miniIconButton, pill } from "../tailwind";
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
  const liveDotClass = cn(
    "size-2 shrink-0 rounded-full bg-muted-foreground/60 shadow-[0_0_0_3px_hsl(var(--muted-foreground)/0.12)]",
    (ambientStatus === "thinking" || ambientStatus === "stale") && "animate-pulse bg-amber-500 shadow-[0_0_0_3px_rgb(245_158_11/0.18)]",
    ambientStatus === "ready" && "bg-green-500 shadow-[0_0_0_3px_rgb(34_197_94/0.2)]",
    ambientStatus === "off" && "bg-muted-foreground/35 shadow-none",
    ambientStatus === "error" && "bg-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.18)]",
  );

  return (
    <div id="ai-panel-tools" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-0.5 max-[1120px]:min-h-72" role="tabpanel" aria-labelledby="ai-tab-tools">
      <div className="grid gap-2.5 border-t border-border/70 pt-4 max-[1120px]:border-t-0 max-[1120px]:pt-0">
        <div className="flex items-center justify-between gap-3 text-sm font-medium leading-5 text-foreground">
          <span className="inline-flex items-center gap-2 text-[0.8125rem] font-medium text-foreground">
            <span className={liveDotClass} aria-hidden="true" />
            <span>{ambientStatusLabel}</span>
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-transparent px-2 py-1 text-[0.6875rem] font-medium leading-4 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[pressed=false]:border-border/60"
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
            {currentClassification.observation ? <p className="m-0 rounded-md bg-muted/55 px-3 py-2 text-[0.8125rem] leading-snug text-foreground">{currentClassification.observation}</p> : null}
            <dl className="m-0 grid gap-3 [&_div]:grid [&_div]:gap-1 [&_dt]:text-xs [&_dt]:font-medium [&_dt]:leading-4 [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:text-sm [&_dd]:leading-snug [&_dd]:text-foreground">
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
              <p className="m-0 grid gap-1 border-t border-dashed border-border/70 pt-1.5 text-[0.8125rem] leading-snug text-foreground">
                <span className="font-mono text-[0.6875rem] font-medium uppercase leading-4 text-muted-foreground">try next</span>
                <span>{currentClassification.nextMove}</span>
              </p>
            ) : null}
          </>
        ) : (
          <p className="m-0 text-sm leading-6 text-muted-foreground">{liveAnalysisEnabled ? "Keep writing — Draftside reads along." : "Live analysis is paused."}</p>
        )}

        {currentClassification?.tags?.length ? (
          <div className="flex flex-wrap gap-2">
            {currentClassification.tags.map((tag) => (
              <span key={tag} className={pill}>{tag}</span>
            ))}
          </div>
        ) : null}

        {detectedLanguage ? (
          <div className={cn(pill, "self-start")}>
            <Languages size={13} />
            {detectedLanguage}
          </div>
        ) : null}
      </div>

      <div className="grid gap-2.5 border-t border-border/70 pt-4">
        <div className="flex items-center justify-between gap-3 text-sm font-medium leading-5 text-foreground">
          <span>Translate</span>
          <button
            type="button"
            className={cn(pill, "border-0 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-60")}
            onClick={swapTranslation}
            disabled={aiAction !== null || !translationSource || translationSource === translationTarget}
            {...tooltipProps("Swap languages", "left")}
          >
            <ArrowLeftRight size={13} />
            {translationLabel(translationSource)} → {translationLabel(translationTarget)}
          </button>
        </div>

        <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2">
          <label htmlFor="translation-target" className="text-xs font-medium leading-4 text-muted-foreground">To</label>
          <select
            id="translation-target"
            className="h-9 min-w-0 rounded-md border border-border bg-background px-2.5 text-sm leading-5 text-foreground disabled:cursor-default disabled:opacity-55"
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

        <div className="grid">
          <Button type="button" size="sm" onClick={translateDraft} disabled={aiAction !== null || !capabilities.translator || !activeText}>
            {aiAction === "translate" ? <LoaderCircle className="animate-spin" size={15} /> : <Languages size={15} />}
            Translate {selection.empty ? "draft" : "selection"}
          </Button>
        </div>

        {aiError ? <p className="m-0 text-sm leading-6 text-destructive">{aiError}</p> : null}

        {showTranslationPreview ? (
          <div className="grid gap-1.5 rounded-md bg-muted/50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-xs font-medium leading-4 text-muted-foreground">
              <span>Result</span>
              <button
                type="button"
                className={miniIconButton()}
                onClick={copyAiOutput}
                aria-label="Copy translation"
                {...tooltipProps("Copy translation", "left")}
              >
                {copiedOutput ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <pre className="m-0 max-h-[28vh] overflow-auto whitespace-pre-wrap bg-transparent p-0 font-sans text-sm leading-6 text-foreground">{lastTranslation}</pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
