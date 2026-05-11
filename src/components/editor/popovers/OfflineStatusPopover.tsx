import { Check, Wifi, WifiOff } from "lucide-react";
import type { OfflineRuntimeInfo } from "../../../lib/types";
import { formatBytes, formatModelInfoTime, formatNumber, formatPercent } from "../../../lib/formatters";

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
  const className = offlineReady ? "connectivity is-offline-ready" : online ? "connectivity is-online" : "connectivity";

  return (
    <span className="offline-status-wrap" onMouseEnter={onRefresh} onFocus={onRefresh}>
      <span className={className} tabIndex={0} aria-describedby="offline-status-popover">
        {offlineReady ? <Check size={14} /> : online ? <Wifi size={14} /> : <WifiOff size={14} />}
        {offlineBadgeLabel}
      </span>
      <span id="offline-status-popover" className="offline-popover" role="tooltip">
        <span className="model-popover-title">
          <span>Works offline</span>
          <span>{offlineInfo.loading ? "checking" : offlineInfo.controlled ? "ready" : "standby"}</span>
        </span>

        <span className="model-popover-grid">
          <span>
            <strong>Network</strong>
            <em>{online ? "online now" : "offline now"}</em>
          </span>
          <span>
            <strong>Offline cache</strong>
            <em>{offlineInfo.serviceWorkerSupported ? (offlineInfo.controlled ? "Ready" : offlineInfo.registrationState === "activated" ? "Preparing" : offlineInfo.registrationState) : "Unsupported"}</em>
          </span>
          <span>
            <strong>Cached</strong>
            <em>
              {formatNumber(offlineInfo.cachedRequests)} files · {formatBytes(offlineInfo.cachedBytes)}
            </em>
          </span>
          <span>
            <strong>Disk used by Draftside</strong>
            <em>
              {formatBytes(offlineInfo.storageUsage)} / {formatBytes(offlineInfo.storageQuota)} ({formatPercent(offlineStorageRatio)})
            </em>
          </span>
          <span>
            <strong>Draft storage</strong>
            <em>{storagePersisted === null ? "checking" : storagePersisted ? "Protected" : "May be cleared if disk fills"}</em>
          </span>
          <span>
            <strong>Install</strong>
            <em>{installStatusLabel}</em>
          </span>
        </span>

        <span className="model-popover-note">
          Once Draftside loads, you can keep writing without internet. Install it to get a desktop launcher. Your drafts and the AI model live on your device.
        </span>
        <span className="model-popover-foot">checked {formatModelInfoTime(offlineInfo.checkedAt)}</span>
      </span>
    </span>
  );
}
