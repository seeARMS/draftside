import { Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";
import { detectInstallPlatform, INSTALL_INSTRUCTIONS } from "../installInstructions";
import { eyebrowClass } from "../dialogPrimitives";

interface InstallBannerProps {
  pwaInstalled: boolean;
  installPromptAvailable: boolean;
  installStatusLabel: string;
  offlineReady: boolean;
  onInstall: () => void;
}

export function InstallBanner({ pwaInstalled, installPromptAvailable, installStatusLabel, offlineReady, onInstall }: InstallBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const platform = useMemo(detectInstallPlatform, []);

  useEffect(() => {
    if (!expanded) return;
    const onDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [expanded]);

  if (pwaInstalled) return null;

  const { title, steps } = INSTALL_INSTRUCTIONS[platform];

  return (
    <div
      ref={containerRef}
      className={cn(
        "mx-3 mt-2 grid shrink-0 gap-3 rounded-xl bg-muted/50 p-3.5 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.6)] max-[520px]:mx-2.5",
        offlineReady && "bg-muted/60",
      )}
    >
      <div className="grid min-w-0 gap-1.5">
        <span className={cn(eyebrowClass, "inline-flex w-max max-w-full items-center gap-1.5")}>
          <Download size={12} />
          {installStatusLabel}
        </span>
        <strong className="text-[0.9375rem] font-semibold leading-5 text-foreground">Install Draftside</strong>
        <span className="text-[0.8125rem] leading-5 text-muted-foreground">Install once and keep writing offline.</span>
      </div>
      {installPromptAvailable ? (
        <Button type="button" size="sm" onClick={onInstall}>
          Install
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls="install-instructions"
        >
          How to install
        </Button>
      )}
      {expanded && !installPromptAvailable ? (
        <div
          id="install-instructions"
          className="grid gap-2 rounded-lg bg-background/70 p-3 text-[0.8125rem] leading-6 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.5)]"
        >
          <strong className="text-[0.875rem] font-semibold leading-5 text-foreground">{title}</strong>
          <ol className="m-0 grid list-decimal gap-1 pl-4 text-muted-foreground">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
