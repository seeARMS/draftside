import { LoaderCircle, Wand2, X } from "lucide-react";
import type { CSSProperties, RefObject } from "react";
import type { AiAction, ExpressionOption, ExpressionTarget } from "../../../lib/types";
import type { TooltipPlacement } from "../hooks/useTooltip";

interface ExpressionPopoverProps {
  target: ExpressionTarget;
  options: ExpressionOption[];
  loading: boolean;
  error: string;
  popoverRef: RefObject<HTMLDivElement>;
  aiAction: AiAction;
  applyOption: (text: string) => void;
  close: () => void;
  rewriteSelection: () => Promise<void>;
  tooltipProps: (label: string, placement?: TooltipPlacement, size?: "wide") => Record<string, string | undefined>;
  tightenTooltip: string;
}

export function ExpressionPopover({
  target,
  options,
  loading,
  error,
  popoverRef,
  aiAction,
  applyOption,
  close,
  rewriteSelection,
  tooltipProps,
  tightenTooltip,
}: ExpressionPopoverProps) {
  const style = {
    "--expression-left": `${target.position.left}px`,
    "--expression-top": `${target.position.top}px`,
  } as CSSProperties;

  return (
    <div ref={popoverRef} className="expression-popover" role="dialog" aria-label={`Alternates for ${target.text}`} style={style}>
      <div className="expression-header">
        <div>
          <span className="expression-kicker">Alternates</span>
          <span className="expression-target">{target.text}</span>
        </div>
        <button type="button" className="expression-close" onClick={close} aria-label="Close alternates" title="Close">
          <X size={14} />
        </button>
      </div>

      {loading ? (
        <div className="expression-state">
          <LoaderCircle className="spin" size={15} />
          Thinking locally
        </div>
      ) : error ? (
        <p className="expression-error">{error}</p>
      ) : (
        <div className="expression-options">
          {options.map((option) => (
            <button
              type="button"
              key={option.text}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyOption(option.text)}
            >
              <span>{option.text}</span>
              {option.note ? <small>{option.note}</small> : null}
            </button>
          ))}
        </div>
      )}

      <div className="expression-footer">
        <button
          type="button"
          className="expression-action"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            void rewriteSelection().finally(() => close());
          }}
          disabled={aiAction !== null}
          {...tooltipProps(tightenTooltip, "top", "wide")}
        >
          {aiAction === "rewrite" ? <LoaderCircle className="spin" size={13} /> : <Wand2 size={13} />}
          Tighten selection
        </button>
      </div>
    </div>
  );
}
