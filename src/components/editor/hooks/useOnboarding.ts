import { useCallback, useEffect, useState } from "react";
import type { AiStatus, ModelRuntimeInfo } from "../../../lib/types";

const ONBOARDED_KEY = "draftside.onboarded";

interface OnboardedRecord {
  at: number;
  hadApi: boolean;
  availability?: string;
}

interface UseOnboardingParams {
  aiStatus: AiStatus;
  modelInfo: ModelRuntimeInfo;
}

function readRecord(): OnboardedRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardedRecord;
    if (typeof parsed?.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRecord(record: OnboardedRecord) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDED_KEY, JSON.stringify(record));
  } catch {
    // Storage may be unavailable in private mode; ignore.
  }
}

interface BrowserDetection {
  isChromeFamily: boolean;
  isMobile: boolean;
}

function detectBrowser(): BrowserDetection {
  if (typeof navigator === "undefined") return { isChromeFamily: false, isMobile: false };

  const ua = navigator.userAgent || "";
  const uaData = (
    navigator as Navigator & {
      userAgentData?: { brands?: { brand: string }[]; mobile?: boolean };
    }
  ).userAgentData;

  const isMobile = uaData?.mobile ?? /Mobile|Android|iPhone|iPad|iPod/i.test(ua);

  let isChromeFamily = false;
  if (uaData?.brands?.length) {
    isChromeFamily = uaData.brands.some((brand) =>
      /chromium|google chrome|microsoft edge|brave/i.test(brand.brand),
    );
  } else if (/Edg\/|EdgiOS\/|Chrome\/|Chromium\/|CriOS\//.test(ua) && !/Firefox|FxiOS/.test(ua)) {
    isChromeFamily = true;
  }

  return { isChromeFamily, isMobile };
}

export function useOnboarding({ aiStatus, modelInfo }: UseOnboardingParams) {
  const [hasApi, setHasApi] = useState<boolean | null>(null);
  const [isChromeFamily, setIsChromeFamily] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const apiPresent = typeof globalThis !== "undefined" && "LanguageModel" in globalThis;
    setHasApi(apiPresent);
    const browser = detectBrowser();
    setIsChromeFamily(browser.isChromeFamily);
    setIsMobile(browser.isMobile);

    const record = readRecord();
    if (!record) {
      setShouldShow(true);
      return;
    }
    // Re-show if the user previously dismissed without the API and now has it.
    if (!record.hadApi && apiPresent) {
      setShouldShow(true);
      return;
    }
    setShouldShow(false);
  }, []);

  const dismiss = useCallback(() => {
    writeRecord({
      at: Date.now(),
      hadApi: hasApi ?? false,
      availability: modelInfo.availability,
    });
    setShouldShow(false);
  }, [hasApi, modelInfo.availability]);

  const reopen = useCallback(() => {
    setShouldShow(true);
  }, []);

  return {
    shouldShow,
    hasApi,
    isChromeFamily,
    isMobile,
    aiStatus,
    modelInfo,
    dismiss,
    reopen,
  };
}
