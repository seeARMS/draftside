import { Lock } from "lucide-react";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import type { AiAction, ExpressionOption, ExpressionTarget } from "../../../lib/types";
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
    <div className="editor-scroll">
      {vaultLocked ? (
        <section className="vault-locked-panel" aria-label="Private Vault locked">
          <div className="vault-locked-icon">
            <Lock size={22} />
          </div>
          <h2>Private Vault is locked</h2>
          <p>Your drafts are encrypted on this device. Unlock with your passkey to read, edit, export, or use local AI.</p>
          <button type="button" onClick={onUnlock}>
            Unlock drafts
          </button>
        </section>
      ) : (
        <article className="editor-paper" data-ghost-completion={ghostCompletionText ? "ready" : undefined} onPointerUp={onPointerUp}>
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
