import { Download } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";

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
    <div className={cn("mx-3 mt-2 grid shrink-0 gap-2.5 rounded-md bg-muted/60 p-3 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.75)] max-[520px]:mx-2.5", offlineReady && "bg-muted/70")}>
      <div className="grid min-w-0 gap-1">
        <span className="inline-flex w-max max-w-full items-center gap-1.5 font-mono text-[0.6875rem] font-semibold uppercase leading-4 text-muted-foreground">
          <Download size={13} />
          {installStatusLabel}
        </span>
        <strong className="text-sm font-semibold leading-5 text-foreground">Install Draftside</strong>
        <span className="text-xs leading-tight text-muted-foreground">Install once and keep writing offline.</span>
      </div>
      {installPromptAvailable ? (
        <Button type="button" size="sm" onClick={onInstall}>
          Install
        </Button>
      ) : (
        <span className="inline-flex min-h-8 items-center justify-center rounded-md bg-background/70 text-xs font-semibold leading-4 text-muted-foreground">Browser menu</span>
      )}
    </div>
  );
}
