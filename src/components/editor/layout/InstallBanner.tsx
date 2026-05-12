import { Download } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../../lib/utils";
import { Button } from "../../ui/button";

interface InstallBannerProps {
  pwaInstalled: boolean;
  installPromptAvailable: boolean;
  installStatusLabel: string;
  offlineReady: boolean;
  onInstall: () => void;
}

type Platform = "chrome-desktop" | "edge-desktop" | "firefox-desktop" | "safari-desktop" | "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Edg\//.test(ua)) return "edge-desktop";
  if (/Firefox\//.test(ua)) return "firefox-desktop";
  if (/Chrome\//.test(ua)) return "chrome-desktop";
  if (/Safari\//.test(ua)) return "safari-desktop";
  return "other";
}

const INSTRUCTIONS: Record<Platform, { title: string; steps: string[] }> = {
  "chrome-desktop": {
    title: "Install via Chrome",
    steps: [
      "Click the install icon at the right end of the address bar (monitor with a down arrow).",
      "Or open the ⋮ menu → Cast, save, share → Install page as app…",
      "Confirm with Install.",
    ],
  },
  "edge-desktop": {
    title: "Install via Edge",
    steps: [
      "Click the install icon at the right end of the address bar.",
      "Or open the ⋯ menu → Apps → Install Draftside.",
      "Confirm with Install.",
    ],
  },
  "firefox-desktop": {
    title: "Firefox doesn't install PWAs",
    steps: [
      "Firefox on desktop doesn't support installing web apps.",
      "Try Chrome, Edge, or Brave to install Draftside.",
      "Draftside still works fully in this tab.",
    ],
  },
  "safari-desktop": {
    title: "Install via Safari",
    steps: [
      "Open the File menu and choose Add to Dock…",
      "Confirm the name and click Add.",
      "Draftside opens like a native app from the Dock.",
    ],
  },
  ios: {
    title: "Add to Home Screen",
    steps: [
      "Tap the Share button (the square with the arrow) in Safari.",
      "Scroll down and tap Add to Home Screen.",
      "Tap Add in the top-right corner.",
    ],
  },
  android: {
    title: "Install via Chrome",
    steps: [
      "Tap the ⋮ menu at the top right.",
      "Tap Install app, or Add to Home screen.",
      "Confirm with Install.",
    ],
  },
  other: {
    title: "Install instructions",
    steps: [
      "Open your browser's main menu.",
      "Look for Install Draftside, Install app, or Add to Home screen.",
      "Confirm to install.",
    ],
  },
};

export function InstallBanner({ pwaInstalled, installPromptAvailable, installStatusLabel, offlineReady, onInstall }: InstallBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const platform = useMemo(detectPlatform, []);

  useEffect(() => {
    if (!expanded) return;
    const onDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [expanded]);

  if (pwaInstalled) return null;

  const { title, steps } = INSTRUCTIONS[platform];

  return (
    <div ref={containerRef} className={cn("mx-3 mt-2 grid shrink-0 gap-2.5 rounded-md bg-muted/60 p-3 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.75)] max-[520px]:mx-2.5", offlineReady && "bg-muted/70")}>
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
        <div id="install-instructions" className="grid gap-1.5 rounded bg-background/70 p-2.5 text-xs leading-5 text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.6)]">
          <strong className="text-[0.75rem] font-semibold leading-4 text-foreground">{title}</strong>
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
