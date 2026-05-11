import { Download } from "lucide-react";

interface InstallBannerProps {
  pwaInstalled: boolean;
  installPromptAvailable: boolean;
  installStatusLabel: string;
  offlineReady: boolean;
  onInstall: () => void;
}

export function InstallBanner({ pwaInstalled, installPromptAvailable, installStatusLabel, offlineReady, onInstall }: InstallBannerProps) {
  if (pwaInstalled) return null;

  return (
    <div className={offlineReady ? "install-banner is-offline-ready" : "install-banner"}>
      <div className="install-banner-copy">
        <span className="install-banner-kicker">
          <Download size={13} />
          {installStatusLabel}
        </span>
        <strong>Install Draftside</strong>
        <span>Install once and keep writing offline.</span>
      </div>
      {installPromptAvailable ? (
        <button type="button" onClick={onInstall}>
          Install
        </button>
      ) : (
        <span className="install-banner-fallback">Browser menu</span>
      )}
    </div>
  );
}
