import type { Dispatch, SetStateAction } from "react";
import type { WriteSession } from "../../../lib/types";
import { Button } from "../../ui/button";
import { overlay } from "../tailwind";
import { PanelLayout } from "../dialogPrimitives";

interface ConfirmDeleteDialogProps {
  busy: boolean;
  confirmDelete: () => Promise<void>;
  setDeleteTarget: Dispatch<SetStateAction<WriteSession | null>>;
  target: WriteSession;
}

export function ConfirmDeleteDialog({ busy, confirmDelete, setDeleteTarget, target }: ConfirmDeleteDialogProps) {
  const name = target.title || "Untitled";
  return (
    <div
      className={overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setDeleteTarget(null);
      }}
    >
      <div
        className="grid w-[min(28rem,100%)] gap-5 rounded-3xl bg-popover px-7 py-6 text-popover-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)),0_24px_70px_hsl(var(--shadow-color)/0.16)] max-[540px]:px-5 max-[540px]:py-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-draft-title"
        aria-describedby="delete-draft-description"
      >
        <PanelLayout
          titleId="delete-draft-title"
          title="Delete this draft?"
          body={
            <span id="delete-draft-description">
              Delete <strong className="font-semibold text-foreground">"{name}"</strong> from this browser. This cannot be undone.
            </span>
          }
          primary={
            <Button
              type="button"
              size="lg"
              variant="destructive"
              className="max-[540px]:w-full"
              onClick={() => void confirmDelete()}
              disabled={busy}
            >
              Delete draft
            </Button>
          }
          secondary={
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className="max-[540px]:w-full"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
          }
        />
      </div>
    </div>
  );
}
