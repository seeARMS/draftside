import { Lock } from "lucide-react";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type { AiAction, ExpressionOption, ExpressionTarget } from "../../../lib/types";
import { Button } from "../../ui/button";
import { ExpressionPopover } from "../popovers/ExpressionPopover";
import type { TooltipPlacement } from "../hooks/useTooltip";

interface EditorSurfaceProps {
  editor: Editor | null;
  vaultLocked: boolean;
  ghostCompletionText: string;
  onUnlock: () => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  expressionTarget: ExpressionTarget | null;
  expressionOptions: ExpressionOption[];
  expressionLoading: boolean;
  expressionError: string;
  expressionPopoverRef: React.RefObject<HTMLDivElement>;
  applyExpressionOption: (text: string) => void;
  closeExpressionPopover: () => void;
  rewriteSelection: () => Promise<void>;
  aiAction: AiAction;
  tooltipProps: (label: string, placement?: TooltipPlacement, size?: "wide") => Record<string, string | undefined>;
  tightenTooltip: string;
}

export function EditorSurface({
  editor,
  vaultLocked,
  ghostCompletionText,
  onUnlock,
  onPointerUp,
  expressionTarget,
  expressionOptions,
  expressionLoading,
  expressionError,
  expressionPopoverRef,
  applyExpressionOption,
  closeExpressionPopover,
  rewriteSelection,
  aiAction,
  tooltipProps,
  tightenTooltip,
}: EditorSurfaceProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth">
      {vaultLocked ? (
        <section className="mx-auto grid min-h-full w-[min(100%,34rem)] place-content-center justify-items-center gap-3.5 p-8 text-center" aria-label="Private Vault locked">
          <div className="inline-flex size-12 items-center justify-center rounded-xl bg-muted text-foreground">
            <Lock size={22} />
          </div>
          <h2 className="m-0 text-xl font-semibold leading-7 text-foreground">Private Vault is locked</h2>
          <p className="m-0 max-w-md text-[0.9375rem] leading-6 text-muted-foreground">Your drafts are encrypted on this device. Unlock with your passkey to read, edit, export, or use local AI.</p>
          <Button type="button" onClick={onUnlock}>
            Unlock drafts
          </Button>
        </section>
      ) : (
        <article className="relative box-border flex min-h-full w-[min(100%,54rem)] flex-col px-[clamp(1.5rem,5vw,4.5rem)] pb-[38vh] pt-[4.5rem] max-[820px]:w-full max-[820px]:px-5 max-[820px]:pb-[32vh] max-[820px]:pt-10" data-ghost-completion={ghostCompletionText ? "ready" : undefined} onPointerUp={onPointerUp}>
          <EditorContent editor={editor} />
          {expressionTarget ? (
            <ExpressionPopover
              target={expressionTarget}
              options={expressionOptions}
              loading={expressionLoading}
              error={expressionError}
              popoverRef={expressionPopoverRef}
              aiAction={aiAction}
              applyOption={applyExpressionOption}
              close={closeExpressionPopover}
              rewriteSelection={rewriteSelection}
              tooltipProps={tooltipProps}
              tightenTooltip={tightenTooltip}
            />
          ) : null}
        </article>
      )}
    </div>
  );
}
