import { useCallback, useEffect, useState } from "react";

type PwaInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type NavigatorWithRelatedApps = Navigator & {
  getInstalledRelatedApps?: () => Promise<Array<{ platform?: string; url?: string; id?: string }>>;
};

const INSTALLED_STORAGE_KEY = "draftside.pwaInstalled";

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(navigatorWithStandalone.standalone);
}

function readStoredInstalled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(INSTALLED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredInstalled(installed: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (installed) window.localStorage.setItem(INSTALLED_STORAGE_KEY, "true");
    else window.localStorage.removeItem(INSTALLED_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function usePwaInstall(onPostInstall?: () => void) {
  const [installPrompt, setInstallPrompt] = useState<PwaInstallPromptEvent | null>(null);
  const [pwaInstalled, setPwaInstalled] = useState(() => isStandalonePwa() || readStoredInstalled());

  useEffect(() => {
    let cancelled = false;
    const markInstalled = () => {
      if (cancelled) return;
      setPwaInstalled(true);
      setInstallPrompt(null);
      writeStoredInstalled(true);
    };

    if (isStandalonePwa()) markInstalled();

    const nav = window.navigator as NavigatorWithRelatedApps;
    nav.getInstalledRelatedApps?.()
      .then((apps) => {
        if (apps.length > 0) markInstalled();
      })
      .catch(() => {
        // ignore — API is best-effort and unsupported elsewhere
      });

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!isStandalonePwa()) setInstallPrompt(event as PwaInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      markInstalled();
    };

    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => {
      if (isStandalonePwa()) markInstalled();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneQuery.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      cancelled = true;
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
      if (choice.outcome === "accepted") {
        setPwaInstalled(true);
        writeStoredInstalled(true);
      }
    } finally {
      setInstallPrompt(null);
      onPostInstall?.();
    }
  }, [installPrompt, onPostInstall, pwaInstalled]);

  return { installPrompt, pwaInstalled, install };
}
