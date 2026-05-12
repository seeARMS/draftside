import { Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { WriteSession } from "../../../lib/types";
import { Button } from "../../ui/button";
import { overlay } from "../tailwind";

interface ConfirmDeleteDialogProps {
  busy: boolean;
  confirmDelete: () => Promise<void>;
  setDeleteTarget: Dispatch<SetStateAction<WriteSession | null>>;
  target: WriteSession;
}

export function ConfirmDeleteDialog({ busy, confirmDelete, setDeleteTarget, target }: ConfirmDeleteDialogProps) {
  return (
    <div
      className={overlay}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setDeleteTarget(null);
      }}
    >
      <div className="grid w-[min(25rem,100%)] grid-cols-[2.5rem_minmax(0,1fr)] gap-3.5 rounded-xl bg-popover p-4 text-popover-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)),0_24px_70px_hsl(var(--shadow-color)/0.16)]" role="dialog" aria-modal="true" aria-labelledby="delete-draft-title" aria-describedby="delete-draft-description">
        <div className="inline-flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive" aria-hidden="true">
          <Trash2 size={18} />
        </div>
        <div className="min-w-0">
          <h2 id="delete-draft-title" className="m-0 text-base font-semibold leading-6 text-foreground">Delete draft?</h2>
          <p id="delete-draft-description" className="mt-1 text-sm leading-snug text-muted-foreground">Delete "{target.title || "Untitled"}" from this browser. This cannot be undone.</p>
        </div>
        <div className="col-span-full flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={busy}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
