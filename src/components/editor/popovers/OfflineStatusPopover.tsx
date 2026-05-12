import { Check, Wifi, WifiOff } from "lucide-react";
import type { OfflineRuntimeInfo } from "../../../lib/types";
import { formatBytes, formatModelInfoTime, formatNumber, formatPercent } from "../../../lib/formatters";
import { cn } from "../../../lib/utils";
import { popoverShell, statusPill } from "../tailwind";
import {
  KeyValueGrid,
  KeyValueRow,
  popoverHeadlineClass,
  popoverMetaClass,
} from "../dialogPrimitives";

interface OfflineStatusPopoverProps {
  online: boolean;
  offlineReady: boolean;
  offlineBadgeLabel: string;
  offlineInfo: OfflineRuntimeInfo;
  offlineStorageRatio: number | null;
  storagePersisted: boolean | null;
  installStatusLabel: string;
  onRefresh: () => void;
}

export function OfflineStatusPopover({
  online,
  offlineReady,
  offlineBadgeLabel,
  offlineInfo,
  offlineStorageRatio,
  storagePersisted,
  installStatusLabel,
  onRefresh,
}: OfflineStatusPopoverProps) {
  const cacheStatus = offlineInfo.serviceWorkerSupported
    ? offlineInfo.controlled
      ? "Ready"
      : offlineInfo.registrationState === "activated"
        ? "Preparing"
        : offlineInfo.registrationState
    : "Unsupported";

  const headerStatus = offlineInfo.loading ? "checking" : offlineInfo.controlled ? "ready" : "standby";

  return (
    <span className="group relative inline-flex" onMouseEnter={onRefresh} onFocus={onRefresh}>
      <span
        className={statusPill(offlineReady || online ? "ok" : "default")}
        tabIndex={0}
        aria-describedby="offline-status-popover"
      >
        {offlineReady ? <Check size={14} /> : online ? <Wifi size={14} /> : <WifiOff size={14} />}
        {offlineBadgeLabel}
      </span>
      <span
        id="offline-status-popover"
        className={cn(popoverShell, "w-[min(24rem,calc(100vw-1.5rem))]")}
        role="tooltip"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className={popoverHeadlineClass}>Works offline</h3>
          <span className="inline-flex items-center rounded-md bg-muted/70 px-2 py-0.5 text-[0.6875rem] font-medium leading-4 text-muted-foreground">
            {headerStatus}
          </span>
        </div>

        <KeyValueGrid>
          <KeyValueRow label="Network" value={online ? "online now" : "offline now"} />
          <KeyValueRow label="Offline cache" value={cacheStatus} />
          <KeyValueRow
            label="Cached"
            value={`${formatNumber(offlineInfo.cachedRequests)} files · ${formatBytes(offlineInfo.cachedBytes)}`}
          />
          <KeyValueRow
            label="Disk used"
            value={`${formatBytes(offlineInfo.storageUsage)} / ${formatBytes(offlineInfo.storageQuota)} (${formatPercent(offlineStorageRatio)})`}
          />
          <KeyValueRow
            label="Draft storage"
            value={storagePersisted === null ? "checking" : storagePersisted ? "Protected" : "May be cleared"}
          />
          <KeyValueRow label="Install" value={installStatusLabel} />
        </KeyValueGrid>

        <p className={popoverMetaClass}>
          Once Draftside loads, you can keep writing without internet. Install it to get a desktop launcher. Your drafts and the AI model live on your device.
        </p>
        <p className="m-0 font-mono text-xs leading-5 text-muted-foreground">
          checked {formatModelInfoTime(offlineInfo.checkedAt)}
        </p>
      </span>
    </span>
  );
}
