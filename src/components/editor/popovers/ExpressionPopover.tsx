import { LoaderCircle, Wand2, X } from "lucide-react";
import type { CSSProperties, RefObject } from "react";
import type { AiAction, ExpressionOption, ExpressionTarget } from "../../../lib/types";
import { miniIconButton } from "../tailwind";
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
    <div ref={popoverRef} className="fixed left-[var(--expression-left)] top-[var(--expression-top)] z-40 grid w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 gap-2 rounded-xl bg-popover p-2.5 text-popover-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]" role="dialog" aria-label={`Alternates for ${target.text}`} style={style}>
      <div className="flex items-start justify-between gap-3 px-1 pb-1 pt-0.5">
        <div className="min-w-0">
          <span className="block font-mono text-[0.6875rem] font-medium uppercase leading-4 text-muted-foreground">Alternates</span>
          <span className="block max-w-60 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold leading-snug text-foreground">{target.text}</span>
        </div>
        <button type="button" className={miniIconButton()} onClick={close} aria-label="Close alternates" title="Close">
          <X size={14} />
        </button>
      </div>

      {loading ? (
        <div className="m-0 flex items-center gap-2 p-2 text-[0.8125rem] leading-snug text-muted-foreground">
          <LoaderCircle className="animate-spin" size={15} />
          Thinking locally
        </div>
      ) : error ? (
        <p className="m-0 flex items-center gap-2 p-2 text-[0.8125rem] leading-snug text-destructive">{error}</p>
      ) : (
        <div className="grid gap-0.5">
          {options.map((option) => (
            <button
              type="button"
              key={option.text}
              className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md border-0 bg-transparent p-2 text-left text-sm font-medium leading-5 text-foreground transition-colors hover:bg-muted"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => applyOption(option.text)}
            >
              <span className="min-w-0 break-words">{option.text}</span>
              {option.note ? <small className="shrink-0 whitespace-nowrap text-xs font-medium leading-4 text-muted-foreground">{option.note}</small> : null}
            </button>
          ))}
        </div>
      )}

      <div className="mt-0.5 flex justify-stretch border-t border-border/70 pt-1.5">
        <button
          type="button"
          className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-md border-0 bg-transparent px-2.5 text-[0.8125rem] font-medium leading-4 text-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-55"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            void rewriteSelection().finally(() => close());
          }}
          disabled={aiAction !== null}
          {...tooltipProps(tightenTooltip, "top", "wide")}
        >
          {aiAction === "rewrite" ? <LoaderCircle className="animate-spin" size={13} /> : <Wand2 size={13} />}
          Tighten selection
        </button>
      </div>
    </div>
  );
}
