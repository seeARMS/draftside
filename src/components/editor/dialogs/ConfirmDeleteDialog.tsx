import { Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { WriteSession } from "../../../lib/types";

interface ConfirmDeleteDialogProps {
  busy: boolean;
  confirmDelete: () => Promise<void>;
  setDeleteTarget: Dispatch<SetStateAction<WriteSession | null>>;
  target: WriteSession;
}

export function ConfirmDeleteDialog({ busy, confirmDelete, setDeleteTarget, target }: ConfirmDeleteDialogProps) {
  return (
    <div
      className="confirm-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setDeleteTarget(null);
      }}
    >
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-draft-title" aria-describedby="delete-draft-description">
        <div className="confirm-icon" aria-hidden="true">
          <Trash2 size={18} />
        </div>
        <div className="confirm-copy">
          <h2 id="delete-draft-title">Delete draft?</h2>
          <p id="delete-draft-description">Delete "{target.title || "Untitled"}" from this browser. This cannot be undone.</p>
        </div>
        <div className="confirm-actions">
          <button type="button" className="confirm-secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </button>
          <button type="button" className="confirm-danger" onClick={() => void confirmDelete()} disabled={busy}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
