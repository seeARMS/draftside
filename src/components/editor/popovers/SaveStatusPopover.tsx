import { Save } from "lucide-react";
import type { SaveState, WriteSession } from "../../../lib/types";
import { formatSaveTime } from "../../../lib/formatters";

interface SaveStatusPopoverProps {
  saveState: SaveState;
  lastSavedAt: number | null;
  activeSession: WriteSession | null;
  wordCount: number;
  charCount: number;
  storagePersisted: boolean | null;
}

export function SaveStatusPopover({
  saveState,
  lastSavedAt,
  activeSession,
  wordCount,
  charCount,
  storagePersisted,
}: SaveStatusPopoverProps) {
  return (
    <span className="save-status-wrap">
      <span className={`connectivity save-status ${saveState}`} tabIndex={0} aria-describedby="save-status-popover">
        <Save size={14} />
        {saveState}
      </span>
      <span id="save-status-popover" className="save-popover" role="tooltip">
        <span className="model-popover-title">
          <span>Local draft save</span>
          <span>{saveState}</span>
        </span>

        <span className="model-popover-grid">
          <span>
            <strong>Last saved</strong>
            <em>{formatSaveTime(lastSavedAt)}</em>
          </span>
          <span>
            <strong>Last change</strong>
            <em>{formatSaveTime(activeSession?.updatedAt)}</em>
          </span>
          <span>
            <strong>Created</strong>
            <em>{formatSaveTime(activeSession?.createdAt)}</em>
          </span>
          <span>
            <strong>Current draft</strong>
            <em>
              {wordCount} words, {charCount} chars
            </em>
          </span>
          <span>
            <strong>Storage</strong>
            <em>{storagePersisted === null ? "checking" : storagePersisted ? "persistent IndexedDB" : "browser-managed IndexedDB"}</em>
          </span>
          <span>
            <strong>Session</strong>
            <em>{activeSession?.title || "Untitled"}</em>
          </span>
        </span>

        <span className="model-popover-note">
          Draftside autosaves the active document to local IndexedDB about 420ms after edits. Chat history and AI classifications are stored with the same draft.
        </span>
      </span>
    </span>
  );
}
