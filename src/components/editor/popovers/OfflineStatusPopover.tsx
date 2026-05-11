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
          <span>Offline app shell</span>
          <span>{offlineInfo.loading ? "checking" : offlineInfo.controlled ? "active" : "standby"}</span>
        </span>

        <span className="model-popover-grid">
          <span>
            <strong>Network</strong>
            <em>{online ? "online now" : "offline now"}</em>
          </span>
          <span>
            <strong>Service worker</strong>
            <em>{offlineInfo.serviceWorkerSupported ? offlineInfo.registrationState : "unsupported"}</em>
          </span>
          <span>
            <strong>Page control</strong>
            <em>{offlineInfo.controlled ? "controlling this tab" : "not controlling this tab"}</em>
          </span>
          <span>
            <strong>Cache stores</strong>
            <em>{formatNumber(offlineInfo.cacheCount)}</em>
          </span>
          <span>
            <strong>Cached responses</strong>
            <em>{formatNumber(offlineInfo.cachedRequests)}</em>
          </span>
          <span>
            <strong>Cache size</strong>
            <em>{formatBytes(offlineInfo.cachedBytes)}</em>
          </span>
          <span>
            <strong>Storage used</strong>
            <em>
              {formatBytes(offlineInfo.storageUsage)} / {formatBytes(offlineInfo.storageQuota)} ({formatPercent(offlineStorageRatio)})
            </em>
          </span>
          <span>
            <strong>Draft storage</strong>
            <em>{storagePersisted === null ? "checking" : storagePersisted ? "persistent IndexedDB" : "browser-managed IndexedDB"}</em>
          </span>
          <span>
            <strong>Install</strong>
            <em>{installStatusLabel}</em>
          </span>
        </span>

        <span className="model-popover-note">
          Production builds register Chrome's service worker at scope /. It precaches / and /editor, the manifest, icons, fonts, and discovered app assets, then runtime-caches same-origin requests. Install adds a standalone launcher; drafts stay in IndexedDB and Gemini Nano runs locally after Chrome downloads it.
        </span>
        <span className="model-popover-foot">checked {formatModelInfoTime(offlineInfo.checkedAt)}</span>
      </span>
    </span>
  );
}
