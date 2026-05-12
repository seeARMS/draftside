import { Save } from "lucide-react";
import type { SaveState, WriteSession } from "../../../lib/types";
import { formatSaveTime } from "../../../lib/formatters";
import { popoverShell, statusPill } from "../tailwind";
import {
  KeyValueGrid,
  KeyValueRow,
  popoverHeadlineClass,
  popoverMetaClass,
} from "../dialogPrimitives";

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
  const state = saveState === "error" ? "danger" : saveState === "saving" ? "ok" : "default";

  return (
    <span className="group relative inline-flex">
      <span className={statusPill(state)} tabIndex={0} aria-describedby="save-status-popover">
        <Save size={14} />
        {saveState}
      </span>
      <span id="save-status-popover" className={popoverShell} role="tooltip">
        <div className="flex items-center justify-between gap-3">
          <h3 className={popoverHeadlineClass}>Saved on this device</h3>
          <span className="inline-flex items-center rounded-md bg-muted/70 px-2 py-0.5 text-[0.6875rem] font-medium leading-4 text-muted-foreground">
            {saveState}
          </span>
        </div>

        <KeyValueGrid>
          <KeyValueRow label="Last saved" value={formatSaveTime(lastSavedAt)} />
          <KeyValueRow label="Created" value={formatSaveTime(activeSession?.createdAt)} />
          <KeyValueRow label="Current draft" value={`${wordCount} words · ${charCount} chars`} />
          <KeyValueRow
            label="Storage"
            value={storagePersisted === null ? "checking" : storagePersisted ? "Protected" : "May be cleared"}
          />
          <KeyValueRow label="Session" value={activeSession?.title || "Untitled"} />
        </KeyValueGrid>

        <p className={popoverMetaClass}>
          Your draft saves automatically as you type — to this browser only. Chat and AI suggestions are kept with it.
        </p>
      </span>
    </span>
  );
}
