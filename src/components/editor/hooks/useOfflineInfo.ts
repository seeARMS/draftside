import { useCallback, useEffect, useState } from "react";
import type { OfflineRuntimeInfo } from "../../../lib/types";
import { getDraftsideCacheStats } from "../../../storage/offline";

const INITIAL_OFFLINE_INFO: OfflineRuntimeInfo = {
  loading: true,
  serviceWorkerSupported: typeof navigator !== "undefined" && "serviceWorker" in navigator,
  controlled: false,
  registrationState: "unknown",
};

export function useOfflineInfo({ online, storagePersisted }: { online: boolean; storagePersisted: boolean | null }) {
  const [offlineInfo, setOfflineInfo] = useState<OfflineRuntimeInfo>(INITIAL_OFFLINE_INFO);

  const refreshOfflineInfo = useCallback(async () => {
    const serviceWorkerSupported = "serviceWorker" in navigator;
    setOfflineInfo((current) => ({ ...current, loading: true, serviceWorkerSupported }));

    let controlled = false;
    let registrationState = serviceWorkerSupported ? "not registered" : "unsupported";

    if (serviceWorkerSupported) {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const worker = registration?.active ?? registration?.installing ?? registration?.waiting;
        controlled = Boolean(navigator.serviceWorker.controller);
        registrationState = worker ? worker.state : registration ? "registered" : "not registered";
      } catch {
        registrationState = "error";
      }
    }

    let storageUsage: number | undefined;
    let storageQuota: number | undefined;
    try {
      if ("storage" in navigator && "estimate" in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        storageUsage = estimate.usage;
        storageQuota = estimate.quota;
      }
    } catch {
      // Storage estimates are informational only.
    }

    let cacheStats: Awaited<ReturnType<typeof getDraftsideCacheStats>> = {};
    try {
      cacheStats = await getDraftsideCacheStats();
    } catch {
      cacheStats = {};
    }

    setOfflineInfo({
      loading: false,
      serviceWorkerSupported,
      controlled,
      registrationState,
      cacheCount: cacheStats.cacheCount,
      cachedRequests: cacheStats.cachedRequests,
      cachedBytes: cacheStats.cachedBytes,
      storageUsage,
      storageQuota,
      checkedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    void refreshOfflineInfo();

    if (!("serviceWorker" in navigator)) return;
    const handleControllerChange = () => void refreshOfflineInfo();
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, [online, refreshOfflineInfo, storagePersisted]);

  return { offlineInfo, refreshOfflineInfo };
}
