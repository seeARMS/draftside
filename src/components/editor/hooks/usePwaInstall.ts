import { useCallback, useEffect, useState } from "react";

type PwaInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(navigatorWithStandalone.standalone);
}

export function usePwaInstall(onPostInstall?: () => void) {
  const [installPrompt, setInstallPrompt] = useState<PwaInstallPromptEvent | null>(null);
  const [pwaInstalled, setPwaInstalled] = useState(isStandalonePwa);

  useEffect(() => {
    setPwaInstalled(isStandalonePwa());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isStandalonePwa()) setInstallPrompt(event as PwaInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setPwaInstalled(true);
    };

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => setPwaInstalled(isStandalonePwa());

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneQuery.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (pwaInstalled) return;

    if (!installPrompt) {
      onPostInstall?.();
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setPwaInstalled(true);
    } finally {
      setInstallPrompt(null);
      onPostInstall?.();
    }
  }, [installPrompt, onPostInstall, pwaInstalled]);

  return { installPrompt, pwaInstalled, install };
}
